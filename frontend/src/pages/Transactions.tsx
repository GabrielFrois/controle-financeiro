import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, MenuItem, Box, Typography, Button,
  IconButton, Chip, CircularProgress, Stack, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, TablePagination,
  Tabs, Tab, useTheme, ToggleButtonGroup, ToggleButton, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider,
  FormControlLabel, Switch, Card, CardContent, CardActions, LinearProgress
} from '@mui/material';
import {
  Add, Delete, Edit, Clear, ListAlt, Timeline, History, EmojiEvents, Payments, Savings, Warning, HelpOutline,
  ChevronLeft, ChevronRight, Today, CreditCard, AccountBalanceWallet, CheckCircle, ReceiptLong,
  CalendarViewDay, CalendarViewWeek, CalendarMonth, Paid, ArrowDownward, ShoppingBag, EventRepeat
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

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAllFuture, setEditAllFuture] = useState(false);

  const [paymentMode, setPaymentMode] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

  // --- ESTADOS DA ABA DE FATURAS ---
  const [selectedCardId, setSelectedCardId] = useState('');
  const [invoiceMonth, setInvoiceMonth] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<any>(null);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [userFilter, setUserFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(endOfMonth);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: '', amount: '', type: 'EXPENSE',
    category_id: '', user_id: '', date: new Date().toISOString().split('T')[0],
    payment_method_id: '', installments: '1', asset_ticker: '', quantity: '',
    investment_type: 'OUTROS', yield_rate: ''
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
      
      const pMethods = Array.isArray(payRes.data) ? payRes.data : [];
      setPaymentMethods(pMethods);

      const firstCard = pMethods.find((m: any) => m.closing_day);
      if (firstCard) setSelectedCardId(firstCard.id);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getSmartInvoiceDate = useCallback((cardId: number) => {
    const card = paymentMethods.find(m => m.id === cardId);
    if (!card || !card.closing_day) return new Date().toISOString().slice(0, 7);

    const today = new Date();
    const currentDay = today.getDate();
    
    let currentInvoiceDate = new Date(today);
    let isClosed = false;

    if (currentDay < card.closing_day) {
        currentInvoiceDate.setMonth(currentInvoiceDate.getMonth() + 1);
        isClosed = false; 
    } else {
        currentInvoiceDate.setMonth(currentInvoiceDate.getMonth() + 1);
        isClosed = true;
    }
    
    const currentInvoiceStr = currentInvoiceDate.toISOString().slice(0, 7);

    // Se aberta, mostra ela
    if (!isClosed) return currentInvoiceStr;

    // Se fechada, verifica se pagou
    const debt = transactions
        .filter(t => t.payment_method_id === cardId && t.date.startsWith(currentInvoiceStr) && t.type === 'EXPENSE')
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const [year, month] = currentInvoiceStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 15);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const targetString = `${monthName}/${year}`.toLowerCase();

    const paid = transactions
        .filter(t => 
            t.type === 'EXPENSE' &&
            t.payment_method_id !== cardId && 
            t.description.toLowerCase().includes('pagamento fatura') &&
            t.description.toLowerCase().includes(card.name.toLowerCase()) &&
            t.description.toLowerCase().includes(targetString)
        )
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const isPaid = (debt - paid) <= 1;

    if (!isPaid) {
        return currentInvoiceStr;
    } else {
        const nextInvoiceDate = new Date(currentInvoiceDate);
        nextInvoiceDate.setMonth(nextInvoiceDate.getMonth() + 1);
        return nextInvoiceDate.toISOString().slice(0, 7);
    }
  }, [paymentMethods, transactions]);

  // Inicializa
  useEffect(() => {
    if (selectedCardId && paymentMethods.length > 0 && transactions.length > 0) {
        if(invoiceMonth === '') {
            setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
        }
    }
  }, [selectedCardId, paymentMethods, transactions, getSmartInvoiceDate, invoiceMonth]);

  const handleSmartJump = () => {
      if(selectedCardId) {
          setInvoiceMonth(getSmartInvoiceDate(Number(selectedCardId)));
      }
  };

  const formatCurrency = (val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return "---";
    const pureDate = dateStr.split('T')[0];
    return new Date(pureDate + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const formatRegistrationDate = (isoString: string) => {
    if (!isoString) return "--/--";
    return new Date(isoString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const handleOpenNew = () => {
    setIsEditing(false);
    setEditingId(null);
    setEditAllFuture(false);
    setPaymentMode('DEBIT'); 
    setForm({
      description: '', amount: '', type: 'EXPENSE', category_id: '', user_id: '',
      date: new Date().toISOString().split('T')[0], payment_method_id: '', installments: '1',
      asset_ticker: '', quantity: '', investment_type: 'OUTROS', yield_rate: ''
    });
    setOpen(true);
  };

  const handlePayInvoice = (totalPending: number, dueDate: string) => {
    const cardName = paymentMethods.find(m => m.id === Number(selectedCardId))?.name || 'Cartão';
    const [year, month] = invoiceMonth.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 15); 
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    
    setIsEditing(false);
    setEditingId(null);
    setEditAllFuture(false);
    setPaymentMode('DEBIT'); 
    
    setForm({
        description: `Pagamento Fatura ${cardName} - ${monthName}/${year}`,
        amount: totalPending.toFixed(2),
        type: 'EXPENSE',
        category_id: '', 
        user_id: '', 
        date: new Date().toISOString().split('T')[0], 
        payment_method_id: '', 
        installments: '1',
        asset_ticker: '', quantity: '', investment_type: 'OUTROS', yield_rate: ''
    });
    setOpen(true);
  };

  const handleOpenEdit = (t: any) => {
    setIsEditing(true);
    setEditingId(t.id);
    setEditAllFuture(false);
    const savedMethod = paymentMethods.find(m => m.id === t.payment_method_id);
    setPaymentMode(savedMethod && savedMethod.closing_day ? 'CREDIT' : 'DEBIT');
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
      quantity: t.quantity || '',
      investment_type: t.investment_type || 'OUTROS',
      yield_rate: t.yield_rate || ''
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

  const creditCards = useMemo(() => paymentMethods.filter(m => m.closing_day), [paymentMethods]);

  const invoiceData = useMemo(() => {
    if (!selectedCardId || !invoiceMonth) return { items: [], payments: [], totalInvoice: 0, totalPaid: 0, dueDate: '', cardLimit: 0, totalUsedLimit: 0 };

    const card = creditCards.find(c => c.id === Number(selectedCardId));
    const cardName = card?.name || '';
    const cardLimit = Number(card?.card_limit) || 0;

    const items = transactions.filter(t => 
        t.payment_method_id === Number(selectedCardId) &&
        t.date.startsWith(invoiceMonth) &&
        t.type === 'EXPENSE'
    );

    const [year, month] = invoiceMonth.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 15);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long' });
    const targetString = `${monthName}/${year}`.toLowerCase();

    const payments = transactions.filter(t => 
        t.type === 'EXPENSE' &&
        t.payment_method_id !== Number(selectedCardId) && 
        t.description.toLowerCase().includes('pagamento fatura') &&
        t.description.toLowerCase().includes(cardName.toLowerCase()) &&
        t.description.toLowerCase().includes(targetString) 
    );

    const totalInvoice = items.reduce((acc, t) => acc + Number(t.amount), 0);
    const totalPaid = payments.reduce((acc, t) => acc + Number(t.amount), 0);

    const dueDay = card?.due_day || 10;
    const dueDate = `${invoiceMonth}-${String(dueDay).padStart(2, '0')}`;

    const allTimeSpend = transactions
        .filter(t => t.payment_method_id === Number(selectedCardId) && t.type === 'EXPENSE')
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const allTimePayments = transactions
        .filter(t => 
            t.type === 'EXPENSE' &&
            t.payment_method_id !== Number(selectedCardId) && 
            t.description.toLowerCase().includes('pagamento fatura') &&
            t.description.toLowerCase().includes(cardName.toLowerCase())
        )
        .reduce((acc, t) => acc + Number(t.amount), 0);

    const totalUsedLimit = Math.max(0, allTimeSpend - allTimePayments);

    return { items, payments, totalInvoice, totalPaid, dueDate, cardLimit, totalUsedLimit };
  }, [transactions, selectedCardId, invoiceMonth, creditCards]);


  const analyticsData = useMemo(() => {
    try {
      const today = new Date();
      const trendData: any[] = [];
      const maxFutureMonthDiff = transactions.reduce((max, t) => {
        const tDate = new Date((t.date || "").split('T')[0] + 'T12:00:00');
        const diff = (tDate.getFullYear() - today.getFullYear()) * 12 + (tDate.getMonth() - today.getMonth());
        return diff > max ? diff : max;
      }, 0);
      
      const futureHorizon = Math.max(0, Math.min(6, maxFutureMonthDiff));
      const endOffset = futureHorizon + chartOffset;
      const startOffset = endOffset - 11;

      let runningPatrimony = transactions
        .filter(t => {
            const tDate = new Date((t.date || "").split('T')[0] + 'T12:00:00');
            return tDate < new Date(today.getFullYear(), today.getMonth() + startOffset, 1);
        })
        .reduce((acc, t) => t.type === 'INCOME' ? acc + Number(t.amount) : acc - Number(t.amount), 0);

      for (let i = startOffset; i <= endOffset; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const monthYear = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const monthTrans = transactions.filter(t => t.date?.startsWith(monthYear) && (trendUserFilter === 'Todos' || t.user_name === trendUserFilter));
        const inc = monthTrans.filter(t => t.type === 'INCOME').reduce((a, b) => a + Number(b.amount), 0);
        const exp = monthTrans.filter(t => t.type === 'EXPENSE').reduce((a, b) => a + Number(b.amount), 0);
        runningPatrimony += (inc - exp);
        trendData.push({
          name: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).toUpperCase(),
          Patrimonio: runningPatrimony, Receitas: inc, Despesas: exp, isFuture: i > 0
        });
      }

      const chartEndDate = new Date(); 
      let chartStartDate = new Date();

      if (evolutionMode === 'monthly') {
         chartStartDate.setMonth(chartEndDate.getMonth() - 11);
      } else if (evolutionMode === 'weekly') {
         chartStartDate.setDate(chartEndDate.getDate() - (12 * 7));
      } else {
         chartStartDate.setDate(chartEndDate.getDate() - 30);
      }
      
      const sDateStr = chartStartDate.toISOString().split('T')[0];
      const eDateStr = chartEndDate.toISOString().split('T')[0];

      const chartTransactions = transactions.filter(t => {
          const tDate = t.date.split('T')[0];
          const matchCat = categoryFilter === 'Todas' || t.category_name === categoryFilter;
          const matchUser = userFilter === 'Todos' || t.user_name === userFilter;
          const matchType = typeFilter === 'Todos' || t.type === typeFilter;
          return matchCat && matchUser && matchType && tDate >= sDateStr && tDate <= eDateStr;
      });

      const evolutionMap: any = {};
      
      chartTransactions.forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'EXPENSE') { 
          const [year, month, day] = t.date.split('T')[0].split('-').map(Number);
          const dt = new Date(year, month - 1, day);
          let sortKey, label;
          
          if (evolutionMode === 'daily') {
             sortKey = t.date.split('T')[0];
             label = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
          } else if (evolutionMode === 'weekly') {
             const tempD = new Date(dt);
             tempD.setDate(tempD.getDate() - tempD.getDay()); 
             sortKey = tempD.toISOString().split('T')[0];
             label = `Sem. ${tempD.getDate()}/${tempD.getMonth() + 1}`;
          } else {
             sortKey = `${year}-${String(month).padStart(2, '0')}`;
             label = dt.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
          }

          if (!evolutionMap[sortKey]) evolutionMap[sortKey] = { valor: 0, label };
          evolutionMap[sortKey].valor += amt;
        }
      });

      const listExpense = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((a,b) => a + Number(b.amount), 0);
      const listIncome = filteredTransactions.filter(t => t.type === 'INCOME').reduce((a,b) => a + Number(b.amount), 0);
      
      const groupedExpensesMap = filteredTransactions.filter(t => t.type === 'EXPENSE').reduce((acc: any, t) => {
        const baseDescription = t.description.replace(/\s\(\d+\/\d+\)$/, '');
        if (!acc[baseDescription]) acc[baseDescription] = { ...t, description: baseDescription, amount: 0 };
        acc[baseDescription].amount += Number(t.amount);
        return acc;
      }, {});

      return {
        trendData,
        lineData: Object.keys(evolutionMap).sort().map(k => evolutionMap[k]), 
        top5: Object.values(groupedExpensesMap).sort((a: any, b: any) => b.amount - a.amount).slice(0, 5),
        avgWeekly: listExpense / 4, 
        avgMonthly: listExpense, 
        totalPeriodo: listExpense, 
        savingsTotal: listIncome - listExpense,
        projectedSavings: 0 
      };
    } catch (e) { return { trendData: [], lineData: [], top5: [], avgWeekly: 0, avgMonthly: 0, totalPeriodo: 0, savingsTotal: 0, projectedSavings: 0 }; }
  }, [transactions, filteredTransactions, evolutionMode, trendUserFilter, chartOffset, startDate, endDate, categoryFilter, userFilter, typeFilter]);

  const handleOpenDelete = (transaction: any) => { setTransactionToDelete(transaction); setDeleteDialogOpen(true); };

  const handleExecuteDelete = async (deleteAllInSeries: boolean) => {
    try {
      if (deleteAllInSeries && transactionToDelete.installment_group_id) await api.delete(`/transactions/group/${transactionToDelete.installment_group_id}`);
      else await api.delete(`/transactions/${transactionToDelete.id}`);
      setDeleteDialogOpen(false); fetchData();
    } catch { alert("Erro ao excluir"); }
  };

  const isInvestmentForm = useMemo(() => categories.find(c => c.id === form.category_id)?.name.toLowerCase().includes('investimento'), [form.category_id, categories]);

  const availablePaymentMethods = useMemo(() => {
    return paymentMethods.filter(m => {
      if (!m.active) return false;
      if (paymentMode === 'CREDIT') return m.closing_day != null; 
      return m.closing_day == null; 
    });
  }, [paymentMethods, paymentMode]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, px: 2, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<ListAlt />} iconPosition="start" label="Registros" />
          <Tab icon={<ReceiptLong />} iconPosition="start" label="Faturas" />
          <Tab icon={<Timeline />} iconPosition="start" label="Análise de Período" />
          <Tab icon={<History />} iconPosition="start" label="Tendência" />
        </Tabs>
        {(tabValue === 0) && <Button variant="contained" startIcon={<Add />} sx={{ borderRadius: '10px' }} onClick={handleOpenNew}>Novo Lançamento</Button>}
      </Box>

      {/* --- ABA 0: Registros --- */}
      {tabValue === 0 && (
        <>
           <Paper sx={{ p: 3, mb: 3, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Tipo" size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem><MenuItem value="INCOME">Receitas</MenuItem><MenuItem value="EXPENSE">Despesas</MenuItem></TextField></Grid>
                <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Categoria" size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><MenuItem value="Todas">Todas</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Usuário" size="small" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Grid>
                <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Início" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Grid>
                <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Fim" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Grid>
                <Grid size={{ xs: 12, md: 2 }}><Button fullWidth startIcon={<Clear />} onClick={() => { setStartDate(startOfMonth); setEndDate(endOfMonth); setCategoryFilter('Todas'); setUserFilter('Todos'); }}>Reset</Button></Grid>
            </Grid>
           </Paper>

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
                        <IconButton size="small" color="primary" onClick={() => handleOpenEdit(t)}><Edit fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleOpenDelete(t)}><Delete fontSize="small" /></IconButton>
                        </Stack>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            <TablePagination component="div" count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page} onPageChange={(_, p) => setPage(p)} onRowsPerPageChange={e => setRowsPerPage(parseInt(e.target.value, 10))} />
            </TableContainer>
        </>
      )}

      {/* --- ABA 1: GESTÃO DE FATURAS --- */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3, borderRadius: 5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl sx={{ minWidth: 200 }} size="small">
                        <InputLabel>Selecione o Cartão</InputLabel>
                        <Select value={selectedCardId} label="Selecione o Cartão" onChange={(e) => setSelectedCardId(e.target.value)}>
                            {creditCards.length === 0 && <MenuItem disabled>Nenhum cartão cadastrado</MenuItem>}
                            {creditCards.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField 
                        type="month" 
                        label="Mês de Vencimento" 
                        size="small" 
                        value={invoiceMonth} 
                        onChange={(e) => setInvoiceMonth(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    <Button 
                        variant="outlined" 
                        startIcon={<EventRepeat />}
                        color="primary"
                        onClick={handleSmartJump}
                        sx={{ ml: 'auto', height: 40, fontWeight: 'bold' }}
                    >
                        Fatura Atual
                    </Button>
                </Paper>
            </Grid>

            {/* RESUMO DA FATURA */}
            <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ borderRadius: 5, height: '100%', bgcolor: 'primary.main', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: 6 }}>
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                        <CreditCard sx={{ fontSize: 60, mb: 1, opacity: 0.9 }} />
                        <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 3, fontWeight: 'bold' }}>TOTAL A PAGAR</Typography>
                        
                        <Typography variant="h3" fontWeight="900" sx={{ my: 1 }}>{formatCurrency(Math.max(0, invoiceData.totalInvoice - invoiceData.totalPaid))}</Typography>
                        
                        {invoiceData.totalPaid > 0 && (
                            <Chip size="small" label={`Já Pago: ${formatCurrency(invoiceData.totalPaid)}`} sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 'bold', mt: 1 }} />
                        )}

                        <Typography variant="caption" sx={{ mt: 2, opacity: 0.8 }}>Vencimento: {invoiceData.dueDate ? new Date(invoiceData.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}</Typography>

                        {/* BARRA DE LIMITE */}
                        {invoiceData.cardLimit > 0 && (
                            <Box sx={{ width: '100%', mt: 4 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, px: 1 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Limite Usado</Typography>
                                    <Typography variant="caption">{Math.min(100, (invoiceData.totalUsedLimit / invoiceData.cardLimit) * 100).toFixed(0)}%</Typography>
                                </Box>
                                <LinearProgress 
                                    variant="determinate" 
                                    value={Math.min(100, (invoiceData.totalUsedLimit / invoiceData.cardLimit) * 100)} 
                                    sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: invoiceData.totalUsedLimit > invoiceData.cardLimit ? 'error.main' : 'secondary.main' } }}
                                />
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5, opacity: 0.8 }}>
                                    {formatCurrency(invoiceData.totalUsedLimit)} / {formatCurrency(invoiceData.cardLimit)}
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                    <CardActions sx={{ p: 3, justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.1)' }}>
                        <Button 
                            variant="contained" 
                            color="secondary" 
                            size="large"
                            fullWidth
                            startIcon={<CheckCircle />}
                            onClick={() => handlePayInvoice(invoiceData.totalInvoice - invoiceData.totalPaid, invoiceData.dueDate)}
                            disabled={invoiceData.totalInvoice - invoiceData.totalPaid <= 0.01}
                            sx={{ fontWeight: 'bold', py: 1.5, borderRadius: 3, boxShadow: 'none' }}
                        >
                            PAGAR
                        </Button>
                    </CardActions>
                </Card>
            </Grid>

            {/* TABELA DE FATURA */}
            <Grid size={{ xs: 12, md: 8 }}>
                
                {/* 1. SEÇÃO DE PAGAMENTOS */}
                {invoiceData.payments.length > 0 && (
                    <Paper sx={{ mb: 2, borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'success.light' }}>
                        <Box sx={{ bgcolor: 'success.light', p: 1, px: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Paid sx={{ color: 'white', fontSize: 20 }} />
                            <Typography variant="subtitle2" color="white" fontWeight="bold">PAGAMENTOS EFETUADOS</Typography>
                        </Box>
                        <List dense>
                            {invoiceData.payments.map(p => (
                                <ListItem key={p.id} sx={{ borderBottom: '1px dashed #e0e0e0' }}>
                                    <ListItemText primary={p.description} secondary={`Data do Pagamento: ${new Date(p.date).toLocaleDateString('pt-BR')}`} />
                                    <Typography fontWeight="bold" color="success.main">-{formatCurrency(p.amount)}</Typography>
                                    <IconButton size="small" color="error" onClick={() => handleOpenDelete(p)} sx={{ ml: 1 }}><Delete fontSize="small" /></IconButton>
                                </ListItem>
                            ))}
                        </List>
                        <Box sx={{ bgcolor: '#f1f8e9', p: 0.5, textAlign: 'center' }}>
                            <ArrowDownward color="success" fontSize="small" />
                        </Box>
                    </Paper>
                )}

                {/* 2. SEÇÃO DE LANÇAMENTOS */}
                <TableContainer component={Paper} sx={{ borderRadius: 5, maxHeight: 600 }}>
                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                            <ShoppingBag fontSize="small" color="primary"/> DETALHES DA FATURA
                        </Typography>
                    </Box>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Data</TableCell>
                                <TableCell>Descrição</TableCell>
                                <TableCell>Quem</TableCell>
                                <TableCell align="right">Valor</TableCell>
                                <TableCell align="center">Editar</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {invoiceData.items.length === 0 && (
                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                                    <Typography variant="body1">Nenhuma compra nesta fatura.</Typography>
                                </TableCell></TableRow>
                            )}
                            {/* Ordenar por data de criação para ficar cronológico */}
                            {invoiceData.items.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(t => (
                                <TableRow key={t.id} hover>
                                    <TableCell sx={{ color: 'text.primary', fontSize: '0.85rem' }}>
                                        {formatRegistrationDate(t.created_at)}
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{t.description}</TableCell>
                                    <TableCell><Chip label={t.user_name} size="small" sx={{ height: 20, fontSize: '0.7rem' }} /></TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(t.amount)}</TableCell>
                                    <TableCell align="center">
                                        <IconButton size="small" onClick={() => handleOpenEdit(t)}><Edit fontSize="small" /></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Grid>
        </Grid>
      )}

      {/* --- ABA 2: ANÁLISE --- */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}><Paper sx={{ p: 3, borderRadius: 5 }}><Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Payments color="primary" /> RESUMO</Typography><Grid container spacing={2}>{[{ label: 'MÉDIA SEMANAL', val: analyticsData.avgWeekly, color: 'text.secondary' }, { label: 'MÉDIA MENSAL', val: analyticsData.avgMonthly, color: 'text.secondary' }, { label: 'TOTAL NO PERÍODO', val: analyticsData.totalPeriodo, color: 'error.main' }].map((item) => (<Grid size={{ xs: 12, sm: 4 }} key={item.label}><Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}><Typography variant="caption" fontWeight="bold" color="text.secondary">{item.label}</Typography><Typography variant="h6" fontWeight="900" color={item.color}>{formatCurrency(item.val)}</Typography></Box></Grid>))}</Grid></Paper></Grid>
          <Grid size={{ xs: 12, md: 5 }}><Paper sx={{ p: 3, borderRadius: 5, bgcolor: `${theme.palette.success.main}08`, border: '1px solid', borderColor: theme.palette.success.light }}><Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}><Savings color="success" /> ECONOMIA</Typography><Stack spacing={2}><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">NO PERÍODO:</Typography><Typography variant="h5" fontWeight="900" color="success.main">{formatCurrency(analyticsData.savingsTotal)}</Typography></Box><Divider /><Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" fontWeight="bold">PROJEÇÃO FINAL DO MÊS:</Typography><Typography variant="h6" fontWeight="900">{formatCurrency(analyticsData.projectedSavings)}</Typography></Box></Stack></Paper></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Typography variant="h6" fontWeight="900" mb={2}><EmojiEvents color="warning" /> MAIORES GASTOS </Typography>
            <List>
              {analyticsData.top5.map((t: any, i: number) => (
                <ListItem key={i} disableGutters>
                  <ListItemAvatar><Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 'bold' }}>{i + 1}</Avatar></ListItemAvatar>
                  <ListItemText primary={<Typography fontWeight="700" noWrap>{t.description}</Typography>} secondary={t.category_name} />
                  <Typography fontWeight="900" color="error.main">{formatCurrency(t.amount)}</Typography>
                </ListItem>
              ))}
            </List>
          </Paper></Grid>
          <Grid size={{ xs: 12, md: 8 }}><Paper sx={{ p: 3, borderRadius: 5, height: 480 }}><Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}><Typography variant="h6" fontWeight="bold">Evolução de Gastos</Typography><ToggleButtonGroup size="small" value={evolutionMode} exclusive onChange={(_, v) => v && setEvolutionMode(v)}><ToggleButton value="daily"><CalendarViewDay fontSize="small" sx={{ mr: 1 }}/> Dia</ToggleButton><ToggleButton value="weekly"><CalendarViewWeek fontSize="small" sx={{ mr: 1 }}/> Sem</ToggleButton><ToggleButton value="monthly"><CalendarMonth fontSize="small" sx={{ mr: 1 }}/> Mês</ToggleButton></ToggleButtonGroup></Box><Box sx={{ height: 350 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={analyticsData.lineData}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis hide /><Tooltip formatter={(v: any) => [formatCurrency(v), "Gasto"]} /><Line type="monotone" dataKey="valor" stroke={theme.palette.error.main} strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></Box></Paper></Grid>
        </Grid>
      )}

      {/* --- ABA 3: TENDÊNCIA E PROJEÇÃO --- */}
      {tabValue === 3 && (
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
          <Grid size={{ xs: 12 }}><Paper sx={{ p: 4, borderRadius: 5, bgcolor: '#fff' }}><Typography variant="h6" fontWeight="900" mb={4} display="flex" alignItems="center" gap={1}><Payments color="primary" /> FLUXO DE CAIXA </Typography><Box sx={{ height: 400 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={analyticsData.trendData}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis hide /><Tooltip formatter={(v: any) => formatCurrency(v)} /><Legend verticalAlign="top" height={36} /><Bar name="Receitas" dataKey="Receitas" fill={theme.palette.success.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((e, i) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}</Bar><Bar name="Despesas" dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]}>{analyticsData.trendData.map((e, i) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}</Bar></BarChart></ResponsiveContainer></Box></Paper></Grid>
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
              <TextField fullWidth label="Descrição" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Valor" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Grid>
                <Grid size={{ xs: 6 }}><TextField fullWidth type="date" label="Data" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth><InputLabel>Tipo</InputLabel>
                    <Select value={form.type} label="Tipo" onChange={(e) => setForm({ ...form, type: e.target.value as any, category_id: '' })}>
                      <MenuItem value="EXPENSE">Despesa</MenuItem>
                      <MenuItem value="INCOME">Receita</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControl fullWidth required><InputLabel>Usuário</InputLabel>
                    <Select value={form.user_id} label="Usuário" onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
                      {users.filter(u => u.active).map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <FormControl fullWidth required><InputLabel>Categoria</InputLabel>
                <Select value={form.category_id} label="Categoria" onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  {categories.filter(c => c.active && c.type === form.type).map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              
              <Divider sx={{ my: 1 }}><Chip label="PAGAMENTO" size="small" /></Divider>

              {/* SELETOR DE MODO DE PAGAMENTO */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <ToggleButtonGroup
                    color="primary"
                    value={paymentMode}
                    exclusive
                    onChange={(_, val) => {
                        if (val) {
                            setPaymentMode(val);
                            setForm({ ...form, payment_method_id: '' });
                        }
                    }}
                    size="small"
                >
                    <ToggleButton value="DEBIT" sx={{ px: 3 }}>
                        <AccountBalanceWallet sx={{ mr: 1, fontSize: 20 }} /> À VISTA / DÉBITO
                    </ToggleButton>
                    <ToggleButton value="CREDIT" sx={{ px: 3 }}>
                        <CreditCard sx={{ mr: 1, fontSize: 20 }} /> CRÉDITO PARCELADO
                    </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Grid container spacing={2}>
                  <Grid size={{ xs: (paymentMode === 'CREDIT' && !isEditing) ? 8 : 12 }}>
                    <FormControl fullWidth required>
                        <InputLabel>{paymentMode === 'CREDIT' ? "Cartão de Crédito" : "Conta / Carteira"}</InputLabel>
                        <Select
                            value={form.payment_method_id}
                            label={paymentMode === 'CREDIT' ? "Cartão de Crédito" : "Conta / Carteira"}
                            onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
                        >
                            {availablePaymentMethods.length === 0 && (
                                <MenuItem disabled value="">
                                    {paymentMode === 'CREDIT' ? "Nenhum cartão cadastrado" : "Nenhuma conta encontrada"}
                                </MenuItem>
                            )}
                            {availablePaymentMethods.map(m => (
                                <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                  </Grid>

                  {/* Campo de Parcelas */}
                  {paymentMode === 'CREDIT' && !isEditing && (
                    <Grid size={{ xs: 4 }}>
                      <TextField 
                        fullWidth 
                        type="number" 
                        label="Parcelas" 
                        value={form.installments} 
                        onChange={(e) => setForm({ ...form, installments: e.target.value })} 
                        InputProps={{ inputProps: { min: 1 } }}
                      />
                    </Grid>
                  )}
              </Grid>

              {isInvestmentForm && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12}>
                    <TextField
                      select
                      fullWidth
                      label="Tipo de Ativo"
                      value={form.investment_type}
                      onChange={(e) => setForm({ ...form, investment_type: e.target.value })}
                    >
                      <MenuItem value="RENDA_FIXA">Renda Fixa (CDB/Tesouro)</MenuItem>
                      <MenuItem value="ACOES">Ações</MenuItem>
                      <MenuItem value="FII">FIIs</MenuItem>
                      <MenuItem value="CRIPTOS">Criptoativos</MenuItem>
                      <MenuItem value="INTERNACIONAL">Internacional</MenuItem>
                      <MenuItem value="OUTROS">Outros</MenuItem>
                    </TextField>
                  </Grid>

                  {form.investment_type === 'RENDA_FIXA' ? (
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Rentabilidade (% do CDI)"
                        type="number"
                        placeholder="Ex: 102"
                        value={form.yield_rate}
                        onChange={(e) => setForm({ ...form, yield_rate: e.target.value })}
                      />
                    </Grid>
                  ) : (
                    <>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          label="Ticker (Ex: PETR4)"
                          value={form.asset_ticker}
                          onChange={(e) => setForm({ ...form, asset_ticker: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Quantidade"
                          value={form.quantity}
                          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                        />
                      </Grid>
                    </>
                  )}
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