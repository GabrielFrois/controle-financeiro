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
app.get('/api/health', async (_req, res) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// Rotas
app.use('/api/auth',            authRouter);

app.use('/api/users',           usersRouter);
app.use('/api/families',        familiesRouter);
app.use('/api/categories',      categoriesRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/transactions',    transactionsRouter);
app.use('/api/budgets',         budgetsRouter);
app.use('/api/assets',          assetsRouter);
app.use('/api/profile',         profileRouter);

app.get('/api/credit-card/invoice', authenticate, getInvoice);
app.get('/api/summary',             authenticate, getSummary);

// Na Vercel (Services) o Express é usado como um handler de requisição, não
// como um servidor de longa duração — o import do módulo não deve abrir uma
// porta. Fora da Vercel (dev local, outros PaaS), sobe normalmente.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`>>> Backend rodando em http://localhost:${PORT}`);
  });
}

export default app;