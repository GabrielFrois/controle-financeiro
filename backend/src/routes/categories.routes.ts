import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../middleware/schemas.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../controllers/categories.controller.js';

const router = Router();

// Qualquer usuário autenticado pode listar
router.get('/',       authenticate, listCategories);

// Apenas admin pode criar, editar ou inativar categorias
router.post('/',      authenticate, requireAdmin, validate(createCategorySchema), createCategory);
router.put('/:id',    authenticate, requireAdmin, validate(updateCategorySchema), updateCategory);
router.delete('/:id', authenticate, requireAdmin, deleteCategory);

export default router;