import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { updateAssetPriceSchema } from '../middleware/schemas.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { listAssets, updateAssetPrice, getAssetPrices } from '../controllers/assets.controller.js';

const router = Router();

router.get('/prices', authenticate, getAssetPrices);
router.get('/',       authenticate, listAssets);
router.put('/price',  authenticate, requireAdmin, validate(updateAssetPriceSchema), updateAssetPrice);

export default router;