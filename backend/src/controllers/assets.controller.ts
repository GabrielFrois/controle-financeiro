import { Request, Response } from 'express';
import axios from 'axios';
import { query } from '../database/index.js';

// ─── ticker alias map ────────────────────────────────────────────────────────
const TICKER_MAP: Record<string, string> = {
  TSMC:  'TSMC34',
  TMC:   'TSMC34',
  APPLE: 'AAPL34',
};

function getApiTicker(ticker: string): string {
  const t = ticker.trim().toUpperCase();
  return TICKER_MAP[t] ?? t;
}

// ─── handlers ───────────────────────────────────────────────────────────────

export async function listAssets(req: Request, res: Response) {
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
    res.json({ status: 'ok' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar preço do ativo' });
  }
}

export async function getAssetPrices(req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT DISTINCT a.ticker, t.investment_type
       FROM assets a
       JOIN transactions t ON t.asset_id = a.id
       WHERE a.ticker IS NOT NULL`
    );
    const assets: { ticker: string; investment_type: string }[] = result.rows;
    const prices: Record<string, number> = {};
    const hgToken = process.env.HG_TOKEN;

    // 1. CDI diário (Banco Central)
    try {
      const bcbRes = await axios.get(
        'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json'
      );
      prices['GLOBAL_CDI'] = parseFloat(bcbRes.data[0].valor) / 100;
    } catch {
      console.error('[BCB] Erro ao buscar CDI, usando fallback');
      prices['GLOBAL_CDI'] = 0.0004;
    }

    // 2. Câmbio (HG Brasil) com fallback
    prices['USDBRL'] = 5.7;
    prices['EURBRL'] = 6.2;
    prices['GBPBRL'] = 7.2;
    try {
      const fxRes = await axios.get(`https://api.hgbrasil.com/finance?format=1&key=${hgToken}`);
      const currencies = fxRes.data?.results?.currencies;
      if (currencies) {
        if (currencies.USD) prices['USDBRL'] = parseFloat(currencies.USD.buy);
        if (currencies.EUR) prices['EURBRL'] = parseFloat(currencies.EUR.buy);
        if (currencies.GBP) prices['GBPBRL'] = parseFloat(currencies.GBP.buy);
      }
    } catch {
      console.error('[HG Câmbio] Erro, usando fallback');
    }

    // 3. Ações, FIIs, BDRs e Internacional (HG Brasil)
    const stockAssets = assets.filter((a) =>
      ['ACOES', 'FII', 'INTERNACIONAL', 'OUTROS'].includes(a.investment_type)
    );
    if (stockAssets.length > 0) {
      const tickers = [...new Set(stockAssets.map((a) => getApiTicker(a.ticker)))];
      try {
        const stockRes = await axios.get(
          `https://api.hgbrasil.com/finance/stock_price?key=${hgToken}&symbol=${tickers.join(',')}`
        );
        const stockData = stockRes.data?.results;
        if (stockData) {
          for (const asset of stockAssets) {
            const apiTicker = getApiTicker(asset.ticker);
            const quote = stockData[apiTicker];
            if (quote?.price) prices[asset.ticker] = parseFloat(quote.price);
          }
        }
      } catch (err) {
        console.error('[HG Ações] Erro ao buscar cotações:', err);
      }
    }

    // 4. Criptomoedas (HG Brasil, individual)
    const cryptoAssets = assets.filter((a) => a.investment_type === 'CRIPTOS');
    for (const asset of cryptoAssets) {
      const ticker = asset.ticker.trim().toUpperCase();
      try {
        const cRes = await axios.get(
          `https://api.hgbrasil.com/finance/stock_price?key=${hgToken}&symbol=${ticker}`
        );
        const quote = cRes.data?.results?.[ticker];
        if (quote?.price) prices[ticker] = parseFloat(quote.price);
      } catch {
        console.error(`[HG Cripto] Erro em ${ticker}`);
      }
    }

    res.json(prices);
  } catch (err) {
    console.error('[Preços] Erro crítico:', err);
    res.status(500).json({ error: 'Erro interno ao buscar preços' });
  }
}