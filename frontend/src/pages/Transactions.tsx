import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, TextField, MenuItem, Box, Typography, Button, 
  IconButton, Chip, CircularProgress, Stack, Grid, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  FormControl, InputLabel, Select, TablePagination,
  Tabs, Tab, useTheme, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  Autocomplete 
} from '@mui/material';
import { 
  Add, Delete, Clear, ListAlt, Timeline, History, EmojiEvents, AccountBalance, Payments, Savings, QueryStats, Warning, HelpOutline
} from '@mui/icons-material';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, LineChart, Line, Cell
} from 'recharts';
import api from '../services/api';

export default function Transactions() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [evolutionMode, setEvolutionMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [trendUserFilter, setTrendUserFilter] = useState('Todos');
  const [trendViewMode, setTrendViewMode] = useState<'projection' | 'history'>('projection');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);

  // Estados para Modal de Exclusão Unificado
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);

  const now = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(now.getFullYear() - 1);
  const firstDayDefault = oneYearAgo.toISOString().split('T')[0];
  const lastDayDefault = now.toISOString().split('T')[0];

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [userFilter, setUserFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [startDate, setStartDate] = useState(firstDayDefault); 
  const [endDate, setEndDate] = useState(lastDayDefault);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: '', amount: '', type: 'EXPENSE',
    category_id: '', user_id: '', date: new Date().toISOString().split('T')[0],
    payment_method_id: '', installments: '1', asset_ticker: '', quantity: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, userRes, catRes, payRes, assetRes] = await Promise.all([
        api.get('/transactions'), api.get('/users'), api.get('/categories'), api.get('/payment-methods'), api.get('/assets')
      ]);
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setPaymentMethods(Array.isArray(payRes.data) ? payRes.data : []);
      setAssets(Array.isArray(assetRes.data) ? assetRes.data : []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return "---";
    const pureDate = dateStr.split('T')[0];
    return new Date(pureDate + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchCategory = categoryFilter === 'Todas' || t.category_name === categoryFilter;
      const matchUser = userFilter === 'Todos' || t.user_name === userFilter;
      const matchType = typeFilter === 'Todos' || t.type === typeFilter;
      const tDate = (t.date || "").split('T')[0];
      return matchCategory && matchUser && matchType && tDate >= startDate && tDate <= endDate;
    });
  }, [transactions, categoryFilter, userFilter, typeFilter, startDate, endDate]);

  const analyticsData = useMemo(() => {
    try {
      const today = new Date();
      const trendData: any[] = [];
      let startOffset = -11; 
      let endOffset = 0;    
      if (trendViewMode === 'projection') {
        let maxFutureMonths = 0;
        if (transactions.length > 0) {
          const dates = transactions.map(t => new Date(t.date).getTime());
          const latestDate = new Date(Math.max(...dates));
          maxFutureMonths = Math.max(0, (latestDate.getUTCFullYear() - today.getUTCFullYear()) * 12 + (latestDate.getUTCMonth() - today.getUTCMonth()));
        }
        endOffset = Math.min(maxFutureMonths, 11);
        startOffset = -(11 - endOffset);
      }
      const startDateChart = new Date(today.getFullYear(), today.getMonth() + startOffset, 1);
      let runningBalance = transactions
        .filter(t => new Date((t.date || "").split('T')[0] + 'T12:00:00') < startDateChart && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter))
        .reduce((acc, t) => t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount), 0);

      for (let i = startOffset; i <= endOffset; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthTrans = transactions.filter(t => t.date?.startsWith(monthYear) && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter));
        const inc = monthTrans.filter(t => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount), 0);
        const exp = monthTrans.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount), 0);
        runningBalance += (inc - exp);
        trendData.push({ 
          name: d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase(), Patrimonio: runningBalance, Receitas: inc, Despesas: exp, isFuture: i > 0 
        });
      }

      let periodIncome = 0, periodExpense = 0;
      const evolutionMap: any = {};
      filteredTransactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'INCOME') periodIncome += amt;
        else {
          periodExpense += amt;
          const [year, month, day] = t.date.split('T')[0].split('-').map(Number);
          const dt = new Date(year, month - 1, day);
          let sortKey, label;
          if (evolutionMode === 'daily') {
            sortKey = t.date.split('T')[0];
            label = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
          } else if (evolutionMode === 'weekly') {
            const sun = new Date(dt);
            sun.setDate(dt.getDate() - dt.getDay());
            sortKey = sun.toISOString().split('T')[0];
            label = `Sem. ${sun.getDate()}/${sun.getMonth() + 1}`;
          } else {
            sortKey = `${year}-${String(month).padStart(2, '0')}`;
            label = dt.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
          }
          if (!evolutionMap[sortKey]) evolutionMap[sortKey] = { valor: 0, label };
          evolutionMap[sortKey].valor += amt;
        }
      });

      const lineData = Object.keys(evolutionMap).sort().map(k => evolutionMap[k]);
      const transDates = filteredTransactions.filter(t => t.type === 'EXPENSE').map(t => new Date(t.date).getTime());
      const firstTrans = transDates.length > 0 ? Math.min(...transDates) : new Date(startDate).getTime();
      const lastTrans = transDates.length > 0 ? Math.max(...transDates) : new Date(endDate).getTime();
      const divisorEfetivo = Math.max(1, Math.ceil(Math.abs(lastTrans - firstTrans) / 86400000) + 1);
      const dailyBase = periodExpense / divisorEfetivo;
      const curMonthTrans = transactions.filter(t => t.date.startsWith(today.toISOString().substring(0, 7)));
      const curMonthBal = curMonthTrans.reduce((acc, t) => t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount), 0);

      return { 
        trendData, lineData,
        top5: [...filteredTransactions].filter(t => t.type === 'EXPENSE').sort((a,b) => Number(b.amount) - Number(a.amount)).slice(0, 5),
        avgWeekly: dailyBase * 7, avgMonthly: dailyBase * 30, totalPeriodo: periodExpense,
        savingsTotal: periodIncome - periodExpense, projectedSavings: (curMonthBal / Math.max(1, today.getDate())) * 30
      };
    } catch (e) { return { trendData: [], lineData: [], top5: [], avgWeekly: 0, avgMonthly: 0, totalPeriodo: 0, savingsTotal: 0, projectedSavings: 0 }; }
  }, [transactions, filteredTransactions, evolutionMode, trendUserFilter, trendViewMode, startDate, endDate]);

  const handleOpenDelete = (transaction: any) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const handleExecuteDelete = async (deleteAllInSeries: boolean) => {
    try {
      if (deleteAllInSeries && transactionToDelete.installment_group_id) {
        await api.delete(`/transactions/group/${transactionToDelete.installment_group_id}`);
      } else {
        await api.delete(`/transactions/${transactionToDelete.id}`);
      }
      setDeleteDialogOpen(false);
      setTransactionToDelete(null);
      fetchData();
    } catch { alert("Erro ao excluir"); }
  };

  const isInvestment = useMemo(() => {
    const selectedCat = categories.find(c => c.id === form.category_id);
    return selectedCat?.name.toLowerCase().includes('investimento');
  }, [form.category_id, categories]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2, maxWidth: '1200px', margin: '0 auto' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ListAlt />} iconPosition="start" label="Registros" />
          <Tab icon={<Timeline />} iconPosition="start" label="Análise de Período" />
          <Tab icon={<History />} iconPosition="start" label="Tendência e Projeção" />
        </Tabs>
        {tabValue === 0 && <Button variant="contained" startIcon={<Add />} sx={{ borderRadius: '10px' }} onClick={() => setOpen(true)}>Novo Lançamento</Button>}
      </Box>

      {tabValue !== 2 && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Tipo" size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem><MenuItem value="INCOME">Receitas</MenuItem><MenuItem value="EXPENSE">Despesas</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Categoria" size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><MenuItem value="Todas">Todas</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Usuário" size="small" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Início" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Fim" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><Button fullWidth startIcon={<Clear />} onClick={() => { setStartDate(firstDayDefault); setEndDate(lastDayDefault); setCategoryFilter('Todas'); setUserFilter('Todos'); }}>Reset</Button></Grid>
          </Grid>
        </Paper>
      )}

      {tabValue === 0 && (
        <TableContainer component={Paper} sx={{ borderRadius: 5 }}>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 900 }}>DATA</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>USUÁRIO</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>DESCRIÇÃO</TableCell>
                <TableCell sx={{ fontWeight: 900 }}>CATEGORIA</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>VALOR</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>AÇÕES</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>{safeFormatDate(t.date)}</TableCell>
                  <TableCell><Chip label={t.user_name} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderColor: t.user_color, color: t.user_color }} /></TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t.description}
                    {t.asset_ticker && <Chip label={t.asset_ticker} size="small" sx={{ ml: 1, height: 18, fontSize: '0.65rem', bgcolor: theme.palette.primary.main + '15', color: theme.palette.primary.main }} />}
                  </TableCell>
                  <TableCell><Chip label={t.category_name} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderColor: t.category_color, color: t.category_color, fontSize: '0.65rem' }} /></TableCell>
                  <TableCell align="right"><Typography fontWeight="900" color={t.type === 'INCOME' ? 'success.main' : 'error.main'}>{formatCurrency(t.amount)}</Typography></TableCell>
                  <TableCell align="center">
                    <IconButton size="small" color="error" onClick={() => handleOpenDelete(t)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
        </TableContainer>
      )}

      {/* Abas de Análise e Tendência */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: '100%' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <Payments color="primary"/> RESUMO FINANCEIRO NO PERÍODO
              </Typography>
              <Grid container spacing={2}>
                {[ 
                  { label: 'MÉDIA SEMANAL', val: analyticsData.avgWeekly, color: 'text.secondary' }, 
                  { label: 'MÉDIA MENSAL', val: analyticsData.avgMonthly, color: 'text.secondary' }, 
                  { label: 'TOTAL NO PERÍODO', val: analyticsData.totalPeriodo, color: 'error.main' } 
                ].map((item) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">{item.label}</Typography>
                      <Typography variant="h6" fontWeight="900" color={item.color}>{formatCurrency(item.val)}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}><Paper sx={{ p: 3, borderRadius: 5, bgcolor: `${theme.palette.success.main}08`, border: '1px solid', borderColor: theme.palette.success.light }}><Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Savings color="success"/> ECONOMIA</Typography><Stack spacing={2}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">NO PERÍODO FILTRADO:</Typography><Typography variant="h5" fontWeight="900" color="success.main">{formatCurrency(analyticsData.savingsTotal)}</Typography></Box><Divider /><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">PROJEÇÃO FINAL DO MÊS ATUAL:</Typography><Typography variant="h6" fontWeight="900">{formatCurrency(analyticsData.projectedSavings)}</Typography></Box></Stack></Paper></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Typography variant="h6" fontWeight="900" mb={2}><EmojiEvents color="warning" /> MAIORES GASTOS</Typography><List>{analyticsData.top5.map((t, i) => (<ListItem key={t.id} disableGutters><ListItemAvatar><Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 'bold' }}>{i+1}</Avatar></ListItemAvatar><ListItemText primary={<Typography fontWeight="700" noWrap>{t.description}</Typography>} secondary={t.category_name} /><Typography fontWeight="900" color="error.main">{formatCurrency(t.amount)}</Typography></ListItem>))}</List></Paper></Grid>
          <Grid size={{ xs: 12, md: 8 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h6" fontWeight="bold">Evolução de Gastos</Typography><ToggleButtonGroup size="small" value={evolutionMode} exclusive onChange={(_, v) => v && setEvolutionMode(v)}><ToggleButton value="daily">Diário</ToggleButton><ToggleButton value="weekly">Semanal</ToggleButton><ToggleButton value="monthly">Mensal</ToggleButton></ToggleButtonGroup></Box>
          <Box sx={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.lineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="label" interval="preserveStartEnd" minTickGap={80} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => [formatCurrency(v), "Gasto"]} />
                <Line name="Gasto Total" type="monotone" dataKey="valor" stroke={theme.palette.error.main} strokeWidth={3} dot={{ r: 4, fill: theme.palette.error.main }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box></Paper></Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 2, borderRadius: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><ToggleButtonGroup size="small" value={trendViewMode} exclusive onChange={(_, v) => v && setTrendViewMode(v)} sx={{ bgcolor: 'action.hover' }}><ToggleButton value="projection" sx={{ gap: 1 }}><QueryStats fontSize="small" /> Visão de Projeção</ToggleButton><ToggleButton value="history" sx={{ gap: 1 }}><History fontSize="small" /> Histórico 12 Meses</ToggleButton></ToggleButtonGroup><TextField select label="Filtrar Usuário" size="small" sx={{ width: 250 }} value={trendUserFilter} onChange={(e) => setTrendUserFilter(e.target.value)}><MenuItem value="Todos">Todos os Usuários</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Paper></Grid>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 4, borderRadius: 5 }}><Typography variant="h6" fontWeight="900" mb={4} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{trendViewMode === 'projection' ? <QueryStats color="primary"/> : <History color="primary"/>} FLUXO DE CAIXA MENSAL</Typography>
          <Box sx={{ height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analyticsData.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="name" interval="preserveStartEnd" minTickGap={60} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => formatCurrency(v)} />
                <Legend verticalAlign="top" height={36}/>
                <Bar name="Receitas" dataKey="Receitas" fill={theme.palette.success.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((entry, index) => <Cell key={`c-i-${index}`} fillOpacity={entry.isFuture ? 0.4 : 1} />)}</Bar>
                <Bar name="Despesas" dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((entry, index) => <Cell key={`c-e-${index}`} fillOpacity={entry.isFuture ? 0.4 : 1} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box></Paper></Grid>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 4, borderRadius: 5, bgcolor: `${theme.palette.primary.main}05` }}><Typography variant="h6" fontWeight="900" mb={4}><AccountBalance color="primary" sx={{ mr: 1 }} /> EVOLUÇÃO DO PATRIMÔNIO ESTIMADA</Typography>
          <Box sx={{ height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analyticsData.trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                <XAxis dataKey="name" interval="preserveStartEnd" minTickGap={60} tick={{ fontSize: 11 }} />
                <YAxis hide />
                <Tooltip formatter={(v: any) => [formatCurrency(v), "Saldo"]} />
                <Line name="Saldo Acumulado" dataKey="Patrimonio" stroke={theme.palette.primary.main} strokeWidth={5} dot={(props: any) => { const { cx, cy, payload } = props; return <circle cx={cx} cy={cy} r={6} fill={payload.isFuture ? theme.palette.warning.main : theme.palette.primary.main} stroke="none" />; }} />
              </LineChart>
            </ResponsiveContainer>
          </Box></Paper></Grid>
        </Grid>
      )}

      {/* DIALOG DE LANÇAMENTO */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Novo Lançamento</DialogTitle>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.post('/transactions', form);
            setOpen(false);
            setForm({ description: '', amount: '', type: 'EXPENSE', category_id: '', user_id: '', date: new Date().toISOString().split('T')[0], payment_method_id: '', installments: '1', asset_ticker: '', quantity: '' });
            fetchData();
          } catch { alert("Erro ao salvar"); }
        }}>
          <DialogContent>
            <Stack spacing={2.5}>
              <TextField fullWidth label="Descrição" required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <Grid container spacing={2}><Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Valor Total" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></Grid><Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="Data" required value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} /></Grid></Grid>
              <Grid container spacing={2}><Grid size={{ xs: 6 }}><FormControl fullWidth><InputLabel>Tipo</InputLabel><Select value={form.type} label="Tipo" onChange={(e) => setForm({...form, type: e.target.value as any, category_id: ''})}><MenuItem value="EXPENSE">Despesa</MenuItem><MenuItem value="INCOME">Receita</MenuItem></Select></FormControl></Grid><Grid size={{ xs: 6 }}><FormControl fullWidth required><InputLabel>Usuário</InputLabel><Select value={form.user_id} label="Usuário" onChange={(e) => setForm({...form, user_id: e.target.value})}>{users.filter(u => u.active).map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</Select></FormControl></Grid></Grid>
              <FormControl fullWidth required><InputLabel>Categoria</InputLabel><Select value={form.category_id} label="Categoria" onChange={(e) => setForm({...form, category_id: e.target.value})}>{categories.filter(c => c.active && c.type === form.type).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl>
              <FormControl fullWidth required><InputLabel>Método</InputLabel><Select value={form.payment_method_id} label="Método" onChange={(e) => setForm({...form, payment_method_id: e.target.value})}>{paymentMethods.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}</Select></FormControl>
              {paymentMethods.find(m => m.id === form.payment_method_id)?.name === 'Crédito' && (<TextField fullWidth type="number" label="Número de Parcelas" required value={form.installments} onChange={(e) => setForm({...form, installments: e.target.value})} />)}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="contained">Salvar</Button></DialogActions>
        </form>
      </Dialog>

      {/* DIALOG DE EXCLUSÃO UNIFICADO */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 900 }}>
          {transactionToDelete?.installment_group_id ? <Warning color="warning" /> : <HelpOutline color="primary" />}
          Excluir Registro
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" fontWeight="700">
            Tem certeza que deseja excluir "{transactionToDelete?.description}"?
          </Typography>
          
          {transactionToDelete?.installment_group_id ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2, border: '1px solid #ffe0b2' }}>
              <b>Atenção:</b> Este item faz parte de uma compra parcelada. Você pode excluir apenas esta parcela ou o grupo inteiro.
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Esta ação não poderá ser desfeita. O valor de <b>{formatCurrency(transactionToDelete?.amount)}</b> será removido do seu histórico.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2 }}>
            Cancelar
          </Button>
          
          {transactionToDelete?.installment_group_id ? (
            <Stack direction="row" spacing={1}>
              <Button onClick={() => handleExecuteDelete(false)} variant="contained" color="error" sx={{ borderRadius: 2 }}>
                Apenas Esta
              </Button>
              <Button onClick={() => handleExecuteDelete(true)} variant="contained" color="error" sx={{ borderRadius: 2 }}>
                Excluir Todas
              </Button>
            </Stack>
          ) : (
            <Button onClick={() => handleExecuteDelete(false)} variant="contained" color="error" sx={{ borderRadius: 2 }}>
              Confirmar Exclusão
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}