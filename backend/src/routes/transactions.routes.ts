import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createTransactionSchema, updateTransactionSchema, updateGroupTransactionSchema } from '../middleware/schemas.js';
import { authenticate } from '../middleware/auth.js';
import { listTransactions, createTransaction, updateTransaction, updateTransactionGroup, deleteTransaction, deleteTransactionGroup } from '../controllers/transactions.controller.js';

const router = Router();

router.get('/',                  authenticate, listTransactions);
router.post('/',                 authenticate, validate(createTransactionSchema), createTransaction);
router.put('/group/:groupId',    authenticate, validate(updateGroupTransactionSchema), updateTransactionGroup);
router.delete('/group/:groupId', authenticate, deleteTransactionGroup);
router.put('/:id',               authenticate, validate(updateTransactionSchema), updateTransaction);
router.delete('/:id',            authenticate, deleteTransaction);

export default router;