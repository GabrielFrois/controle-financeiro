import { query } from '../database/index.js';

/**
 * Saldo comprometido de um cartão: soma de TODAS as parcelas já lançadas
 * (passadas e futuras) menos os pagamentos de fatura já registrados para
 * esse cartão. Isso reflete o comportamento real de um cartão de crédito,
 * onde o limite é bloqueado no momento da compra (mesmo parcelado), e só é
 * liberado quando a fatura correspondente é efetivamente paga — não apenas
 * quando a parcela do mês "vence".
 *
 * excludeIds permite recalcular o saldo desconsiderando uma transação (ou
 * grupo de parcelas) que está sendo editada, para não contar o valor antigo
 * junto com o novo valor durante uma atualização.
 */
export async function getCardCommittedBalance(
  cardId: number,
  excludeIds: number[] = []
): Promise<number> {
  const excludeClause = excludeIds.length > 0 ? 'AND id <> ALL($2::int[])' : '';
  const params: any[] = excludeIds.length > 0 ? [cardId, excludeIds] : [cardId];

  const spentRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE payment_method_id = $1
       AND type = 'EXPENSE'
       AND COALESCE(is_invoice_payment, FALSE) = FALSE
       ${excludeClause}`,
    params
  );

  const paidRes = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE paid_card_id = $1
       AND type = 'EXPENSE'
       AND is_invoice_payment = TRUE
       ${excludeClause}`,
    params
  );

  const spent = parseFloat(spentRes.rows[0].total);
  const paid = parseFloat(paidRes.rows[0].total);
  return Math.max(0, spent - paid);
}

export interface CardLimitCheck {
  ok: boolean;
  committedBalance: number;
  availableLimit: number | null; // null = cartão sem limite definido
}

/**
 * Verifica se `additionalAmount` cabe no limite disponível do cartão.
 * Se o cartão não tiver card_limit configurado (0/null), sempre retorna ok.
 */
export async function checkCardLimit(
  cardLimit: number | null | undefined,
  cardId: number,
  additionalAmount: number,
  excludeIds: number[] = []
): Promise<CardLimitCheck> {
  const limit = Number(cardLimit) || 0;
  if (limit <= 0) {
    return { ok: true, committedBalance: 0, availableLimit: null };
  }

  const committedBalance = await getCardCommittedBalance(cardId, excludeIds);
  const availableLimit = limit - committedBalance;

  return {
    ok: additionalAmount <= availableLimit + 0.01, // tolerância de arredondamento
    committedBalance,
    availableLimit,
  };
}