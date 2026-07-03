import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/index.js';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não definido.');
  return secret;
}

// Hash "morto" usado apenas para igualar o tempo de resposta ao de uma senha incorreta quando o usuário não existe, está bloqueado ou inativo
// evita enumeração de e-mails por análise de latência (timing attack).
const DUMMY_HASH = '$2b$12$RM6VtZdBstYymjk444OeI.9SPvrKAAhUZ/JdeaZNtwM.DPX0SBe6C';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

const GENERIC_ERROR = { error: 'E-mail ou senha incorretos.' };

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  try {
    const result = await query(
      'SELECT id, name, email, password_hash, role, color, active, failed_attempts, locked_at, token_version FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    // Conta bloqueada por excesso de tentativas: verifica se o bloqueio ainda está ativo.
    const isLocked =
      user?.locked_at && Date.now() - new Date(user.locked_at).getTime() < LOCK_DURATION_MS;

    if (!user || !user.active || isLocked) {
      // Mesmo custo de bcrypt.compare de um caso de senha incorreta, para não vazar (por timing) se o e-mail existe, está inativo ou está bloqueado.
      await bcrypt.compare(password ?? '', DUMMY_HASH);
      const reason = !user ? 'email não encontrado' : !user.active ? 'usuário inativo' : 'conta bloqueada';
      console.warn(`[AUDIT] Login falhou — ${reason} | email=${email} | ip=${ip}`);
      return res.status(401).json(GENERIC_ERROR);
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const attempts = (user.failed_attempts ?? 0) + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await query(
        `UPDATE users SET failed_attempts = $1, locked_at = ${shouldLock ? 'NOW()' : 'locked_at'} WHERE id = $2`,
        [attempts, user.id]
      );
      console.warn(
        `[AUDIT] Login falhou — senha incorreta | userId=${user.id} | tentativa=${attempts} | ip=${ip}${shouldLock ? ' | CONTA BLOQUEADA' : ''}`
      );
      return res.status(401).json(GENERIC_ERROR);
    }

    // Login bem-sucedido: zera tentativas e bloqueio.
    await query('UPDATE users SET failed_attempts = 0, locked_at = NULL WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, role: user.role, tokenVersion: user.token_version ?? 0 },
      getSecret(),
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as any
    );

    console.info(`[AUDIT] Login bem-sucedido | userId=${user.id} | ip=${ip}`);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, color: user.color },
    });
  } catch {
    res.status(500).json({ error: 'Erro interno no login.' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const result = await query(
      'SELECT id, name, email, role, color, active FROM users WHERE id = $1',
      [req.user!.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }
}