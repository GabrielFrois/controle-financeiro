import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function getSummary(req: Request, res: Response) {
  const { month, year } = req.query;

  let sql = `
    SELECT
      SUM(CASE WHEN type = 'INCOME'  THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS total_expense
    FROM transactions
  `;
  const values: unknown[] = [];

  if (month && year) {
    sql += ` WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2`;
    values.push(month, year);
  } else if (year) {
    sql += ` WHERE EXTRACT(YEAR FROM date) = $1`;
    values.push(year);
  }

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