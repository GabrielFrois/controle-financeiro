import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/index.js';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não definido.');
  return secret;
}

export async function updateMyProfile(req: Request, res: Response) {
  const { name, password } = req.body;
  const userId = req.user!.userId;

  try {
    if (password) {
      const password_hash = await bcrypt.hash(password, 12);
      // Incrementa token_version: revoga todas as sessões antigas do usuário (qualquer token emitido antes da troca de senha deixa de ser aceito).
      const result = await query(
        `UPDATE users SET name = $1, password_hash = $2, token_version = token_version + 1
         WHERE id = $3
         RETURNING id, name, username, color, role, token_version`,
        [name, password_hash, userId]
      );
      const updated = result.rows[0];

      // Emite um novo token já com a versão atualizada, para que apenas o dispositivo que fez a troca continue logado
      //  os demais são desconectados na próxima requisição
      const token = jwt.sign(
        { userId: updated.id, role: updated.role, tokenVersion: updated.token_version },
        getSecret(),
        { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as any
      );

      console.info(`[AUDIT] Perfil atualizado (com senha) | userId=${userId}`);
      return res.json({ token, user: updated });
    }

    const result = await query(
      `UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, username, color, role`,
      [name, userId]
    );
    console.info(`[AUDIT] Perfil atualizado | userId=${userId}`);
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
}