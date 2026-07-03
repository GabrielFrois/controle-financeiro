import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../database/index.js';

export interface AuthPayload {
  userId: number;
  role: 'admin' | 'member';
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET não definido.');
  return secret;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido.' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, getSecret()) as AuthPayload;

    // Confere se o token ainda é a "versão" atual do usuário. token_version é incrementado ao trocar senha, ser editado/desativado por um admin
    // ou deletado, isso revoga instantaneamente tokens antigos já emitidos, já que o JWT em si não pode ser invalidado antes de expirar.
    const result = await query('SELECT role, active, token_version FROM users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];

    if (!user || !user.active || user.token_version !== payload.tokenVersion) {
      return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
    }

    req.user = { ...payload, role: user.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}