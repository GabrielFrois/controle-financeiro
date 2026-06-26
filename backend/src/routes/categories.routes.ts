import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../middleware/schemas.js';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../controllers/categories.controller.js';

const router = Router();

router.get('/',       listCategories);
router.post('/',      validate(createCategorySchema), createCategory);
router.put('/:id',    validate(updateCategorySchema), updateCategory);
router.delete('/:id', deleteCategory);

export default router;