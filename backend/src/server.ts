import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './database/index.js';
import { randomUUID } from 'crypto';
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Função auxiliar para evitar estouro de limite da Alpha Vantage (5 req/min)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Rota: Diagnóstico ---
app.get('/health', async (req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// --- Rotas: Usuários ---
app.get('/users', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.post('/users', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório.' });
  try {
    const sql = 'INSERT INTO users (name, color, active) VALUES ($1, $2, TRUE) RETURNING *';
    const result = await query(sql, [name, color || '#1976d2']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color, active } = req.body;
  try {
    const sql = 'UPDATE users SET name = $1, color = $2, active = $3 WHERE id = $4 RETURNING *';
    const result = await query(sql, [name, color, active !== undefined ? active : true, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar usuário' });
  }
});

// --- Rotas: Categorias ---
app.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

app.post('/categories', async (req, res) => {
  const { name, type, color } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
  try {
    const sql = 'INSERT INTO categories (name, type, color, active) VALUES ($1, $2, $3, TRUE) RETURNING *';
    const result = await query(sql, [name, type, color || '#9e9e9e']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

app.put('/categories/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, color, active } = req.body;
  try {
    const sql = 'UPDATE categories SET name = $1, type = $2, color = $3, active = $4 WHERE id = $5 RETURNING *';
    const result = await query(sql, [name, type, color, active !== undefined ? active : true, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

app.delete('/categories/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('UPDATE categories SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar categoria' });
  }
});

// --- Rotas: Métodos de Pagamento ---
app.get('/payment-methods', async (req, res) => {
  try {
    const result = await query('SELECT * FROM payment_methods ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
  }
});

// --- Rotas: Transações ---

// Listar Transações
app.get('/transactions', async (req, res) => {
  try {
    const sql = `
      SELECT 
        t.*, 
        COALESCE(u.name, 'Inativo') as user_name, 
        COALESCE(u.color, '#9e9e9e') as user_color, 
        COALESCE(c.name, 'Inativa') as category_name, 
        COALESCE(c.color, '#9e9e9e') as category_color, 
        COALESCE(p.name, 'Pix') as payment_method_name,
        a.ticker as asset_ticker,
        a.manual_price
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      LEFT JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC, t.id DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
});

// Criar Transação
app.post('/transactions', async (req, res) => {
  const {
    description, amount, type, category_id, user_id,
    date, payment_method_id, installments, asset_ticker, quantity,
    investment_type, yield_rate
  } = req.body;

  if (!description || !amount || !type || !category_id || !user_id || !date || !payment_method_id) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    let assetId = null;
    if (asset_ticker && asset_ticker.trim() !== '') {
      const tickerUpper = asset_ticker.trim().toUpperCase();
      const assetResult = await query(
        `INSERT INTO assets (ticker) VALUES ($1) ON CONFLICT (ticker) DO UPDATE SET ticker = EXCLUDED.ticker RETURNING id`,
        [tickerUpper]
      );
      assetId = assetResult.rows[0].id;
    }

    const numInstallments = parseInt(installments) || 1;
    const installmentValue = parseFloat(amount) / numInstallments;
    const baseDate = new Date(date);
    const groupId = numInstallments > 1 ? randomUUID() : null;

    const createdTransactions = [];

    for (let i = 0; i < numInstallments; i++) {
      const currentLabel = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';
      const installmentDate = new Date(baseDate);
      installmentDate.setUTCDate(1);
      installmentDate.setUTCMonth(baseDate.getUTCMonth() + i);
      const lastDay = new Date(Date.UTC(installmentDate.getUTCFullYear(), installmentDate.getUTCMonth() + 1, 0)).getUTCDate();
      installmentDate.setUTCDate(Math.min(baseDate.getUTCDate(), lastDay));

      const sql = `
        INSERT INTO transactions (
          description, amount, type, user_id, category_id, 
          date, payment_method_id, asset_id, quantity, installment_group_id,
          investment_type, yield_rate -- <-- Novo campo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const values = [
        `${description}${currentLabel}`,
        installmentValue,
        type,
        user_id,
        category_id,
        installmentDate.toISOString().split('T')[0],
        payment_method_id,
        assetId,
        quantity ? parseFloat(quantity) : null,
        groupId,
        investment_type || 'OUTROS',
        yield_rate ? parseFloat(yield_rate) : null
      ];

      const result = await query(sql, values);
      createdTransactions.push(result.rows[0]);
    }

    res.status(201).json(createdTransactions[0]);
  } catch (err) {
    console.error("Erro ao salvar transação:", err);
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// Editar Transação Individual
app.put('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  const {
    description, amount, type, category_id, user_id,
    date, payment_method_id, investment_type, yield_rate,
    asset_ticker, quantity
  } = req.body;

  try {
    // Lógica para buscar ou criar o Ativo
    let assetId = null;

    // Se vier um ticker preenchido, buscamos/criamos o ID
    if (asset_ticker && asset_ticker.trim() !== '') {
      const tickerUpper = asset_ticker.trim().toUpperCase();
      const assetResult = await query(
        `INSERT INTO assets (ticker) VALUES ($1) ON CONFLICT (ticker) DO UPDATE SET ticker = EXCLUDED.ticker RETURNING id`,
        [tickerUpper]
      );
      assetId = assetResult.rows[0].id;
    }

    // Query de Update 
    const sql = `
      UPDATE transactions 
      SET description = $1, amount = $2, type = $3, category_id = $4, 
          user_id = $5, date = $6, payment_method_id = $7, 
          investment_type = $8, yield_rate = $9,
          asset_id = $10, quantity = $11
      WHERE id = $12
      RETURNING *
    `;

    const values = [
      description,
      amount,
      type,
      category_id,
      user_id,
      date,
      payment_method_id,
      investment_type || 'OUTROS',
      yield_rate ? parseFloat(yield_rate) : null,
      assetId,
      quantity ? parseFloat(quantity) : null,
      id
    ];

    const result = await query(sql, values);
    res.json(result.rows[0]);

  } catch (err) {
    console.error("Erro no PUT /transactions:", err);
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
});

// Editar Grupo de Transações (Parcelas)
app.put('/transactions/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  const {
    description, amount, type, category_id, user_id,
    payment_method_id, referer_date, investment_type, yield_rate
  } = req.body;

  try {
    const sql = `
      UPDATE transactions 
      SET description = $1, amount = $2, type = $3, category_id = $4, 
          user_id = $5, payment_method_id = $6, investment_type = $7, yield_rate = $8
      WHERE installment_group_id = $9 AND date >= $10
      RETURNING *
    `;
    const values = [description, amount, type, category_id, user_id, payment_method_id, investment_type || 'OUTROS', yield_rate, groupId, referer_date];
    const result = await query(sql, values);

    res.json({ message: `${result.rowCount} parcelas atualizadas com sucesso.`, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar grupo de parcelas' });
  }
});

// Deletar Transação
app.delete('/transactions/group/:groupId', async (req, res) => {
  const { groupId } = req.params;
  try {
    await query('DELETE FROM transactions WHERE installment_group_id = $1', [groupId]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar grupo de parcelas' });
  }
});

app.delete('/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
});

// --- Rotas: Metas ---
app.get('/budgets', async (req, res) => {
  try {
    const sql = `
      SELECT b.*, c.name as category_name 
      FROM budgets b 
      JOIN categories c ON b.category_id = c.id
      ORDER BY b.period DESC, c.name ASC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
});

app.post('/budgets', async (req, res) => {
  const { category_id, amount, period } = req.body;
  try {
    const sql = `
      INSERT INTO budgets (category_id, amount, period) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (category_id, period) 
      DO UPDATE SET amount = EXCLUDED.amount 
      RETURNING *
    `;
    const result = await query(sql, [category_id, amount, period]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar meta' });
  }
});

// Editar Meta
app.put('/budgets/:id', async (req, res) => {
  const { id } = req.params;
  const { category_id, amount, period } = req.body;
  try {
    const sql = `
      UPDATE budgets 
      SET category_id = $1, amount = $2, period = $3 
      WHERE id = $4 
      RETURNING *
    `;
    const result = await query(sql, [category_id, amount, period, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Meta não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
});

// Deletar meta
app.delete('/budgets/:id', async (req, res) => {
  try {
    await query('DELETE FROM budgets WHERE id = $1', [req.params.id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar meta' });
  }
});

// --- Rota Principal de Preços ---
app.get('/assets/prices', async (req, res) => {
  try {
    const result = await query('SELECT DISTINCT ticker, investment_type FROM assets a JOIN transactions t ON t.asset_id = a.id WHERE ticker IS NOT NULL');
    const assets = result.rows;
    const prices: Record<string, number> = {};
    const brapiToken = process.env.BRAPI_TOKEN;

    // Busca CDI (BANCO CENTRAL)
    try {
      // Série 12 é a taxa CDI diária
      const bcbRes = await axios.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json');
      const cdiDiario = parseFloat(bcbRes.data[0].valor) / 100;
      prices['GLOBAL_CDI'] = cdiDiario;
      console.log(`[BCB] CDI Diário: ${cdiDiario}%`);
    } catch (e) {
      console.error("[BCB] Erro ao buscar CDI, usando fallback de 0.04% ao dia");
      prices['GLOBAL_CDI'] = 0.0004;
    }

    // Dólar via AwesomeAPI
    let usdToBrl = 5.40;
    try {
      const exchangeRes = await axios.get('https://economia.awesomeapi.com.br/last/USD-BRL');
      usdToBrl = parseFloat(exchangeRes.data.USDBRL.bid);
      console.log(`[Câmbio] Dólar: R$ ${usdToBrl}`);
    } catch (e) {
      console.error("[Câmbio] Erro na AwesomeAPI, usando 5.40 como fallback");
    }

    // Define cotação para tickers de moeda
    prices['DOLAR'] = usdToBrl;
    prices['USDBRL'] = usdToBrl;

    // Grupo de Ações/FIIs/BDRs (Brapi)
    // Filtramos CRIPTOS e os tickers da moeda (DOLAR/USDBRL)
    const stockAssets = assets.filter(a =>
      a.investment_type !== 'CRIPTOS' &&
      a.ticker !== 'DOLAR' &&
      a.ticker !== 'USDBRL'
    );

    if (stockAssets.length > 0) {
      // Adiciona .SA se for BDR (termina em 34) ou se não tiver ponto (ações comuns)
      const tickers = stockAssets.map(a => {
        const t = a.ticker.trim().toUpperCase();
        return (t.endsWith('34') || !t.includes('.')) ? `${t}.SA` : t;
      });

      try {
        console.log(`[Brapi] Lote: ${tickers.join(',')}`);
        const response = await axios.get(`https://brapi.dev/api/quote/${tickers.join(',')}?token=${brapiToken}`);

        response.data.results.forEach((r: any) => {
          if (r.regularMarketPrice) {
            // Removemos o .SA do símbolo de retorno para bater com o ticker original do banco
            const originalTicker = r.symbol.replace('.SA', '');
            prices[originalTicker] = (r.currency === 'USD') ? r.regularMarketPrice * usdToBrl : r.regularMarketPrice;
          }
        });
      } catch (err) {
        console.warn("[Brapi] Lote falhou. Tentando busca individual...");
        for (const asset of stockAssets) {
          try {
            const r = await axios.get(`https://brapi.dev/api/quote/${asset.ticker}?token=${brapiToken}`);
            const data = r.data.results[0];
            if (data.regularMarketPrice) {
              prices[asset.ticker] = (data.currency === 'USD') ? data.regularMarketPrice * usdToBrl : data.regularMarketPrice;
            }
          } catch (e) { console.error(`[Brapi] Erro no ticker: ${asset.ticker}`); }
        }
      }
    }

    // Criptos (Brapi + CoinMarketCap Fallback)
    const cryptoAssets = assets.filter(a => a.investment_type === 'CRIPTOS');
    for (const asset of cryptoAssets) {
      const ticker = asset.ticker.trim().toUpperCase();
      try {
        const bRes = await axios.get(`https://brapi.dev/api/v2/crypto?coin=${ticker}&token=${brapiToken}`);
        prices[ticker] = bRes.data.coins[0].regularMarketPrice;
      } catch (e) {
        if (process.env.CMC_PRO_API_KEY) {
          try {
            const cmcRes = await axios.get(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${ticker}&convert=BRL`, {
              headers: { 'X-CMC_PRO_API_KEY': process.env.CMC_PRO_API_KEY }
            });
            prices[ticker] = cmcRes.data.data[ticker].quote.BRL.price;
          } catch (err) { console.error(`[CMC] Erro em ${ticker}`); }
        }
      }
    }

    // Alpha Vantage Fallback (Apenas ativos internacionais que a Brapi não resolveu)
    const pendingIntl = stockAssets.filter(a => a.investment_type === 'INTERNACIONAL' && !prices[a.ticker]);
    for (const asset of pendingIntl) {
      try {
        let searchTicker = asset.ticker.toUpperCase();

        // Converte BDR para Ticker Americano
        if (searchTicker.endsWith('34')) {
          searchTicker = searchTicker.replace('34', ''); // Ex: TSMC34 -> TSMC
        }

        // Mapeamento manual para casos onde o nome muda (ex: TSMC em NY é apenas TSM)
        const manualMapping: Record<string, string> = {
          'TSMC': 'TSM',
          'APPLE': 'AAPL',
          'GOGL': 'GOOGL'
        };
        if (manualMapping[searchTicker]) searchTicker = manualMapping[searchTicker];

        console.log(`[AlphaVantage] Traduzido: ${asset.ticker} -> ${searchTicker}`);

        const avRes = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${searchTicker}&apikey=${process.env.ALPHA_VANTAGE_KEY}`);
        const priceUSD = parseFloat(avRes.data["Global Quote"]?.["05. price"]);

        if (!isNaN(priceUSD)) {
          prices[asset.ticker] = priceUSD * usdToBrl;
          await delay(12000);
        }
      } catch (e) {
        console.error(`[AlphaVantage] Falha em ${asset.ticker}`);
      }
    }

    res.json(prices);
  } catch (err) {
    console.error("[Preços] Erro geral:", err);
    res.status(500).json({ error: 'Erro ao buscar cotações' });
  }
});

// --- Resto das Rotas ---
app.get('/assets', async (req, res) => {
  try {
    const result = await query('SELECT * FROM assets ORDER BY ticker ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar ativos' });
  }
});

app.get('/summary', async (req, res) => {
  const { month, year } = req.query;
  let sql = `
    SELECT 
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense
    FROM transactions
  `;
  const values = [];
  if (month && year) {
    sql += ` WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2`;
    values.push(month, year);
  } else if (year) {
    sql += ` WHERE EXTRACT(YEAR FROM date) = $1`;
    values.push(year);
  }

  try {
    const result = await query(sql, values);
    const { total_income, total_expense } = result.rows[0];
    const income = parseFloat(total_income || 0);
    const expense = parseFloat(total_expense || 0);
    res.json({ income, expense, balance: income - expense });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
});

// Atualizar Preço Médio Manual do Ativo
app.put('/assets/price', async (req, res) => {
  const { ticker, price } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Ticker obrigatório' });

  try {
    const val = price && parseFloat(price) > 0 ? parseFloat(price) : null;

    await query('UPDATE assets SET manual_price = $1 WHERE ticker = $2', [val, ticker]);
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar preço ativo' });
  }
});

app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});