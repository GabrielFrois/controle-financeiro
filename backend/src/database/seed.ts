import pool from './index.js';
import bcrypt from 'bcrypt';

async function seed() {
  const client = await pool.connect();

  const adminName     = process.env.ADMIN_NAME     ?? 'Admin';
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'senha123';
  const adminHash     = await bcrypt.hash(adminPassword, 12);

  try {
    await client.query('BEGIN');

    await client.query(`
      INSERT INTO users (name, username, password_hash, color, role, active)
      VALUES ($1, $2, $3, '#1976d2', 'admin', TRUE)
      ON CONFLICT (username) DO UPDATE
        SET name          = EXCLUDED.name,
            password_hash = EXCLUDED.password_hash,
            role          = 'admin',
            active        = TRUE
    `, [adminName, adminUsername, adminHash]);

    await client.query('COMMIT');
    console.log('>>> seed: admin garantido.');
    console.log(`    Login: ${adminUsername} / (senha do .env)`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('>>> Erro no seed:', e);
  } finally {
    client.release();
    process.exit();
  }
}

seed();