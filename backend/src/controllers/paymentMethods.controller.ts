import { Request, Response } from 'express';
import { query } from '../database/index.js';

export async function listPaymentMethods(req: Request, res: Response) {
  try {
    const result = await query('SELECT * FROM payment_methods ORDER BY name ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
  }
}

export async function createPaymentMethod(req: Request, res: Response) {
  const { name, closing_day, due_day, card_limit } = req.body;
  try {
    const result = await query(
      `INSERT INTO payment_methods (name, closing_day, due_day, card_limit, active)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [name, closing_day ?? null, due_day ?? null, card_limit ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao criar método de pagamento' });
  }
}

export async function updatePaymentMethod(req: Request, res: Response) {
  const { id } = req.params;
  const { name, closing_day, due_day, card_limit, active } = req.body;
  try {
    const result = await query(
      `UPDATE payment_methods
       SET name = $1, closing_day = $2, due_day = $3, card_limit = $4, active = $5
       WHERE id = $6 RETURNING *`,
      [name, closing_day ?? null, due_day ?? null, card_limit ?? null, active, id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Método não encontrado.' });
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar método de pagamento' });
  }
}

export async function deletePaymentMethod(req: Request, res: Response) {
  const { id } = req.params;
  try {
    await query('UPDATE payment_methods SET active = FALSE WHERE id = $1', [id]);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao inativar método de pagamento' });
  }
}