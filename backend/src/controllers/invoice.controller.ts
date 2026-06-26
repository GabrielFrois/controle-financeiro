import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function getInvoice(req: Request, res: Response) {
  const { payment_method_id, reference_month, reference_year } = req.query;

  if (!payment_method_id || !reference_month || !reference_year) {
    return res.status(400).json({
      error: 'payment_method_id, reference_month e reference_year são obrigatórios.',
    });
  }

  try {
    const methodRes = await query('SELECT * FROM payment_methods WHERE id = $1', [payment_method_id]);
    if (methodRes.rowCount === 0) return res.status(404).json({ error: 'Cartão não encontrado.' });

    const card = methodRes.rows[0];
    const closingDay: number = card.closing_day ?? 1;
    const dueDay: number = card.due_day ?? 10;
    const cardLimit: number = parseFloat(card.card_limit ?? 0);

    const month = parseInt(reference_month as string);
    const year  = parseInt(reference_year  as string);

    const cycleEnd   = new Date(Date.UTC(year, month - 1, closingDay));
    const cycleStart = new Date(Date.UTC(year, month - 2, closingDay + 1));

    let dueMonth = month - 1; // 0-indexed
    let dueYear  = year;
    if (dueDay <= closingDay) dueMonth = month;
    if (dueMonth > 11) { dueMonth = 0; dueYear++; }
    const dueDate = new Date(Date.UTC(dueYear, dueMonth, dueDay));

    const cycleStartStr = cycleStart.toISOString().split('T')[0];
    const cycleEndStr   = cycleEnd.toISOString().split('T')[0];

    const txRes = await query(
      `SELECT t.*,
              COALESCE(u.name,  'Inativo') AS user_name,
              COALESCE(u.color, '#9e9e9e') AS user_color,
              COALESCE(c.name,  'Inativa') AS category_name,
              COALESCE(c.color, '#9e9e9e') AS category_color
       FROM transactions t
       LEFT JOIN users       u ON t.user_id     = u.id
       LEFT JOIN categories  c ON t.category_id = c.id
       WHERE t.payment_method_id = $1
         AND t.date >= $2
         AND t.date <= $3
         AND t.type = 'EXPENSE'
       ORDER BY t.date DESC, t.id DESC`,
      [payment_method_id, cycleStartStr, cycleEndStr]
    );

    const transactions = txRes.rows;
    const totalInvoice  = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const availableLimit = cardLimit > 0 ? cardLimit - totalInvoice : null;

    res.json({
      card: { id: card.id, name: card.name, closing_day: closingDay, due_day: dueDay, card_limit: cardLimit },
      cycle: { start: cycleStartStr, end: cycleEndStr, due_date: dueDate.toISOString().split('T')[0] },
      summary: {
        total_invoice:    totalInvoice,
        card_limit:       cardLimit,
        available_limit:  availableLimit,
        limit_used_pct:   cardLimit > 0 ? (totalInvoice / cardLimit) * 100 : null,
      },
      transactions,
    });
  } catch (err) {
    console.error('[Invoice] Erro:', err);
    res.status(500).json({ error: 'Erro ao calcular fatura.' });
  }
}