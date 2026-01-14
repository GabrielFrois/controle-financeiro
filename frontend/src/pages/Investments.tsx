import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Grid, Paper, Typography, Card, CardContent, Box, 
  CircularProgress, useTheme, Avatar, Stack, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
  TextField, MenuItem, Slider, styled, Tooltip as MuiTooltip,
  TablePagination, Divider
} from '@mui/material';
import { 
  TrendingUp, TrendingDown, AccountBalance, Stars, 
  PieChart as PieIcon, Timeline, QueryStats, BarChart as BarIcon,
  EmojiEvents, InfoOutlined
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
  const [tabValue, setTabValue] = useState(0);
  const [userFilter, setUserFilter] = useState('Todos');

  const [page, setPage] = useState(0);
  const rowsPerPage = 5; 

  const WINDOW_SIZE = 12;
  const [startDiv, setStartDiv] = useState(0);
  const [startPat, setStartPat] = useState(0);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#9c27b0'];

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, pricesRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/assets/prices').catch(() => ({ data: {} }))
      ]);
      
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setMarketPrices(pricesRes.data || {});
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
  };

  const stats = useMemo(() => {
    const filteredByUser = transactions.filter(t => 
      userFilter === 'Todos' || t.user_name === userFilter
    );

    const investTrans = filteredByUser.filter(t => t?.category_name?.toLowerCase().includes('investimento'));
    
    const dividendosTotal = investTrans
      .filter(t => t.category_name.includes('Dividendos'))
      .reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const positionMap = investTrans.filter(t => t.asset_ticker).reduce((acc: any, t: any) => {
      const ticker = t.asset_ticker.toUpperCase();
      if (!acc[ticker]) acc[ticker] = { ticker, quantity: 0, totalCost: 0 };
      
      const q = Number(t.quantity || 0);
      const a = Number(t.amount || 0);
      
      if (t.category_name.includes('Aporte') || t.category_name.includes('Reinvestimento')) { 
        acc[ticker].quantity += q; 
        acc[ticker].totalCost += a; 
      }
      else if (t.category_name.includes('Resgate')) { 
        acc[ticker].quantity -= q; 
        acc[ticker].totalCost -= a; 
      }
      return acc;
    }, {});

    const consolidatedPosition = Object.values(positionMap)
      .filter((p: any) => p.quantity > 0)
      .map((p: any) => {
        const currentPrice = marketPrices[p.ticker] || (p.totalCost / p.quantity);
        const currentTotal = currentPrice * p.quantity;
        const profitLoss = currentTotal - p.totalCost;
        const performance = p.totalCost > 0 ? (profitLoss / p.totalCost) * 100 : 0;

        return {
          ...p,
          avgPrice: p.totalCost / p.quantity,
          currentPrice,
          currentTotal,
          profitLoss,
          performance
        };
      })
      .sort((a, b) => b.currentTotal - a.currentTotal);

    const patrimonioMercado = consolidatedPosition.reduce((acc, curr) => acc + curr.currentTotal, 0);
    const custoTotal = consolidatedPosition.reduce((acc, curr) => acc + curr.totalCost, 0);

    const allocationData = consolidatedPosition
      .map((p: any) => ({ name: p.ticker, value: p.currentTotal }))
      .sort((a, b) => b.value - a.value);

    const monthlyMap: any = {};
    const sortedTrans = [...investTrans].sort((a, b) => a.date.localeCompare(b.date));
    let runningPatrimony = 0;

    sortedTrans.forEach(t => {
      const monthYear = t.date.substring(0, 7);
      if (!monthlyMap[monthYear]) monthlyMap[monthYear] = { month: monthYear, dividendos: 0, patrimony: 0 };
      const val = Number(t.amount || 0);
      if (t.category_name.includes('Aporte') || t.category_name.includes('Reinvestimento')) runningPatrimony += val;
      if (t.category_name.includes('Resgate')) runningPatrimony -= val;
      if (t.category_name.includes('Dividendos')) monthlyMap[monthYear].dividendos += val;
      monthlyMap[monthYear].patrimony = runningPatrimony;
    });

    const fullHistory = Object.values(monthlyMap).map((item: any) => ({
      ...item,
      label: new Date(item.month + '-02').toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()
    }));

    return {
      patrimonioTotal: patrimonioMercado,
      dinheiroDoBolso: custoTotal,
      dividendos: dividendosTotal,
      lucroReal: patrimonioMercado - custoTotal,
      performanceGeral: custoTotal > 0 ? ((patrimonioMercado / custoTotal) - 1) * 100 : 0,
      allocationData,
      consolidatedPosition,
      fullHistory
    };
  }, [transactions, userFilter, marketPrices]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, px: 2, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<PieIcon />} iconPosition="start" label="Visão Geral" />
          <Tab icon={<Timeline />} iconPosition="start" label="Evolução Mensal" />
        </Tabs>
        <TextField select label="Usuário" size="small" sx={{ width: 180, mb: 1 }} value={userFilter} onChange={(e) => handleUserFilterChange(e.target.value)}>
          <MenuItem value="Todos">Todos</MenuItem>
          {userList.map(user => <MenuItem key={user as string} value={user as string}>{user as string}</MenuItem>)}
        </TextField>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="center">
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard 
            title="Patrimônio Atual" 
            value={formatCurrency(stats.patrimonioTotal)} 
            icon={<AccountBalance />} 
            color="#9c27b0" 
            performance={stats.performanceGeral}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard 
            title="Total Investido" 
            value={formatCurrency(stats.dinheiroDoBolso)} 
            icon={<Stars />} 
            color={theme.palette.primary.main} 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard 
            title="Total Proventos" 
            value={formatCurrency(stats.dividendos)} 
            icon={<TrendingUp />} 
            color={theme.palette.success.main} 
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard 
            title="Lucro/Prejuízo" 
            value={formatCurrency(stats.lucroReal)} 
            icon={<EmojiEvents />} 
            color={stats.lucroReal >= 0 ? "#ff9800" : theme.palette.error.main} 
          />
        </Grid>
      </Grid>

      {tabValue === 0 ? (
        <Grid container spacing={2} justifyContent="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
              <Typography variant="h6" fontWeight="900" mb={3} color="text.secondary">Distribuição Atual (Mercado)</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.allocationData} innerRadius={90} outerRadius={130} dataKey="value" stroke="none" paddingAngle={5}>
                      {stats.allocationData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <Stack spacing={1.5} sx={{ mt: 3, px: 2 }}>
                 {stats.allocationData.slice(0, 5).map((item, i) => (
                   <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                       <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[i % COLORS.length] }} />
                       <Typography variant="body2" fontWeight="bold">{item.name}</Typography>
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
            <TableContainer 
              component={Paper} 
              sx={{ 
                borderRadius: 5, 
                height: 600, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden' 
              }}
            >
              <Box sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <QueryStats color="primary" /> Minha Carteira
                </Typography>
                <MuiTooltip title="Valores comparados com preço real de mercado via API">
                  <InfoOutlined sx={{ color: 'text.disabled', fontSize: 20 }} />
                </MuiTooltip>
              </Box>

              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>ATIVO</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>QTD</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>PREÇO MÉDIO / ATUAL</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>TOTAL MERCADO</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.consolidatedPosition
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((p: any) => (
                        <TableRow key={p.ticker} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Chip label={p.ticker} size="medium" sx={{ fontWeight: 'bold', bgcolor: `${theme.palette.primary.main}15`, color: 'primary.main' }} />
                              <Typography variant="caption" sx={{ fontWeight: 900, color: p.performance >= 0 ? 'success.main' : 'error.main' }}>
                                {p.performance >= 0 ? '+' : ''}{p.performance.toFixed(2)}%
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{p.quantity.toLocaleString('pt-BR')}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Méd: {formatCurrency(p.avgPrice)}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              Atu: {formatCurrency(p.currentPrice)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight={900}>{formatCurrency(p.currentTotal)}</Typography>
                            <Typography variant="caption" sx={{ color: p.profitLoss >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                              {p.profitLoss >= 0 ? '+' : ''}{formatCurrency(p.profitLoss)}
                            </Typography>
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
      ) : (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><BarIcon color="success" /> DIVIDENDOS</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.fullHistory.slice(startDiv, startDiv + WINDOW_SIZE)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 'bold' }} interval={0} />
                    <YAxis hide />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="dividendos" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider size="small" value={startDiv} min={0} max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)} onChange={(_, v) => setStartDiv(v as number)} sx={{ color: theme.palette.success.main }} />
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><AccountBalance color="primary" /> EVOLUÇÃO (CUSTO)</Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.fullHistory.slice(startPat, startPat + WINDOW_SIZE)}>
                    <defs><linearGradient id="cPat" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/><stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 'bold' }} interval={0} />
                    <YAxis hide />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} />
                    <Area type="monotone" dataKey="patrimony" stroke={theme.palette.primary.main} strokeWidth={3} fill="url(#cPat)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider size="small" value={startPat} min={0} max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)} onChange={(_, v) => setStartPat(v as number)} sx={{ color: theme.palette.primary.main }} />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

function KPICard({ title, value, icon, color, performance }: any) {
  return (
    <Card sx={{ 
      borderRadius: 5, 
      boxShadow: '0 4px 20px rgba(0,0,0,0.02)', 
      border: '1px solid', 
      borderColor: 'divider',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}>
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