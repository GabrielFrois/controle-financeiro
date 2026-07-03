import { Request, Response, NextFunction } from 'express';
import { query } from '../database/index.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 10;

export async function loginIpRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  try {
    const result = await query(
      'SELECT count, window_start FROM login_ip_attempts WHERE ip = $1',
      [ip]
    );
    const row = result.rows[0];
    const windowExpired = !row || Date.now() - new Date(row.window_start).getTime() > WINDOW_MS;

    if (windowExpired) {
      await query(
        `INSERT INTO login_ip_attempts (ip, count, window_start) VALUES ($1, 1, NOW())
         ON CONFLICT (ip) DO UPDATE SET count = 1, window_start = NOW()`,
        [ip]
      );
      return next();
    }

    if (row.count >= MAX_ATTEMPTS) {
      console.warn(`[AUDIT] Rate limit de login atingido | ip=${ip}`);
      return res.status(429).json({ error: 'Muitas tentativas de login. Tente novamente em alguns minutos.' });
    }

    await query('UPDATE login_ip_attempts SET count = count + 1 WHERE ip = $1', [ip]);
    next();
  } catch (err) {
    // Uma falha ao checar o rate limit não deve impedir o login de funcionar.
    console.error('[ipRateLimit] erro ao verificar rate limit:', err);
    next();
  }
}