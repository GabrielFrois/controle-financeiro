import { z } from 'zod';

// Política de senha para criação/troca: 8+ caracteres, com ao menos uma letra e um número
const strongPassword = z
  .string()
  .min(8, 'Senha deve ter ao menos 8 caracteres.')
  .regex(/[A-Za-z]/, 'Senha deve conter ao menos uma letra.')
  .regex(/[0-9]/, 'Senha deve conter ao menos um número.');

export const loginSchema = z.object({
  email:    z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

export const createUserSchema = z.object({
  name:     z.string().min(1, 'O nome é obrigatório.'),
  email:    z.string().email('E-mail inválido.'),
  password: strongPassword,
  color:    z.string().default('#1976d2').optional(),
  role:     z.enum(['admin', 'member']).default('member').optional(),
});

export const updateUserSchema = z.object({
  name:     z.string().min(1, 'O nome é obrigatório.'),
  email:    z.string().email('E-mail inválido.'),
  color:    z.string().optional(),
  active:   z.boolean().default(true).optional(),
  role:     z.enum(['admin', 'member']).default('member').optional(),
  password: strongPassword.optional(),
});

export const createCategorySchema = z.object({
  name:  z.string().min(1, 'O nome é obrigatório.'),
  type:  z.enum(['INCOME', 'EXPENSE'], { error: 'Tipo deve ser INCOME ou EXPENSE.' }),
  color: z.string().default('#9e9e9e').optional(),
});

export const updateCategorySchema = z.object({
  name:   z.string().min(1),
  type:   z.enum(['INCOME', 'EXPENSE']),
  color:  z.string().optional(),
  active: z.boolean().default(true).optional(),
});

export const createPaymentMethodSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.'),
  closing_day: z.coerce.number().int().min(1).max(31).nullable().optional(),
  due_day:     z.coerce.number().int().min(1).max(31).nullable().optional(),
  card_limit:  z.coerce.number().min(0).nullable().optional(),
});

export const updatePaymentMethodSchema = createPaymentMethodSchema.extend({
  active: z.boolean().default(true).optional(),
});

export const createTransactionSchema = z.object({
  description:       z.string().min(1, 'Descrição obrigatória.'),
  amount:            z.coerce.number().positive('O valor deve ser positivo.'),
  type:              z.enum(['INCOME', 'EXPENSE']),
  category_id:       z.coerce.number().int().positive(),
  user_id:           z.coerce.number().int().positive(),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (YYYY-MM-DD).'),
  payment_method_id: z.coerce.number().int().positive(),
  installments:      z.coerce.number().int().min(1).default(1).optional(),
  asset_ticker:      z.string().default('').optional(),
  quantity:          z.coerce.number().min(0).nullable().optional(),
  investment_type:   z.string().default('OUTROS').optional(),
  yield_rate:        z.coerce.number().nullable().optional(),
});

export const updateTransactionSchema = z.object({
  description:       z.string().min(1),
  amount:            z.coerce.number().positive(),
  type:              z.enum(['INCOME', 'EXPENSE']),
  category_id:       z.coerce.number().int().positive(),
  user_id:           z.coerce.number().int().positive(),
  date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payment_method_id: z.coerce.number().int().positive(),
  investment_type:   z.string().default('OUTROS').optional(),
  yield_rate:        z.coerce.number().nullable().optional(),
  asset_ticker:      z.string().default('').optional(),
  quantity:          z.coerce.number().min(0).nullable().optional(),
});

export const updateGroupTransactionSchema = z.object({
  description:       z.string().min(1),
  amount:            z.coerce.number().positive(),
  type:              z.enum(['INCOME', 'EXPENSE']),
  category_id:       z.coerce.number().int().positive(),
  user_id:           z.coerce.number().int().positive(),
  payment_method_id: z.coerce.number().int().positive(),
  referer_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  investment_type:   z.string().default('OUTROS').optional(),
  yield_rate:        z.coerce.number().nullable().optional(),
});

export const createBudgetSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  amount:      z.coerce.number().positive(),
  period:      z.string().min(1, 'Período obrigatório.'),
});

export const updateAssetPriceSchema = z.object({
  ticker: z.string().min(1, 'Ticker obrigatório.'),
  price:  z.coerce.number().min(0).nullable().optional(),
});