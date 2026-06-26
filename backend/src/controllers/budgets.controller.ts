import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function listBudgets(req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT b.*, c.name AS category_name
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      ORDER BY b.period DESC, c.name ASC
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
}

export async function upsertBudget(req: Request, res: Response) {
  const { category_id, amount, period } = req.body;
  try {
    const result = await query(
      `INSERT INTO budgets (category_id, amount, period) VALUES ($1, $2, $3)
       ON CONFLICT (category_id, period) DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [category_id, amount, period]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao salvar meta' });
  }
}

export async function updateBudget(req: Request, res: Response) {
  const { id } = req.params;
  const { category_id, amount, period } = req.body;
  try {
    const result = await query(
      `UPDATE budgets SET category_id=$1, amount=$2, period=$3 WHERE id=$4 RETURNING *`,
      [category_id, amount, period, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
}

export async function deleteBudget(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('DELETE FROM budgets WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar meta' });
  }
}