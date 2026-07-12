import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { query } from '../database/index.js';
import { checkCardLimit } from '../utils/creditCard.js';
import { resolveAllowedUserIds } from '../utils/familyAccess.js';

// ── helpers de asset ──────────────────────────────────────────────────────

async function upsertAsset(ticker: string, investmentType?: string): Promise<number | null> {
  if (!ticker || ticker.trim() === '') return null;

  const type = investmentType && investmentType !== 'RENDA_FIXA' ? investmentType : 'Variável';

  const result = await query(
    `INSERT INTO assets (ticker, type)
     VALUES ($1, $2)
     ON CONFLICT (ticker) DO UPDATE SET type = EXCLUDED.type
     RETURNING id`,
    [ticker.trim().toUpperCase(), type]
  );
  return result.rows[0].id;
}

// Remove assets que não possuem mais nenhuma transação vinculada
// Chamado após qualquer operação de delete
async function cleanOrphanAssets(): Promise<void> {
  await query(`
    DELETE FROM assets
    WHERE id NOT IN (
      SELECT DISTINCT asset_id FROM transactions WHERE asset_id IS NOT NULL
    )
  `);
}

function buildInstallmentDate(
  baseDate: Date,
  index: number,
  method: { closing_day: number | null; due_day: number | null }
): Date {
  if (method.closing_day && method.due_day) {
    const purchaseDay = baseDate.getUTCDate();
    const boughtAfterClosing = purchaseDay >= method.closing_day;
    let closingMonth = baseDate.getUTCMonth() + (boughtAfterClosing ? 1 : 0);
    let closingYear = baseDate.getUTCFullYear();
    if (closingMonth > 11) { closingMonth -= 12; closingYear += 1; }

    const venceMesSeguinte = method.due_day <= method.closing_day;
    let dueMonth = closingMonth + (venceMesSeguinte ? 1 : 0) + index;
    let dueYear = closingYear;
    dueYear += Math.floor(dueMonth / 12);
    dueMonth = dueMonth % 12;

    return new Date(Date.UTC(dueYear, dueMonth, method.due_day));
  }

  // Débito / Pix
  const d = new Date(baseDate);
  d.setUTCDate(1);
  d.setUTCMonth(baseDate.getUTCMonth() + index);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(baseDate.getUTCDate(), lastDay));
  return d;
}

// ── helpers de posse / limite (antes duplicados em create/update/updateGroup) ──
//
// As três rotas de escrita (criar, editar uma transação, editar um grupo de
// parcelas) repetiam a mesma checagem de posse do método de pagamento, a
// mesma checagem de posse do cartão da fatura e a mesma checagem de limite
// de crédito. Isso foi extraído para as funções abaixo para que as três
// cópias não pudessem divergir silenciosamente com o tempo.

interface OwnershipError {
  status: number;
  error: string;
}

// Métodos padrão (user_id NULL) são compartilhados: qualquer usuário pode
// usá-los. Cartões de crédito são privados: só o dono pode lançar/editar uma
// transação usando o próprio cartão — mesmo admin não pode usar o cartão de
// outro usuário ao lançar em nome dele.
async function resolveOwnedPaymentMethod(
  paymentMethodId: number,
  requesterId: number
): Promise<{ method: any } | { error: OwnershipError }> {
  const methodRes = await query(
    'SELECT * FROM payment_methods WHERE id = $1 AND (user_id = $2 OR user_id IS NULL)',
    [paymentMethodId, requesterId]
  );
  if (methodRes.rowCount === 0) {
    return { error: { status: 403, error: 'Método de pagamento não encontrado ou não pertence a você.' } };
  }
  return { method: methodRes.rows[0] };
}

function isOwnershipError(x: { method: any } | { error: OwnershipError }): x is { error: OwnershipError } {
  return 'error' in x;
}

// Pagamento de fatura sempre se refere a um cartão real, que é sempre
// privado — aqui não faz sentido aceitar user_id IS NULL.
async function assertOwnsInvoiceCard(
  paidCardId: number,
  requesterId: number
): Promise<OwnershipError | null> {
  const cardOwnCheck = await query(
    'SELECT 1 FROM payment_methods WHERE id = $1 AND user_id = $2',
    [paidCardId, requesterId]
  );
  if (cardOwnCheck.rowCount === 0) {
    return { status: 403, error: 'O cartão desta fatura não pertence a você.' };
  }
  return null;
}

// Como um cartão real: o valor TOTAL da compra é comprometido do limite no
// ato da compra, mesmo que seja parcelada — não apenas a parcela do mês
// corrente. Pagamentos de fatura (isInvoicePayment) não passam por aqui,
// pois são debitados de uma conta/carteira, não do próprio cartão.
async function assertWithinCreditLimit(
  method: { name: string; closing_day: number | null; card_limit: number | null },
  paymentMethodId: number,
  type: string,
  isInvoicePayment: boolean,
  amount: number,
  excludeIds: number[] = []
): Promise<OwnershipError | null> {
  const isCreditCardPurchase = type === 'EXPENSE' && !isInvoicePayment && method.closing_day != null;
  if (!isCreditCardPurchase) return null;

  const limitCheck = await checkCardLimit(method.card_limit, paymentMethodId, amount, excludeIds);
  if (!limitCheck.ok) {
    return {
      status: 400,
      error: `Limite insuficiente no cartão "${method.name}". Disponível: R$ ${limitCheck.availableLimit!.toFixed(2)}, valor: R$ ${amount.toFixed(2)}.`,
    };
  }
  return null;
}

// ── handlers ───────────────────────────────────────────────────────────────

export async function listTransactions(req: Request, res: Response) {
  try {
    // Antes: sem `user_ids` na query a cláusula WHERE sumia inteira, e
    // qualquer usuário autenticado que chamasse a rota sem esse parâmetro
    // (ou com o id de outra pessoa) via as transações de todo mundo no
    // sistema. Agora a lista é sempre validada contra a própria família de
    // quem está logado — nunca "todo mundo", e nunca alguém fora da família.
    const userIds = await resolveAllowedUserIds(req.user!.userId, req.query.user_ids as string | undefined);

    // Filtro de período opcional (YYYY-MM-DD). Quando ausente, mantém o
    // comportamento anterior (histórico completo) — telas como Investments
    // e Budgets ainda dependem disso. Reports.tsx, que já tem um seletor de
    // datas na própria UI, agora manda start_date/end_date para não baixar
    // o histórico inteiro a cada consulta.
    const { start_date, end_date } = req.query as { start_date?: string; end_date?: string };
    const dateConditions: string[] = [];
    const params: unknown[] = [userIds];

    if (start_date) {
      dateConditions.push(`t.date >= $${params.length + 1}`);
      params.push(start_date);
    }
    if (end_date) {
      dateConditions.push(`t.date <= $${params.length + 1}`);
      params.push(end_date);
    }
    const dateWhere = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        t.*,
        COALESCE(u.name,  'Inativo') AS user_name,
        COALESCE(u.color, '#9e9e9e') AS user_color,
        COALESCE(c.name,  'Inativa') AS category_name,
        COALESCE(c.color, '#9e9e9e') AS category_color,
        COALESCE(p.name,  'Pix')     AS payment_method_name,
        p.closing_day  AS payment_method_closing_day,
        a.ticker       AS asset_ticker,
        a.manual_price
      FROM transactions t
      LEFT JOIN users           u ON t.user_id           = u.id
      LEFT JOIN categories      c ON t.category_id       = c.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      LEFT JOIN assets          a ON t.asset_id          = a.id
      WHERE t.user_id = ANY($1::int[])
      ${dateWhere}
      ORDER BY t.date DESC, t.id DESC
    `;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
}

export async function createTransaction(req: Request, res: Response) {
  const {
    description, amount, type, category_id,
    date, payment_method_id, installments, asset_ticker,
    quantity, investment_type, yield_rate,
    is_invoice_payment, paid_card_id, invoice_reference_month,
  } = req.body;

  // Membros comuns só podem lançar transações em nome de si mesmos
  // o user_id enviado no corpo é ignorado nesse caso
  // Apenas admins podem lançar em nome de outro membro da família
  const isAdmin = req.user!.role === 'admin';
  const user_id = isAdmin ? req.body.user_id : req.user!.userId;

  try {
    const resolved = await resolveOwnedPaymentMethod(payment_method_id, req.user!.userId);
    if (isOwnershipError(resolved)) {
      return res.status(resolved.error.status).json({ error: resolved.error.error });
    }
    const method = resolved.method;

    if (is_invoice_payment && paid_card_id) {
      const invoiceError = await assertOwnsInvoiceCard(paid_card_id, req.user!.userId);
      if (invoiceError) return res.status(invoiceError.status).json({ error: invoiceError.error });
    }

    const limitError = await assertWithinCreditLimit(
      method, payment_method_id, type, !!is_invoice_payment, Number(amount)
    );
    if (limitError) return res.status(limitError.status).json({ error: limitError.error });

    const assetId = await upsertAsset(asset_ticker, investment_type);

    const numInstallments = installments ?? 1;
    const installmentValue = amount / numInstallments;
    const baseDate = new Date(date);
    const groupId = numInstallments > 1 ? randomUUID() : null;

    const insertSql = `
      INSERT INTO transactions (
        description, amount, type, user_id, category_id,
        date, payment_method_id, asset_id, quantity, installment_group_id,
        investment_type, yield_rate,
        is_invoice_payment, paid_card_id, invoice_reference_month
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `;

    const created = [];
    for (let i = 0; i < numInstallments; i++) {
      const label = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';
      const installmentDate = buildInstallmentDate(baseDate, i, method);

      const result = await query(insertSql, [
        `${description}${label}`,
        installmentValue,
        type,
        user_id,
        category_id,
        installmentDate.toISOString().split('T')[0],
        payment_method_id,
        assetId,
        quantity ?? null,
        groupId,
        investment_type ?? 'OUTROS',
        yield_rate ?? null,
        !!is_invoice_payment,
        paid_card_id ?? null,
        invoice_reference_month ?? null,
      ]);
      created.push(result.rows[0]);
    }

    console.info(`[AUDIT] Transação criada | user=${req.user!.userId} | tipo=${type} | valor=${amount}`);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error('Erro ao salvar transação:', err);
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
}

export async function updateTransaction(req: Request, res: Response) {
  const { id } = req.params;
  const {
    description, amount, type, category_id,
    date, payment_method_id, investment_type, yield_rate,
    asset_ticker, quantity,
    is_invoice_payment, paid_card_id, invoice_reference_month,
  } = req.body;

  const isAdmin = req.user!.role === 'admin';
  // Membro comum não pode reatribuir a transação para outro user_id.
  const user_id = isAdmin ? req.body.user_id : req.user!.userId;

  try {
    const resolved = await resolveOwnedPaymentMethod(payment_method_id, req.user!.userId);
    if (isOwnershipError(resolved)) {
      return res.status(resolved.error.status).json({ error: resolved.error.error });
    }
    const method = resolved.method;

    if (is_invoice_payment && paid_card_id) {
      const invoiceError = await assertOwnsInvoiceCard(paid_card_id, req.user!.userId);
      if (invoiceError) return res.status(invoiceError.status).json({ error: invoiceError.error });
    }

    // Exclui a própria transação (valor antigo) do cálculo do saldo
    // comprometido antes de validar o novo valor.
    const limitError = await assertWithinCreditLimit(
      method, payment_method_id, type, !!is_invoice_payment, Number(amount), [Number(id)]
    );
    if (limitError) return res.status(limitError.status).json({ error: limitError.error });

    // Nota: o clause de ownership referencia o parâmetro que vem DEPOIS do
    // id ($16), não o próprio id ($15) — do contrário a comparação seria
    // user_id = id_da_transação, que nunca corresponde ao usuário logado.
    const ownerClause = isAdmin ? '' : 'AND user_id = $16';
    const params: any[] = [
      description, amount, type, category_id, user_id,
      date, payment_method_id, investment_type ?? 'OUTROS',
      yield_rate ?? null, await upsertAsset(asset_ticker, investment_type),
      quantity ?? null,
      !!is_invoice_payment, paid_card_id ?? null, invoice_reference_month ?? null,
      id,
    ];
    if (!isAdmin) params.push(req.user!.userId);

    const result = await query(
      `UPDATE transactions
       SET description=$1, amount=$2, type=$3, category_id=$4,
           user_id=$5, date=$6, payment_method_id=$7,
           investment_type=$8, yield_rate=$9, asset_id=$10, quantity=$11,
           is_invoice_payment=$12, paid_card_id=$13, invoice_reference_month=$14
       WHERE id=$15 ${ownerClause}
       RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transação não encontrada ou sem permissão.' });
    }

    // Limpa assets órfãos caso o ticker tenha sido removido/trocado na edição
    await cleanOrphanAssets();

    console.info(`[AUDIT] Transação atualizada | user=${req.user!.userId} | id=${id}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro no PUT /transactions:', err);
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
}

export async function updateTransactionGroup(req: Request, res: Response) {
  const { groupId } = req.params;
  const {
    description, amount, type, category_id,
    payment_method_id, referer_date, investment_type, yield_rate,
  } = req.body;

  const isAdmin = req.user!.role === 'admin';
  const user_id = isAdmin ? req.body.user_id : req.user!.userId;

  try {
    // ── Checagem de posse + limite ───────────────────────────────────────────
    // `amount` aqui é o valor de CADA parcela futura. O compromisso total
    // que essa edição representa é amount × (nº de parcelas futuras do
    // grupo), e essas parcelas futuras devem ser excluídas do saldo
    // comprometido atual do cartão antes de validar o novo valor.
    if (type === 'EXPENSE' && payment_method_id) {
      const resolved = await resolveOwnedPaymentMethod(payment_method_id, req.user!.userId);
      if (isOwnershipError(resolved)) {
        return res.status(resolved.error.status).json({ error: resolved.error.error });
      }
      const method = resolved.method;

      if (method.closing_day != null) {
        const futureRes = await query(
          `SELECT id FROM transactions WHERE installment_group_id = $1 AND date >= $2`,
          [groupId, referer_date]
        );
        const futureIds: number[] = futureRes.rows.map((r: any) => r.id);
        const newTotalForFuture = Number(amount) * Math.max(1, futureIds.length);

        const limitError = await assertWithinCreditLimit(
          method, payment_method_id, type, false, newTotalForFuture, futureIds
        );
        if (limitError) return res.status(limitError.status).json({ error: limitError.error });
      }
    }

    const ownerClause = isAdmin ? '' : 'AND user_id = $11';
    const params: any[] = [
      description, amount, type, category_id, user_id,
      payment_method_id, investment_type ?? 'OUTROS', yield_rate ?? null,
      groupId, referer_date,
    ];
    if (!isAdmin) params.push(req.user!.userId);

    const result = await query(
      `UPDATE transactions
       SET description=$1, amount=$2, type=$3, category_id=$4,
           user_id=$5, payment_method_id=$6, investment_type=$7, yield_rate=$8
       WHERE installment_group_id=$9 AND date >= $10 ${ownerClause}
       RETURNING *`,
      params
    );

    await cleanOrphanAssets();

    console.info(`[AUDIT] Grupo de parcelas atualizado | user=${req.user!.userId} | group=${groupId} | rows=${result.rowCount}`);
    res.json({ message: `${result.rowCount} parcelas atualizadas.`, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar grupo de parcelas' });
  }
}

export async function deleteTransactionGroup(req: Request, res: Response) {
  const { groupId } = req.params;
  try {
    const isAdmin = req.user!.role === 'admin';
    const ownerClause = isAdmin ? '' : 'AND user_id = $2';
    const params: any[] = [groupId];
    if (!isAdmin) params.push(req.user!.userId);

    const result = await query(
      `DELETE FROM transactions WHERE installment_group_id = $1 ${ownerClause}`,
      params
    );

    await cleanOrphanAssets();

    console.info(`[AUDIT] Grupo de parcelas deletado | user=${req.user!.userId} | group=${groupId} | rows=${result.rowCount}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar grupo de parcelas' });
  }
}

export async function deleteTransaction(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const isAdmin = req.user!.role === 'admin';
    const ownerClause = isAdmin ? '' : 'AND user_id = $2';
    const params: any[] = [id];
    if (!isAdmin) params.push(req.user!.userId);

    const result = await query(
      `DELETE FROM transactions WHERE id = $1 ${ownerClause}`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transação não encontrada ou sem permissão.' });
    }

    await cleanOrphanAssets();

    console.info(`[AUDIT] Transação deletada | user=${req.user!.userId} | id=${id}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
}