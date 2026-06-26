import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function listUsers(req: Request, res: Response) {
  try {
    const result = await query('SELECT * FROM users ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  const { name, color } = req.body;
  try {
    const result = await query(
      'INSERT INTO users (name, color, active) VALUES ($1, $2, TRUE) RETURNING *',
      [name, color]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { name, color, active } = req.body;
  try {
    const result = await query(
      'UPDATE users SET name = $1, color = $2, active = $3 WHERE id = $4 RETURNING *',
      [name, color, active]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao inativar usuário' });
  }
}