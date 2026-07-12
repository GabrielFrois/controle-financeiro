import { Request, Response } from 'express';
import { query } from '../database/index.js';
import { resolveAllowedUserIds } from '../utils/familyAccess.js';

// Antes, o Dashboard baixava TODAS as transações do usuário/família e
// calculava saldo, patrimônio, distribuição por categoria e "recentes"
// no próprio navegador (reduce/filter em JS). Isso funciona bem com poucos
// registros, mas escala mal: cada troca de filtro (mês/ano/histórico)
// baixava o histórico inteiro de novo, e o payload só cresce com o tempo
// (parcelamentos geram várias linhas por compra).
//
// Esse endpoint devolve só os números já agregados no Postgres.

export async function getDashboardSummary(req: Request, res: Response) {
  const period = (req.query.period as string) || 'month'; // 'month' | 'year' | 'all'

  try {
    const ids = await resolveAllowedUserIds(req.user!.userId, req.query.user_ids as string | undefined);

    // Uma compra no cartão de crédito só pesa no saldo/gastos quando a
    // fatura é paga — mesma regra usada em /summary.
    const unpaidCardClause = `NOT (pm.closing_day IS NOT NULL AND t.is_invoice_payment = FALSE)`;

    // ── Saldo acumulado (sempre "desde o início", até hoje, independente
    // do período selecionado na tela — é assim que o Dashboard sempre
    // funcionou: o saldo é a foto atual da conta) ──────────────────────
    const balanceResult = await query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' AND ${unpaidCardClause} THEN t.amount ELSE 0 END), 0)
          AS balance
      FROM transactions t
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.user_id = ANY($1::int[]) AND t.date <= CURRENT_DATE
      `,
      [ids]
    );

    // ── Patrimônio (aportes - resgates, também sempre "desde o início") ──
    const patrimonioResult = await query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN c.name = 'Investimentos - Aporte'  THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN c.name = 'Investimentos - Resgate' THEN t.amount ELSE 0 END), 0)
          AS patrimonio
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ANY($1::int[])
      `,
      [ids]
    );

    // ── Condição de período para categoria/recentes (respeita o filtro
    // Mês/Ano/Histórico selecionado na tela) ───────────────────────────
    const periodConditions: string[] = [];
    if (period === 'month') {
      periodConditions.push(`EXTRACT(MONTH FROM t.date) = EXTRACT(MONTH FROM CURRENT_DATE)`);
      periodConditions.push(`EXTRACT(YEAR  FROM t.date) = EXTRACT(YEAR  FROM CURRENT_DATE)`);
    } else if (period === 'year') {
      periodConditions.push(`EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)`);
    }
    const periodWhere = periodConditions.length > 0 ? `AND ${periodConditions.join(' AND ')}` : '';

    // ── Gastos por categoria (para o gráfico de pizza) ─────────────────
    const categoryResult = await query(
      `
      SELECT
        COALESCE(c.name, 'Inativa') AS name,
        SUM(t.amount)               AS value
      FROM transactions t
      LEFT JOIN categories      c  ON t.category_id       = c.id
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.user_id = ANY($1::int[])
        AND t.type = 'EXPENSE'
        AND ${unpaidCardClause}
        ${periodWhere}
      GROUP BY c.name
      ORDER BY value DESC
      `,
      [ids]
    );

    // ── Lançamentos recentes (top 5 do período selecionado) ────────────
    const recentResult = await query(
      `
      SELECT
        t.id, t.description, t.amount, t.type, t.date,
        COALESCE(c.name, 'Inativa') AS category_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ANY($1::int[])
        ${periodWhere}
      ORDER BY t.date DESC, t.id DESC
      LIMIT 5
      `,
      [ids]
    );

    res.json({
      balance: parseFloat(balanceResult.rows[0].balance || 0),
      patrimonio: parseFloat(patrimonioResult.rows[0].patrimonio || 0),
      categoryData: categoryResult.rows.map((r: { name: string; value: string }) => ({ name: r.name, value: parseFloat(r.value) })),
      recentTransactions: recentResult.rows,
    });
  } catch (err) {
    console.error('Erro no /dashboard/summary:', err);
    res.status(500).json({ error: 'Erro ao calcular resumo do dashboard' });
  }
}