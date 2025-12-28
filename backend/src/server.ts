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
app.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.post('/users', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório.' });
  try {
    const sql = 'INSERT INTO users (name) VALUES ($1) RETURNING *';
    const result = await query(sql, [name]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
});

app.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
});

// --- Rotas: Categorias ---
app.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

app.post('/categories', async (req: Request, res: Response) => {
  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
  try {
    const sql = 'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING *';
    const result = await query(sql, [name, type]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria' });
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

// Listar Transações com JOIN (para pegar os nomes)
app.get('/transactions', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        t.*, 
        c.name as category_name,
        u.name as user_name,
        p.name as payment_method_name 
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN payment_methods p ON t.payment_method_id = p.id
      ORDER BY t.date DESC, t.created_at DESC
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
    console.error(err);
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// Editar Transação
app.put('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, amount, type, category_id, date, payment_method_id } = req.body;

  if (!description || !amount || !type || !category_id || !date || !payment_method_id) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const sql = `
      UPDATE transactions 
      SET description = $1, amount = $2, type = $3, category_id = $4, date = $5, payment_method_id = $6
      WHERE id = $7
      RETURNING *
    `;
    const values = [description, amount, type, category_id, date, payment_method_id, id];
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
});

app.delete('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
});

// --- Rota: Resumo (Dashboard) ---
app.get('/summary', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense
      FROM transactions
    `;
    const result = await query(sql);
    const { total_income, total_expense } = result.rows[0];

    const income = parseFloat(total_income || 0);
    const expense = parseFloat(total_expense || 0);

    res.json({
      income,
      expense,
      balance: income - expense
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao calcular resumo' });
  }
});

app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});