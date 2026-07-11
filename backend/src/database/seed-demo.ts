/**
 * seed-demo.ts — apaga e recria os dados de demonstração
 * (José, Maria, família, transações, investimentos e metas de exemplo)
 * Cobertura: 18 meses de histórico, múltiplas categorias, investimentos
 * diversificados (ações, FII, renda fixa, cripto, internacional), metas
 * pessoais e agora também cartão de crédito de verdade por usuário:
 *   - Cada um tem seu próprio cartão (limite, dia de fechamento/vencimento)
 *   - Compras parceladas (installment_group_id) com parcelas passadas E futuras
 *   - Faturas de meses anteriores pagas (is_invoice_payment), só o mês
 *     corrente fica em aberto — pra mostrar o fluxo completo de fatura.
 * uso: npm run seed:demo
 */
import { randomUUID } from 'crypto';
import pool from './index.js';
import bcrypt from 'bcrypt';

const DEMO_USERNAMES = ['jose', 'maria'];
const DEMO_PASSWORD = 'exemplo123';
const MONTHS = 18; // janela de histórico (meses atrás), inclui o mês atual (i = 0)

const getDate = (monthsAgo: number, day: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return d.toISOString().split('T')[0];
};

// Mês de referência (YYYY-MM) de uma data "monthsAgo" meses atrás.
// monthsAgo negativo = mês no futuro (usado pelas parcelas ainda não vencidas).
const getYearMonth = (monthsAgo: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toISOString().slice(0, 7);
};

// Inverso de getDate: a partir de uma data "YYYY-MM-DD" já gerada, calcula
// quantos meses atrás ela está (mesmo critério de "i" usado para gerá-la).
const monthsAgoFromDate = (dateStr: string): number => {
  const [y, m] = dateStr.split('-').map(Number);
  const today = new Date();
  return (today.getFullYear() - y) * 12 + (today.getMonth() + 1 - m);
};

async function upsertAsset(client: any, ticker: string, investmentType?: string): Promise<number | null> {
  if (!ticker || ticker.trim() === '') return null;
  const type = investmentType && investmentType !== 'RENDA_FIXA' ? investmentType : 'Variável';
  const result = await client.query(
    `INSERT INTO assets (ticker, type) VALUES ($1, $2)
     ON CONFLICT (ticker) DO UPDATE SET type = EXCLUDED.type RETURNING id`,
    [ticker.trim().toUpperCase(), type]
  );
  return result.rows[0].id;
}

// Cartão de crédito é privado por usuário (payment_methods.user_id preenchido).
// Cria (ou atualiza) um cartão para um usuário específico e devolve o id.
async function upsertPaymentMethod(
  client: any,
  userId: number,
  name: string,
  opts: { closing_day?: number; due_day?: number; card_limit?: number } = {}
): Promise<number> {
  const result = await client.query(
    `INSERT INTO payment_methods (name, user_id, closing_day, due_day, card_limit, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (user_id, name) WHERE user_id IS NOT NULL DO UPDATE
       SET closing_day = EXCLUDED.closing_day,
           due_day      = EXCLUDED.due_day,
           card_limit   = EXCLUDED.card_limit,
           active       = TRUE
     RETURNING id`,
    [name, userId, opts.closing_day ?? null, opts.due_day ?? null, opts.card_limit ?? null]
  );
  return result.rows[0].id;
}

// Métodos padrão (Dinheiro, Pix, Débito, Transferência, Saldo Corretora) são
// globais/compartilhados (user_id NULL) — não pertencem a um usuário
// específico, todo mundo usa os mesmos.
async function upsertGlobalPaymentMethod(client: any, name: string): Promise<number> {
  const result = await client.query(
    `INSERT INTO payment_methods (name, user_id, active)
     VALUES ($1, NULL, TRUE)
     ON CONFLICT (name) WHERE user_id IS NULL DO UPDATE SET active = TRUE
     RETURNING id`,
    [name]
  );
  return result.rows[0].id;
}

interface Tx {
  uid: number; cat: string; pay: string; desc: string;
  val: number; type: 'INCOME' | 'EXPENSE'; date: string;
}

interface InvestTx {
  uid: number; cat: string; pay: string; desc: string; val: number;
  type: 'INCOME' | 'EXPENSE'; date: string;
  assetId: number | null; qty: number | null; investType: string; yieldRate: number | null;
}

async function seedDemo() {
  const client = await pool.connect();
  const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  try {
    await client.query('BEGIN');

    const existing = await client.query(`SELECT id FROM users WHERE username = ANY($1)`, [DEMO_USERNAMES]);
    const existingIds = existing.rows.map((r: { id: number }) => r.id);

    if (existingIds.length > 0) {
      await client.query(`DELETE FROM transactions   WHERE user_id = ANY($1)`, [existingIds]);
      await client.query(`DELETE FROM budgets        WHERE user_id = ANY($1)`, [existingIds]);
      await client.query(`DELETE FROM family_members WHERE user_id = ANY($1)`, [existingIds]);
      // payment_methods dos usuários demo são removidos via ON DELETE CASCADE
      // quando os usuários abaixo forem apagados.
    }

    await client.query(`
      DELETE FROM families
      WHERE id NOT IN (SELECT DISTINCT family_id FROM family_members)
    `);

    await client.query(`DELETE FROM users WHERE username = ANY($1)`, [DEMO_USERNAMES]);

    await client.query(`
      DELETE FROM assets
      WHERE id NOT IN (SELECT DISTINCT asset_id FROM transactions WHERE asset_id IS NOT NULL)
    `);

    const joseRes = await client.query(`
      INSERT INTO users (name, username, password_hash, color, role, active)
      VALUES ('José', 'jose', $1, '#2e7d32', 'member', TRUE)
      RETURNING id
    `, [demoHash]);
    const joseId: number = joseRes.rows[0].id;

    const mariaRes = await client.query(`
      INSERT INTO users (name, username, password_hash, color, role, active)
      VALUES ('Maria', 'maria', $1, '#c62828', 'member', TRUE)
      RETURNING id
    `, [demoHash]);
    const mariaId: number = mariaRes.rows[0].id;

    const catRes = await client.query('SELECT id, name FROM categories');
    const catMap: Record<string, number> = {};
    for (const row of catRes.rows) catMap[row.name] = row.id;

    // ────────────────────────────────────────────────────────────────────
    // 5. MÉTODOS DE PAGAMENTO — os "comuns" são globais/compartilhados entre
    // todos os usuários; só o cartão de crédito é privado por usuário (cada
    // um com seu próprio limite e dia de fechamento/vencimento, pra ficar
    // realista).
    // ────────────────────────────────────────────────────────────────────
    // Limites calibrados considerando o saldo comprometido REAL (mês atual +
    // parcelas futuras já comprometidas, não só o gasto do mês corrente):
    // José fica em ~83% de uso (saudável); Maria propositalmente ultrapassa
    // o limite (~121%) pra também demonstrar o estado "limite excedido" da UI.
    const JOSE_CARD_LIMIT  = 3200;
    const MARIA_CARD_LIMIT = 2600;

    const stdMeth: Record<string, number> = {
      'Dinheiro':        await upsertGlobalPaymentMethod(client, 'Dinheiro'),
      'Pix':             await upsertGlobalPaymentMethod(client, 'Pix'),
      'Débito':          await upsertGlobalPaymentMethod(client, 'Débito'),
      'Transferência':   await upsertGlobalPaymentMethod(client, 'Transferência'),
      'Saldo Corretora': await upsertGlobalPaymentMethod(client, 'Saldo Corretora'),
    };

    const cartaoJoseId  = await upsertPaymentMethod(client, joseId, 'Cartão Nubank', { closing_day: 25, due_day: 5, card_limit: JOSE_CARD_LIMIT });
    const cartaoMariaId = await upsertPaymentMethod(client, mariaId, 'Cartão Inter', { closing_day: 20, due_day: 1, card_limit: MARIA_CARD_LIMIT });

    const methMapJose: Record<string, number>  = { ...stdMeth, 'Cartão': cartaoJoseId };
    const methMapMaria: Record<string, number> = { ...stdMeth, 'Cartão': cartaoMariaId };

    const methMapFor = (uid: number) => (uid === joseId ? methMapJose : methMapMaria);

    // ────────────────────────────────────────────────────────────────────
    // 6. TRANSAÇÕES COMUNS — 18 meses (i = MONTHS-1 ... 0, 0 = mês atual)
    // ────────────────────────────────────────────────────────────────────
    const txs: Tx[] = [];

    for (let i = MONTHS - 1; i >= 0; i--) {
      txs.push({ uid: joseId,  cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 5200, type: 'INCOME', date: getDate(i, 5) });
      txs.push({ uid: mariaId, cat: 'Salário', pay: 'Pix', desc: 'Salário Mensal', val: 4800, type: 'INCOME', date: getDate(i, 5) });

      if (i % 2 === 0) txs.push({ uid: joseId, cat: 'Freelance/Projetos', pay: 'Pix', desc: 'Projeto Freelance', val: 800, type: 'INCOME', date: getDate(i, 22) });
      if (i === 12 || i === 0) txs.push({ uid: mariaId, cat: 'Bônus/PLR', pay: 'Transferência', desc: 'PLR Semestral', val: 2200, type: 'INCOME', date: getDate(i, 10) });
      if (i === 5) txs.push({ uid: joseId, cat: 'Restituição de Imposto', pay: 'Transferência', desc: 'Restituição IRPF', val: 1500, type: 'INCOME', date: getDate(i, 28) });
      if (i === 15) txs.push({ uid: mariaId, cat: 'Presentes', pay: 'Pix', desc: 'Presente em Dinheiro', val: 300, type: 'INCOME', date: getDate(i, 24) });
      if (i === 9) txs.push({ uid: joseId, cat: 'Reembolsos', pay: 'Pix', desc: 'Reembolso Plano de Saúde', val: 250, type: 'INCOME', date: getDate(i, 19) });
      if (i === 7) txs.push({ uid: mariaId, cat: 'Vendas', pay: 'Pix', desc: 'Venda Item Usado', val: 600, type: 'INCOME', date: getDate(i, 14) });
      if (i === 4) txs.push({ uid: mariaId, cat: 'Outros', pay: 'Pix', desc: 'Renda Extra', val: 180, type: 'INCOME', date: getDate(i, 11) });

      txs.push({ uid: joseId,  cat: 'Aluguel',                    pay: 'Transferência', desc: 'Aluguel Ap',            val: 1800, type: 'EXPENSE', date: getDate(i, 10) });
      txs.push({ uid: joseId,  cat: 'Condomínio',                 pay: 'Transferência', desc: 'Condomínio',            val: 450,  type: 'EXPENSE', date: getDate(i, 10) });
      txs.push({ uid: mariaId, cat: 'Energia Elétrica',           pay: 'Débito',        desc: 'Conta de Luz',          val: 220,  type: 'EXPENSE', date: getDate(i, 15) });
      txs.push({ uid: mariaId, cat: 'Água/Saneamento',            pay: 'Débito',        desc: 'Conta de Água',         val: 90,   type: 'EXPENSE', date: getDate(i, 15) });
      txs.push({ uid: joseId,  cat: 'Internet/Celular',           pay: 'Débito',        desc: 'Internet + Celular',    val: 180,  type: 'EXPENSE', date: getDate(i, 8)  });
      if (i % 2 === 0) txs.push({ uid: mariaId, cat: 'Gás', pay: 'Dinheiro', desc: 'Botijão de Gás', val: 60, type: 'EXPENSE', date: getDate(i, 20) });
      if (i === 13 || i === 2) txs.push({ uid: mariaId, cat: 'Manutenção/Reparos Casa', pay: 'Débito', desc: 'Reparo Hidráulico', val: 150, type: 'EXPENSE', date: getDate(i, 17) });
      txs.push({ uid: mariaId, cat: 'Limpeza/Produtos de Casa',   pay: 'Débito',        desc: 'Produtos de Limpeza',   val: 90,   type: 'EXPENSE', date: getDate(i, 12) });

      txs.push({ uid: mariaId, cat: 'Supermercado',   pay: 'Cartão', desc: 'Compras do Mês',    val: 950, type: 'EXPENSE', date: getDate(i, 12) });
      txs.push({ uid: joseId,  cat: 'Restaurante',    pay: 'Cartão', desc: 'Jantar Fora',        val: 220, type: 'EXPENSE', date: getDate(i, 18) });
      txs.push({ uid: mariaId, cat: 'Lanches/Cafés',  pay: 'Débito',  desc: 'Cafeteria',          val: 80,  type: 'EXPENSE', date: getDate(i, 22) });
      txs.push({ uid: joseId,  cat: 'Delivery',       pay: 'Cartão', desc: 'iFood',              val: 120, type: 'EXPENSE', date: getDate(i, 25) });
      txs.push({ uid: mariaId, cat: 'Padaria',        pay: 'Dinheiro', desc: 'Padaria do Bairro', val: 50,  type: 'EXPENSE', date: getDate(i, 3)  });

      txs.push({ uid: joseId,  cat: 'Combustível',              pay: 'Débito', desc: 'Combustível',         val: 280, type: 'EXPENSE', date: getDate(i, 14) });
      txs.push({ uid: mariaId, cat: 'Transporte Público/App',   pay: 'Débito', desc: 'Uber/Ônibus',         val: 150, type: 'EXPENSE', date: getDate(i, 16) });
      txs.push({ uid: joseId,  cat: 'Estacionamento',           pay: 'Débito', desc: 'Estacionamento',      val: 40,  type: 'EXPENSE', date: getDate(i, 9)  });
      if (i % 2 === 0) txs.push({ uid: joseId, cat: 'Pedágio', pay: 'Débito', desc: 'Pedágio Rodovia', val: 30, type: 'EXPENSE', date: getDate(i, 6) });
      if (i === 14 || i === 4) txs.push({ uid: joseId, cat: 'Mecânico', pay: 'Cartão', desc: 'Revisão do Carro', val: 450, type: 'EXPENSE', date: getDate(i, 21) });
      if (i === 17 || i === 5) txs.push({ uid: joseId, cat: 'Seguro Veicular', pay: 'Cartão', desc: 'Seguro Anual do Carro', val: 1200, type: 'EXPENSE', date: getDate(i, 27) });
      if (i === 17) txs.push({ uid: joseId, cat: 'IPVA/Licenciamento', pay: 'Transferência', desc: 'IPVA + Licenciamento', val: 800, type: 'EXPENSE', date: getDate(i, 30) });

      txs.push({ uid: mariaId, cat: 'Farmácia',        pay: 'Débito',  desc: 'Medicamentos',      val: 90,  type: 'EXPENSE', date: getDate(i, 19) });
      txs.push({ uid: mariaId, cat: 'Plano de Saúde',  pay: 'Cartão', desc: 'Plano de Saúde',     val: 420, type: 'EXPENSE', date: getDate(i, 8)  });
      txs.push({ uid: mariaId, cat: 'Terapia',         pay: 'Pix',     desc: 'Sessão de Terapia',  val: 200, type: 'EXPENSE', date: getDate(i, 13) });
      if (i === 10) txs.push({ uid: mariaId, cat: 'Dentista', pay: 'Cartão', desc: 'Tratamento Dentário', val: 300, type: 'EXPENSE', date: getDate(i, 23) });
      if (i === 8)  txs.push({ uid: joseId,  cat: 'Médico/Exames', pay: 'Cartão', desc: 'Check-up Anual', val: 350, type: 'EXPENSE', date: getDate(i, 20) });

      txs.push({ uid: joseId,  cat: 'Academia/Esportes',  pay: 'Cartão', desc: 'Mensalidade Academia', val: 120, type: 'EXPENSE', date: getDate(i, 5)  });
      txs.push({ uid: joseId,  cat: 'Barbearia/Salão',    pay: 'Dinheiro', desc: 'Corte de Cabelo',     val: 80,  type: 'EXPENSE', date: getDate(i, 15) });
      txs.push({ uid: mariaId, cat: 'Cosméticos/Higiene', pay: 'Débito',  desc: 'Produtos de Higiene',  val: 100, type: 'EXPENSE', date: getDate(i, 12) });
      if (i % 2 === 0) txs.push({ uid: mariaId, cat: 'Roupas/Acessórios', pay: 'Cartão', desc: 'Compra de Roupas', val: 250, type: 'EXPENSE', date: getDate(i, 24) });
      if (i === 11 || i === 0) txs.push({ uid: joseId, cat: 'Presentes para Outros', pay: 'Cartão', desc: 'Presente de Fim de Ano', val: 150, type: 'EXPENSE', date: getDate(i, 20) });
      txs.push({ uid: joseId,  cat: 'Lavanderia', pay: 'Dinheiro', desc: 'Lavanderia', val: 60, type: 'EXPENSE', date: getDate(i, 17) });

      if (i % 3 === 0) txs.push({ uid: mariaId, cat: 'Cursos/Treinamentos', pay: 'Pix', desc: 'Curso Online', val: 200, type: 'EXPENSE', date: getDate(i, 18) });
      if (i % 3 === 0) txs.push({ uid: mariaId, cat: 'Livros', pay: 'Pix', desc: 'Compra de Livros', val: 70, type: 'EXPENSE', date: getDate(i, 6) });
      if (i % 3 === 0) txs.push({ uid: mariaId, cat: 'Papelaria', pay: 'Débito', desc: 'Material de Escritório', val: 40, type: 'EXPENSE', date: getDate(i, 9) });
      if (i % 6 === 0) txs.push({ uid: mariaId, cat: 'Faculdade/Escola', pay: 'Transferência', desc: 'Mensalidade Curso', val: 600, type: 'EXPENSE', date: getDate(i, 10) });

      if (i % 2 === 0) txs.push({ uid: joseId, cat: 'Cinema/Shows/Teatro', pay: 'Cartão', desc: 'Cinema', val: 100, type: 'EXPENSE', date: getDate(i, 21) });
      if (i === 16 || i === 6) txs.push({ uid: joseId, cat: 'Viagens/Hospedagem', pay: 'Cartão', desc: 'Viagem de Férias', val: 2000, type: 'EXPENSE', date: getDate(i, 15) });
      txs.push({ uid: joseId, cat: 'Hobby', pay: 'Débito', desc: 'Material de Hobby', val: 100, type: 'EXPENSE', date: getDate(i, 26) });
      txs.push({ uid: joseId, cat: 'Assinaturas', pay: 'Cartão', desc: 'Streaming / Lazer', val: 150, type: 'EXPENSE', date: getDate(i, 20) });

      txs.push({ uid: mariaId, cat: 'Pet: Ração', pay: 'Cartão', desc: 'Ração Mensal', val: 130, type: 'EXPENSE', date: getDate(i, 7) });
      if (i % 3 === 0) txs.push({ uid: mariaId, cat: 'Pet: Acessórios', pay: 'Débito', desc: 'Brinquedos do Pet', val: 80, type: 'EXPENSE', date: getDate(i, 11) });
      if (i % 4 === 0) txs.push({ uid: mariaId, cat: 'Pet: Veterinário/Vacinas', pay: 'Cartão', desc: 'Consulta Veterinária', val: 200, type: 'EXPENSE', date: getDate(i, 16) });

      txs.push({ uid: joseId,  cat: 'Tarifas Bancárias',  pay: 'Débito',        desc: 'Tarifa de Conta',     val: 25,  type: 'EXPENSE', date: getDate(i, 1)  });
      txs.push({ uid: joseId,  cat: 'Juros/Empréstimos',  pay: 'Débito',        desc: 'Parcela Empréstimo',  val: 150, type: 'EXPENSE', date: getDate(i, 10) });
      txs.push({ uid: joseId,  cat: 'Seguro de Vida',     pay: 'Débito',        desc: 'Seguro de Vida',      val: 90,  type: 'EXPENSE', date: getDate(i, 5)  });
      if (i === 5) txs.push({ uid: joseId, cat: 'Impostos (IPTU/IR)', pay: 'Transferência', desc: 'IPTU Anual', val: 400, type: 'EXPENSE', date: getDate(i, 28) });
      txs.push({ uid: mariaId, cat: 'Doações', pay: 'Pix', desc: 'Doação Mensal', val: 50, type: 'EXPENSE', date: getDate(i, 4) });
      txs.push({ uid: joseId,  cat: 'Outras Despesas', pay: 'Débito', desc: 'Despesa Diversa', val: 60, type: 'EXPENSE', date: getDate(i, 27) });
    }

    for (const t of txs) {
      if (!catMap[t.cat] || !methMapFor(t.uid)[t.pay]) continue;
      await client.query(
        `INSERT INTO transactions (description, amount, type, user_id, category_id, payment_method_id, date, investment_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'OUTROS')`,
        [t.desc, t.val, t.type, t.uid, catMap[t.cat], methMapFor(t.uid)[t.pay], t.date]
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // 6.05 COMPRAS PARCELADAS NO CARTÃO — demonstra parcelamento de verdade:
    // parcelas já pagas (passadas) e parcelas ainda futuras (comprometem o
    // limite disponível hoje, mesmo sem terem "vencido" ainda).
    // ────────────────────────────────────────────────────────────────────
    interface Installment { uid: number; card: 'jose' | 'maria'; desc: string; total: number; n: number; startMonthsAgo: number; }
    const installmentPurchases: Installment[] = [
      { uid: joseId,  card: 'jose',  desc: 'Notebook Dell Inspiron', total: 3000, n: 10, startMonthsAgo: 4 },
      { uid: mariaId, card: 'maria', desc: 'Geladeira Brastemp',     total: 1800, n: 6,  startMonthsAgo: 2 },
    ];

    for (const p of installmentPurchases) {
      const groupId = randomUUID();
      const installmentValue = p.total / p.n;
      const catId = catMap['Outras Despesas'];
      const payId = methMapFor(p.uid)['Cartão'];
      if (!catId || !payId) continue;

      for (let k = 0; k < p.n; k++) {
        const monthsAgo = p.startMonthsAgo - k; // decresce; fica negativo = parcela futura
        const label = ` (${k + 1}/${p.n})`;
        await client.query(
          `INSERT INTO transactions
             (description, amount, type, user_id, category_id, payment_method_id, date, investment_type, installment_group_id)
           VALUES ($1,$2,'EXPENSE',$3,$4,$5,$6,'OUTROS',$7)`,
          [`${p.desc}${label}`, installmentValue, p.uid, catId, payId, getDate(monthsAgo, 15), groupId]
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // 6.1 ASSETS de investimento
    // ────────────────────────────────────────────────────────────────────
    const itsa4Id  = await upsertAsset(client, 'ITSA4',  'ACOES');
    const mxrf11Id = await upsertAsset(client, 'MXRF11', 'FII');
    const btcId    = await upsertAsset(client, 'BTC',    'CRIPTOS');
    const ivvb11Id = await upsertAsset(client, 'IVVB11', 'INTERNACIONAL');

    // ────────────────────────────────────────────────────────────────────
    // 6.2 TRANSAÇÕES DE INVESTIMENTO — alimentam a tela "Investimentos"
    // ────────────────────────────────────────────────────────────────────
    const investTxs: InvestTx[] = [];

    for (let i = MONTHS - 1; i >= 0; i--) {
      investTxs.push({ uid: joseId, cat: 'Investimentos - Aporte', pay: 'Saldo Corretora', desc: 'Compra ITSA4', val: 500, type: 'EXPENSE', date: getDate(i, 6), assetId: itsa4Id, qty: 50, investType: 'ACOES', yieldRate: null });
      investTxs.push({ uid: joseId, cat: 'Investimentos - Dividendos', pay: 'Saldo Corretora', desc: 'Dividendos ITSA4', val: 22, type: 'INCOME', date: getDate(i, 25), assetId: itsa4Id, qty: null, investType: 'ACOES', yieldRate: null });

      if (i % 3 === 0) investTxs.push({ uid: joseId, cat: 'Investimentos - JCP', pay: 'Saldo Corretora', desc: 'JCP ITSA4', val: 15, type: 'INCOME', date: getDate(i, 26), assetId: itsa4Id, qty: null, investType: 'ACOES', yieldRate: null });

      if (i === 8) investTxs.push({ uid: joseId, cat: 'Investimentos - Resgate', pay: 'Saldo Corretora', desc: 'Venda Parcial ITSA4', val: 220, type: 'INCOME', date: getDate(i, 27), assetId: itsa4Id, qty: 20, investType: 'ACOES', yieldRate: null });

      if (i % 3 === 0) investTxs.push({ uid: joseId, cat: 'Investimentos - Aporte', pay: 'Saldo Corretora', desc: 'Compra BTC', val: 300, type: 'EXPENSE', date: getDate(i, 2), assetId: btcId, qty: 0.005, investType: 'CRIPTOS', yieldRate: null });

      investTxs.push({ uid: joseId, cat: 'Investimentos - Aporte', pay: 'Transferência', desc: 'CDB Banco XP', val: 300, type: 'EXPENSE', date: getDate(i, 15), assetId: null, qty: null, investType: 'RENDA_FIXA', yieldRate: 100 });

      investTxs.push({ uid: mariaId, cat: 'Investimentos - Aporte', pay: 'Saldo Corretora', desc: 'Compra MXRF11', val: 400, type: 'EXPENSE', date: getDate(i, 7), assetId: mxrf11Id, qty: 40, investType: 'FII', yieldRate: null });
      investTxs.push({ uid: mariaId, cat: 'Investimentos - Dividendos', pay: 'Saldo Corretora', desc: 'Rendimento MXRF11', val: 18, type: 'INCOME', date: getDate(i, 25), assetId: mxrf11Id, qty: null, investType: 'FII', yieldRate: null });

      if (i === 8) investTxs.push({ uid: mariaId, cat: 'Investimentos - Reinvestimento', pay: 'Saldo Corretora', desc: 'Reinvestimento MXRF11', val: 100, type: 'EXPENSE', date: getDate(i, 28), assetId: mxrf11Id, qty: 10, investType: 'FII', yieldRate: null });

      if (i % 3 === 0) investTxs.push({ uid: mariaId, cat: 'Investimentos - Aporte', pay: 'Saldo Corretora', desc: 'Compra IVVB11', val: 350, type: 'EXPENSE', date: getDate(i, 3), assetId: ivvb11Id, qty: 5, investType: 'INTERNACIONAL', yieldRate: null });

      investTxs.push({ uid: mariaId, cat: 'Investimentos - Aporte', pay: 'Transferência', desc: 'Tesouro Selic', val: 250, type: 'EXPENSE', date: getDate(i, 16), assetId: null, qty: null, investType: 'RENDA_FIXA', yieldRate: 100 });
    }

    for (const t of investTxs) {
      if (!catMap[t.cat] || !methMapFor(t.uid)[t.pay]) continue;
      await client.query(
        `INSERT INTO transactions
           (description, amount, type, user_id, category_id, payment_method_id,
            date, asset_id, quantity, investment_type, yield_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [t.desc, t.val, t.type, t.uid, catMap[t.cat], methMapFor(t.uid)[t.pay], t.date, t.assetId, t.qty, t.investType, t.yieldRate]
      );
    }

    // ────────────────────────────────────────────────────────────────────
    // 6.3 PAGAMENTOS DE FATURA — quita o cartão de cada mês passado
    // (i de MONTHS-1 até 1), deixando só o mês corrente (i=0) em aberto,
    // pra mostrar tanto o histórico de faturas pagas quanto uma fatura
    // pendente na tela de "Faturas".
    // ────────────────────────────────────────────────────────────────────
    // Recalcula o total gasto no cartão por usuário/mês a partir dos `txs`
    // já definidos acima (chave "uid_i", onde i = quantos meses atrás).
    const cardSpend = new Map<string, number>();
    for (const t of txs) {
      if (t.pay !== 'Cartão' || t.type !== 'EXPENSE') continue;
      const i = monthsAgoFromDate(t.date);
      const key = `${t.uid}_${i}`;
      cardSpend.set(key, (cardSpend.get(key) ?? 0) + t.val);
    }
    // Soma as parcelas de compras parceladas (já com valor por parcela).
    for (const p of installmentPurchases) {
      for (let k = 0; k < p.n; k++) {
        const monthsAgo = p.startMonthsAgo - k;
        if (monthsAgo < 0) continue; // parcela futura, ainda não "gasta" no passado
        const key = `${p.uid}_${monthsAgo}`;
        cardSpend.set(key, (cardSpend.get(key) ?? 0) + p.total / p.n);
      }
    }

    const payFaturaCatId = catMap['Pagamento de Fatura'];
    for (const uid of [joseId, mariaId]) {
      const cardId  = methMapFor(uid)['Cartão'];
      const debitId = methMapFor(uid)['Débito'];
      if (!cardId || !debitId || !payFaturaCatId) continue;

      for (let i = MONTHS - 1; i >= 1; i--) { // deixa i=0 (mês corrente) em aberto
        const total = cardSpend.get(`${uid}_${i}`) ?? 0;
        if (total <= 0) continue;
        // Fatura da compra feita em "i meses atrás" vence no mês seguinte
        // (due_day <= closing_day pra ambos os cartões deste seed).
        const invoiceRefMonth = getYearMonth(i - 1);
        await client.query(
          `INSERT INTO transactions
             (description, amount, type, user_id, category_id, payment_method_id,
              date, investment_type, is_invoice_payment, paid_card_id, invoice_reference_month)
           VALUES ($1,$2,'EXPENSE',$3,$4,$5,$6,'OUTROS',TRUE,$7,$8)`,
          [
            `Pagamento Fatura ${uid === joseId ? 'Nubank' : 'Inter'} - ${invoiceRefMonth}`,
            total, uid, payFaturaCatId, debitId, getDate(i - 1, 3), cardId, invoiceRefMonth,
          ]
        );
      }
    }

    // ────────────────────────────────────────────────────────────────────
    // 6.4 METAS DE ORÇAMENTO (tela "Metas") — pertencem a um usuário e têm
    // um escopo: FAMILY soma o gasto de José + Maria; PERSONAL soma só o
    // gasto do próprio dono. Deixamos a maioria em FAMILY (teto da casa) e
    // um punhado em PERSONAL (gasto individual do José), pra demo mostrar
    // as duas visões na tela de Metas.
    // ────────────────────────────────────────────────────────────────────
    const monthlyBudgets: Array<{ cat: string; amount: number; scope?: 'PERSONAL' | 'FAMILY' }> = [
      { cat: 'Aluguel',                 amount: 1800 },
      { cat: 'Condomínio',              amount: 450  },
      { cat: 'Energia Elétrica',        amount: 250  },
      { cat: 'Água/Saneamento',         amount: 100  },
      { cat: 'Internet/Celular',        amount: 200  },
      { cat: 'Supermercado',            amount: 1200 },
      { cat: 'Restaurante',             amount: 300  },
      { cat: 'Delivery',                amount: 150  },
      { cat: 'Combustível',             amount: 350  },
      { cat: 'Transporte Público/App',  amount: 200  },
      { cat: 'Farmácia',                amount: 150  },
      { cat: 'Plano de Saúde',          amount: 500  },
      { cat: 'Academia/Esportes',       amount: 150,  scope: 'PERSONAL' },
      { cat: 'Assinaturas',             amount: 200  },
      { cat: 'Pet: Ração',              amount: 150  },
      { cat: 'Cursos/Treinamentos',     amount: 250,  scope: 'PERSONAL' },
      { cat: 'Roupas/Acessórios',       amount: 300,  scope: 'PERSONAL' },
    ];
    const yearlyBudgets: Array<{ cat: string; amount: number; scope?: 'PERSONAL' | 'FAMILY' }> = [
      { cat: 'Viagens/Hospedagem', amount: 4000 },
      { cat: 'Seguro Veicular',    amount: 1200 },
      { cat: 'IPVA/Licenciamento', amount: 800  },
      { cat: 'Impostos (IPTU/IR)', amount: 400  },
    ];

    for (const b of monthlyBudgets) {
      if (!catMap[b.cat]) continue;
      await client.query(
        `INSERT INTO budgets (user_id, category_id, amount, period, scope) VALUES ($1, $2, $3, 'MONTHLY', $4)
         ON CONFLICT (user_id, category_id, period) DO UPDATE SET amount = EXCLUDED.amount, scope = EXCLUDED.scope`,
        [joseId, catMap[b.cat], b.amount, b.scope ?? 'FAMILY']
      );
    }
    for (const b of yearlyBudgets) {
      if (!catMap[b.cat]) continue;
      await client.query(
        `INSERT INTO budgets (user_id, category_id, amount, period, scope) VALUES ($1, $2, $3, 'YEARLY', $4)
         ON CONFLICT (user_id, category_id, period) DO UPDATE SET amount = EXCLUDED.amount, scope = EXCLUDED.scope`,
        [joseId, catMap[b.cat], b.amount, b.scope ?? 'FAMILY']
      );
    }

    // 7. Família demo
    const famRes = await client.query(`INSERT INTO families (name) VALUES ('Família Exemplo') RETURNING id`);
    const familyId: number = famRes.rows[0].id;
    await client.query(
      `INSERT INTO family_members (family_id, user_id) VALUES ($1,$2),($1,$3)`,
      [familyId, joseId, mariaId]
    );

    await client.query('COMMIT');
    console.log('>>> seed:demo concluído! Dados de demo resetados.');
    console.log(`    jose  / exemplo123  (Cartão Nubank: limite R$ ${JOSE_CARD_LIMIT}, fecha dia 25, vence dia 5)`);
    console.log(`    maria / exemplo123  (Cartão Inter:  limite R$ ${MARIA_CARD_LIMIT}, fecha dia 20, vence dia 1)`);
    console.log(`    Família "Família Exemplo": José + Maria`);
    console.log(`    ${MONTHS} meses de histórico | transações + investimentos + metas (do José)`);
    console.log(`    Cartões: parcelamento (Notebook 10x / Geladeira 6x) + faturas passadas pagas + mês corrente em aberto`);
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