import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { updateMyProfile } from '../controllers/profile.controller.js';

const updateProfileSchema = z.object({
  name:     z.string().min(1, 'O nome é obrigatório.'),
  password: z
    .string()
    .min(8, 'A senha deve ter ao menos 8 caracteres.')
    .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra.')
    .regex(/[0-9]/, 'A senha deve conter ao menos um número.')
    .optional(),
});

export { updateProfileSchema };

const router = Router();
router.put('/me', authenticate, validate(updateProfileSchema), updateMyProfile);

export default router;