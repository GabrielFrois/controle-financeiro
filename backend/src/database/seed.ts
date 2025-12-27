import pool from './index.js';

const demoData = {
  users: [{ name: "Gabriel" }, { name: "Klara" }],
  transactions: [
    { user: 'Gabriel', cat: 'Salário', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME' },
    { user: 'Klara', cat: 'Salário', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME' },
    { user: 'Gabriel', cat: 'Aluguel', desc: 'Aluguel Apartamento', val: 1200.00, type: 'EXPENSE' },
    { user: 'Klara', cat: 'Condomínio', desc: 'Condomínio Klara', val: 450.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Energia Elétrica', desc: 'Conta de Luz', val: 185.20, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Supermercado', desc: 'Compras do Mês', val: 840.50, type: 'EXPENSE' },
    { user: 'Klara', cat: 'Supermercado', desc: 'Feira Semanal', val: 120.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Freelance/Projetos', desc: 'Landing Page Cliente X', val: 1200.00, type: 'INCOME' },
    { user: 'Klara', cat: 'Internet/Celular', desc: 'Plano Controle', val: 99.90, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Restaurante', desc: 'Jantar de Sábado', val: 150.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Combustível', desc: 'Posto Shell', val: 250.00, type: 'EXPENSE' },
    { user: 'Klara', cat: 'Academia/Esportes', desc: 'Mensalidade Academia', val: 110.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Assinaturas', desc: 'Netflix + Spotify', val: 75.80, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Pet: Ração', desc: 'Ração 15kg Dog', val: 230.00, type: 'EXPENSE' },
    { user: 'Klara', cat: 'Lanches/Cafés', desc: 'Starbucks', val: 25.50, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Investimentos - Dividendos', desc: 'Proventos FIIs', val: 45.20, type: 'INCOME' },
    { user: 'Gabriel', cat: 'Investimentos - Aporte', desc: 'Aporte Mensal Bolsa', val: 1000.00, type: 'EXPENSE' },
    { user: 'Klara', cat: 'Farmácia', desc: 'Remédios e Vitaminas', val: 85.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Delivery', desc: 'iFood Burguer', val: 65.00, type: 'EXPENSE' },
    { user: 'Gabriel', cat: 'Hobby', desc: 'Jogo na Steam', val: 120.00, type: 'EXPENSE' }
  ]
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Inseri Usuários e mapeia IDs
    const userMap: Record<string, number> = {};
    for (const u of demoData.users) {
      const res = await client.query(
        'INSERT INTO users (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',
        [u.name]
      );
      const id = res.rows.length > 0 ? res.rows[0].id : (await client.query('SELECT id FROM users WHERE name = $1', [u.name])).rows[0].id;
      userMap[u.name] = id;
    }

    // Mapeia IDs das Categorias já existentes
    const catRows = await client.query('SELECT id, name FROM categories');
    const catMap: Record<string, number> = {};
    catRows.rows.forEach(row => catMap[row.name] = row.id);

    // Inseri Transações de Exemplo
    console.log(">>> Populando banco com dados de exemplo...");
    await client.query('DELETE FROM transactions');

    for (const t of demoData.transactions) {
      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, date) 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [t.desc, t.val, t.type, userMap[t.user], catMap[t.cat]]
      );
    }

    await client.query('COMMIT');
    console.log(">>> Seed de exemplo concluído!");
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(">>> Erro no seed:", e);
  } finally {
    client.release();
    process.exit();
  }
}

seed();