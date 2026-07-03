import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function getSummary(req: Request, res: Response) {
  const { month, year, user_ids } = req.query;

  const values: unknown[] = [];
  const conditions: string[] = [];

  // Filtro por período
  if (month && year) {
    conditions.push(`EXTRACT(MONTH FROM date) = $${values.length + 1} AND EXTRACT(YEAR FROM date) = $${values.length + 2}`);
    values.push(month, year);
  } else if (year) {
    conditions.push(`EXTRACT(YEAR FROM date) = $${values.length + 1}`);
    values.push(year);
  }

  // Filtro por usuários — escopo de visibilidade
  if (user_ids) {
    const ids = (user_ids as string).split(',').map(Number).filter((n) => !isNaN(n));
    if (ids.length > 0) {
      conditions.push(`user_id = ANY($${values.length + 1}::int[])`);
      values.push(ids);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expense
    FROM transactions
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