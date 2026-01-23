import pool from './index.js';

/**
 * Utilitário para gerar datas relativas
 */
const getRelativeDate = (monthsAgo: number, day: number) => {
  const d = new Date();
  d.setDate(1); 
  d.setMonth(d.getMonth() - monthsAgo);
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDayOfMonth));
  return d.toISOString().split('T')[0];
};

const generateTransactions = () => {
  const transactions: any[] = [];
  const monthsToSeed = 16;
  
  const assetTypes: Record<string, string> = {
    'Tesouro Direto': 'RENDA_FIXA',
    'KNCR11': 'FII',
    'MXRF11': 'FII',
    'VALE3': 'ACOES',
    'PETR4': 'ACOES',
    'ITUB4': 'ACOES',
    'TSMC': 'INTERNACIONAL',
    'IVVB11': 'INTERNACIONAL',
    'AAPL34': 'INTERNACIONAL',
    'USDBRL': 'INTERNACIONAL',
    'BTC': 'CRIPTOS',
    'ETH': 'CRIPTOS'
  };

  const availableAssets = Object.keys(assetTypes);

  // Controle de portfólio para gerar dividendos coerentes
  const currentPortfolio: Record<string, number> = availableAssets.reduce((acc, asset) => ({ ...acc, [asset]: 0 }), {});

  // --- Garante que TODOS os ativos sejam comprados no início ---
  // Simula compras feitas há 16 meses atrás
  availableAssets.forEach(asset => {
    const type = assetTypes[asset];
    let qty = 0;
    let val = 0;
    const date = getRelativeDate(monthsToSeed, 5); // Data antiga

    if (asset === 'Tesouro Direto') {
      qty = 1; 
      val = 15000.00;
    } else if (asset === 'BTC') {
      qty = 0.0055; 
      val = 2100.00; 
    } else if (asset === 'ETH') {
      qty = 0.15;
      val = 1800.00;
    } else if (asset === 'USDBRL') {
      qty = 500; 
      val = 2600.00;
    } else if (asset === 'KNCR11') {
      qty = 80; val = 80 * 105.00;
    } else if (asset === 'MXRF11') {
      qty = 200; val = 200 * 10.50;
    } else if (asset === 'VALE3') {
      qty = 50; val = 50 * 65.00;
    } else if (asset === 'PETR4') {
      qty = 60; val = 60 * 35.00;
    } else if (asset === 'ITUB4') {
      qty = 40; val = 40 * 32.00;
    } else if (asset === 'IVVB11') {
      qty = 10; val = 10 * 280.00;
    } else if (asset === 'AAPL34') {
      qty = 15; val = 15 * 55.00;
    } else if (asset === 'TSMC') {
      qty = 10; val = 10 * 120.50;
    }

    // Cria a transação de compra inicial
    transactions.push({ 
      user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Saldo Corretora', 
      desc: `${asset}`, val: val, type: 'EXPENSE', date: date,
      asset: asset, qty: qty, inv_type: type 
    });

    currentPortfolio[asset] += qty;
  });

  // --- Meses subsequentes - Salários e Gastos ---
  for (let i = monthsToSeed; i >= 0; i--) {
    const isGabrielTurn = i % 2 === 0;

    // Entradas (Salários)
    transactions.push(
      { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200.00, type: 'INCOME', date: getRelativeDate(i, 5), inv_type: 'OUTROS' },
      { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4800.00, type: 'INCOME', date: getRelativeDate(i, 5), inv_type: 'OUTROS' }
    );

    // Despesas Fixas
    transactions.push(
      { user: 'Gabriel', cat: 'Aluguel', pay: 'Transferência', desc: 'Aluguel Ap', val: 1800.00, type: 'EXPENSE', date: getRelativeDate(i, 10), inv_type: 'OUTROS' },
      { user: 'Klara', cat: 'Supermercado', pay: 'Crédito', desc: 'Compras do Mês', val: 950.00, type: 'EXPENSE', date: getRelativeDate(i, 12), inv_type: 'OUTROS' },
      { user: 'Gabriel', cat: 'Internet/Celular', pay: 'Débito', desc: 'Conta Vivo', val: 120.00, type: 'EXPENSE', date: getRelativeDate(i, 15), inv_type: 'OUTROS' }
    );

    // Dividendos (Gera receita para quem tem saldo)
    availableAssets.forEach(asset => {
      if (currentPortfolio[asset] > 0 && ['ACOES', 'FII', 'INTERNACIONAL'].includes(assetTypes[asset])) {
        const divRate = asset.includes('11') ? 0.08 : 0.20; // FII paga mensal, Ação paga esporádico (simulado)
        
        // Simula pagamento apenas em meses pares para ações, todo mês para FII
        if (assetTypes[asset] === 'FII' || (assetTypes[asset] === 'ACOES' && i % 3 === 0)) {
             const totalDiv = currentPortfolio[asset] * divRate;
             if (totalDiv > 1) {
                transactions.push({
                  user: 'Gabriel', cat: 'Investimentos - Dividendos', pay: 'Saldo Corretora',
                  desc: `Proventos ${asset}`, val: totalDiv, type: 'INCOME', date: getRelativeDate(i, 20),
                  asset: asset, qty: null, inv_type: assetTypes[asset]
                });
             }
        }
      }
    });

    // Aportes Recorrentes
    if (i < monthsToSeed) { 
        // Escolhe um ativo aleatório para aportar no mês
        const assetsToBuy = ['KNCR11', 'MXRF11', 'PETR4', 'VALE3', 'Tesouro Direto', 'BTC']; 
        const chosen = assetsToBuy[Math.floor(Math.random() * assetsToBuy.length)];
        
        let qtyBuy = 0;
        let price = 0;

        if (chosen === 'Tesouro Direto') {
            qtyBuy = 1; price = 500;
        } else if (chosen === 'BTC') {
            qtyBuy = 0.0001; price = 280000;
        } else {
            qtyBuy = Math.floor(Math.random() * 10) + 5;
            price = 10 + (Math.random() * 20);
        }
        
        const totalVal = chosen === 'BTC' ? 300 : (qtyBuy * price);

        transactions.push({
            user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência',
            desc: `${chosen}`, val: totalVal, type: 'EXPENSE', date: getRelativeDate(i, 2),
            asset: chosen, qty: qtyBuy, inv_type: assetTypes[chosen]
        });
        currentPortfolio[chosen] += qtyBuy;
    }
  }

  return transactions;
};

async function seed() {
  const client = await pool.connect();

  // Usuários
  const demoUsers = [{ name: "Gabriel", color: "#1976d2" }, { name: "Klara", color: "#a30d41" }];
  
  // Categorias
  const demoCategories = [
    { name: "Salário", type: "INCOME" },
    { name: "Investimentos - Aporte", type: "EXPENSE" },
    { name: "Investimentos - Dividendos", type: "INCOME" },
    { name: "Investimentos - Resgate", type: "INCOME" },
    { name: "Aluguel", type: "EXPENSE" },
    { name: "Supermercado", type: "EXPENSE" },
    { name: "Internet/Celular", type: "EXPENSE" }
  ];

  // Ativos
  const demoAssets = [
    { ticker: "KNCR11", type: "FII" },
    { ticker: "Tesouro Direto", type: "RENDA_FIXA" },
    { ticker: "VALE3", type: "ACOES" },
    { ticker: "IVVB11", type: "INTERNACIONAL" },
    { ticker: "PETR4", type: "ACOES" },
    { ticker: "MXRF11", type: "FII" },
    { ticker: "ITUB4", type: "ACOES" },
    { ticker: "BTC", type: "CRIPTOS" },
    { ticker: "ETH", type: "CRIPTOS" },
    { ticker: "TSMC", type: "INTERNACIONAL" },
    { ticker: "USDBRL", type: "INTERNACIONAL" },
    { ticker: "AAPL34", type: "INTERNACIONAL" }
  ];

  const demoMethods = ["Pix", "Transferência", "Crédito", "Saldo Corretora", "Débito"];

  const demoBudgets = [
    { cat: 'Supermercado', val: 1200.00, period: 'MONTHLY' },
    { cat: 'Aluguel', val: 1800.00, period: 'MONTHLY' }
  ];

  try {
    await client.query('BEGIN');

    // 1. Criar Usuários
    const userMap: Record<string, number> = {};
    for (const u of demoUsers) {
      const res = await client.query('INSERT INTO users (name, color) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING id', [u.name, u.color]);
      userMap[u.name] = res.rows[0].id;
    }

    // 2. Criar Ativos
    const assetMap: Record<string, number> = {};
    for (const a of demoAssets) {
      const res = await client.query('INSERT INTO assets (ticker, type) VALUES ($1, $2) ON CONFLICT (ticker) DO UPDATE SET type = EXCLUDED.type RETURNING id', [a.ticker, a.type]);
      assetMap[a.ticker] = res.rows[0].id;
    }

    // 3. Criar Categorias
    const catMap: Record<string, number> = {};
    for (const cat of demoCategories) {
      const res = await client.query('INSERT INTO categories (name, type) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type RETURNING id', [cat.name, cat.type]);
      catMap[cat.name] = res.rows[0].id;
    }

    // 4. Criar Métodos de Pagamento
    const methodMap: Record<string, number> = {};
    for (const m of demoMethods) {
      const res = await client.query('INSERT INTO payment_methods (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id', [m]);
      methodMap[m] = res.rows[0].id;
    }

    console.log(">>> Limpando registros antigos de transações e metas...");
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