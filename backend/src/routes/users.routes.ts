import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../middleware/schemas.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/',       authenticate, requireAdmin, listUsers);
router.post('/',      authenticate, requireAdmin, validate(createUserSchema), createUser);
router.put('/:id',    authenticate, requireAdmin, validate(updateUserSchema), updateUser);
router.delete('/:id', authenticate, requireAdmin, deleteUser);

export default router;