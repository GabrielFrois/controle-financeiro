import pool from './index.js';

async function clearDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(">>> Limpando dados de exemplo...");

    await client.query('TRUNCATE transactions, users RESTART IDENTITY CASCADE');

    await client.query('COMMIT');
    console.log(">>> Banco de dados limpo com sucesso!");
    console.log(">>> Categorias e Métodos de Pagamento foram preservados.");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(">>> Erro ao limpar banco de dados:", e);
  } finally {
    client.release();
    process.exit();
  }
}

clearDatabase();