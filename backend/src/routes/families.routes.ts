import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { listFamilies, createFamily, updateFamily, deleteFamily, myFamilies } from '../controllers/families.controller.js';

const router = Router();

router.get('/my',     authenticate, myFamilies);
router.get('/',       authenticate, requireAdmin, listFamilies);
router.post('/',      authenticate, requireAdmin, createFamily);
router.put('/:id',    authenticate, requireAdmin, updateFamily);
router.delete('/:id', authenticate, requireAdmin, deleteFamily);

export default router;