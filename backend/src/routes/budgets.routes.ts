import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createBudgetSchema } from '../middleware/schemas.js';
import { authenticate } from '../middleware/auth.js';
import { listBudgets, upsertBudget, updateBudget, deleteBudget } from '../controllers/budgets.controller.js';

const router = Router();

router.get('/',       authenticate, listBudgets);
router.post('/',      authenticate, validate(createBudgetSchema), upsertBudget);
router.put('/:id',    authenticate, validate(createBudgetSchema), updateBudget);
router.delete('/:id', authenticate, deleteBudget);

export default router;