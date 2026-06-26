import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function listCategories(req: Request, res: Response) {
  try {
    const result = await query('SELECT * FROM categories ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
}

export async function createCategory(req: Request, res: Response) {
  const { name, type, color } = req.body;
  try {
    const result = await query(
      'INSERT INTO categories (name, type, color, active) VALUES ($1, $2, $3, TRUE) RETURNING *',
      [name, type, color]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
}

export async function updateCategory(req: Request, res: Response) {
  const { id } = req.params;
  const { name, type, color, active } = req.body;
  try {
    const result = await query(
      'UPDATE categories SET name = $1, type = $2, color = $3, active = $4 WHERE id = $5 RETURNING *',
      [name, type, color, active, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Categoria não encontrada.' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
}

export async function deleteCategory(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('UPDATE categories SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao inativar categoria' });
  }
}