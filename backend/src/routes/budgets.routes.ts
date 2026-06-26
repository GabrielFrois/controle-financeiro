import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createBudgetSchema } from '../middleware/schemas.js';
import { listBudgets, upsertBudget, updateBudget, deleteBudget } from '../controllers/budgets.controller.js';

const router = Router();

router.get('/',       listBudgets);
router.post('/',      validate(createBudgetSchema), upsertBudget);
router.put('/:id',    validate(createBudgetSchema), updateBudget);
router.delete('/:id', deleteBudget);

export default router;