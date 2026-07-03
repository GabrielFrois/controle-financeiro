import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { query } from './database/index.js';
import { authenticate } from './middleware/auth.js';
import profileRouter       from './routes/profile.routes.js';

import authRouter           from './routes/auth.routes.js';
import usersRouter          from './routes/users.routes.js';
import familiesRouter       from './routes/families.routes.js';
import categoriesRouter     from './routes/categories.routes.js';
import paymentMethodsRouter from './routes/paymentMethods.routes.js';
import transactionsRouter   from './routes/transactions.routes.js';
import budgetsRouter        from './routes/budgets.routes.js';
import assetsRouter         from './routes/assets.routes.js';
import { getInvoice }       from './controllers/invoice.controller.js';
import { getSummary }       from './controllers/summary.controller.js';

dotenv.config();

// Validação obrigatória de variáveis de ambiente
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não está definido. O servidor não pode iniciar.');
  process.exit(1);
}

if (!process.env.ALLOWED_ORIGINS) {
  console.warn('AVISO: ALLOWED_ORIGINS não está definido. CORS aceitará qualquer origem.');
}

const app  = express();
const PORT = process.env.PORT || 3000;

// Na Vercel (e na maioria dos PaaS) a aplicação roda atrás de um único proxy
// reverso, que seta X-Forwarded-For corretamente. Sem isso, req.ip retorna o
// IP interno do proxy, quebrando o rate limiting por IP e a auditoria de login.
app.set('trust proxy', 1);

// Headers de segurança (Helmet)
app.use(helmet());

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) ?? [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origem não permitida — ${origin}`));
    }
  },
}));

app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// Rotas
app.use('/auth',            authRouter);

app.use('/users',           usersRouter);
app.use('/families',        familiesRouter);
app.use('/categories',      categoriesRouter);
app.use('/payment-methods', paymentMethodsRouter);
app.use('/transactions',    transactionsRouter);
app.use('/budgets',         budgetsRouter);
app.use('/assets',          assetsRouter);
app.use('/profile',         profileRouter);

app.get('/credit-card/invoice', authenticate, getInvoice);
app.get('/summary',             authenticate, getSummary);

app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});