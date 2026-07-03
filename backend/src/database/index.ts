import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL não está definido. O servidor não pode iniciar.');
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL obrigatório em produção (Supabase, Railway, Render, etc.)
  ssl: isProduction ? { rejectUnauthorized: true } : false,
  // Limite de conexões simultâneas ao banco
  max: 10,
  // Tempo máximo aguardando uma conexão do pool (ms)
  connectionTimeoutMillis: 5000,
  // Tempo máximo de uma query inativa antes de fechar a conexão (ms)
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool de conexões:', err.message);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
export default pool;