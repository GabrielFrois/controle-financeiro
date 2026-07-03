import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function listFamilies(_req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT f.id, f.name,
        json_agg(json_build_object('id', u.id, 'name', u.name, 'color', u.color, 'email', u.email) ORDER BY u.name) AS members
      FROM families f
      JOIN family_members fm ON fm.family_id = f.id
      JOIN users u           ON u.id = fm.user_id
      GROUP BY f.id ORDER BY f.name
    `);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar famílias.' });
  }
}

export async function createFamily(req: Request, res: Response) {
  const { name, member_ids }: { name: string; member_ids: number[] } = req.body;
  try {
    const fRes = await query('INSERT INTO families (name) VALUES ($1) RETURNING id', [name]);
    const familyId = fRes.rows[0].id;
    for (const userId of member_ids) {
      await query(
        'INSERT INTO family_members (family_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [familyId, userId]
      );
    }
    res.status(201).json({ id: familyId, name, member_ids });
  } catch {
    res.status(500).json({ error: 'Erro ao criar família.' });
  }
}

export async function updateFamily(req: Request, res: Response) {
  const { id } = req.params;
  const { name, member_ids }: { name: string; member_ids: number[] } = req.body;
  try {
    await query('UPDATE families SET name = $1 WHERE id = $2', [name, id]);
    await query('DELETE FROM family_members WHERE family_id = $1', [id]);
    for (const userId of member_ids) {
      await query('INSERT INTO family_members (family_id, user_id) VALUES ($1, $2)', [id, userId]);
    }
    res.json({ id, name, member_ids });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar família.' });
  }
}

export async function deleteFamily(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('DELETE FROM families WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar família.' });
  }
}

export async function myFamilies(req: Request, res: Response) {
  try {
    const result = await query(`
      SELECT f.id, f.name,
        json_agg(json_build_object('id', u.id, 'name', u.name, 'color', u.color) ORDER BY u.name) AS members
      FROM families f
      JOIN family_members fm ON fm.family_id = f.id
      JOIN users u           ON u.id = fm.user_id
      WHERE f.id IN (SELECT family_id FROM family_members WHERE user_id = $1)
      GROUP BY f.id ORDER BY f.name
    `, [req.user!.userId]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar suas famílias.' });
  }
}