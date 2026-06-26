import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema } from '../middleware/schemas.js';
import { listUsers, createUser, updateUser, deleteUser } from '../controllers/users.controller.js';

const router = Router();

router.get('/',       listUsers);
router.post('/',      validate(createUserSchema), createUser);
router.put('/:id',    validate(updateUserSchema), updateUser);
router.delete('/:id', deleteUser);

export default router;