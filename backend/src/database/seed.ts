import pool from './index.js';

const demoData = {
  users: [{ name: "Gabriel" }, { name: "Klara" }],
  transactions: [
    { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME', date: '2025-12-28' },
    { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME', date: '2025-12-28' },
    { user: 'Gabriel', cat: 'Aluguel', pay: 'Transferência', desc: 'Aluguel Apartamento', val: 1200.00, type: 'EXPENSE', date: '2025-12-11' },
    { user: 'Klara', cat: 'Condomínio', pay: 'Transferência', desc: 'Condomínio', val: 450.00, type: 'EXPENSE', date: '2025-12-11' },
    { user: 'Gabriel', cat: 'Energia Elétrica', pay: 'Pix', desc: 'Conta de Luz', val: 185.20, type: 'EXPENSE', date: '2025-12-02' },
    { user: 'Gabriel', cat: 'Presentes para Outros', pay: 'Crédito', desc: 'Presente Natal Família', val: 450.00, type: 'EXPENSE', date: '2025-12-20' },
    { user: 'Klara', cat: 'Roupas/Acessórios', pay: 'Crédito', desc: 'Vestido Festa', val: 280.00, type: 'EXPENSE', date: '2025-12-15' },
    { user: 'Gabriel', cat: 'Restaurante', pay: 'Débito', desc: 'Confraternização Firma', val: 120.00, type: 'EXPENSE', date: '2025-12-18' },
    { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Compras do Mês', val: 840.50, type: 'EXPENSE', date: '2025-11-25' },
    { user: 'Klara', cat: 'Supermercado', pay: 'Débito', desc: 'Feira Semanal', val: 120.00, type: 'EXPENSE', date: '2025-11-25' },
    { user: 'Gabriel', cat: 'Freelance/Projetos', pay: 'Pix', desc: 'Landing Page Cliente X', val: 1200.00, type: 'INCOME', date: '2025-11-23' },
    { user: 'Klara', cat: 'Internet/Celular', pay: 'Crédito', desc: 'Plano Controle', val: 99.90, type: 'EXPENSE', date: '2025-11-21' },
    { user: 'Gabriel', cat: 'Restaurante', pay: 'Crédito', desc: 'Jantar de Sábado', val: 150.00, type: 'EXPENSE', date: '2025-11-21' },
    { user: 'Gabriel', cat: 'Combustível', pay: 'Débito', desc: 'Posto Shell', val: 250.00, type: 'EXPENSE', date: '2025-11-21' },
    { user: 'Klara', cat: 'Academia/Esportes', pay: 'Crédito', desc: 'Mensalidade Academia', val: 110.00, type: 'EXPENSE', date: '2025-11-17' },
    { user: 'Gabriel', cat: 'Assinaturas', pay: 'Crédito', desc: 'Netflix + Spotify', val: 75.80, type: 'EXPENSE', date: '2025-11-16' },
    { user: 'Gabriel', cat: 'Pet: Ração', pay: 'Débito', desc: 'Ração 15kg', val: 230.00, type: 'EXPENSE', date: '2025-11-15' },
    { user: 'Klara', cat: 'Lanches/Cafés', pay: 'Crédito', desc: 'Starbucks', val: 25.50, type: 'EXPENSE', date: '2025-11-14' },
    { user: 'Gabriel', cat: 'Investimentos - Dividendos', pay: 'Saldo Corretora', desc: 'Proventos FIIs', val: 45.20, type: 'INCOME', date: '2025-11-14' },
    { user: 'Gabriel', cat: 'Investimentos - Aporte', pay: 'Transferência', desc: 'Aporte Mensal Bolsa', val: 1000.00, type: 'EXPENSE', date: '2025-11-05' },
    { user: 'Klara', cat: 'Farmácia', pay: 'Débito', desc: 'Remédios e Vitaminas', val: 85.00, type: 'EXPENSE', date: '2025-11-05' },
    { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME', date: '2025-10-28' },
    { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME', date: '2025-10-28' },
    { user: 'Gabriel', cat: 'Delivery', pay: 'Crédito', desc: 'iFood Burguer', val: 65.00, type: 'EXPENSE', date: '2025-10-29' },
    { user: 'Gabriel', cat: 'Hobby', pay: 'Crédito', desc: 'Jogo na Steam', val: 120.00, type: 'EXPENSE', date: '2025-10-28' },
    { user: 'Klara', cat: 'Cursos/Treinamentos', pay: 'Crédito', desc: 'Curso de Design', val: 350.00, type: 'EXPENSE', date: '2025-10-15' },
    { user: 'Gabriel', cat: 'Mecânico', pay: 'Pix', desc: 'Troca de Óleo', val: 220.00, type: 'EXPENSE', date: '2025-10-10' },
    { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Mercado Outubro', val: 910.00, type: 'EXPENSE', date: '2025-10-05' },
    { user: 'Klara', cat: 'Farmácia', pay: 'Dinheiro', desc: 'Protetor Solar', val: 65.00, type: 'EXPENSE', date: '2025-10-02' },
    { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME', date: '2025-09-28' },
    { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME', date: '2025-09-28' },
    { user: 'Gabriel', cat: 'Viagens/Hospedagem', pay: 'Crédito', desc: 'Hospedagem Airbnb', val: 1500.00, type: 'EXPENSE', date: '2025-09-12' },
    { user: 'Klara', cat: 'Barbearia/Salão', pay: 'Pix', desc: 'Corte e Cor', val: 180.00, type: 'EXPENSE', date: '2025-09-10' },
    { user: 'Gabriel', cat: 'Padaria', pay: 'Débito', desc: 'Café da Manhã', val: 35.00, type: 'EXPENSE', date: '2025-09-08' },
    { user: 'Klara', cat: 'Transporte Público/App', pay: 'Crédito', desc: 'Uber Semana', val: 140.00, type: 'EXPENSE', date: '2025-09-05' },
    { user: 'Gabriel', cat: 'Vendas', pay: 'Pix', desc: 'Venda Monitor Antigo', val: 400.00, type: 'INCOME', date: '2025-09-15' },
    { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME', date: '2025-08-28' },
    { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME', date: '2025-08-28' },
    { user: 'Gabriel', cat: 'Manutenção/Reparos Casa', pay: 'Pix', desc: 'Conserto Geladeira', val: 350.00, type: 'EXPENSE', date: '2025-08-15' },
    { user: 'Klara', cat: 'Supermercado', pay: 'Crédito', desc: 'Mercado Agosto', val: 780.00, type: 'EXPENSE', date: '2025-08-05' },
    { user: 'Gabriel', cat: 'Combustível', pay: 'Dinheiro', desc: 'Gasolina', val: 200.00, type: 'EXPENSE', date: '2025-08-10' },
    { user: 'Gabriel', cat: 'Restaurante', pay: 'Crédito', desc: 'Aniversário', val: 320.00, type: 'EXPENSE', date: '2025-08-20' },
    { user: 'Klara', cat: 'Presentes', pay: 'Pix', desc: 'Pix Titia Aniversário', val: 100.00, type: 'INCOME', date: '2025-08-12' },
    { user: 'Gabriel', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5000.00, type: 'INCOME', date: '2025-07-28' },
    { user: 'Klara', cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4500.00, type: 'INCOME', date: '2025-07-28' },
    { user: 'Gabriel', cat: 'IPVA/Licenciamento', pay: 'Pix', desc: 'Parcela Unica Licenc.', val: 650.00, type: 'EXPENSE', date: '2025-07-15' },
    { user: 'Klara', cat: 'Hobby', pay: 'Crédito', desc: 'Livros Novos', val: 120.00, type: 'EXPENSE', date: '2025-07-10' },
    { user: 'Gabriel', cat: 'Supermercado', pay: 'Crédito', desc: 'Mercado Julho', val: 820.00, type: 'EXPENSE', date: '2025-07-05' },
    { user: 'Gabriel', cat: 'Outros', pay: 'Dinheiro', desc: 'Chaveiro', val: 45.00, type: 'EXPENSE', date: '2025-07-20' },
    { user: 'Klara', cat: 'Pet: Veterinário/Vacinas', pay: 'Crédito', desc: 'Vacinas Anuais Gato', val: 220.00, type: 'EXPENSE', date: '2025-07-22' },
    { user: 'Gabriel', cat: 'Reembolsos', pay: 'Pix', desc: 'Reembolso Viagem Trabalho', val: 1200.00, type: 'INCOME', date: '2025-07-30' }
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
    const methodRows = await client.query('SELECT id, name FROM payment_methods');
    const methodMap: Record<string, number> = {};
    methodRows.rows.forEach(row => methodMap[row.name] = row.id);

    // Inseri Transações de Exemplo
    console.log(">>> Populando banco com dados de exemplo...");
    await client.query('DELETE FROM transactions');

    for (const t of demoData.transactions) {
      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [t.desc, t.val, t.type, userMap[t.user], catMap[t.cat], methodMap[t.pay], t.date]
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