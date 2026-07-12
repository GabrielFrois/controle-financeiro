import { useMemo } from 'react';
import type { Transaction } from '../types';

interface Filters {
  categoryFilter: string;
  userFilter: string;
  typeFilter: string;
  startDate: string;
  endDate: string;
}

export function useTransactionAnalytics(
  transactions: Transaction[],
  filteredTransactions: Transaction[],
  evolutionMode: 'daily' | 'weekly' | 'monthly',
  trendUserFilter: string,
  chartOffset: number,
  filters: Filters
) {
  return useMemo(() => {
    try {
      const { categoryFilter, userFilter, typeFilter } = filters;
      const today = new Date();

      // Diferente do Dashboard/Resumo/Relatórios (que só contam uma compra no
      // crédito quando a fatura é paga — fluxo de caixa real), aqui em
      // Análise/Tendência TODA compra conta a partir da data em que foi
      // feita, esteja no crédito ou não. A visão aqui é "quanto eu me
      // comprometi a gastar", não "quanto já saiu da conta".
      //
      // Isso cria um risco de contar a mesma coisa duas vezes: pagar a
      // fatura gera uma SEGUNDA transação (is_invoice_payment = true, no
      // valor total pago) — a compra original já foi contada quando foi
      // feita, então essa segunda transação é só o dinheiro mudando de
      // lugar pra quitar algo que já entrou na conta. Por isso ela é
      // excluída de todo agregado "comprometido" abaixo.
      const isInvoiceSettlement = (t: any) => !!t.is_invoice_payment;

      // ── Trend data (12-month rolling window) ──────────────────────────────
      const maxFutureMonthDiff = transactions.reduce((max, t) => {
        const tDate = new Date(t.date.split('T')[0] + 'T12:00:00');
        const diff  = (tDate.getFullYear() - today.getFullYear()) * 12 + (tDate.getMonth() - today.getMonth());
        return diff > max ? diff : max;
      }, 0);

      const futureHorizon = Math.max(0, Math.min(6, maxFutureMonthDiff));
      const endOffset     = futureHorizon + chartOffset;
      const startOffset   = endOffset - 11;

      let runningPatrimony = transactions
        .filter((t) => {
          const tDate = new Date(t.date.split('T')[0] + 'T12:00:00');
          return tDate < new Date(today.getFullYear(), today.getMonth() + startOffset, 1);
        })
        .filter((t) => !isInvoiceSettlement(t))
        .reduce((acc, t) => (t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount)), 0);

      const trendData: any[] = [];
      for (let i = startOffset; i <= endOffset; i++) {
        const d         = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthTrans = transactions
          .filter((t) => t.date?.startsWith(monthYear) && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter))
          .filter((t) => !isInvoiceSettlement(t));
        const inc = monthTrans.filter((t) => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount), 0);
        const exp = monthTrans.filter((t) => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount), 0);
        runningPatrimony += inc - exp;
        trendData.push({
          name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
          Patrimonio: runningPatrimony,
          Receitas: inc,
          Despesas: exp,
          isFuture: i > 0,
        });
      }

      // ── Evolution chart data ───────────────────────────────────────────────
      const chartEndDate   = new Date();
      const chartStartDate = new Date();
      if      (evolutionMode === 'monthly') chartStartDate.setMonth(chartEndDate.getMonth() - 11);
      else if (evolutionMode === 'weekly')  chartStartDate.setDate(chartEndDate.getDate() - 84);
      else                                  chartStartDate.setDate(chartEndDate.getDate() - 30);

      const sDateStr = chartStartDate.toISOString().split('T')[0];
      const eDateStr = chartEndDate.toISOString().split('T')[0];

      const chartTransactions = transactions.filter((t) => {
        const tDate      = t.date.split('T')[0];
        const matchCat   = categoryFilter === 'Todas' || t.category_name === categoryFilter;
        const matchUser  = userFilter  === 'Todos'   || t.user_name    === userFilter;
        const matchType  = typeFilter  === 'Todos'   || t.type         === typeFilter;
        return matchCat && matchUser && matchType && tDate >= sDateStr && tDate <= eDateStr;
      });

      const evolutionMap: Record<string, { valor: number; label: string }> = {};
      chartTransactions
        .filter((t) => t.type === 'EXPENSE' && !isInvoiceSettlement(t))
        .forEach((t) => {
          const [year, month, day] = t.date.split('T')[0].split('-').map(Number);
          const dt = new Date(year, month - 1, day);
          let sortKey: string;
          let label: string;

          if (evolutionMode === 'daily') {
            sortKey = t.date.split('T')[0];
            label   = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
          } else if (evolutionMode === 'weekly') {
            const tempD = new Date(dt);
            tempD.setDate(tempD.getDate() - tempD.getDay());
            sortKey = tempD.toISOString().split('T')[0];
            label   = `Sem. ${tempD.getDate()}/${tempD.getMonth() + 1}`;
          } else {
            sortKey = `${year}-${String(month).padStart(2, '0')}`;
            label   = dt.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
          }

          if (!evolutionMap[sortKey]) evolutionMap[sortKey] = { valor: 0, label };
          evolutionMap[sortKey].valor += Number(t.amount);
        });

      // ── Aggregates for current period (Média/Total/Economia) ──────────────
      const listExpense = filteredTransactions
        .filter((t) => t.type === 'EXPENSE' && !isInvoiceSettlement(t))
        .reduce((a, b) => a + Number(b.amount), 0);

      const listIncome = filteredTransactions
        .filter((t) => t.type === 'INCOME')
        .reduce((a, b) => a + Number(b.amount), 0);

      // Top 5 maiores gastos: também exclui o pagamento de fatura em si —
      // sem isso, "Pagamento Fatura Nubank" apareceria como um gasto gigante
      // ao lado das compras que já o compõem.
      const groupedExpensesMap = filteredTransactions
        .filter((t) => t.type === 'EXPENSE' && !isInvoiceSettlement(t))
        .reduce<Record<string, any>>((acc, t) => {
          const base = t.description.replace(/\s\(\d+\/\d+\)$/, '');
          if (!acc[base]) acc[base] = { ...t, description: base, amount: 0 };
          acc[base].amount += Number(t.amount);
          return acc;
        }, {});

      return {
        trendData,
        lineData: Object.keys(evolutionMap).sort().map((k) => evolutionMap[k]),
        top5: Object.values(groupedExpensesMap)
          .sort((a: any, b: any) => b.amount - a.amount)
          .slice(0, 5),
        avgWeekly:        listExpense / 4,
        avgMonthly:       listExpense,
        totalPeriodo:     listExpense,
        savingsTotal:     listIncome - listExpense,
        projectedSavings: 0,
      };
    } catch {
      return { trendData: [], lineData: [], top5: [], avgWeekly: 0, avgMonthly: 0, totalPeriodo: 0, savingsTotal: 0, projectedSavings: 0 };
    }
  }, [transactions, filteredTransactions, evolutionMode, trendUserFilter, chartOffset, filters]);
}