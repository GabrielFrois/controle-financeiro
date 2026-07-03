/**
 * seed-demo.ts — apaga e recria apenas os dados de demonstração
 * (José, Maria, família e transações de exemplo)
 * uso: npm run seed:demo
 */
import pool from './index.js';
import bcrypt from 'bcrypt';

const DEMO_EMAILS = ['jose@demo.com', 'maria@demo.com'];
const DEMO_PASSWORD = 'demo123';

const getDate = (monthsAgo: number, day: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().split('T')[0];
};

async function seedDemo() {
  const client = await pool.connect();
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  try {
    await client.query('BEGIN');

    // 1. Busca IDs dos usuários demo que já existem (se houver)
    const existing = await client.query(
      `SELECT id FROM users WHERE email = ANY($1)`,
      [DEMO_EMAILS]
    );
    const existingIds = existing.rows.map((r: { id: number }) => r.id);

    // 2. Remove dados vinculados a eles na ordem correta
    if (existingIds.length > 0) {
      await client.query(`DELETE FROM transactions   WHERE user_id = ANY($1)`, [existingIds]);
      await client.query(`DELETE FROM family_members WHERE user_id = ANY($1)`, [existingIds]);
    }

    // Remove famílias demo órfãs (sem membros)
    await client.query(`
      DELETE FROM families
      WHERE id NOT IN (SELECT DISTINCT family_id FROM family_members)
    `);

    // Remove os usuários demo
    await client.query(`DELETE FROM users WHERE email = ANY($1)`, [DEMO_EMAILS]);

    // 3. Recria José
    const joseRes = await client.query(`
      INSERT INTO users (name, email, password_hash, color, role, active)
      VALUES ('José', 'jose@demo.com', $1, '#2e7d32', 'member', TRUE)
      RETURNING id
    `, [demoHash]);
    const joseId: number = joseRes.rows[0].id;

    // 4. Recria Maria
    const mariaRes = await client.query(`
      INSERT INTO users (name, email, password_hash, color, role, active)
      VALUES ('Maria', 'maria@demo.com', $1, '#c62828', 'member', TRUE)
      RETURNING id
    `, [demoHash]);
    const mariaId: number = mariaRes.rows[0].id;

    // 5. Carrega categorias e métodos existentes
    const catRes  = await client.query('SELECT id, name FROM categories');
    const catMap: Record<string, number> = {};
    for (const row of catRes.rows) catMap[row.name] = row.id;

    const methRes = await client.query('SELECT id, name FROM payment_methods');
    const methMap: Record<string, number> = {};
    for (const row of methRes.rows) methMap[row.name] = row.id;

    // 6. Transações de exemplo (6 meses)
    const txs: Array<{ uid: number; cat: string; pay: string; desc: string; val: number; type: string; date: string }> = [];
    for (let i = 5; i >= 0; i--) {
      txs.push(
        { uid: joseId,  cat: 'Salário',           pay: 'Pix',           desc: 'Salário Mensal',    val: 5200, type: 'INCOME',  date: getDate(i, 5)  },
        { uid: mariaId, cat: 'Salário',           pay: 'Pix',           desc: 'Salário Mensal',    val: 4800, type: 'INCOME',  date: getDate(i, 5)  },
        { uid: joseId,  cat: 'Aluguel',           pay: 'Transferência', desc: 'Aluguel Ap',        val: 1800, type: 'EXPENSE', date: getDate(i, 10) },
        { uid: mariaId, cat: 'Supermercado',      pay: 'Crédito',       desc: 'Compras do Mês',    val: 950,  type: 'EXPENSE', date: getDate(i, 12) },
        { uid: joseId,  cat: 'Combustível',       pay: 'Débito',        desc: 'Combustível',       val: 280,  type: 'EXPENSE', date: getDate(i, 14) },
        { uid: mariaId, cat: 'Plano de Saúde',    pay: 'Crédito',       desc: 'Plano de Saúde',    val: 420,  type: 'EXPENSE', date: getDate(i, 8)  },
        { uid: joseId,  cat: 'Assinaturas',       pay: 'Crédito',       desc: 'Streaming / Lazer', val: 150,  type: 'EXPENSE', date: getDate(i, 20) },
        { uid: mariaId, cat: 'Cursos/Treinamentos', pay: 'Pix',         desc: 'Curso Online',      val: 200,  type: 'EXPENSE', date: getDate(i, 18) },
      );
    }

    for (const t of txs) {
      if (!catMap[t.cat] || !methMap[t.pay]) continue;
      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date, investment_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'OUTROS')`,
        [t.desc, t.val, t.type, t.uid, catMap[t.cat], methMap[t.pay], t.date]
      );
    }

    // 7. Família demo
    const famRes = await client.query(
      `INSERT INTO families (name) VALUES ('Família Demo') RETURNING id`
    );
    const familyId: number = famRes.rows[0].id;
    await client.query(
      `INSERT INTO family_members (family_id, user_id) VALUES ($1,$2),($1,$3)`,
      [familyId, joseId, mariaId]
    );

    await client.query('COMMIT');
    console.log('>>> seed:demo concluído! Dados de demo resetados.');
    console.log(`    jose@demo.com  / demo123`);
    console.log(`    maria@demo.com / demo123`);
    console.log(`    Família "Família Demo": José + Maria`);
    console.log(`    (admin e seus dados não foram alterados)`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('>>> Erro no seed:demo:', e);
  } finally {
    client.release();
    process.exit();
  }
}

seedDemo();