import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, TextField, MenuItem, Box, Typography, Button, 
  IconButton, Chip, CircularProgress, Stack, Grid, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  FormControl, InputLabel, Select, TablePagination,
  Tabs, Tab, useTheme, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  FormControlLabel, Switch
} from '@mui/material';
import { 
  Add, Delete, Edit, Clear, ListAlt, Timeline, History, EmojiEvents, AccountBalance, Payments, Savings, Warning, HelpOutline,
  ChevronLeft, ChevronRight, Today
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
  const [chartOffset, setChartOffset] = useState(0);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  // ESTADOS PARA EDIÇÃO
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAllFuture, setEditAllFuture] = useState(false);

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
      const [transRes, userRes, catRes, payRes] = await Promise.all([
        api.get('/transactions'), api.get('/users'), api.get('/categories'), api.get('/payment-methods')
      ]);
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
      setPaymentMethods(Array.isArray(payRes.data) ? payRes.data : []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return "---";
    const pureDate = dateStr.split('T')[0];
    return new Date(pureDate + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  // FUNÇÕES DE AÇÃO
  const handleOpenNew = () => {
    setIsEditing(false);
    setEditingId(null);
    setEditAllFuture(false);
    setForm({ description: '', amount: '', type: 'EXPENSE', category_id: '', user_id: '', date: new Date().toISOString().split('T')[0], payment_method_id: '', installments: '1', asset_ticker: '', quantity: '' });
    setOpen(true);
  };

  const handleOpenEdit = (t: any) => {
    setIsEditing(true);
    setEditingId(t.id);
    setEditAllFuture(false);
    setForm({
      description: t.description.replace(/\s\(\d+\/\d+\)$/, ''), 
      amount: t.amount,
      type: t.type,
      category_id: t.category_id,
      user_id: t.user_id,
      date: t.date.split('T')[0],
      payment_method_id: t.payment_method_id,
      installments: '1',
      asset_ticker: t.asset_ticker || '',
      quantity: t.quantity || ''
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        if (editAllFuture) {
          const groupId = transactions.find(t => t.id === editingId)?.installment_group_id;
          await api.put(`/transactions/group/${groupId}`, form);
        } else {
          await api.put(`/transactions/${editingId}`, form);
        }
      } else {
        await api.post('/transactions', form);
      }
      setOpen(false);
      fetchData();
    } catch { alert("Erro ao salvar"); }
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
      const maxFutureMonthDiff = transactions.reduce((max, t) => {
        const tDate = new Date((t.date || "").split('T')[0] + 'T12:00:00');
        const diff = (tDate.getFullYear() - today.getFullYear()) * 12 + (tDate.getMonth() - today.getMonth());
        return diff > max ? diff : max;
      }, 0);
      const windowSize = 12;
      const baseEnd = Math.min(6, maxFutureMonthDiff);
      const endOffset = baseEnd + chartOffset;
      const startOffset = endOffset - (windowSize - 1);
      const firstMonthOfWindow = new Date(today.getFullYear(), today.getMonth() + startOffset, 1);
      const isInvestment = (t: any) => t.category_name?.toLowerCase().includes('investimento');

      let runningPatrimony = transactions
        .filter(t => {
          const tDate = new Date((t.date || "").split('T')[0] + 'T12:00:00');
          const isFromSelectedUser = trendUserFilter === 'Todos' || t.user_name === trendUserFilter;
          return tDate < firstMonthOfWindow && isFromSelectedUser;
        })
        .reduce((acc, t) => {
            if (isInvestment(t)) return acc;
            return t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount);
        }, 0);

      for (let i = startOffset; i <= endOffset; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthTrans = transactions.filter(t => t.date?.startsWith(monthYear) && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter));
        const inc = monthTrans.filter(t => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount), 0);
        const exp = monthTrans.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount), 0);
        const patrimonyChange = monthTrans.filter(t => !isInvestment(t)).reduce((acc, t) => t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount), 0);
        runningPatrimony += patrimonyChange;
        trendData.push({ 
          name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(), 
          Patrimonio: runningPatrimony, Receitas: inc, Despesas: exp, isFuture: i > 0, isToday: i === 0
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
          let sortKey = evolutionMode === 'daily' ? t.date.split('T')[0] : (evolutionMode === 'weekly' ? new Date(dt.setDate(dt.getDate() - dt.getDay())).toISOString().split('T')[0] : `${year}-${String(month).padStart(2, '0')}`);
          let label = evolutionMode === 'daily' ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}` : (evolutionMode === 'weekly' ? `Sem. ${dt.getDate()}/${dt.getMonth() + 1}` : dt.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase());
          if (!evolutionMap[sortKey]) evolutionMap[sortKey] = { valor: 0, label };
          evolutionMap[sortKey].valor += amt;
        }
      });

      const groupedExpensesMap = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc: any, t) => {
        const baseDescription = t.description.replace(/\s\(\d+\/\d+\)$/, '');
        if (!acc[baseDescription]) acc[baseDescription] = { ...t, description: baseDescription, amount: 0, count: 0 };
        acc[baseDescription].amount += Number(t.amount);
        acc[baseDescription].count += 1;
        return acc;
      }, {});

      const dailyBase = periodExpense / Math.max(1, Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);

      return { 
        trendData, 
        lineData: Object.keys(evolutionMap).sort().map(k => evolutionMap[k]), 
        top5: Object.values(groupedExpensesMap).sort((a: any, b: any) => b.amount - a.amount).slice(0, 5),
        avgWeekly: dailyBase * 7, avgMonthly: dailyBase * 30, totalPeriodo: periodExpense, savingsTotal: periodIncome - periodExpense, 
        projectedSavings: (transactions.filter(t => t.date.startsWith(today.toISOString().substring(0, 7))).reduce((acc, t) => t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount), 0) / Math.max(1, today.getDate())) * 30
      };
    } catch (e) { return { trendData: [], lineData: [], top5: [], avgWeekly: 0, avgMonthly: 0, totalPeriodo: 0, savingsTotal: 0, projectedSavings: 0 }; }
  }, [transactions, filteredTransactions, evolutionMode, trendUserFilter, chartOffset, startDate, endDate]);

  const handleOpenDelete = (transaction: any) => { setTransactionToDelete(transaction); setDeleteDialogOpen(true); };

  const handleExecuteDelete = async (deleteAllInSeries: boolean) => {
    try {
      if (deleteAllInSeries && transactionToDelete.installment_group_id) await api.delete(`/transactions/group/${transactionToDelete.installment_group_id}`);
      else await api.delete(`/transactions/${transactionToDelete.id}`);
      setDeleteDialogOpen(false); fetchData();
    } catch { alert("Erro ao excluir"); }
  };

  const isInvestmentForm = useMemo(() => categories.find(c => c.id === form.category_id)?.name.toLowerCase().includes('investimento'), [form.category_id, categories]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, px: 2, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ListAlt />} iconPosition="start" label="Registros" />
          <Tab icon={<Timeline />} iconPosition="start" label="Análise de Período" />
          <Tab icon={<History />} iconPosition="start" label="Tendência e Projeção" />
        </Tabs>
        {tabValue === 0 && <Button variant="contained" startIcon={<Add />} sx={{ borderRadius: '10px' }} onClick={handleOpenNew}>Novo Lançamento</Button>}
      </Box>

      {/* BLOCO DE FILTROS - VISÍVEL NAS ABAS 0 E 1 */}
      {tabValue < 2 && (
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

      {/* REGISTROS */}
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
                  <TableCell sx={{ fontWeight: 700 }}>{t.description}</TableCell>
                  <TableCell><Chip label={t.category_name} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderColor: t.category_color, color: t.category_color, fontSize: '0.65rem' }} /></TableCell>
                  <TableCell align="right"><Typography fontWeight="900" color={t.type === 'INCOME' ? 'success.main' : 'error.main'}>{formatCurrency(t.amount)}</Typography></TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={1} justifyContent="center">
                      <IconButton size="small" color="primary" onClick={() => handleOpenEdit(t)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleOpenDelete(t)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
        </TableContainer>
      )}

      {/* ANÁLISE DE PERÍODO */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}><Paper sx={{ p: 3, borderRadius: 5 }}><Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Payments color="primary"/> RESUMO FINANCEIRO</Typography><Grid container spacing={2}>{[ { label: 'MÉDIA SEMANAL', val: analyticsData.avgWeekly, color: 'text.secondary' }, { label: 'MÉDIA MENSAL', val: analyticsData.avgMonthly, color: 'text.secondary' }, { label: 'TOTAL NO PERÍODO', val: analyticsData.totalPeriodo, color: 'error.main' } ].map((item) => (<Grid size={{ xs: 12, sm: 4 }} key={item.label}><Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}><Typography variant="caption" fontWeight="bold" color="text.secondary">{item.label}</Typography><Typography variant="h6" fontWeight="900" color={item.color}>{formatCurrency(item.val)}</Typography></Box></Grid>))}</Grid></Paper></Grid>
          <Grid size={{ xs: 12, md: 5 }}><Paper sx={{ p: 3, borderRadius: 5, bgcolor: `${theme.palette.success.main}08`, border: '1px solid', borderColor: theme.palette.success.light }}><Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Savings color="success"/> ECONOMIA</Typography><Stack spacing={2}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">NO PERÍODO:</Typography><Typography variant="h5" fontWeight="900" color="success.main">{formatCurrency(analyticsData.savingsTotal)}</Typography></Box><Divider /><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">PROJEÇÃO FINAL DO MÊS:</Typography><Typography variant="h6" fontWeight="900">{formatCurrency(analyticsData.projectedSavings)}</Typography></Box></Stack></Paper></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Typography variant="h6" fontWeight="900" mb={2}><EmojiEvents color="warning" /> MAIORES GASTOS </Typography>
            <List>
              {analyticsData.top5.map((t: any, i: number) => (
                <ListItem key={i} disableGutters>
                  <ListItemAvatar><Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 'bold' }}>{i+1}</Avatar></ListItemAvatar>
                  <ListItemText primary={<Typography fontWeight="700" noWrap>{t.description}</Typography>} secondary={t.category_name} />
                  <Typography fontWeight="900" color="error.main">{formatCurrency(t.amount)}</Typography>
                </ListItem>
              ))}
            </List>
          </Paper></Grid>
          <Grid size={{ xs: 12, md: 8 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h6" fontWeight="bold">Evolução de Gastos</Typography><ToggleButtonGroup size="small" value={evolutionMode} exclusive onChange={(_, v) => v && setEvolutionMode(v)}><ToggleButton value="daily">Dia</ToggleButton><ToggleButton value="weekly">Sem</ToggleButton><ToggleButton value="monthly">Mês</ToggleButton></ToggleButtonGroup></Box><Box sx={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={analyticsData.lineData}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis hide /><Tooltip formatter={(v: any) => [formatCurrency(v), "Gasto"]} /><Line type="monotone" dataKey="valor" stroke={theme.palette.error.main} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></Box></Paper></Grid>
        </Grid>
      )}

      {/* TENDÊNCIA E PROJEÇÃO */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2, borderRadius: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton onClick={() => setChartOffset(prev => prev - 1)}><ChevronLeft /></IconButton>
                <Button variant="outlined" size="small" startIcon={<Today />} onClick={() => setChartOffset(0)}>Reset</Button>
                <IconButton onClick={() => setChartOffset(prev => prev + 1)}><ChevronRight /></IconButton>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2, fontWeight: 'bold' }}>Visualizando: {analyticsData.trendData[0]?.name} até {analyticsData.trendData[11]?.name}</Typography>
              </Stack>
              <TextField select label="Usuário" size="small" sx={{ width: 200 }} value={trendUserFilter} onChange={(e) => setTrendUserFilter(e.target.value)}>
                <MenuItem value="Todos">Todos</MenuItem>
                {users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}
              </TextField>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 4, borderRadius: 5, bgcolor: '#fff' }}><Typography variant="h6" fontWeight="900" mb={4} display="flex" alignItems="center" gap={1}><Payments color="primary"/> FLUXO DE CAIXA </Typography><Box sx={{ height: 400 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis hide /><Tooltip formatter={(v: any) => formatCurrency(v)} /><Legend verticalAlign="top" height={36}/><Bar name="Receitas" dataKey="Receitas" fill={theme.palette.success.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((e, i) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}</Bar><Bar name="Despesas" dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((e, i) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}</Bar></BarChart></ResponsiveContainer></Box></Paper></Grid>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 4, borderRadius: 5, bgcolor: '#fff' }}><Typography variant="h6" fontWeight="900" mb={4} display="flex" alignItems="center" gap={1}><AccountBalance color="primary" /> EVOLUÇÃO DE PATRIMÔNIO </Typography><Box sx={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={analyticsData.trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis hide /><Tooltip formatter={(v: any) => [formatCurrency(v), "Patrimônio"]} /><Line name="Patrimônio Total" dataKey="Patrimonio" stroke={theme.palette.primary.main} strokeWidth={5} dot={(props: any) => { const { cx, cy, payload } = props; return <circle cx={cx} cy={cy} r={6} fill={payload.isFuture ? theme.palette.warning.main : theme.palette.primary.main} stroke="none" />; }} /></LineChart></ResponsiveContainer></Box></Paper></Grid>
        </Grid>
      )}

      {/* MODAL DE LANÇAMENTO */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{isEditing ? 'Editar Registro' : 'Novo Lançamento'}</DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5}>
              {isEditing && transactions.find(t => t.id === editingId)?.installment_group_id && (
                <FormControlLabel
                  control={<Switch checked={editAllFuture} onChange={(e) => setEditAllFuture(e.target.checked)} />}
                  label="Aplicar mudanças a todas as parcelas deste grupo?"
                />
              )}
              <TextField fullWidth label="Descrição" required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Valor" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="Data" required value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} /></Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth><InputLabel>Tipo</InputLabel>
                    <Select value={form.type} label="Tipo" onChange={(e) => setForm({...form, type: e.target.value as any, category_id: ''})}>
                      <MenuItem value="EXPENSE">Despesa</MenuItem>
                      <MenuItem value="INCOME">Receita</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth required><InputLabel>Usuário</InputLabel>
                    <Select value={form.user_id} label="Usuário" onChange={(e) => setForm({...form, user_id: e.target.value})}>
                      {users.filter(u => u.active).map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <FormControl fullWidth required><InputLabel>Categoria</InputLabel>
                <Select value={form.category_id} label="Categoria" onChange={(e) => setForm({...form, category_id: e.target.value})}>
                  {categories.filter(c => c.active && c.type === form.type).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth required><InputLabel>Método de Pagamento</InputLabel>
                <Select value={form.payment_method_id} label="Método" onChange={(e) => setForm({...form, payment_method_id: e.target.value})}>
                  {paymentMethods.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                </Select>
              </FormControl>
              {paymentMethods.find(m => m.id === form.payment_method_id)?.name === 'Crédito' && !isEditing && (
                <TextField fullWidth type="number" label="Parcelas" value={form.installments} onChange={(e) => setForm({...form, installments: e.target.value})} />
              )}
              {isInvestmentForm && (
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}><TextField fullWidth label="Ticker (Ex: PETR4)" value={form.asset_ticker} onChange={(e) => setForm({...form, asset_ticker: e.target.value})} /></Grid>
                  <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Quantidade" value={form.quantity} onChange={(e) => setForm({...form, quantity: e.target.value})} /></Grid>
                </Grid>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">{isEditing ? 'Salvar Alterações' : 'Salvar'}</Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIALOG DE EXCLUSÃO */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 900 }}>{transactionToDelete?.installment_group_id ? <Warning color="warning" /> : <HelpOutline color="primary" />}Excluir Registro</DialogTitle>
        <DialogContent><Typography variant="body1" fontWeight="700">Tem certeza que deseja excluir "{transactionToDelete?.description}"?</Typography>{transactionToDelete?.installment_group_id && (<Typography variant="body2" color="text.secondary" sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2, border: '1px solid #ffe0b2' }}><b>Atenção:</b> Este item faz parte de uma compra parcelada. Você pode excluir apenas esta parcela ou o grupo inteiro.</Typography>)}</DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}><Button onClick={() => setDeleteDialogOpen(false)} color="inherit" variant="outlined">Cancelar</Button>{transactionToDelete?.installment_group_id ? (<Stack direction="row" spacing={1}><Button onClick={() => handleExecuteDelete(false)} variant="contained" color="error">Apenas Esta</Button><Button onClick={() => handleExecuteDelete(true)} variant="contained" color="error">Excluir Todas</Button></Stack>) : (<Button onClick={() => handleExecuteDelete(false)} variant="contained" color="error">Confirmar Exclusão</Button>)}</DialogActions>
      </Dialog>
    </Box>
  );
}