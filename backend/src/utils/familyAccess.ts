import { query } from '../database/index.js';

// Endpoints de listagem (transações, metas) recebem um `user_ids` opcional
// na querystring pra alimentar o toggle "Só eu / Família" do frontend. Até
// aqui, o backend confiava cegamente nessa lista — qualquer usuário
// autenticado podia mandar o id de QUALQUER outra pessoa no sistema e
// receber de volta os dados dela, mesmo sem nenhum vínculo de família. Este
// módulo fecha essa brecha: a lista pedida pelo cliente é sempre
// intersectada com quem o requisitante realmente pode ver (ele mesmo, mais
// quem compartilha ao menos uma família com ele).

// Todos os ids que o usuário tem permissão de consultar: ele mesmo, mais
// qualquer pessoa que esteja em pelo menos uma família em comum com ele.
// Se ele não pertence a nenhuma família, o resultado é só o próprio id.
export async function getOwnHouseholdIds(requesterId: number): Promise<number[]> {
  const result = await query(
    `SELECT DISTINCT fm2.user_id
     FROM family_members fm1
     JOIN family_members fm2 ON fm1.family_id = fm2.family_id
     WHERE fm1.user_id = $1
     UNION
     SELECT $1::int`,
    [requesterId]
  );
  return result.rows.map((r: any) => r.user_id);
}

// Recebe o `user_ids` cru da querystring (string "1,2,3" ou undefined) e
// devolve a lista de ids realmente permitida para esse requisitante.
// - Sem parâmetro: só o próprio requisitante (nunca "todo mundo").
// - Com parâmetro: interseção com quem o requisitante pode ver. Ids que não
//   pertencem à família dele são descartados silenciosamente (sem erro),
//   pra não funcionar como oráculo confirmando quais ids existem no sistema.
// - Se a interseção ficar vazia (só ids de fora da família), cai no
//   fallback seguro de mostrar só os dados do próprio requisitante.
export async function resolveAllowedUserIds(
  requesterId: number,
  rawUserIds: string | undefined
): Promise<number[]> {
  if (!rawUserIds) return [requesterId];

  const requested = rawUserIds.split(',').map(Number).filter((n) => Number.isInteger(n));
  if (requested.length === 0) return [requesterId];

  const allowed = new Set(await getOwnHouseholdIds(requesterId));
  const filtered = requested.filter((id) => allowed.has(id));
  return filtered.length > 0 ? filtered : [requesterId];
}