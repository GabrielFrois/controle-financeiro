import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { query } from './database/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

//Rota: Diagnóstico
app.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT NOW()');
    res.json({ status: 'OK', database_time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao conectar no banco' });
  }
});

// Rota: Listar Usuários
app.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Rota: Criar Usuário 
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

// Rota: Deletar Usuário
app.delete('/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Desativa o usuário
    await query('UPDATE users SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao desativar usuário' });
  }
});

//Rota: Listar Categorias
app.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// Rota: Criar Categoria
app.post('/categories', async (req: Request, res: Response) => {
  const { name, type } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });

  try {
    const sql = 'INSERT INTO categories (name, type) VALUES ($1, $2) RETURNING *';
    const result = await query(sql, [name, type]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar categoria (verifique se o nome já existe).' });
  }
});

// Rota: Deletar Categoria
app.delete('/categories/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Nota: O banco impedirá a exclusão se houver gastos usando esta categoria.
    await query('DELETE FROM categories WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Não é possível deletar uma categoria que já possui registros vinculados.' });
  }
});

// Rota: Listar Transações
app.get('/transactions', async (req: Request, res: Response) => {
  try {
    const sql = `
      SELECT 
        t.id, t.description, t.amount, t.type, t.date, 
        c.name as category_name,
        u.name as user_name 
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      JOIN users u ON t.user_id = u.id
      ORDER BY t.date DESC, t.created_at DESC
    `;
    const result = await query(sql);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
});

// Rota: Criar Transação
app.post('/transactions', async (req: Request, res: Response) => {
  const { description, amount, type, category_id, user_id } = req.body;

  if (!description || !amount || !type || !category_id || !user_id) {
    return res.status(400).json({ error: 'Preencha todos os campos, incluindo o usuário.' });
  }

  try {
    const sql = `
      INSERT INTO transactions (description, amount, type, user_id, category_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [description, amount, type, user_id, category_id];
    const result = await query(sql, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar transação' });
  }
});

// Rota: Resumo (Dashboard)
// Calcula total de entradas, saídas e saldo
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

// Rota: Deletar Transação
app.delete('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM transactions WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar transação' });
  }
});

// Rota: Editar Transação (PUT)
app.put('/transactions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description, amount, type, category_id } = req.body;

  if (!description || !amount || !type || !category_id) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const sql = `
      UPDATE transactions 
      SET description = $1, amount = $2, type = $3, category_id = $4
      WHERE id = $5
      RETURNING *
    `;
    const values = [description, amount, type, category_id, id];
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transação não encontrada.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar transação' });
  }
});

app.listen(PORT, () => {
  console.log(`>>> Backend rodando em http://localhost:${PORT}`);
});