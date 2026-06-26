import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

export interface InvestmentTransaction {
  id: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  category_name: string;
  user_name: string;
  asset_ticker: string | null;
  quantity: number | null;
  investment_type: string;
  yield_rate: number | null;
}

export interface AssetRecord {
  id: number;
  ticker: string;
  manual_price: number | null;
}

export interface ConsolidatedPosition {
  ticker: string;
  quantity: number;
  avgPrice: number;
  totalCost: number;
  currentPrice: number;
  currentTotal: number;
  profitLoss: number;
  performance: number;
  type: string;
  isRF: boolean;
  isManual: boolean;
}

function findManualPrice(assetsList: AssetRecord[], identifier: string): number | null {
  if (!identifier) return null;
  const asset = assetsList.find((a) => a.ticker.toUpperCase() === identifier.toUpperCase());
  return asset?.manual_price ? Number(asset.manual_price) : null;
}

export function useInvestments(userFilter: string) {
  const [loading, setLoading]           = useState(true);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [assetsList, setAssetsList]     = useState<AssetRecord[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, pricesRes, assetsRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/assets/prices').catch(() => ({ data: {} })),
        api.get('/assets').catch(() => ({ data: [] })),
      ]);
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setMarketPrices(pricesRes.data || {});
      setAssetsList(Array.isArray(assetsRes.data) ? assetsRes.data : []);
    } catch (err) {
      console.error('Erro ao carregar investimentos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userList = useMemo(
    () => [...new Set(transactions.map((t) => t.user_name))].filter(Boolean) as string[],
    [transactions]
  );

  const stats = useMemo(() => {
    const filteredByUser = transactions.filter(
      (t) => userFilter === 'Todos' || t.user_name === userFilter
    );
    const investTrans = filteredByUser.filter((t) =>
      t?.category_name?.toLowerCase().includes('investimento')
    );
    const cdiDiarioOficial = marketPrices.GLOBAL_CDI || 0.00041;

    const positionMap: Record<string, any> = {};
    const rfMap: Record<string, any>       = {};

    investTrans.forEach((t) => {
      const isRF      = t.investment_type === 'RENDA_FIXA';
      let val         = Number(t.amount || 0);
      const isResgate = t.category_name.toLowerCase().includes('resgate') || t.type === 'INCOME';
      if (isResgate) val = -Math.abs(val);
      const qtd = Number(t.quantity || 0);

      if (isRF) {
        const nomeTitulo      = t.asset_ticker || t.description;
        const manualPriceFound = findManualPrice(assetsList, nomeTitulo);

        const dataMovimentacao = new Date(t.date.split('T')[0] + 'T12:00:00');
        const hoje             = new Date(); hoje.setHours(12, 0, 0, 0);
        const diasCorridos     = Math.max(0, Math.floor((hoje.getTime() - dataMovimentacao.getTime()) / 86400000));
        const diasUteis        = Math.floor(diasCorridos * 0.69);
        const taxaContratada   = Number(t.yield_rate || 100) / 100;
        const rentDiaria       = cdiDiarioOficial * taxaContratada;
        const valorAtualizado  = val * Math.pow(1 + rentDiaria, diasUteis);

        if (!rfMap[nomeTitulo]) {
          rfMap[nomeTitulo] = { ticker: nomeTitulo, quantity: 0, totalCost: 0, currentTotal: 0, isRF: true, type: 'RENDA_FIXA', manualPrice: null };
        }
        if (manualPriceFound !== null) rfMap[nomeTitulo].manualPrice = manualPriceFound;
        if (!isResgate) rfMap[nomeTitulo].quantity += 1;
        rfMap[nomeTitulo].totalCost += val;

        if (rfMap[nomeTitulo].manualPrice) {
          rfMap[nomeTitulo].currentTotal = rfMap[nomeTitulo].manualPrice;
          rfMap[nomeTitulo].isManual     = true;
        } else {
          rfMap[nomeTitulo].currentTotal += valorAtualizado;
        }

        if (!rfMap[nomeTitulo].manualPrice && Math.abs(rfMap[nomeTitulo].currentTotal) < 0.10) {
          rfMap[nomeTitulo].currentTotal = 0;
          rfMap[nomeTitulo].totalCost    = 0;
        }
      } else if (t.asset_ticker) {
        const ticker           = t.asset_ticker.toUpperCase();
        const manualPriceFound = findManualPrice(assetsList, ticker);

        if (!positionMap[ticker]) {
          positionMap[ticker] = { ticker, quantity: 0, totalCost: 0, type: t.investment_type || 'OUTROS', manualPrice: null };
        }
        if (manualPriceFound !== null) positionMap[ticker].manualPrice = manualPriceFound;
        positionMap[ticker].quantity  += isResgate ? -qtd : qtd;
        positionMap[ticker].totalCost += val;
      }
    });

    const rendaFixaItems: ConsolidatedPosition[] = Object.values(rfMap).map((item: any) => {
      const finalTotal  = item.manualPrice ? item.manualPrice : item.currentTotal;
      const displayTotal = (!item.manualPrice && Math.abs(finalTotal) < 0.10) ? 0 : finalTotal;
      const displayCost  = (!item.manualPrice && Math.abs(item.totalCost) < 0.10) ? 0 : item.totalCost;
      return {
        ...item, quantity: 1, avgPrice: displayCost,
        currentPrice: displayTotal, currentTotal: displayTotal,
        profitLoss: displayTotal - displayCost,
        performance: displayCost > 0 ? ((displayTotal / displayCost) - 1) * 100 : 0,
        isManual: !!item.manualPrice,
      };
    });

    const processedVariavel: ConsolidatedPosition[] = Object.values(positionMap)
      .filter((p: any) => p.quantity > 0)
      .map((p: any) => {
        const avgPrice          = p.manualPrice ? p.manualPrice : (p.totalCost / p.quantity);
        const effectiveTotalCost = avgPrice * p.quantity;
        const currentPrice      = marketPrices[p.ticker] || avgPrice;
        const currentTotal      = currentPrice * p.quantity;
        return {
          ...p, avgPrice, totalCost: effectiveTotalCost,
          currentPrice, currentTotal,
          profitLoss: currentTotal - effectiveTotalCost,
          performance: effectiveTotalCost > 0 ? ((currentTotal / effectiveTotalCost) - 1) * 100 : 0,
          isRF: false, isManual: !!p.manualPrice,
        };
      });

    const consolidatedPosition = [...rendaFixaItems, ...processedVariavel]
      .sort((a, b) => b.currentTotal - a.currentTotal);

    const patrimonioMercado = consolidatedPosition.reduce((acc, c) => acc + c.currentTotal, 0);
    const custoTotal        = consolidatedPosition.reduce((acc, c) => acc + c.totalCost,    0);

    // Allocation breakdowns
    const allocationByAsset = consolidatedPosition.map((p) => ({ name: p.ticker, value: p.currentTotal }));
    const typeMap = consolidatedPosition.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + curr.currentTotal;
      return acc;
    }, {});
    const allocationByType = Object.entries(typeMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const totalIntl    = consolidatedPosition.filter((p) => ['INTERNACIONAL', 'CRIPTOS'].includes(p.type)).reduce((acc, c) => acc + c.currentTotal, 0);
    const totalNacional = Math.max(0, patrimonioMercado - totalIntl);
    const allocationByGeo = [{ name: 'Brasil', value: totalNacional }, { name: 'Exterior', value: totalIntl }].filter((i) => i.value > 0);

    // History
    const fullHistory: any[] = [];
    if (investTrans.length > 0) {
      const dates   = investTrans.map((t) => new Date(t.date));
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date();
      minDate.setDate(1); maxDate.setDate(1);
      const historyMap = new Map<string, any>();
      let cur = new Date(minDate);
      while (cur <= maxDate) {
        const key = cur.toISOString().substring(0, 7);
        historyMap.set(key, {
          month: key,
          label: cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
          dividendos: 0, patrimony: 0,
        });
        cur.setMonth(cur.getMonth() + 1);
      }
      investTrans.forEach((t) => {
        const key = t.date.substring(0, 7);
        if (!historyMap.has(key)) return;
        const entry = historyMap.get(key)!;
        const val   = Number(t.amount || 0);
        if      (t.category_name.includes('Dividendos'))                                      entry.dividendos += val;
        else if (t.category_name.includes('Aporte') || t.category_name.includes('Reinvestimento')) entry.patrimony += val;
        else if (t.category_name.includes('Resgate'))                                         entry.patrimony -= val;
      });
      let accumulated = 0;
      historyMap.forEach((entry) => {
        accumulated += entry.patrimony;
        entry.patrimony = accumulated;
        fullHistory.push(entry);
      });
    }

    return {
      patrimonioTotal: patrimonioMercado,
      dinheiroDoBolso: custoTotal,
      dividendos: investTrans.filter((t) => t.category_name.includes('Dividendos')).reduce((a, b) => a + Number(b.amount), 0),
      lucroReal: patrimonioMercado - custoTotal,
      performanceGeral: custoTotal > 0 ? ((patrimonioMercado / custoTotal) - 1) * 100 : 0,
      allocationByAsset, allocationByType, allocationByGeo,
      consolidatedPosition, fullHistory,
    };
  }, [transactions, userFilter, marketPrices, assetsList]);

  return { loading, stats, userList, fetchData };
}