import { Request, Response } from 'express';
import { query } from '../database/index.js';

// Budgets são globais (não têm user_id na tabela), então o controle de escrita
// é feito via role: apenas admin pode criar/editar/deletar metas.
// A rota já aplica authenticate; aqui adicionamos requireAdmin via route ou
// checagem inline para flexibilidade futura.

export async function listBudgets(_req: Request, res: Response) {
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

  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem criar metas.' });
  }

  try {
    const result = await query(
      `INSERT INTO budgets (category_id, amount, period) VALUES ($1, $2, $3)
       ON CONFLICT (category_id, period) DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [category_id, amount, period]
    );
    console.info(`[AUDIT] Meta criada/atualizada | user=${req.user!.userId} | category=${category_id} | period=${period}`);
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao salvar meta' });
  }
}

export async function updateBudget(req: Request, res: Response) {
  const { id } = req.params;
  const { category_id, amount, period } = req.body;

  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem editar metas.' });
  }

  try {
    const result = await query(
      `UPDATE budgets SET category_id=$1, amount=$2, period=$3 WHERE id=$4 RETURNING *`,
      [category_id, amount, period, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
    console.info(`[AUDIT] Meta atualizada | user=${req.user!.userId} | id=${id}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
}

export async function deleteBudget(req: Request, res: Response) {
  const { id } = req.params;

  if (req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem excluir metas.' });
  }

  try {
    const result = await query('DELETE FROM budgets WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
    console.info(`[AUDIT] Meta deletada | user=${req.user!.userId} | id=${id}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar meta' });
  }
}