import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../middleware/schemas.js';
import { loginIpRateLimit } from '../middleware/ipRateLimit.js';

const router = Router();

// Rate limit por IP persistido no banco
// ver middleware/ipRateLimit.ts para o motivo de não usar um limitador em memória (não sobrevive em serverless).
router.post('/login', loginIpRateLimit, validate(loginSchema), login);
router.get('/me',     authenticate, getMe);

export default router;