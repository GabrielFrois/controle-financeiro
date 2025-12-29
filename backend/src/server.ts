import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './database/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Rota: Diagnóstico ---
app.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// --- Rotas: Usuários ---

// Listar usuários
app.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Criar usuário
app.post('/users', async (req: Request, res: Response) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório.' });
  try {
    const sql = 'INSERT INTO users (name, color, active) VALUES ($1, $2, TRUE) RETURNING *';
    const result = await query(sql, [name, color || '#1976d2']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

// Editar usuário
app.put('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, color, active } = req.body;
  try {
    const sql = 'UPDATE users SET name = $1, color = $2, active = $3 WHERE id = $4 RETURNING *';
    const result = await query(sql, [name, color, active !== undefined ? active : true, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// Soft Delete de usuário
app.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar usuário' });
  }
});

// --- Rotas: Categorias ---

// Listar categorias
app.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY active DESC, name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Criar categoria
app.post('/categories', async (req: Request, res: Response) => {
  const { name, type, color } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
  try {
    const sql = 'INSERT INTO categories (name, type, color, active) VALUES ($1, $2, $3, TRUE) RETURNING *';
    const result = await query(sql, [name, type, color || '#9e9e9e']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// Editar categoria
app.put('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, type, color, active } = req.body;
  try {
    const sql = 'UPDATE categories SET name = $1, type = $2, color = $3, active = $4 WHERE id = $5 RETURNING *';
    const result = await query(sql, [name, type, color, active !== undefined ? active : true, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
});

// Soft Delete de categoria
app.delete('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('UPDATE categories SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao inativar categoria' });
  }
});

// --- Rotas: Métodos de Pagamento ---
app.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM payment_methods ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
  }
});

// --- Rotas: Transações ---

// Listar Transações
app.get('/transactions', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        t.*, 
        COALESCE(u.name, 'Inativo') as user_name, 
        COALESCE(u.color, '#9e9e9e') as user_color, 
        COALESCE(c.name, 'Inativa') as category_name, 
        COALESCE(c.color, '#9e9e9e') as category_color, 
        COALESCE(p.name, 'Pix') as payment_method_name 
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      ORDER BY t.date DESC, t.id DESC;
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
});

// Criar Transação
app.post('/transactions', async (req: Request, res: Response) => {
  const { description, amount, type, category_id, user_id, date, payment_method_id } = req.body;
  if (!description || !amount || !type || !category_id || !user_id || !date || !payment_method_id) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }
  try {
    const sql = `
      INSERT INTO transactions (description, amount, type, user_id, category_id, date, payment_method_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const values = [description, amount, type, user_id, category_id, date, payment_method_id];
    const result = await query(sql, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// Editar Transação
app.put('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, amount, type, category_id, date, payment_method_id } = req.body;
  try {
    const sql = `
      UPDATE transactions 
      SET description = $1, amount = $2, type = $3, category_id = $4, date = $5, payment_method_id = $6
      WHERE id = $7
      RETURNING *
    `;
    const values = [description, amount, type, category_id, date, payment_method_id, id];
    const result = await query(sql, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
});

// Deletar Transação
app.delete('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
});

// --- Rota: Dashboard ---
app.get('/summary', async (req: Request, res: Response) => {
  const { month, year } = req.query;
  
  let sql = `
    SELECT 
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense
    FROM transactions
  `;
  
  const values = [];
  
  if (month && year) {
    sql += ` WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2`;
    values.push(month, year);
  } else if (year) {
    sql += ` WHERE EXTRACT(YEAR FROM date) = $1`;
    values.push(year);
  }

  try {
    const result = await query(sql, values);
    const { total_income, total_expense } = result.rows[0];
    const income = parseFloat(total_income || 0);
    const expense = parseFloat(total_expense || 0);
    res.json({ income, expense, balance: income - expense });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
});

app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});