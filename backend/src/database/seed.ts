import pool from './index.js';

/**
 * Utilitário para gerar datas relativas de forma consistente
 */
const getRelativeDate = (monthsAgo: number, day: number) => {
  const d = new Date();
  d.setDate(1); 
  d.setMonth(d.getMonth() - monthsAgo);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth));
  return d.toISOString().split('T')[0];
};

/**
 * Gera a lista de transações simuladas para os últimos 14 meses
 */
const generateTransactions = () => {
  const transactions: any[] = [];
  const monthsToSeed = 14;
  
  const assetTypes: Record<string, string> = {
    'PETR4': 'ACOES',
    'VALE3': 'ACOES',
    'ITUB4': 'ACOES',
    'MXRF11': 'FII',
    'KNCR11': 'FII',
    'IVVB11': 'INTERNACIONAL'
  };

  const availableAssets = ['PETR4', 'VALE3', 'ITUB4', 'MXRF11', 'KNCR11', 'IVVB11'];

  // Rastreio de saldo de cotas para cálculo de dividendos e reinvestimento
  const currentPortfolio: Record<string, number> = {
    'PETR4': 0, 'VALE3': 0, 'ITUB4': 0, 'MXRF11': 0, 'KNCR11': 0, 'IVVB11': 0
  };

  for (let i = monthsToSeed; i >= 0; i--) {
    const isGabrielTurn = i % 2 === 0;

    // --- ENTRADAS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200.00, type: 'INCOME', date: getRelativeDate(i, 28), inv_type: 'OUTROS' },
      { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4700.00, type: 'INCOME', date: getRelativeDate(i, 28), inv_type: 'OUTROS' }
    );

    // --- DIVIDENDOS E REINVESTIMENTOS ---
    availableAssets.forEach(asset => {
      const sharesHeld = currentPortfolio[asset];
      if (sharesHeld > 0 && (assetTypes[asset] === 'FII' || assetTypes[asset] === 'ACOES')) {
        const dividendPerShare = assetTypes[asset] === 'FII' ? 0.12 : 0.40;
        const totalDividend = sharesHeld * dividendPerShare;

        // Registro do provento
        transactions.push({
          user: 'Gabriel', cat: 'Investimentos - Dividendos', pay: 'Saldo Corretora',
          desc: `Dividendos ${asset}`, val: totalDividend, type: 'INCOME', date: getRelativeDate(i, 15),
          asset: asset, qty: null, inv_type: assetTypes[asset]
        });

        // Reinvestimento
        const price = asset.includes('11') ? 10.50 : 35.00;
        const qtyToBuy = Math.floor(totalDividend / price);

        if (qtyToBuy > 0) {
          transactions.push({
            user: 'Gabriel', cat: 'Investimentos - Reinvestimento', pay: 'Saldo Corretora',
            desc: `Reinvestimento ${asset}`, val: qtyToBuy * price, type: 'EXPENSE', date: getRelativeDate(i, 16),
            asset: asset, qty: qtyToBuy, inv_type: assetTypes[asset]
          });
          currentPortfolio[asset] += qtyToBuy;
        }
      }
    });

    // --- APORTES E INVESTIMENTOS ---
    if (isGabrielTurn) {
      const assetIndex = Math.floor(i / 2) % availableAssets.length;
      const asset = availableAssets[assetIndex];
      
      let quantity = 30; 
      if (asset.includes('11')) quantity = 150;
      if (asset === 'IVVB11') quantity = 5;

      transactions.push({ 
        user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência', 
        desc: `Aporte ${asset}`, val: 1200.00 + (Math.random() * 500), type: 'EXPENSE', date: getRelativeDate(i, 5),
        asset: asset, qty: quantity,
        inv_type: assetTypes[asset] 
      });

      currentPortfolio[asset] += quantity;
    }

    // --- GASTOS VARIÁVEIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Compra do mês', val: 800 + Math.random() * 500, type: 'EXPENSE', date: getRelativeDate(i, 10), inv_type: 'OUTROS' },
      { user: 'Klara', cat: 'Supermercado', pay: 'Crédito', desc: 'Feira e Padaria', val: 150 + Math.random() * 100, type: 'EXPENSE', date: getRelativeDate(i, 12), inv_type: 'OUTROS' },
      { user: 'Klara', cat: 'Lanches/Cafés', pay: 'Pix', desc: 'Cafeteria', val: 40 + Math.random() * 80, type: 'EXPENSE', date: getRelativeDate(i, 15), inv_type: 'OUTROS' },
      { user: 'Gabriel', cat: 'Restaurante', pay: 'Crédito', desc: 'Jantar', val: 200 + Math.random() * 300, type: 'EXPENSE', date: getRelativeDate(i, 20), inv_type: 'OUTROS' },
      { user: 'Gabriel', cat: 'Farmácia', pay: 'Débito', desc: 'Higiene/Medicamentos', val: 60 + Math.random() * 100, type: 'EXPENSE', date: getRelativeDate(i, 18), inv_type: 'OUTROS' }
    );

    // --- GASTOS ANUAIS ---
    if (i % 4 === 0) {
      transactions.push({ 
        user: 'Gabriel', cat: 'Lazer', pay: 'Crédito', desc: 'Viagem/Passeio', val: 800 + Math.random() * 1000, 
        type: 'EXPENSE', date: getRelativeDate(i, 15), inv_type: 'OUTROS'
      });
    }
    if (i % 3 === 0) {
      transactions.push({ 
        user: 'Klara', cat: 'Cursos/Livros', pay: 'Crédito', desc: 'Curso Online', val: 200 + Math.random() * 300, 
        type: 'EXPENSE', date: getRelativeDate(i, 5), inv_type: 'OUTROS'
      });
    }

    // --- CUSTOS FIXOS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Aluguel', pay: 'Transferência', desc: 'Moradia', val: 1500.00, type: 'EXPENSE', date: getRelativeDate(i, 10), inv_type: 'OUTROS' },
      { user: 'Gabriel', cat: 'Lazer', pay: 'Crédito', desc: 'Assinaturas (Netflix/Cloud)', val: 89.90, type: 'EXPENSE', date: getRelativeDate(i, 5), inv_type: 'OUTROS' }
    );
  }
  return transactions;
};

async function seed() {
  const client = await pool.connect();

  const demoUsers = [{ name: "Gabriel", color: "#1976d2" }, { name: "Klara", color: "#a30d41" }];
  const demoAssets = [
    { ticker: "PETR4", type: "ACOES" },
    { ticker: "VALE3", type: "ACOES" },
    { ticker: "ITUB4", type: "ACOES" },
    { ticker: "MXRF11", type: "FII" },
    { ticker: "KNCR11", type: "FII" },
    { ticker: "IVVB11", type: "INTERNACIONAL" }
  ];
  
  const demoCategories = [
    { name: "Salário", type: "INCOME" },
    { name: "Investimentos - Aporte", type: "EXPENSE" },
    { name: "Investimentos - Dividendos", type: "INCOME" },
    { name: "Investimentos - Reinvestimento", type: "EXPENSE" },
    { name: "Aluguel", type: "EXPENSE" },
    { name: "Supermercado", type: "EXPENSE" },
    { name: "Lanches/Cafés", type: "EXPENSE" },
    { name: "Restaurante", type: "EXPENSE" },
    { name: "Lazer", type: "EXPENSE" },
    { name: "Cursos/Livros", type: "EXPENSE" },
    { name: "Farmácia", type: "EXPENSE" }
  ];

  const demoMethods = ["Pix", "Transferência", "Crédito", "Saldo Corretora", "Débito"];

  const demoBudgets = [
    { cat: 'Supermercado', val: 1200.00, period: 'MONTHLY' },
    { cat: 'Lanches/Cafés', val: 350.00, period: 'MONTHLY' },
    { cat: 'Restaurante', val: 800.00, period: 'MONTHLY' },
    { cat: 'Lazer', val: 6000.00, period: 'YEARLY' },
    { cat: 'Cursos/Livros', val: 2500.00, period: 'YEARLY' }
  ];

  try {
    await client.query('BEGIN');

    const userMap: Record<string, number> = {};
    for (const u of demoUsers) {
      const res = await client.query('INSERT INTO users (name, color) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING id', [u.name, u.color]);
      userMap[u.name] = res.rows[0].id;
    }

    const assetMap: Record<string, number> = {};
    for (const a of demoAssets) {
      const res = await client.query('INSERT INTO assets (ticker, type) VALUES ($1, $2) ON CONFLICT (ticker) DO UPDATE SET type = EXCLUDED.type RETURNING id', [a.ticker, a.type]);
      assetMap[a.ticker] = res.rows[0].id;
    }

    const catMap: Record<string, number> = {};
    for (const cat of demoCategories) {
      const res = await client.query('INSERT INTO categories (name, type) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type RETURNING id', [cat.name, cat.type]);
      catMap[cat.name] = res.rows[0].id;
    }

    const methodMap: Record<string, number> = {};
    for (const m of demoMethods) {
      const res = await client.query('INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [m]);
      methodMap[m] = res.rows[0].id;
    }

    console.log(">>> Limpando registros antigos...");
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM budgets');

    const dynamicTransactions = generateTransactions();
    console.log(`>>> Inserindo ${dynamicTransactions.length} transações...`);
    for (const t of dynamicTransactions) {
      const categoryId = catMap[t.cat];
      const methodId = methodMap[t.pay];
      if (!categoryId || !methodId) continue;
      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date, asset_id, quantity, investment_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [t.desc, t.val, t.type, userMap[t.user], categoryId, methodId, t.date, t.asset ? assetMap[t.asset] : null, t.qty || null, t.inv_type || 'OUTROS']
      );
    }

    console.log(">>> Inserindo metas de exemplo...");
    for (const b of demoBudgets) {
      const categoryId = catMap[b.cat];
      if (categoryId) {
        await client.query('INSERT INTO budgets (category_id, amount, period) VALUES ($1, $2, $3)', [categoryId, b.val, b.period]);
      }
    }

    await client.query('COMMIT');
    console.log(`>>> Seed concluído com sucesso!`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(">>> Erro durante o seed:", e);
  } finally {
    client.release();
    process.exit();
  }
}

seed();