import { Request, Response } from 'express';
import { query } from '../database/index.js';

// Métodos padrão (Dinheiro, Pix, Débito, Transferência, Saldo Corretora) são
// globais — user_id NULL — e visíveis/utilizáveis por todos. Cartões de
// crédito são privados por usuário: cada um só vê, cria, edita e inativa os
// seus próprios cartões — sem exceção para admin.

export async function listPaymentMethods(req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT * FROM payment_methods
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY user_id NULLS FIRST, name ASC`,
      [req.user!.userId]
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar métodos de pagamento' });
  }
}

export async function createPaymentMethod(req: Request, res: Response) {
  const { name, closing_day, due_day, card_limit } = req.body;
  try {
    // Todo método criado por aqui (tela de Gestão) é privado de quem criou —
    // normalmente um cartão de crédito (closing_day/due_day preenchidos).
    const result = await query(
      `INSERT INTO payment_methods (name, closing_day, due_day, card_limit, active, user_id)
       VALUES ($1, $2, $3, $4, TRUE, $5) RETURNING *`,
      [name, closing_day ?? null, due_day ?? null, card_limit ?? null, req.user!.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    // Nome é único por usuário (user_id, name) entre os métodos privados dele.
    if (err.code === '23505') return res.status(409).json({ error: `Você já tem um método de pagamento chamado "${name}".` });
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
       WHERE id = $6 AND user_id = $7 RETURNING *`,
      [name, closing_day ?? null, due_day ?? null, card_limit ?? null, active, id, req.user!.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Método não encontrado ou você não tem permissão para editá-lo.' });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: `Você já tem um método de pagamento chamado "${name}".` });
    res.status(500).json({ error: 'Erro ao atualizar método de pagamento' });
  }
}

export async function deletePaymentMethod(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const result = await query(
      'UPDATE payment_methods SET active = FALSE WHERE id = $1 AND user_id = $2',
      [id, req.user!.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Método não encontrado ou você não tem permissão para inativá-lo.' });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao inativar método de pagamento' });
  }
}