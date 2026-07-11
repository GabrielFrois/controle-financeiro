import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function getSummary(req: Request, res: Response) {
  const { month, year, user_ids } = req.query;

  const values: unknown[] = [];
  const conditions: string[] = [];

  // Filtro por período (sempre referenciando a tabela via alias t)
  if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM t.date) = $${values.length + 1} AND EXTRACT(YEAR FROM t.date) = $${values.length + 2}`);
    values.push(month, year);
  } else if (year) {
    conditions.push(`EXTRACT(YEAR FROM t.date) = $${values.length + 1}`);
    values.push(year);
  }

  // Filtro por usuários — escopo de visibilidade
  if (user_ids) {
    const ids = (user_ids as string).split(',').map(Number).filter((n) => !isNaN(n));
    if (ids.length > 0) {
      conditions.push(`t.user_id = ANY($${values.length + 1}::int[])`);
      values.push(ids);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Uma compra no cartão de crédito (payment_methods.closing_day != null) só
  // deve impactar receitas/despesas quando a fatura dela for paga
  // (is_invoice_payment = TRUE), não no momento da compra — assim como no
  // extrato bancário real, o dinheiro só sai quando a fatura é quitada.
  const sql = `
    SELECT
      SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END) AS total_income,
      SUM(
        CASE
          WHEN t.type = 'EXPENSE'
           AND NOT (pm.closing_day IS NOT NULL AND t.is_invoice_payment = FALSE)
          THEN t.amount
          ELSE 0
        END
      ) AS total_expense
    FROM transactions t
    LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
    ${where}
  `;

  try {
    const result = await query(sql, values);
    const { total_income, total_expense } = result.rows[0];
    const income  = parseFloat(total_income  || 0);
    const expense = parseFloat(total_expense || 0);
    res.json({ income, expense, balance: income - expense });
  } catch {
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
}