import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createPaymentMethodSchema, updatePaymentMethodSchema } from '../middleware/schemas.js';
import {
  listPaymentMethods, createPaymentMethod,
  updatePaymentMethod, deletePaymentMethod,
} from '../controllers/paymentMethods.controller.js';

const router = Router();

router.get('/',       listPaymentMethods);
router.post('/',      validate(createPaymentMethodSchema), createPaymentMethod);
router.put('/:id',    validate(updatePaymentMethodSchema), updatePaymentMethod);
router.delete('/:id', deletePaymentMethod);

export default router;