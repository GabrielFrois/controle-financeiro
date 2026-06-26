import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import {
  createTransactionSchema,
  updateTransactionSchema,
  updateGroupTransactionSchema,
} from '../middleware/schemas.js';
import {
  listTransactions, createTransaction,
  updateTransaction, updateTransactionGroup,
  deleteTransaction, deleteTransactionGroup,
} from '../controllers/transactions.controller.js';

const router = Router();

router.get('/',                         listTransactions);
router.post('/',                        validate(createTransactionSchema), createTransaction);
router.put('/group/:groupId',           validate(updateGroupTransactionSchema), updateTransactionGroup);
router.delete('/group/:groupId',        deleteTransactionGroup);
router.put('/:id',                      validate(updateTransactionSchema), updateTransaction);
router.delete('/:id',                   deleteTransaction);

export default router;