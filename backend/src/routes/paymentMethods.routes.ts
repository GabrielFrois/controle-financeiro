import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createPaymentMethodSchema, updatePaymentMethodSchema } from '../middleware/schemas.js';
import { authenticate } from '../middleware/auth.js';
import {
  listPaymentMethods, createPaymentMethod,
  updatePaymentMethod, deletePaymentMethod,
} from '../controllers/paymentMethods.controller.js';

const router = Router();

router.get('/',       authenticate, listPaymentMethods);
router.post('/',      authenticate, validate(createPaymentMethodSchema), createPaymentMethod);
router.put('/:id',    authenticate, validate(updatePaymentMethodSchema), updatePaymentMethod);
router.delete('/:id', authenticate, deletePaymentMethod);

export default router;