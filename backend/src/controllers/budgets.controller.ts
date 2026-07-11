import { Request, Response } from 'express';
import { query } from '../database/index.js';
import { resolveAllowedUserIds } from '../utils/familyAccess.js';

// Metas agora são pessoais ou de família: cada usuário cria/edita/apaga
// somente as suas próprias — nem admin gerencia meta alheia, já que é um
// objetivo pessoal, não uma entidade administrável do sistema. Além disso,
// o usuário escolhe se o GASTO daquela meta soma apenas o que ele mesmo
// gastou (PERSONAL) ou o que toda a sua família gastou (FAMILY). A tela usa
// esses limites junto com o gasto agregado calculado no frontend a partir
// de /transactions.

// Quem não pertence a nenhuma família não pode ter meta FAMILY — não existe
// "família" para somar. Nesse caso o escopo é sempre forçado para PERSONAL,
// independente do que o cliente mandar.
async function resolveScope(userId: number, requestedScope: string | undefined): Promise<'PERSONAL' | 'FAMILY'> {
  if (requestedScope !== 'FAMILY') return 'PERSONAL';

  const membership = await query(
    'SELECT 1 FROM family_members WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return membership.rowCount! > 0 ? 'FAMILY' : 'PERSONAL';
}

export async function listBudgets(req: Request, res: Response) {
  // Visibilidade segue o toggle "Só eu / Família" do frontend (mesmo padrão do
  // /transactions): a lista de ids pedida é sempre validada contra a própria
  // família de quem está logado (resolveAllowedUserIds) — nunca confia
  // cegamente no que o cliente manda. Além disso, meta PERSONAL de outra
  // pessoa nunca aparece aqui, mesmo que o id dela esteja no filtro (ex.:
  // Maria no modo "Família" não deve ver as metas pessoais do João, só as
  // de família dele).
  const ids = await resolveAllowedUserIds(req.user!.userId, req.query.user_ids as string | undefined);

  try {
    const result = await query(`
      SELECT b.*, c.name AS category_name, u.name AS user_name, u.color AS user_color
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      JOIN users u      ON b.user_id = u.id
      WHERE b.user_id = ANY($1)
        AND (b.scope = 'FAMILY' OR b.user_id = $2)
      ORDER BY b.period DESC, c.name ASC
    `, [ids, req.user!.userId]);
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar metas' });
  }
}

export async function upsertBudget(req: Request, res: Response) {
  const { category_id, amount, period } = req.body;
  const userId = req.user!.userId;
  const scope = await resolveScope(userId, req.body.scope);

  try {
    const result = await query(
      `INSERT INTO budgets (user_id, category_id, amount, period, scope) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, category_id, period) DO UPDATE SET amount = EXCLUDED.amount, scope = EXCLUDED.scope
       RETURNING *`,
      [userId, category_id, amount, period, scope]
    );
    console.info(`[AUDIT] Meta criada/atualizada | user=${userId} | category=${category_id} | period=${period} | scope=${scope}`);
    res.status(201).json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Erro ao salvar meta' });
  }
}

export async function updateBudget(req: Request, res: Response) {
  const { id } = req.params;
  const { category_id, amount, period } = req.body;
  const userId = req.user!.userId;

  try {
    // Metas são pessoais: mesmo admin não edita meta de outro usuário
    // (diferente de outras entidades do sistema, aqui não existe "gestão"
    // de meta alheia — é um objetivo do próprio dono).
    const ownerRes = await query('SELECT user_id FROM budgets WHERE id = $1', [id]);
    if (ownerRes.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
    const ownerId = ownerRes.rows[0].user_id;
    if (ownerId !== userId) {
      return res.status(403).json({ error: 'Você só pode editar as suas próprias metas.' });
    }
    const scope = await resolveScope(ownerId, req.body.scope);

    const result = await query(
      `UPDATE budgets SET category_id=$1, amount=$2, period=$3, scope=$4
       WHERE id=$5 AND user_id=$6
       RETURNING *`,
      [category_id, amount, period, scope, id, userId]
    );
    console.info(`[AUDIT] Meta atualizada | user=${userId} | id=${id} | scope=${scope}`);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar meta' });
  }
}

export async function deleteBudget(req: Request, res: Response) {
  const { id } = req.params;
  const userId = req.user!.userId;

  try {
    // Idem: exclusão de meta também é restrita ao próprio dono, sem exceção para admin.
    const result = await query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );
    if (result.rowCount === 0) {
      const check = await query('SELECT id FROM budgets WHERE id = $1', [id]);
      if (check.rowCount === 0) return res.status(404).json({ error: 'Meta não encontrada.' });
      return res.status(403).json({ error: 'Você só pode excluir as suas próprias metas.' });
    }
    console.info(`[AUDIT] Meta deletada | user=${userId} | id=${id}`);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Erro ao deletar meta' });
  }
}