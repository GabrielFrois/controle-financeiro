import pool from './index.js';

/**
 * Função auxiliar para gerar datas relativas a hoje.
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
  const transactions = [];
  const monthsToSeed = 14;
  
  // Patrimônio inicial para cálculos de dividendos
  let cumulativeInvestments = 1500.00; 

  for (let i = monthsToSeed; i >= 0; i--) {
    
    // --- ENTRADAS MENSAIS ---
    transactions.push(
      { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200.00, type: 'INCOME', date: getRelativeDate(i, 28) },
      { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4700.00, type: 'INCOME', date: getRelativeDate(i, 28) }
    );

    // --- INVESTIMENTOS ---
    if (i % 2 === 0) {
      const val = 1000.00;
      transactions.push({ 
        user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência', 
        desc: 'Compra PETR4', val: val, type: 'EXPENSE', date: getRelativeDate(i, 5),
        asset: 'PETR4', qty: 25 
      });
      cumulativeInvestments += val;
    } else {
      const val = 800.00;
      transactions.push({ 
        user: 'Klara', cat: 'Investimentos - Aporte', pay: 'Transferência', 
        desc: 'Aporte MXRF11', val: val, type: 'EXPENSE', date: getRelativeDate(i, 5),
        asset: 'MXRF11', qty: 80 
      });
      cumulativeInvestments += val;
    }

    // --- DIVIDENDOS (Associados aos ativos) ---
    const dividendVal = cumulativeInvestments * 0.01;
    transactions.push({ 
      user: i % 2 === 0 ? 'Gabriel' : 'Klara', 
      cat: 'Investimentos - Dividendos',
      pay: 'Saldo Corretora', 
      desc: 'Dividendos', 
      val: dividendVal, 
      type: 'INCOME', 
      date: getRelativeDate(i, 15),
      asset: i % 2 === 0 ? 'PETR4' : 'MXRF11'
    });

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
      { user: 'Gabriel', cat: 'Restaurante', pay: 'Crédito', desc: 'Jantar Final de Semana', val: 80 + Math.random() * 100, type: 'EXPENSE', date: getRelativeDate(i, 22) },
      { user: 'Klara', cat: 'Lanches/Cafés', pay: 'Pix', desc: 'Cafeteria', val: 15 + Math.random() * 30, type: 'EXPENSE', date: getRelativeDate(i, i % 28) }
    );

    // --- RESGATES ---
    if (i === 0) { 
      const resVal = 3500.00;
      transactions.push({ 
        user: 'Gabriel', cat: 'Investimentos - Resgate', pay: 'Saldo Corretora', 
        desc: 'Venda PETR4', val: resVal, type: 'INCOME', date: getRelativeDate(i, 20),
        asset: 'PETR4', qty: 10 
      });
      cumulativeInvestments -= resVal;
    }
    if (i === 6) {
      const resVal = 1500.00;
      transactions.push({ 
        user: 'Klara', cat: 'Investimentos - Resgate', pay: 'Saldo Corretora', 
        desc: 'Resgate MXRF11', val: resVal, type: 'INCOME', date: getRelativeDate(i, 10),
        asset: 'MXRF11', qty: 150 
      });
      cumulativeInvestments -= resVal;
    }

    // --- SAZONALIDADE ---
    const targetMonth = new Date();
    targetMonth.setMonth(targetMonth.getMonth() - i);
    if (targetMonth.getMonth() === 0) {
      transactions.push({ 
        user: 'Gabriel', cat: 'IPVA/Licenciamento', pay: 'Pix', 
        desc: 'IPVA Anual', val: 2400.00, type: 'EXPENSE', date: getRelativeDate(i, 12) 
      });
    }
  }
  return transactions;
};

async function seed() {
  const client = await pool.connect();
  const demoUsers = [{ name: "Gabriel", color: "#1976d2" }, { name: "Klara", color: "#a30d41" }];
  const demoAssets = ["PETR4", "MXRF11", "VALE3", "ITUB4", "CDB BANCO X"];

  try {
    await client.query('BEGIN');

    // Upsert de Usuários
    const userMap: any = {};
    for (const u of demoUsers) {
      const res = await client.query(
        'INSERT INTO users (name, color) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET color = EXCLUDED.color RETURNING id', 
        [u.name, u.color]
      );
      userMap[u.name] = res.rows[0].id;
    }

    // Upsert de Ativos
    const assetMap: any = {};
    for (const ticker of demoAssets) {
      const res = await client.query(
        'INSERT INTO assets (ticker) VALUES ($1) ON CONFLICT (ticker) DO UPDATE SET ticker = EXCLUDED.ticker RETURNING id', 
        [ticker]
      );
      assetMap[ticker] = res.rows[0].id;
    }

    // Mapeamento de Categorias e Métodos
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

    for (const t of dynamicTransactions as any[]) {
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