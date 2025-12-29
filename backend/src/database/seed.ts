import pool from './index.js';

/**
 * Função auxiliar para gerar datas relativas a hoje.
 * @param {number} monthsAgo - Quantos meses subtrair de hoje.
 * @param {number} day - O dia específico do mês desejado.
 */
const getRelativeDate = (monthsAgo: number, day: number) => {
  const d = new Date();
  d.setDate(1); // Primeiro reseta para o dia 1
  d.setMonth(d.getMonth() - monthsAgo);
  
  // Verifica qual o último dia do mês alvo
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth)); // Garante que não passe do limite do mês
  
  return d.toISOString().split('T')[0];
};

const generateTransactions = () => {
  const transactions = [];
  const monthsToSeed = 14;

  for (let i = 0; i <= monthsToSeed; i++) {
    // --- ENTRADAS MENSAIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200.00, type: 'INCOME', date: getRelativeDate(i, 28) },
      { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4700.00, type: 'INCOME', date: getRelativeDate(i, 28) }
    );

    // --- INVESTIMENTOS ---
    if (i % 2 === 0) {
      transactions.push({ user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência', desc: 'Aporte Mensal Bolsa', val: 1000.00, type: 'EXPENSE', date: getRelativeDate(i, 5) });
    } else {
      transactions.push({ user: 'Klara', cat: 'Investimentos - Aporte', pay: 'Transferência', desc: 'Aporte Tesouro', val: 800.00, type: 'EXPENSE', date: getRelativeDate(i, 5) });
    }

    // --- CUSTOS FIXOS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Aluguel', pay: 'Transferência', desc: 'Aluguel Apartamento', val: 1250.00, type: 'EXPENSE', date: getRelativeDate(i, 11) },
      { user: 'Klara', cat: 'Condomínio', pay: 'Transferência', desc: 'Condomínio', val: 480.00, type: 'EXPENSE', date: getRelativeDate(i, 11) },
      { user: 'Gabriel', cat: 'Energia Elétrica', pay: 'Pix', desc: 'Conta de Luz', val: 170 + Math.random() * 50, type: 'EXPENSE', date: getRelativeDate(i, 3) },
      { user: 'Klara', cat: 'Internet/Celular', pay: 'Pix', desc: 'Plano Duo', val: 110.00, type: 'EXPENSE', date: getRelativeDate(i, 10) }
    );

    // --- VARIÁVEIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Compras do Mês', val: 600 + Math.random() * 300, type: 'EXPENSE', date: getRelativeDate(i, 7) },
      { user: 'Klara', cat: 'Farmácia', pay: 'Débito', desc: 'Itens de Higiene', val: 40 + Math.random() * 80, type: 'EXPENSE', date: getRelativeDate(i, 15) },
      { user: 'Gabriel', cat: 'Transporte Público/App', pay: 'Crédito', desc: 'Uber Semana', val: 25 + Math.random() * 60, type: 'EXPENSE', date: getRelativeDate(i, 18) },
      { user: 'Gabriel', cat: 'Restaurante', pay: 'Crédito', desc: 'Jantar Final de Semana', val: 80 + Math.random() * 100, type: 'EXPENSE', date: getRelativeDate(i, 22) }
    );

    // --- RESGATES DE INVESTIMENTO ---
    if (i === 0) { // Mês Atual
      transactions.push({ user: 'Gabriel', cat: 'Investimentos - Resgate', pay: 'Saldo Corretora', desc: 'Resgate para Viagem', val: 3500.00, type: 'INCOME', date: getRelativeDate(i, 20) });
    }
    if (i === 6) { // 6 Meses atrás
      transactions.push({ user: 'Klara', cat: 'Investimentos - Resgate', pay: 'Saldo Corretora', desc: 'Resgate Reserva Emergência', val: 1500.00, type: 'INCOME', date: getRelativeDate(i, 10) });
    }

    // --- SAZONALIDADE ---
    const targetMonth = new Date();
    targetMonth.setMonth(targetMonth.getMonth() - i);
    if (targetMonth.getMonth() === 0) { // 0 = Janeiro
      transactions.push({ user: 'Gabriel', cat: 'IPVA/Licenciamento', pay: 'Pix', desc: 'IPVA Anual', val: 2400.00, type: 'EXPENSE', date: getRelativeDate(i, 12) });
    }
  }
  return transactions;
};

async function seed() {
  const client = await pool.connect();
  const demoUsers = [
    { name: "Gabriel", color: "#1976d2" },
    { name: "Klara", color: "#a30d41" }
  ];

  try {
    await client.query('BEGIN');

    // Inserir/Mapear Usuários
    const userMap = {};
    for (const u of demoUsers) {
      const res = await client.query(
        'INSERT INTO users (name, color) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING id',
        [u.name, u.color]
      );
      userMap[u.name] = res.rows[0].id;
    }

    // Mapear Categorias e Métodos
    const catRows = await client.query('SELECT id, name FROM categories');
    const catMap = {};
    catRows.rows.forEach(row => catMap[row.name] = row.id);

    const methodRows = await client.query('SELECT id, name FROM payment_methods');
    const methodMap = {};
    methodRows.rows.forEach(row => methodMap[row.name] = row.id);

    // Gerar e Inserir Transações
    const dynamicTransactions = generateTransactions();
    console.log(">>> Populando banco com dados de exemplo...");
    
    await client.query('DELETE FROM transactions');

    for (const t of dynamicTransactions) {
      const categoryId = catMap[t.cat];
      const methodId = methodMap[t.pay];

      if (!categoryId || !methodId) {
        console.warn(`Aviso: Categoria "${t.cat}" ou Método "${t.pay}" não encontrados. Pulando registro.`);
        continue;
      }

      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.desc, t.val, t.type, userMap[t.user], categoryId, methodId, t.date]
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