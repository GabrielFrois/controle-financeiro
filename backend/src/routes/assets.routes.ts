import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { updateAssetPriceSchema } from '../middleware/schemas.js';
import { listAssets, updateAssetPrice, getAssetPrices } from '../controllers/assets.controller.js';

const router = Router();

router.get('/prices',  getAssetPrices);
router.get('/',        listAssets);
router.put('/price',   validate(updateAssetPriceSchema), updateAssetPrice);

export default router;