import pool from './index.js';

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
  const monthsToSeed = 14;
  
  // Controle de patrimônio por ativo para simular dividendos
  const portfolio = {
    'PETR4': 2000.00,
    'MXRF11': 1500.00,
    'VALE3': 1000.00,
    'ITUB4': 0.00,
    'IVVB11': 0.00,
    'KNCR11': 0.00
  };

  for (let i = monthsToSeed; i >= 0; i--) {
    const isGabrielTurn = i % 2 === 0;

    // --- ENTRADAS MENSAIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200.00, type: 'INCOME', date: getRelativeDate(i, 28) },
      { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4700.00, type: 'INCOME', date: getRelativeDate(i, 28) }
    );

    // --- APORTES MENSAIS (DINHEIRO NOVO) ---
    if (isGabrielTurn) {
      const val = 1200.00;
      const asset = i % 4 === 0 ? 'VALE3' : 'PETR4';
      transactions.push({ 
        user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência', 
        desc: `Aporte Mensal ${asset}`, val: val, type: 'EXPENSE', date: getRelativeDate(i, 5),
        asset: asset, qty: asset === 'VALE3' ? 15 : 35
      });
      portfolio[asset] += val;
    } else {
      const val = 1000.00;
      const asset = i % 3 === 0 ? 'IVVB11' : 'MXRF11';
      transactions.push({ 
        user: 'Klara', cat: 'Investimentos - Aporte', pay: 'Transferência', 
        desc: `Compra mensal ${asset}`, val: val, type: 'EXPENSE', date: getRelativeDate(i, 5),
        asset: asset, qty: asset === 'IVVB11' ? 4 : 100 
      });
      portfolio[asset] += val;
    }

    // --- DIVIDENDOS E REINVESTIMENTOS ---
    const payingAssets = ['PETR4', 'MXRF11', 'VALE3', 'KNCR11'] as const;
    
    payingAssets.forEach(asset => {
      const balance = portfolio[asset];
      if (balance > 0) {
        const yieldRate = asset === 'MXRF11' ? 0.011 : 0.008;
        const dividendVal = balance * yieldRate;

        // Recebe o Dividendo
        transactions.push({ 
          user: isGabrielTurn ? 'Gabriel' : 'Klara', 
          cat: 'Investimentos - Dividendos',
          pay: 'Saldo Corretora', 
          desc: `Dividendos ${asset}`, 
          val: dividendVal, 
          type: 'INCOME', 
          date: getRelativeDate(i, 15),
          asset: asset
        });

        // Lógica de Reinvestimento (EXPENSE - Categoria Nova)
        const reinvestVal = dividendVal * 0.9;
        transactions.push({ 
          user: isGabrielTurn ? 'Gabriel' : 'Klara', 
          cat: 'Investimentos - Reinvestimento',
          pay: 'Saldo Corretora', 
          desc: `Reinvestimento Automático ${asset}`, 
          val: reinvestVal, 
          type: 'EXPENSE', 
          date: getRelativeDate(i, 16),
          asset: asset,
          qty: Math.max(1, Math.floor(reinvestVal / 10))
        });
        
        portfolio[asset] += reinvestVal;
      }
    });

    // --- CUSTOS FIXOS E VARIÁVEIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Aluguel', pay: 'Transferência', desc: 'Moradia', val: 1500.00, type: 'EXPENSE', date: getRelativeDate(i, 10) },
      { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Compras', val: 800 + Math.random() * 200, type: 'EXPENSE', date: getRelativeDate(i, 10) },
      { user: 'Klara', cat: 'Lanches/Cafés', pay: 'Pix', desc: 'Cafeteria', val: 20 + Math.random() * 50, type: 'EXPENSE', date: getRelativeDate(i, 15) }
    );
  }
  return transactions;
};

async function seed() {
  const client = await pool.connect();
  const demoUsers = [{ name: "Gabriel", color: "#1976d2" }, { name: "Klara", color: "#a30d41" }];
  const demoAssets = ["PETR4", "MXRF11", "VALE3", "ITUB4", "IVVB11", "KNCR11"];

  try {
    await client.query('BEGIN');

    const userMap: any = {};
    for (const u of demoUsers) {
      const res = await client.query(
        'INSERT INTO users (name, color) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING id', 
        [u.name, u.color]
      );
      userMap[u.name] = res.rows[0].id;
    }

    const assetMap: any = {};
    for (const ticker of demoAssets) {
      const res = await client.query(
        'INSERT INTO assets (ticker) VALUES ($1) ON CONFLICT (ticker) DO UPDATE SET ticker = EXCLUDED.ticker RETURNING id', 
        [ticker]
      );
      assetMap[ticker] = res.rows[0].id;
    }

    const catRows = await client.query('SELECT id, name FROM categories');
    const catMap: any = {};
    catRows.rows.forEach((row: any) => catMap[row.name] = row.id);

    const methodRows = await client.query('SELECT id, name FROM payment_methods');
    const methodMap: any = {};
    methodRows.rows.forEach((row: any) => methodMap[row.name] = row.id);

    console.log(">>> Limpando transações antigas...");
    await client.query('DELETE FROM transactions');

    const dynamicTransactions = generateTransactions();
    console.log(`>>> Inserindo ${dynamicTransactions.length} registros...`);

    for (const t of dynamicTransactions) {
      const categoryId = catMap[t.cat];
      const methodId = methodMap[t.pay];
      const assetId = t.asset ? assetMap[t.asset] : null;

      if (!categoryId || !methodId) {
        console.warn(`Pulado: ${t.cat} ou ${t.pay} não encontrados.`);
        continue;
      }

      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date, asset_id, quantity) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [t.desc, t.val, t.type, userMap[t.user], categoryId, methodId, t.date, assetId, t.qty || null]
      );
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