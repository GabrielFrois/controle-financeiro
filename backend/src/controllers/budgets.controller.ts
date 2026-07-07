import { Request, Response } from 'express';
import { query } from '../database/index.js';

// Metas agora são pessoais: cada usuário cria/edita/apaga as suas próprias
// (dono ou admin). A tela usa esses limites junto com o gasto agregado da
// família do dono (calculado no frontend a partir de /transactions).

export async function listBudgets(req: Request, res: Response) {
  // Visibilidade segue o toggle "Só eu / Família" do frontend (mesmo padrão do
  // /transactions): sem parâmetro, mostra só as próprias; com vários ids,
  // mostra a meta de cada um deles.
  const { user_ids } = req.query;
  const ids = user_ids
    ? String(user_ids).split(',').map(Number).filter((n) => Number.isInteger(n))
    : [req.user!.userId];

  try {
    const result = await query(`
      SELECT b.*, c.name AS category_name, u.name AS user_name, u.color AS user_color
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      JOIN users u      ON b.user_id = u.id
      WHERE b.user_id = ANY($1)
      ORDER BY b.period DESC, c.name ASC
    `, [ids]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
}

export async function upsertBudget(req: Request, res: Response) {
  const { category_id, amount, period } = req.body;
  const userId = req.user!.userId;

  try {
    const result = await query(
      `INSERT INTO budgets (user_id, category_id, amount, period) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category_id, period) DO UPDATE SET amount = EXCLUDED.amount
       RETURNING *`,
      [userId, category_id, amount, period]
    );
    console.info(`[AUDIT] Meta criada/atualizada | user=${userId} | category=${category_id} | period=${period}`);
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao salvar meta' });
  }
}

export async function updateBudget(req: Request, res: Response) {
  const { id } = req.params;
  const { category_id, amount, period } = req.body;
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  try {
    const result = await query(
      `UPDATE budgets SET category_id=$1, amount=$2, period=$3
       WHERE id=$4 AND ($5::boolean OR user_id = $6)
       RETURNING *`,
      [category_id, amount, period, id, isAdmin, userId]
    );
    if (result.rowCount === 0) {
      // Distingue "não existe" de "existe mas não é sua" pra dar uma mensagem melhor.
      const check = await query('SELECT id FROM budgets WHERE id = $1', [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
      return res.status(403).json({ error: 'Você só pode editar as suas próprias metas.' });
    }
    console.info(`[AUDIT] Meta atualizada | user=${userId} | id=${id}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
}

export async function deleteBudget(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  try {
    const result = await query(
      'DELETE FROM budgets WHERE id = $1 AND ($2::boolean OR user_id = $3) RETURNING id',
      [id, isAdmin, userId]
    );
    if (result.rowCount === 0) {
      const check = await query('SELECT id FROM budgets WHERE id = $1', [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
      return res.status(403).json({ error: 'Você só pode excluir as suas próprias metas.' });
    }
    console.info(`[AUDIT] Meta deletada | user=${userId} | id=${id}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar meta' });
  }
}