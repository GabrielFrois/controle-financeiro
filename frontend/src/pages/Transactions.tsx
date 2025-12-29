import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, 
  TableRow, TextField, MenuItem, Box, Typography, Button, 
  IconButton, Chip, CircularProgress, Stack, Grid, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  FormControl, InputLabel, Select, TablePagination,
  Tabs, Tab, useTheme, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider
} from '@mui/material';
import { 
  Add, Delete, Clear, ListAlt, Timeline, History, EmojiEvents, AccountBalance, Payments, Savings 
} from '@mui/icons-material';
import { 
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import api from '../services/api';

export default function Transactions() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [evolutionMode, setEvolutionMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [trendUserFilter, setTrendUserFilter] = useState('Todos');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [userFilter, setUserFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: '', amount: '', type: 'EXPENSE',
    category_id: '', user_id: '', date: new Date().toISOString().split('T')[0],
    payment_method_id: ''
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
    } catch (error) { console.error("Erro na busca:", error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchCategory = categoryFilter === 'Todas' || t.category_name === categoryFilter;
      const matchUser = userFilter === 'Todos' || t.user_name === userFilter;
      const matchType = typeFilter === 'Todos' || t.type === typeFilter;
      const tDate = t.date ? new Date(t.date).getTime() : 0;
      const start = startDate ? new Date(startDate).getTime() : -Infinity;
      const end = endDate ? new Date(endDate).getTime() : Infinity;
      return matchCategory && matchUser && matchType && tDate >= start && tDate <= end;
    });
  }, [transactions, categoryFilter, userFilter, typeFilter, startDate, endDate]);

  const analyticsData = useMemo(() => {
    try {
      const last12Months: any[] = [];
      let runningBalance = 0;
      const now = new Date();
      
      // Tendência 12 Meses 
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthTrans = transactions.filter(t => t.date?.startsWith(monthYear) && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter));
        const inc = monthTrans.filter(t => t.type === 'INCOME').reduce((a, b) => a + (Number(b.amount) || 0), 0);
        const exp = monthTrans.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + (Number(b.amount) || 0), 0);
        runningBalance += (inc - exp);
        
        last12Months.push({ 
          name: d.toLocaleDateString('pt-BR', { month: 'short' }).replace(".", "").toUpperCase(), 
          fullName: d.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase(),
          Receitas: inc, Despesas: exp, Patrimonio: runningBalance 
        });
      }

      // Análise de Período
      let periodIncome = 0, periodExpense = 0;
      const evolutionMap: any = {};

      filteredTransactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'INCOME') periodIncome += amt;
        else {
          periodExpense += amt;
          if (t.date) {
            const dt = new Date(t.date);
            let sortKey = ""; // Chave para ordenação (YYYY-MM-DD ou YYYY-MM)
            let label = "";   // O que aparece no eixo X
            let tooltip = ""; // O que aparece no hover

            if (evolutionMode === 'daily') {
              sortKey = t.date;
              label = `${dt.getUTCDate().toString().padStart(2, '0')}/${(dt.getUTCMonth() + 1).toString().padStart(2, '0')}`;
              tooltip = label;
            } else if (evolutionMode === 'weekly') {
              const startOfYear = new Date(dt.getFullYear(), 0, 1);
              const weekNum = Math.ceil((((dt.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
              const weekOfMonth = Math.ceil(dt.getUTCDate() / 7);
              sortKey = `${dt.getFullYear()}-${weekNum.toString().padStart(2, '0')}`;
              label = `Sem ${weekNum}`;
              tooltip = `Semana ${weekOfMonth} de ${dt.toLocaleDateString('pt-BR', { month: 'long' })}`;
            } else if (evolutionMode === 'monthly') {
              sortKey = t.date.substring(0, 7);
              label = dt.toLocaleDateString('pt-BR', { month: 'short' }).replace(".", "").toUpperCase();
              tooltip = dt.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
            }

            if (!evolutionMap[sortKey]) evolutionMap[sortKey] = { valor: 0, label, tooltip };
            evolutionMap[sortKey].valor += amt;
          }
        }
      });

      // Ordena as chaves cronologicamente
      const lineData = Object.keys(evolutionMap).sort().map(k => ({ 
        label: evolutionMap[k].label, 
        fullTooltip: evolutionMap[k].tooltip,
        valor: evolutionMap[k].valor 
      }));

      // Médias e Projeção
      const daysPassed = Math.max(1, now.getDate());
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const currentMonthStr = now.toISOString().substring(0, 7);
      const curMonthTrans = transactions.filter(t => t.date?.startsWith(currentMonthStr));
      const curMonthSavings = curMonthTrans.reduce((acc, t) => t.type === 'INCOME' ? acc + (Number(t.amount) || 0) : acc - (Number(t.amount) || 0), 0);
      const diffTime = (startDate && endDate) ? (new Date(endDate).getTime() - new Date(startDate).getTime()) : 30 * 86400000;
      const baseDaily = periodExpense / Math.max(1, Math.ceil(diffTime / 86400000));

      return { 
        barData: last12Months,
        lineData,
        top5: [...filteredTransactions].filter(t => t.type === 'EXPENSE').sort((a,b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)).slice(0, 5),
        avgWeekly: baseDaily * 7, avgMonthly: baseDaily * 30, avgYearly: baseDaily * 365,
        savingsTotal: periodIncome - periodExpense,
        projectedSavings: (curMonthSavings / daysPassed) * daysInMonth
      };
    } catch (e) { return { barData: [], lineData: [], top5: [], avgWeekly: 0, avgMonthly: 0, avgYearly: 0, savingsTotal: 0, projectedSavings: 0 }; }
  }, [transactions, filteredTransactions, evolutionMode, startDate, endDate, trendUserFilter]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2, maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* NAVEGAÇÃO PRINCIPAL */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ListAlt />} iconPosition="start" label="Registros" />
          <Tab icon={<Timeline />} iconPosition="start" label="Análise de Período" />
          <Tab icon={<History />} iconPosition="start" label="Tendência 12 Meses" />
        </Tabs>
        {tabValue === 0 && (
          <Button variant="contained" startIcon={<Add />} sx={{ borderRadius: '10px' }} onClick={() => setOpen(true)}>Novo Lançamento</Button>
        )}
      </Box>

      {/* FILTROS */}
      {tabValue !== 2 && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Tipo" size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem><MenuItem value="INCOME">Receitas</MenuItem><MenuItem value="EXPENSE">Despesas</MenuItem></TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Categoria" size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><MenuItem value="Todas">Todas</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Usuário" size="small" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Início" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Fim" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Grid>
            <Grid size={{ xs: 12, md: 2 }}><Button fullWidth startIcon={<Clear />} onClick={() => { setCategoryFilter('Todas'); setUserFilter('Todos'); setTypeFilter('Todos'); setStartDate(''); setEndDate(''); }}>Limpar</Button></Grid>
          </Grid>
        </Paper>
      )}

      {/* ABA 0: REGISTROS */}
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
                  <TableCell>{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</TableCell>
                  <TableCell><Chip label={t.user_name} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderColor: t.user_color, color: t.user_color }} /></TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t.description}</TableCell>
                  <TableCell><Chip label={t.category_name} size="small" variant="outlined" sx={{ fontWeight: 'bold', borderColor: t.category_color, color: t.category_color, fontSize: '0.65rem' }} /></TableCell>
                  <TableCell align="right"><Typography fontWeight="900" color={t.type === 'INCOME' ? 'success.main' : 'error.main'}>{t.type === 'INCOME' ? '+ ' : '- '} {formatCurrency(t.amount)}</Typography></TableCell>
                  <TableCell align="center"><IconButton size="small" color="error" onClick={() => { if(window.confirm("Excluir?")) api.delete(`/transactions/${t.id}`).then(() => fetchData()); }}><Delete fontSize="small" /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination component="div" count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
        </TableContainer>
      )}

      {/* ABA 1: ANÁLISE DE PERÍODO */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: '100%' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Payments color="primary"/> MÉDIAS DE GASTO</Typography>
              <Grid container spacing={2}>
                {[ { label: 'SEMANAL', val: analyticsData.avgWeekly }, { label: 'MENSUAL', val: analyticsData.avgMonthly }, { label: 'ANUAL', val: analyticsData.avgYearly } ].map((item) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">{item.label}</Typography>
                      <Typography variant="h6" fontWeight="900" color="error.main">{formatCurrency(item.val)}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 5, bgcolor: `${theme.palette.success.main}08`, border: '1px solid', borderColor: theme.palette.success.light }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Savings color="success"/> ECONOMIA</Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">NO PERÍODO FILTRADO:</Typography><Typography variant="h5" fontWeight="900" color="success.main">{formatCurrency(analyticsData.savingsTotal)}</Typography></Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">PROJEÇÃO FINAL DO MÊS ATUAL:</Typography><Typography variant="h6" fontWeight="900">{formatCurrency(analyticsData.projectedSavings)}</Typography></Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: 480 }}>
              <Typography variant="h6" fontWeight="900" mb={2}><EmojiEvents color="warning" /> MAIORES GASTOS</Typography>
              <List>{analyticsData.top5.map((t, i) => (
                <ListItem key={t.id} disableGutters><ListItemAvatar><Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 'bold' }}>{i+1}</Avatar></ListItemAvatar><ListItemText primary={<Typography fontWeight="700" noWrap>{t.description}</Typography>} secondary={t.category_name} /><Typography fontWeight="900" color="error.main">{formatCurrency(t.amount)}</Typography></ListItem>
              ))}</List>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: 480 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">Evolução de Gastos</Typography>
                <ToggleButtonGroup size="small" value={evolutionMode} exclusive onChange={(_, v) => v && setEvolutionMode(v)}>
                  <ToggleButton value="daily">Diário</ToggleButton>
                  <ToggleButton value="weekly">Semanal</ToggleButton>
                  <ToggleButton value="monthly">Mensal</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.lineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                    <XAxis dataKey="label" />
                    <Tooltip 
                      labelFormatter={(_, payload) => payload[0]?.payload?.fullTooltip} 
                      formatter={(v: any) => [formatCurrency(v), "Gasto"]} 
                    />
                    <Line type="monotone" dataKey="valor" stroke={theme.palette.error.main} strokeWidth={4} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ABA 2: TENDÊNCIA 12 MESES */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 2, borderRadius: 5, display: 'flex', justifyContent: 'flex-end', mb: -1 }}><TextField select label="Filtrar por Usuário" size="small" sx={{ width: 250 }} value={trendUserFilter} onChange={(e) => setTrendUserFilter(e.target.value)}><MenuItem value="Todos">Todos os Usuários</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Paper></Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 4, borderRadius: 5 }}>
              <Typography variant="h6" fontWeight="900" mb={4}><History color="primary" sx={{ mr: 1 }} /> FLUXO DE CAIXA MENSAL</Typography>
              <Box sx={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="name" />
                    <Tooltip 
                      labelFormatter={(_, payload) => payload[0]?.payload?.fullName} 
                      formatter={(v: any) => formatCurrency(v)} 
                    />
                    <Legend verticalAlign="top" height={36}/><Bar name="Receitas" dataKey="Receitas" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} /><Bar name="Despesas" dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 4, borderRadius: 5, bgcolor: `${theme.palette.primary.main}05` }}>
              <Typography variant="h6" fontWeight="900" mb={4}><AccountBalance color="primary" sx={{ mr: 1 }} /> EVOLUÇÃO DO PATRIMÔNIO (SALDO LÍQUIDO)</Typography>
              <Box sx={{ height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.barData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="name" />
                    <Tooltip 
                      labelFormatter={(_, payload) => payload[0]?.payload?.fullName} 
                      formatter={(v: any) => [formatCurrency(v), "Saldo"]} 
                    />
                    <Line name="Patrimônio Acumulado" dataKey="Patrimonio" stroke={theme.palette.primary.main} strokeWidth={5} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* DIALOG DE CADASTRO */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>Novo Lançamento</DialogTitle>
        <form onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api.post('/transactions', form);
            setOpen(false);
            setForm({ description: '', amount: '', type: 'EXPENSE', category_id: '', user_id: '', date: new Date().toISOString().split('T')[0], payment_method_id: '' });
            fetchData();
          } catch { alert("Erro ao salvar"); }
        }}>
          <DialogContent>
            <Stack spacing={2.5}>
              <TextField fullWidth label="Descrição" required value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Valor" required value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="Data" required value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} /></Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth><InputLabel>Tipo</InputLabel>
                    <Select value={form.type} label="Tipo" onChange={(e) => setForm({...form, type: e.target.value, category_id: ''})}>
                      <MenuItem value="EXPENSE">Despesa</MenuItem><MenuItem value="INCOME">Receita</MenuItem>
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
              <FormControl fullWidth required><InputLabel>Método</InputLabel>
                <Select value={form.payment_method_id} label="Método" onChange={(e) => setForm({...form, payment_method_id: e.target.value})}>
                  {paymentMethods.map(m => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" variant="contained">Salvar</Button></DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}