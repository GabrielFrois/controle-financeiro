import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../database/index.js';

export async function listUsers(_req: Request, res: Response) {
  try {
    const result = await query(
      'SELECT id, name, email, color, role, active FROM users ORDER BY active DESC, name ASC'
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}

export async function createUser(req: Request, res: Response) {
  const { name, email, password, color, role } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, color, role, active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, name, email, color, role, active`,
      [name, email, password_hash, color, role ?? 'member']
    );
    console.info(`[AUDIT] Usuário criado | admin=${req.user!.userId} | novoUserId=${result.rows[0].id} | email=${email}`);
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'E-mail já cadastrado.' });
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req: Request, res: Response) {
  const { id } = req.params;
  const { name, email, color, active, role, password } = req.body;
  try {
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      // token_version + 1 revoga imediatamente qualquer sessão que o usuário editado já tivesse aberta (senha trocada por um admin).
      const result = await query(
        `UPDATE users SET name=$1, email=$2, color=$3, active=$4, role=$5, password_hash=$6, token_version = token_version + 1
         WHERE id=$7 RETURNING id, name, email, color, role, active`,
        [name, email, color, active, role, password_hash, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
      console.info(`[AUDIT] Usuário atualizado (com senha) | admin=${req.user!.userId} | userId=${id}`);
      return res.json(result.rows[0]);
    }
    // Papel ou status também afetam permissões da sessão em curso 
    // revoga tokens antigos para que a mudança tenha efeito imediato.
    const result = await query(
      `UPDATE users SET name=$1, email=$2, color=$3, active=$4, role=$5, token_version = token_version + 1
       WHERE id=$6 RETURNING id, name, email, color, role, active`,
      [name, email, color, active, role, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    console.info(`[AUDIT] Usuário atualizado | admin=${req.user!.userId} | userId=${id}`);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req: Request, res: Response) {
  const { id } = req.params;
  if (Number(id) === req.user!.userId) {
    return res.status(400).json({ error: 'Você não pode desativar sua própria conta.' });
  }
  try {
    // Revoga também a sessão do usuário desativado.
    await query('UPDATE users SET active = FALSE, token_version = token_version + 1 WHERE id = $1', [id]);
    console.info(`[AUDIT] Usuário desativado | admin=${req.user!.userId} | userId=${id}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao inativar usuário' });
  }
}