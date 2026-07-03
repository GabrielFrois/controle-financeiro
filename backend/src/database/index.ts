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
  // O pooler do Supabase (PgBouncer) apresenta uma cadeia de certificado que
  // o Node não reconhece por padrão, então validamos apenas que a conexão é
  // criptografada (SSL), sem checar a cadeia contra uma CA — o mesmo padrão
  // recomendado pelo Supabase para conexões via pooler em ambientes serverless.
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  // Em serverless (Vercel), cada instância da função mantém seu próprio pool.
  // Use a connection string do POOLER do Supabase (porta 6543) em produção e
  // mantenha "max" baixo aqui — quem já faz o pooling pesado é o pgbouncer.
  max: process.env.VERCEL ? 1 : 10,
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