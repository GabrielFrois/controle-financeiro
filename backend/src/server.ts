import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './database/index.js';

import usersRouter          from './routes/users.routes.js';
import categoriesRouter     from './routes/categories.routes.js';
import paymentMethodsRouter from './routes/paymentMethods.routes.js';
import transactionsRouter   from './routes/transactions.routes.js';
import budgetsRouter        from './routes/budgets.routes.js';
import assetsRouter         from './routes/assets.routes.js';
import { getInvoice }       from './controllers/invoice.controller.js';
import { getSummary }       from './controllers/summary.controller.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware global ───────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [];

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisições sem origin (Postman, curl) e origens explicitamente listadas
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origem não permitida — ${origin}`));
    }
  },
}));

app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/users',           usersRouter);
app.use('/categories',      categoriesRouter);
app.use('/payment-methods', paymentMethodsRouter);
app.use('/transactions',    transactionsRouter);
app.use('/budgets',         budgetsRouter);
app.use('/assets',          assetsRouter);
app.get('/credit-card/invoice', getInvoice);
app.get('/summary',             getSummary);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});