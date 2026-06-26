import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { query } from '../database/index.js';

// ─── helpers ────────────────────────────────────────────────────────────────

async function upsertAsset(ticker: string): Promise<number | null> {
  if (!ticker || ticker.trim() === '') return null;
  const result = await query(
    `INSERT INTO assets (ticker) VALUES ($1)
     ON CONFLICT (ticker) DO UPDATE SET ticker = EXCLUDED.ticker
     RETURNING id`,
    [ticker.trim().toUpperCase()]
  );
  return result.rows[0].id;
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

  // Débito/Pix
  const d = new Date(baseDate);
  d.setUTCDate(1);
  d.setUTCMonth(baseDate.getUTCMonth() + index);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(baseDate.getUTCDate(), lastDay));
  return d;
}

// ─── handlers ───────────────────────────────────────────────────────────────

export async function listTransactions(req: Request, res: Response) {
  try {
    const sql = `
      SELECT
        t.*,
        COALESCE(u.name,  'Inativo') AS user_name,
        COALESCE(u.color, '#9e9e9e') AS user_color,
        COALESCE(c.name,  'Inativa') AS category_name,
        COALESCE(c.color, '#9e9e9e') AS category_color,
        COALESCE(p.name,  'Pix')     AS payment_method_name,
        a.ticker      AS asset_ticker,
        a.manual_price
      FROM transactions t
      LEFT JOIN users           u ON t.user_id           = u.id
      LEFT JOIN categories      c ON t.category_id       = c.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      LEFT JOIN assets          a ON t.asset_id          = a.id
      ORDER BY t.date DESC, t.id DESC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
}

export async function createTransaction(req: Request, res: Response) {
  const {
    description, amount, type, category_id, user_id,
    date, payment_method_id, installments, asset_ticker,
    quantity, investment_type, yield_rate,
  } = req.body;

  try {
    const methodRes = await query('SELECT * FROM payment_methods WHERE id = $1', [payment_method_id]);
    const method = methodRes.rows[0] ?? { closing_day: null, due_day: null };

    const assetId = await upsertAsset(asset_ticker);

    const numInstallments = installments ?? 1;
    const installmentValue = amount / numInstallments;
    const baseDate = new Date(date);
    const groupId = numInstallments > 1 ? randomUUID() : null;

    const insertSql = `
      INSERT INTO transactions (
        description, amount, type, user_id, category_id,
        date, payment_method_id, asset_id, quantity, installment_group_id,
        investment_type, yield_rate
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
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
      ]);
      created.push(result.rows[0]);
    }

    res.status(201).json(created[0]);
  } catch (err) {
    console.error('Erro ao salvar transação:', err);
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
}

export async function updateTransaction(req: Request, res: Response) {
  const { id } = req.params;
  const {
    description, amount, type, category_id, user_id,
    date, payment_method_id, investment_type, yield_rate,
    asset_ticker, quantity,
  } = req.body;

  try {
    const assetId = await upsertAsset(asset_ticker);

    const result = await query(
      `UPDATE transactions
       SET description=$1, amount=$2, type=$3, category_id=$4,
           user_id=$5, date=$6, payment_method_id=$7,
           investment_type=$8, yield_rate=$9, asset_id=$10, quantity=$11
       WHERE id=$12 RETURNING *`,
      [description, amount, type, category_id, user_id, date, payment_method_id,
       investment_type ?? 'OUTROS', yield_rate ?? null, assetId, quantity ?? null, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Transação não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro no PUT /transactions:', err);
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
}

export async function updateTransactionGroup(req: Request, res: Response) {
  const { groupId } = req.params;
  const {
    description, amount, type, category_id, user_id,
    payment_method_id, referer_date, investment_type, yield_rate,
  } = req.body;

  try {
    const result = await query(
      `UPDATE transactions
       SET description=$1, amount=$2, type=$3, category_id=$4,
           user_id=$5, payment_method_id=$6, investment_type=$7, yield_rate=$8
       WHERE installment_group_id=$9 AND date >= $10
       RETURNING *`,
      [description, amount, type, category_id, user_id,
       payment_method_id, investment_type ?? 'OUTROS', yield_rate ?? null,
       groupId, referer_date]
    );
    res.json({ message: `${result.rowCount} parcelas atualizadas.`, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar grupo de parcelas' });
  }
}

export async function deleteTransactionGroup(req: Request, res: Response) {
  const { groupId } = req.params;
  try {
    await query('DELETE FROM transactions WHERE installment_group_id = $1', [groupId]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar grupo de parcelas' });
  }
}

export async function deleteTransaction(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
}