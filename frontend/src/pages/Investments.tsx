import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Grid, Paper, Typography, Card, CardContent, Box,
  CircularProgress, useTheme, Avatar, Stack, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  TextField, MenuItem, Slider, styled, Tooltip as MuiTooltip,
  TablePagination, Divider, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, Button, InputAdornment, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  TrendingUp, TrendingDown, AccountBalance, Stars,
  PieChart as PieIcon, Timeline, QueryStats, BarChart as BarIcon,
  EmojiEvents, InfoOutlined, TableView, Edit, Public, Category, Apps
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  ResponsiveContainer, Tooltip, PieChart, Pie, Cell
} from 'recharts';
import api from '../services/api';

const SmoothSlider = styled(Slider)(({ theme }) => ({
  '& .MuiSlider-thumb': {
    transition: theme.transitions.create(['left', 'box-shadow'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
  '& .MuiSlider-track': {
    transition: theme.transitions.create(['width'], {
      duration: theme.transitions.duration.shorter,
    }),
  },
}));

export default function Investments() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});
  const [assetsList, setAssetsList] = useState<any[]>([]); 
  const [tabValue, setTabValue] = useState(0);
  const [userFilter, setUserFilter] = useState('Todos');

  // Estado para controlar a visualização do gráfico
  const [chartViewMode, setChartViewMode] = useState<'assets' | 'types' | 'geo'>('types');

  const [page, setPage] = useState(0);
  const rowsPerPage = 7;
  const [detailPage, setDetailPage] = useState(0);
  const detailRowsPerPage = 10;

  const WINDOW_SIZE = 12;
  const [startDiv, setStartDiv] = useState(0);
  const [startPat, setStartPat] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<{ ticker: string, currentPm: number } | null>(null);
  const [newPm, setNewPm] = useState('');

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#9c27b0'];

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const formatQuantity = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    }).format(val || 0);
  };

  // Helper para traduzir tipos técnicos para nomes bonitos
  const formatLabel = (key: string) => {
    const map: Record<string, string> = {
      'RENDA_FIXA': 'Renda Fixa',
      'ACOES': 'Ações',
      'FII': 'Fundos Imobiliários',
      'CRIPTOS': 'Criptomoedas',
      'INTERNACIONAL': 'Internacional',
      'OUTROS': 'Outros',
      'Brasil': 'Nacional',
      'Exterior': 'Internacional'
    };
    return map[key] || key;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, pricesRes, assetsRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/assets/prices').catch(() => ({ data: {} })),
        api.get('/assets').catch(() => ({ data: [] })) 
      ]);

      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setMarketPrices(pricesRes.data || {});
      setAssetsList(Array.isArray(assetsRes.data) ? assetsRes.data : []);
    } catch (error) {
      console.error("Erro ao carregar investimentos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userList = useMemo(() => {
    return [...new Set(transactions.map(t => t.user_name))].filter(Boolean);
  }, [transactions]);

  const handleUserFilterChange = (val: string) => {
    setUserFilter(val);
    setPage(0);
    setDetailPage(0);
  };

  const handleOpenEdit = (ticker: string, currentVal: number) => {
    setEditAsset({ ticker, currentPm: currentVal });
    setNewPm(currentVal.toFixed(2));
    setEditOpen(true);
  };

  const handleSavePm = async () => {
    if (!editAsset) return;
    try {
      await api.put('/assets/price', {
        ticker: editAsset.ticker, 
        price: newPm
      });
      setEditOpen(false);
      fetchData();
    } catch (error) {
      alert("Erro ao salvar preço.");
    }
  };

  const stats = useMemo(() => {
    const filteredByUser = transactions.filter(t =>
      userFilter === 'Todos' || t.user_name === userFilter
    );

    const investTrans = filteredByUser.filter(t => t?.category_name?.toLowerCase().includes('investimento'));
    const cdiDiarioOficial = marketPrices.GLOBAL_CDI || 0.00041;

    const positionMap: any = {};
    const rfMap: any = {};

    const findManualPrice = (identifier: string) => {
      if (!identifier) return null;
      const asset = assetsList.find(a => a.ticker.toUpperCase() === identifier.toUpperCase());
      return asset && asset.manual_price ? Number(asset.manual_price) : null;
    };

    investTrans.forEach(t => {
      const isRF = t.investment_type === 'RENDA_FIXA';
      let val = Number(t.amount || 0);
      const isResgate = t.category_name.toLowerCase().includes('resgate') || t.type === 'INCOME';
      
      if (isResgate) val = -Math.abs(val);

      const qtd = Number(t.quantity || 0);

      if (isRF) {
        const nomeTitulo = t.asset_ticker || t.description;
        const manualPriceFound = findManualPrice(nomeTitulo); 

        const dataMovimentacao = new Date(t.date.split('T')[0] + 'T12:00:00');
        const hoje = new Date();
        hoje.setHours(12, 0, 0, 0);
        const diffTime = hoje.getTime() - dataMovimentacao.getTime();
        const diasCorridos = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const diasUteis = Math.floor(diasCorridos * 0.69); 
        const taxaContratada = Number(t.yield_rate || 100) / 100;
        const rentabilidadeDiariaEfetiva = cdiDiarioOficial * taxaContratada;
        const valorAtualizado = val * Math.pow(1 + rentabilidadeDiariaEfetiva, diasUteis);

        if (!rfMap[nomeTitulo]) {
          rfMap[nomeTitulo] = {
            ticker: nomeTitulo,
            quantity: 0,
            totalCost: 0,
            currentTotal: 0,
            isRF: true,
            type: 'RENDA_FIXA',
            manualPrice: null
          };
        }

        if (manualPriceFound !== null) rfMap[nomeTitulo].manualPrice = manualPriceFound;
        if (!isResgate) rfMap[nomeTitulo].quantity += 1;
        
        rfMap[nomeTitulo].totalCost += val;          
        
        if (rfMap[nomeTitulo].manualPrice) {
            rfMap[nomeTitulo].currentTotal = rfMap[nomeTitulo].manualPrice;
            rfMap[nomeTitulo].isManual = true;
        } else {
            rfMap[nomeTitulo].currentTotal += valorAtualizado; 
        }

        if (!rfMap[nomeTitulo].manualPrice && Math.abs(rfMap[nomeTitulo].currentTotal) < 0.10) {
            rfMap[nomeTitulo].currentTotal = 0;
            rfMap[nomeTitulo].totalCost = 0;
        }

      } else if (t.asset_ticker) {
        const ticker = t.asset_ticker.toUpperCase();
        const manualPriceFound = findManualPrice(ticker);

        if (!positionMap[ticker]) {
          positionMap[ticker] = {
            ticker,
            quantity: 0,
            totalCost: 0,
            type: t.investment_type || 'OUTROS',
            manualPrice: null
          };
        }

        if (manualPriceFound !== null) positionMap[ticker].manualPrice = manualPriceFound;

        if (isResgate) positionMap[ticker].quantity -= qtd;
        else positionMap[ticker].quantity += qtd;

        positionMap[ticker].totalCost += val;
      }
    });

    const rendaFixaItems = Object.values(rfMap).map((item: any) => {
      const finalCurrentTotal = item.manualPrice ? item.manualPrice : item.currentTotal;
      const displayTotal = (!item.manualPrice && Math.abs(finalCurrentTotal) < 0.10) ? 0 : finalCurrentTotal;
      const displayCost = (!item.manualPrice && Math.abs(item.totalCost) < 0.10) ? 0 : item.totalCost;

      return {
        ...item,
        quantity: 1, 
        avgPrice: displayCost,
        currentPrice: displayTotal,
        currentTotal: displayTotal,
        profitLoss: displayTotal - displayCost,
        performance: displayCost > 0 ? ((displayTotal / displayCost) - 1) * 100 : 0,
        isManual: !!item.manualPrice 
      };
    });

    const processedVariavel = Object.values(positionMap)
      .filter((p: any) => p.quantity > 0)
      .map((p: any) => {
        const avgPrice = p.manualPrice ? p.manualPrice : (p.totalCost / p.quantity);
        const effectiveTotalCost = avgPrice * p.quantity;
        const currentPrice = marketPrices[p.ticker] || avgPrice;
        const currentTotal = currentPrice * p.quantity;
        return {
          ...p,
          avgPrice,
          totalCost: effectiveTotalCost,
          currentPrice,
          currentTotal,
          profitLoss: currentTotal - effectiveTotalCost,
          performance: effectiveTotalCost > 0 ? ((currentTotal / effectiveTotalCost) - 1) * 100 : 0,
          isRF: false,
          isManual: !!p.manualPrice
        };
      });

    const consolidatedPosition = [...rendaFixaItems, ...processedVariavel]
      .sort((a, b) => b.currentTotal - a.currentTotal);

    const patrimonioMercado = consolidatedPosition.reduce((acc, curr) => acc + curr.currentTotal, 0);
    const custoTotal = consolidatedPosition.reduce((acc, curr) => acc + curr.totalCost, 0);

    // --- AGRUPAMENTOS PARA O GRÁFICO ---
    
    // 1. Por Ativos
    const allocationByAsset = consolidatedPosition.map(p => ({ name: p.ticker, value: p.currentTotal }));

    // 2. Por Tipo/Classe
    const typeMap = consolidatedPosition.reduce((acc: any, curr) => {
      acc[curr.type] = (acc[curr.type] || 0) + curr.currentTotal;
      return acc;
    }, {});
    const allocationByType = Object.entries(typeMap)
      .map(([name, value]) => ({ name, value: Number(value) }))
      .sort((a, b) => b.value - a.value);

    // 3. Por Geografia
    const intlTypes = ['INTERNACIONAL', 'CRIPTOS'];
    const totalIntl = consolidatedPosition.filter(p => intlTypes.includes(p.type)).reduce((acc, curr) => acc + curr.currentTotal, 0);
    const totalNacional = Math.max(0, patrimonioMercado - totalIntl);
    const allocationByGeo = [
        { name: 'Brasil', value: totalNacional }, 
        { name: 'Exterior', value: totalIntl }    
    ].filter(i => i.value > 0);


    if (investTrans.length === 0) {
      return { 
          patrimonioTotal: patrimonioMercado, 
          dinheiroDoBolso: custoTotal, 
          dividendos: 0, 
          lucroReal: 0, 
          performanceGeral: 0, 
          allocationByAsset,
          allocationByType,
          allocationByGeo,
          consolidatedPosition, 
          fullHistory: [] 
      };
    }

    const dates = investTrans.map(t => new Date(t.date));
    const minDate = new Date(Math.min.apply(null, dates as any));
    const maxDate = new Date();
    minDate.setDate(1); maxDate.setDate(1);
    const historyMap = new Map();
    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      const key = currentDate.toISOString().substring(0, 7);
      historyMap.set(key, { month: key, label: currentDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(), dividendos: 0, patrimony: 0 });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    investTrans.forEach(t => {
      const key = t.date.substring(0, 7);
      if (historyMap.has(key)) {
        const entry = historyMap.get(key);
        const val = Number(t.amount || 0);
        if (t.category_name.includes('Dividendos')) entry.dividendos += val;
        else if (t.category_name.includes('Aporte') || t.category_name.includes('Reinvestimento')) entry.patrimony += val;
        else if (t.category_name.includes('Resgate')) entry.patrimony -= val;
      }
    });
    const fullHistory = Array.from(historyMap.values());
    let accumulatedPatrimony = 0;
    for (let i = 0; i < fullHistory.length; i++) {
      accumulatedPatrimony += fullHistory[i].patrimony;
      fullHistory[i].patrimony = accumulatedPatrimony;
    }

    return {
      patrimonioTotal: patrimonioMercado,
      dinheiroDoBolso: custoTotal,
      dividendos: investTrans.filter(t => t.category_name.includes('Dividendos')).reduce((a, b) => a + Number(b.amount), 0),
      lucroReal: patrimonioMercado - custoTotal,
      performanceGeral: custoTotal > 0 ? ((patrimonioMercado / custoTotal) - 1) * 100 : 0,
      allocationByAsset,
      allocationByType,
      allocationByGeo,
      consolidatedPosition,
      fullHistory
    };
  }, [transactions, userFilter, marketPrices, assetsList]);

  useEffect(() => {
    if (stats.fullHistory.length > 0) {
      // Calcula o índice para mostrar os últimos "WINDOW_SIZE" meses
      const latestStart = Math.max(0, stats.fullHistory.length - WINDOW_SIZE);
      
      setStartDiv(latestStart);
      setStartPat(latestStart);
    }
  }, [stats.fullHistory.length]); // Executa apenas quando o tamanho do histórico mudar

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;

  const getAssetColor = (type: string) => {
    switch (type) {
      case 'RENDA_FIXA': return theme.palette.success.main;
      case 'ACOES': return theme.palette.primary.main;
      case 'FII': return theme.palette.warning.main;
      case 'CRIPTOS': return theme.palette.secondary.main;
      case 'INTERNACIONAL': return theme.palette.error.main;
      case 'Brasil': return theme.palette.success.dark;
      case 'Exterior': return theme.palette.info.main;
      default: return theme.palette.grey[500];
    }
  };

  const currentChartData = chartViewMode === 'assets' ? stats.allocationByAsset 
                         : chartViewMode === 'types' ? stats.allocationByType 
                         : stats.allocationByGeo;

  const compactCellStyle = { px: 1 };

  return (
    <Box sx={{ pt: 2, px: 2, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>

      {/* --- Header e Filtros --- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<PieIcon />} iconPosition="start" label="Visão Geral" />
          <Tab icon={<TableView />} iconPosition="start" label="Posições" />
          <Tab icon={<Timeline />} iconPosition="start" label="Evolução" />
        </Tabs>
        <TextField select label="Usuário" size="small" sx={{ width: 180, mb: 1 }} value={userFilter} onChange={(e) => handleUserFilterChange(e.target.value)}>
          <MenuItem value="Todos">Todos</MenuItem>
          {userList.map(user => <MenuItem key={user as string} value={user as string}>{user as string}</MenuItem>)}
        </TextField>
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="center">
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Patrimônio Atual" value={formatCurrency(stats.patrimonioTotal)} icon={<AccountBalance />} color="#9c27b0" performance={stats.performanceGeral} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Total Investido" value={formatCurrency(stats.dinheiroDoBolso)} icon={<Stars />} color={theme.palette.primary.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Total Proventos" value={formatCurrency(stats.dividendos)} icon={<TrendingUp />} color={theme.palette.success.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Lucro/Prejuízo" value={formatCurrency(stats.lucroReal)} icon={<EmojiEvents />} color={stats.lucroReal >= 0 ? "#ff9800" : theme.palette.error.main} />
        </Grid>
      </Grid>

      {/* TAB 0: VISÃO GERAL */}
      {tabValue === 0 && (
        <Grid container spacing={2} justifyContent="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              {/* Header do Gráfico */}
              <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" mb={2}>
                    Distribuição da Carteira
                </Typography>
                <ToggleButtonGroup 
                    value={chartViewMode} 
                    exclusive 
                    onChange={(_, v) => v && setChartViewMode(v)} 
                    size="small"
                    sx={{ 
                        mb: 1,
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 8, 
                        '& .MuiToggleButton-root': {
                           border: 'none',
                           borderRadius: 8,
                           px: 2,
                           py: 0.5,
                           mx: 0.5,
                           my: 0.5,
                           textTransform: 'none',
                           fontWeight: 700,
                           fontSize: '0.8rem',
                           color: 'text.secondary',
                           '&.Mui-selected': {
                             bgcolor: 'primary.main',
                             color: '#fff',
                             '&:hover': { bgcolor: 'primary.dark' }
                           }
                        }
                    }}
                >
                    <ToggleButton value="assets">Ativos</ToggleButton>
                    <ToggleButton value="types">Tipos</ToggleButton>
                    <ToggleButton value="geo">Geo</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Box sx={{ flexGrow: 1, width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie 
                        data={currentChartData} 
                        innerRadius={90} 
                        outerRadius={130} 
                        dataKey="value" 
                        stroke="none" 
                        paddingAngle={5}
                    >
                      {currentChartData.map((entry: any, index: number) => (
                        <Cell key={index} fill={chartViewMode === 'assets' ? COLORS[index % COLORS.length] : getAssetColor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        formatter={(value: number, name: string) => [
                            `${formatCurrency(value)} (${((value / stats.patrimonioTotal) * 100).toFixed(2)}%)`,
                            formatLabel(name)
                        ]}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              
              <Stack spacing={1} sx={{ mt: 3, px: 2, width: '100%', maxHeight: 150, overflowY: 'auto' }}>
                {currentChartData.slice(0, 5).map((item: any, i: number) => (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: chartViewMode === 'assets' ? COLORS[i % COLORS.length] : getAssetColor(item.name) }} />
                      <Typography variant="body2" fontWeight="bold">
                          {formatLabel(item.name)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" fontWeight="900">
                      {stats.patrimonioTotal > 0 ? ((item.value / stats.patrimonioTotal) * 100).toFixed(1) : 0}%
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <TableContainer component={Paper} sx={{ borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <QueryStats color="primary" /> Minha Carteira
                </Typography>
                <MuiTooltip
                  title={
                    <div style={{ textAlign: 'center' }}>
                      Cotações em tempo real.
                      <br />
                      <span style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.8 }}>
                        Rentabilidade da Renda Fixa é apenas uma previsão e não o valor real.
                      </span>
                    </div>
                  }
                >
                  <InfoOutlined sx={{ color: 'text.disabled', fontSize: 20 }} />
                </MuiTooltip>
              </Box>

              <Box sx={{ flexGrow: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>ATIVO</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>QTD</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>PREÇO</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>TOTAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>RESULTADO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.consolidatedPosition
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((p: any) => (
                        <TableRow key={p.ticker} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Chip
                              label={p.ticker}
                              size="medium"
                              sx={{
                                fontWeight: 800,
                                bgcolor: `${getAssetColor(p.type)}15`,
                                color: getAssetColor(p.type),
                                borderRadius: '8px'
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Typography variant="body2" fontWeight="bold" color="text.secondary">
                              {formatQuantity(p.quantity)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              {p.isRF ? 'Inv.: ' : 'PM: '}
                              {formatCurrency(p.avgPrice)} {p.isManual}
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', color: 'text.primary' }}>
                              Atual: {formatCurrency(p.currentPrice)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body1" fontWeight="900">
                              {formatCurrency(p.currentTotal)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <Typography variant="body2" sx={{ color: p.profitLoss >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold', mb: 0.5 }}>
                                {p.profitLoss >= 0 ? '+' : ''}{formatCurrency(p.profitLoss)}
                              </Typography>
                              <Chip
                                label={`${Math.abs(p.performance).toFixed(2)}%`}
                                size="small"
                                sx={{
                                  height: 22,
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  bgcolor: p.performance >= 0 ? 'success.main' : 'error.main',
                                  color: '#fff'
                                }}
                              />
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </Box>
              <Divider />
              <TablePagination
                component="div"
                count={stats.consolidatedPosition.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                sx={{ borderTop: 'none' }}
              />
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* --- ABA 1: Posições --- */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TableContainer component={Paper} sx={{ borderRadius: 5, overflow: 'hidden' }}>
              <Box sx={{ p: 3, pb: 1 }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <TableView color="primary" /> Detalhamento das Posições
                </Typography>
              </Box>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900, px: 1 }}>ATIVO</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>QTD</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>PREÇO MÉDIO</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>PREÇO ATUAL</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>TOTAL INVESTIDO</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>TOTAL ATUAL</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, px: 1 }}>RESULTADO</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.consolidatedPosition
                    .slice(detailPage * detailRowsPerPage, detailPage * detailRowsPerPage + detailRowsPerPage)
                    .map((p: any) => (
                      <TableRow key={p.ticker} hover>
                        <TableCell sx={compactCellStyle}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Box sx={{ width: 4, height: 32, bgcolor: getAssetColor(p.type), borderRadius: 1 }} />
                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.9rem' }}>{p.ticker}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right" sx={compactCellStyle}>
                          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatQuantity(p.quantity)}</Typography>
                        </TableCell>

                        {/* COLUNA PREÇO MÉDIO */}
                        <TableCell align="right" sx={compactCellStyle}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'text.primary', 
                                fontWeight: 'normal', 
                                fontSize: '0.9rem',
                              }}
                            >
                              {formatCurrency(p.avgPrice)}
                            </Typography>
                            
                            <IconButton 
                              size="small" 
                              onClick={() => !p.isRF && handleOpenEdit(p.ticker, p.avgPrice)} 
                              sx={{ 
                                padding: 0.5,
                                visibility: p.isRF ? 'hidden' : 'visible', 
                                pointerEvents: p.isRF ? 'none' : 'auto'
                              }}
                            >
                                <Edit fontSize="small" sx={{ fontSize: 16, color: 'text.disabled' }} />
                            </IconButton>
                          </Box>
                        </TableCell>

                        {/* COLUNA PREÇO ATUAL */}
                        <TableCell align="right" sx={compactCellStyle}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontSize: '0.9rem', 
                                color: 'text.primary',
                                fontWeight: 'normal' 
                              }}
                            >
                                {formatCurrency(p.currentPrice)} 
                            </Typography>

                            <IconButton 
                              size="small" 
                              onClick={() => p.isRF && handleOpenEdit(p.ticker, p.currentTotal)} 
                              sx={{ 
                                padding: 0.5,
                                visibility: !p.isRF ? 'hidden' : 'visible', 
                                pointerEvents: !p.isRF ? 'none' : 'auto'
                              }}
                            >
                                <Edit fontSize="small" sx={{ fontSize: 16, color: 'text.disabled' }} />
                            </IconButton>
                          </Box>
                        </TableCell>

                        {/* COLUNA TOTAL INVESTIDO */}
                        <TableCell align="right" sx={{ ...compactCellStyle, color: 'text.primary' }}>
                          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.totalCost)}</Typography>
                        </TableCell>

                        <TableCell align="right" sx={compactCellStyle}>
                          <Typography variant="body2" fontWeight={900} sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.currentTotal)}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={compactCellStyle}>
                          <Chip
                            label={`${p.profitLoss >= 0 ? '+' : ''}${formatCurrency(p.profitLoss)}`}
                            size="small"
                            sx={{
                              bgcolor: p.profitLoss >= 0 ? `${theme.palette.success.main}15` : `${theme.palette.error.main}15`,
                              color: p.profitLoss >= 0 ? 'success.main' : 'error.main',
                              fontWeight: 'bold',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              height: 24
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={stats.consolidatedPosition.length}
                rowsPerPage={detailRowsPerPage}
                page={detailPage}
                onPageChange={(_, newPage) => setDetailPage(newPage)}
                rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
                sx={{ borderTop: 'none' }}
              />
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* --- ABA 2: EVOLUÇÃO --- */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          {/* GRÁFICO DE DIVIDENDOS */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <BarIcon color="success" /> DIVIDENDOS RECEBIDOS
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.fullHistory.slice(startDiv, startDiv + WINDOW_SIZE)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fontWeight: 'bold' }}
                      minTickGap={20}
                    />
                    <YAxis 
                      tickFormatter={(val) => `R$ ${val}`} 
                      tick={{ fontSize: 12 }} 
                    />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(v)}
                      cursor={{ fill: 'transparent' }}
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="dividendos" name="Dividendos" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider 
                  size="small" 
                  value={startDiv} 
                  min={0} 
                  max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)} 
                  onChange={(_, v) => setStartDiv(v as number)} 
                  sx={{ color: theme.palette.success.main }} 
                />
              </Box>
            </Paper>
          </Grid>

          {/* GRÁFICO DE PATRIMÔNIO */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <AccountBalance color="primary" /> CRESCIMENTO PATRIMONIAL
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.fullHistory.slice(startPat, startPat + WINDOW_SIZE)}>
                    <defs>
                      <linearGradient id="colorPatrimony" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fontWeight: 'bold' }}
                      minTickGap={20}
                    />
                    <YAxis
                      tickFormatter={(val) => `R$ ${val / 1000}k`}
                      tick={{ fontSize: 12 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(v)}
                      contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="patrimony"
                      name="Patrimônio Acumulado"
                      stroke={theme.palette.primary.main}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorPatrimony)"
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider 
                  size="small" 
                  value={startPat} 
                  min={0} 
                  max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)} 
                  onChange={(_, v) => setStartPat(v as number)} 
                  sx={{ color: theme.palette.primary.main }} 
                />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* --- DIALOG DE EDIÇÃO DE PREÇO --- */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Editar {editAsset?.ticker && stats.consolidatedPosition.find(p => p.ticker === editAsset.ticker)?.isRF ? 'Saldo Atual' : 'Preço Médio'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {editAsset?.ticker && stats.consolidatedPosition.find(p => p.ticker === editAsset.ticker)?.isRF 
              ? `Informe o SALDO BRUTO ATUAL que consta no app da corretora para "${editAsset.ticker}".`
              : `Defina um PREÇO MÉDIO UNITÁRIO manual para "${editAsset?.ticker}".`
            }
            <br/><br/>
            <span style={{ fontSize: '0.8rem' }}>
              Deixe <b>0</b> para voltar ao cálculo automático.
            </span>
          </Typography>
          
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label={
               editAsset?.ticker && stats.consolidatedPosition.find(p => p.ticker === editAsset.ticker)?.isRF 
               ? "Saldo Total Atual (R$)" 
               : "Preço Médio Unitário (R$)"
            }
            type="number"
            value={newPm}
            onChange={(e) => setNewPm(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            }}
            inputProps={{
              step: "0.01"
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSavePm} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function KPICard({ title, value, icon, color, performance }: any) {
  return (
    <Card sx={{ borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 2, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Avatar sx={{ bgcolor: `${color}12`, color, mx: 'auto', mb: 1, width: 44, height: 44, borderRadius: '14px' }}>{icon}</Avatar>
        <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase' }}>{title}</Typography>
        <Typography variant="h5" fontWeight="900" sx={{ mt: 0.5 }}>{value}</Typography>
        <Box sx={{ minHeight: '20px', mt: 0.5 }}>
          {performance !== undefined && (
            <Typography variant="caption" color={performance >= 0 ? "success.main" : "error.main"} fontWeight="bold">
              {performance >= 0 ? '+' : ''}{performance.toFixed(2)}%
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}