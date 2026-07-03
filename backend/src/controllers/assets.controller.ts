import { Request, Response } from 'express';
import axios from 'axios';
import { query } from '../database/index.js';

// ─── cache em memória (15 minutos) ───────────────────────────────────────────
const CACHE_TTL_MS = 15 * 60 * 1000;
let priceCache: { data: Record<string, number>; fetchedAt: number } | null = null;

// ─── tickers que são câmbio e não devem entrar no loop de ativos ─────────────
const FX_TICKERS = new Set(['USDBRL', 'EURBRL', 'GBPBRL', 'GLOBAL_CDI']);

// ─── BDRs conhecidos que vivem na B3 mas têm investment_type = INTERNACIONAL ─
// Qualquer ticker terminado em número (AAPL34, TSMC34, IVVB11) é BDR da B3.
function isBDR(ticker: string): boolean {
  return /\d$/.test(ticker.trim());
}

// ─── Monta o símbolo correto para o Yahoo Finance ────────────────────────────
function buildYahooSymbol(ticker: string, investmentType: string): string {
  const t = ticker.trim().toUpperCase();

  // BDRs e ativos da B3: sufixo .SA (PETR4 → PETR4.SA, AAPL34 → AAPL34.SA)
  if (['ACOES', 'FII', 'OUTROS', 'Variável'].includes(investmentType) || isBDR(t)) {
    return `${t}.SA`;
  }

  // Criptos: formato SYMBOL-USD (BTC → BTC-USD)
  if (investmentType === 'CRIPTOS') {
    return t.endsWith('-USD') ? t : `${t}-USD`;
  }

  // Internacionais puros (AAPL, MSFT, TSLA): sem sufixo
  return t;
}

async function fetchYahooPrice(yahooSymbol: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=1d`;
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const meta = res.data?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? meta.previousClose ?? null;
    return price ? parseFloat(price) : null;
  } catch (err: any) {
    console.error(`[Yahoo] Erro ao buscar ${yahooSymbol}:`, err?.message ?? err);
    return null;
  }
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function listAssets(_req: Request, res: Response) {
  try {
    const result = await query('SELECT * FROM assets ORDER BY ticker ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar ativos' });
  }
}

export async function updateAssetPrice(req: Request, res: Response) {
  const { ticker, price } = req.body;
  try {
    const val = price && parseFloat(price) > 0 ? parseFloat(price) : null;
    await query(
      `INSERT INTO assets (ticker, manual_price) VALUES ($1, $2)
       ON CONFLICT (ticker) DO UPDATE SET manual_price = EXCLUDED.manual_price`,
      [ticker.trim(), val]
    );
    priceCache = null; // invalida cache ao salvar preço manual
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar preço do ativo' });
  }
}

export async function getAssetPrices(_req: Request, res: Response) {
  try {
    // ── Cache hit ────────────────────────────────────────────────────────────
    if (priceCache && Date.now() - priceCache.fetchedAt < CACHE_TTL_MS) {
      return res.json(priceCache.data);
    }

    // ── Busca ativos do banco ────────────────────────────────────────────────
    const result = await query(`
      SELECT ticker, type AS investment_type
      FROM assets
      WHERE ticker IS NOT NULL AND ticker != ''
      ORDER BY ticker
    `);

    const assets: { ticker: string; investment_type: string }[] = result.rows;
    const prices: Record<string, number> = {};

    // ── 1. CDI diário (Banco Central) ────────────────────────────────────────
    try {
      const bcbRes = await axios.get(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json',
        { timeout: 5000 }
      );
      prices['GLOBAL_CDI'] = parseFloat(bcbRes.data[0].valor) / 100;
    } catch {
      console.error('[BCB] Erro ao buscar CDI, usando fallback');
      prices['GLOBAL_CDI'] = 0.0004;
    }

    // ── 2. Câmbio via Yahoo Finance ──────────────────────────────────────────
    prices['USDBRL'] = 5.7;
    prices['EURBRL'] = 6.2;
    prices['GBPBRL'] = 7.2;

    await Promise.all([
      fetchYahooPrice('USDBRL=X').then((p) => { if (p) prices['USDBRL'] = p; }),
      fetchYahooPrice('EURBRL=X').then((p) => { if (p) prices['EURBRL'] = p; }),
      fetchYahooPrice('GBPBRL=X').then((p) => { if (p) prices['GBPBRL'] = p; }),
    ]);

    // ── 3. Ativos variáveis (exclui câmbio e CDI que já foram buscados) ──────
    const variavelAssets = assets.filter((a) =>
      !FX_TICKERS.has(a.ticker.toUpperCase()) &&
      ['ACOES', 'FII', 'INTERNACIONAL', 'CRIPTOS', 'OUTROS', 'Variável'].includes(a.investment_type)
    );

    // Lotes de 5 em paralelo para evitar rate limit (429) do Yahoo
    const CONCURRENCY = 5;
    for (let i = 0; i < variavelAssets.length; i += CONCURRENCY) {
      const batch = variavelAssets.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (asset) => {
          const yahooSymbol = buildYahooSymbol(asset.ticker, asset.investment_type);
          const price = await fetchYahooPrice(yahooSymbol);
          if (price) {
            prices[asset.ticker] = price;
          } else {
            console.warn(`[Yahoo] Sem preço para ${yahooSymbol} (ticker: ${asset.ticker})`);
          }
        })
      );
    }

    // ── Salva cache e responde ────────────────────────────────────────────────
    priceCache = { data: prices, fetchedAt: Date.now() };
    res.json(prices);
  } catch (err) {
    console.error('[Preços] Erro crítico:', err);
    res.status(500).json({ error: 'Erro interno ao buscar preços' });
  }
}