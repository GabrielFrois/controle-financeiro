import { useState, useMemo, useCallback } from 'react';
import {
  Box, Tabs, Tab, Button, CircularProgress, Grid,
  Paper, Typography, Stack, TextField, MenuItem,
  FormControl, InputLabel, Select, Card, CardContent, CardActions,
  LinearProgress, List, ListItem, ListItemText, ListItemAvatar, Avatar,
  Chip, Divider, IconButton, ToggleButtonGroup, ToggleButton,
  TableContainer, Table, TableHead, TableRow, TableCell, TableBody,
  useTheme, useMediaQuery,
} from '@mui/material';
import {
  Add, ListAlt, ReceiptLong, Timeline, History,
  EventRepeat, ChevronLeft, ChevronRight, Today,
  Payments, Savings, EmojiEvents,
  CheckCircle, Paid, ArrowDownward, ShoppingBag,
  CalendarViewDay, CalendarViewWeek, CalendarMonth, Edit, Delete,
} from '@mui/icons-material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  Legend, ResponsiveContainer, LineChart, Line, Cell,
} from 'recharts';
import api from '../services/api';
import { useTransactions } from '../hooks/useTransactions';
import type { Transaction } from '../types';
import { useInvoice } from '../hooks/useInvoice';
import { useTransactionAnalytics } from '../hooks/useTransactionAnalytics';
import TransactionFilters from '../components/transactions/TransactionFilters';
import TransactionTable from '../components/transactions/TransactionTable';
import TransactionFormDialog from '../components/transactions/TransactionFormDialog';
import type { TransactionForm } from '../components/transactions/TransactionFormDialog';
import DeleteTransactionDialog from '../components/transactions/DeleteTransactionDialog';
import { useAuth } from '../context/AuthContext';
import { useFamily } from '../context/FamilyContext';

// ─── helpers ────────────────────────────────────────────────────────────────
const formatCurrency = (val: any) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

const formatRegistrationDate = (iso: string) => {
  if (!iso) return '--/--';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const now           = new Date();
const oneYearAgo    = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
const DEFAULT_START = oneYearAgo.toISOString().split('T')[0];
const DEFAULT_END   = now.toISOString().split('T')[0];

const makeEmptyForm = (userId: string): TransactionForm => ({
  description: '', amount: '', type: 'EXPENSE',
  category_id: '', user_id: userId, date: new Date().toISOString().split('T')[0],
  payment_method_id: '', installments: '1',
  asset_ticker: '', quantity: '', investment_type: 'OUTROS', yield_rate: '',
  is_invoice_payment: false, paid_card_id: '', invoice_reference_month: '',
});

// ─── component ──────────────────────────────────────────────────────────────
export default function Transactions() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user: authUser } = useAuth();
  const { activeLabel } = useFamily();
  const { loading, transactions, categories, paymentMethods, fetchData } = useTransactions();
  const {
    creditCards, selectedCardId, setSelectedCardId,
    invoiceMonth, setInvoiceMonth, invoiceData, jumpToCurrentInvoice,
  } = useInvoice(transactions, paymentMethods);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [tabValue, setTabValue]             = useState(0);
  const [evolutionMode, setEvolutionMode]   = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [chartOffset, setChartOffset]       = useState(0);

  const [page, setPage]                     = useState(0);
  const [rowsPerPage, setRowsPerPage]       = useState(10);
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [typeFilter, setTypeFilter]         = useState('Todos');
  const [startDate, setStartDate]           = useState(DEFAULT_START);
  const [endDate, setEndDate]               = useState(DEFAULT_END);

  // ── Form / dialog state ───────────────────────────────────────────────────
  const [open, setOpen]                     = useState(false);
  const [isEditing, setIsEditing]           = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editAllFuture, setEditAllFuture]   = useState(false);
  const [paymentMode, setPaymentMode]       = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [form, setForm]                     = useState<TransactionForm>(makeEmptyForm(String(authUser?.id ?? '')));

  const [deleteDialogOpen, setDeleteDialogOpen]       = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => transactions.filter((t) => {
    const matchCategory = categoryFilter === 'Todas' || t.category_name === categoryFilter;
    const matchType     = typeFilter === 'Todos'    || t.type           === typeFilter;
    const tDate         = (t.date || '').split('T')[0];
    return matchCategory && matchType && tDate >= startDate && tDate <= endDate;
  }), [transactions, categoryFilter, typeFilter, startDate, endDate]);

  const analyticsData = useTransactionAnalytics(
    transactions, filteredTransactions, evolutionMode,
    'Todos', chartOffset,
    { categoryFilter, userFilter: 'Todos', typeFilter, startDate, endDate }
  );

  const editingHasGroup = useMemo(
    () => !!transactions.find((t) => t.id === editingId)?.installment_group_id,
    [transactions, editingId]
  );

  // ── handlers ──────────────────────────────────────────────────────────────
  const handleOpenNew = () => {
    setIsEditing(false); setEditingId(null); setEditAllFuture(false);
    setPaymentMode('DEBIT');
    setForm(makeEmptyForm(String(authUser?.id ?? '')));
    setOpen(true);
  };

  const handlePayInvoice = (totalPending: number) => {
    const card     = paymentMethods.find((m) => m.id === Number(selectedCardId));
    const cardName = (card as any)?.name ?? 'Cartão';
    const [year, month] = invoiceMonth.split('-');
    const monthName = new Date(Number(year), Number(month) - 1, 15)
      .toLocaleDateString('pt-BR', { month: 'long' });

    // A descrição aqui é só para leitura humana no extrato — quem realmente
    // liga este lançamento à fatura do cartão são os campos estruturados
    // abaixo (is_invoice_payment / paid_card_id / invoice_reference_month),
    // não mais o texto.
    const invoicePaymentCategory = categories.find((c) => c.name === 'Pagamento de Fatura');

    setIsEditing(false); setEditingId(null); setEditAllFuture(false); setPaymentMode('DEBIT');
    setForm({
      ...makeEmptyForm(String(authUser?.id ?? '')),
      description: `Pagamento Fatura ${cardName} - ${monthName}/${year}`,
      amount: totalPending.toFixed(2),
      category_id: invoicePaymentCategory ? String(invoicePaymentCategory.id) : '',
      is_invoice_payment: true,
      paid_card_id: selectedCardId,
      invoice_reference_month: invoiceMonth,
    });
    setOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setIsEditing(true); setEditingId(t.id); setEditAllFuture(false);
    const saved = paymentMethods.find((m) => m.id === t.payment_method_id);
    setPaymentMode(saved?.closing_day ? 'CREDIT' : 'DEBIT');
    setForm({
      description:       t.description.replace(/\s\(\d+\/\d+\)$/, ''),
      amount:            String(t.amount),
      type:              t.type,
      category_id:       String(t.category_id),
      user_id:           String(t.user_id),
      date:              t.date.split('T')[0],
      payment_method_id: String(t.payment_method_id),
      installments:      '1',
      asset_ticker:      t.asset_ticker ?? '',
      quantity:          t.quantity ? String(t.quantity) : '',
      investment_type:   t.investment_type ?? 'OUTROS',
      yield_rate:        t.yield_rate ? String(t.yield_rate) : '',
      is_invoice_payment: !!t.is_invoice_payment,
      paid_card_id:        t.paid_card_id ? String(t.paid_card_id) : '',
      invoice_reference_month: t.invoice_reference_month ?? '',
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && editingId) {
        if (editAllFuture) {
          const groupId = transactions.find((t) => t.id === editingId)?.installment_group_id;
          await api.put(`/transactions/group/${groupId}`, { ...form, referer_date: form.date });
        } else {
          await api.put(`/transactions/${editingId}`, form);
        }
      } else {
        await api.post('/transactions', form);
      }
      setOpen(false);
      fetchData();
    } catch (err: any) {
      const details = err?.response?.data?.details as { field: string; message: string }[] | undefined;
      const message = details?.length
        ? details.map((d) => `${d.field}: ${d.message}`).join('\n')
        : (err?.response?.data?.error ?? 'Erro ao salvar');
      alert(message);
    }
  };

  const handleOpenDelete = (t: Transaction) => { setTransactionToDelete(t); setDeleteDialogOpen(true); };

  const handleExecuteDelete = async (deleteAllInSeries: boolean) => {
    if (!transactionToDelete) return;
    try {
      if (deleteAllInSeries && transactionToDelete.installment_group_id) {
        await api.delete(`/transactions/group/${transactionToDelete.installment_group_id}`);
      } else {
        await api.delete(`/transactions/${transactionToDelete.id}`);
      }
      setDeleteDialogOpen(false);
      fetchData();
    } catch {
      alert('Erro ao excluir');
    }
  };

  const handleFilterChange = useCallback((field: string, value: string) => {
    const setters: Record<string, (v: string) => void> = {
      typeFilter: setTypeFilter, categoryFilter: setCategoryFilter,
      startDate: setStartDate, endDate: setEndDate,
    };
    setters[field]?.(value);
  }, []);

  const handleFilterReset = useCallback(() => {
    setStartDate(DEFAULT_START); setEndDate(DEFAULT_END);
    setCategoryFilter('Todas');
  }, []);

  // ── render ────────────────────────────────────────────────────────────────
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, px: { xs: 1.5, sm: 2 }, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>

      {/* Tab bar */}
      <Box sx={{
        borderBottom: 1, borderColor: 'divider', mb: 2,
        display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' },
        gap: { xs: 1.5, sm: 0 },
      }}>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : undefined}
          allowScrollButtonsMobile
          sx={{ minHeight: 44 }}
        >
          <Tab icon={<ListAlt />}     iconPosition="start" label="Registros" sx={{ minHeight: 44 }} />
          <Tab icon={<ReceiptLong />} iconPosition="start" label="Faturas" sx={{ minHeight: 44 }} />
          <Tab icon={<Timeline />}    iconPosition="start" label={isMobile ? 'Análise' : 'Análise de Período'} sx={{ minHeight: 44 }} />
          <Tab icon={<History />}     iconPosition="start" label="Tendência" sx={{ minHeight: 44 }} />
        </Tabs>
        {tabValue === 0 && (
          <Button
            variant="contained" startIcon={<Add />} fullWidth={isMobile}
            sx={{ borderRadius: '10px', flexShrink: 0 }}
            onClick={handleOpenNew}
          >
            Novo Lançamento
          </Button>
        )}
      </Box>

      {/* ── ABA 0: Registros ─────────────────────────────────────────────── */}
      {tabValue === 0 && (
        <>
          <TransactionFilters
            typeFilter={typeFilter} categoryFilter={categoryFilter}
            startDate={startDate} endDate={endDate}
            defaultStartDate={DEFAULT_START} defaultEndDate={DEFAULT_END}
            categories={categories}
            onChange={handleFilterChange} onReset={handleFilterReset}
          />
          <TransactionTable
            transactions={filteredTransactions}
            page={page} rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
            onEdit={handleOpenEdit}
            onDelete={handleOpenDelete}
          />
        </>
      )}

      {/* ── ABA 1: Faturas ───────────────────────────────────────────────── */}
      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{
              p: { xs: 2, sm: 3 }, borderRadius: 5,
              display: 'flex', flexDirection: { xs: 'column', sm: 'row' },
              gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, flexWrap: 'wrap',
            }}>
              <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }} size="small">
                <InputLabel>Selecione o Cartão</InputLabel>
                <Select value={selectedCardId} label="Selecione o Cartão" onChange={(e) => setSelectedCardId(e.target.value)}>
                  {creditCards.length === 0 && <MenuItem disabled>Nenhum cartão cadastrado</MenuItem>}
                  {creditCards.map((c: any) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField type="month" label="Mês de Vencimento" size="small" value={invoiceMonth}
                onChange={(e) => setInvoiceMonth(e.target.value)} InputLabelProps={{ shrink: true }}
                fullWidth={isMobile} />
              <Button variant="outlined" startIcon={<EventRepeat />} onClick={jumpToCurrentInvoice}
                fullWidth={isMobile}
                sx={{ ml: { xs: 0, sm: 'auto' }, height: 40, fontWeight: 'bold', flexShrink: 0 }}>
                Fatura Atual
              </Button>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 5, height: '100%', bgcolor: 'primary.main', color: 'white', display: 'flex', flexDirection: 'column', boxShadow: 6 }}>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3 } }}>
                <CreditCardIcon sx={{ fontSize: { xs: 44, sm: 60 }, mb: 1, opacity: 0.9 }} />
                <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: { xs: 1.5, sm: 3 }, fontWeight: 'bold', fontSize: { xs: '0.65rem', sm: '0.75rem' }, textAlign: 'center' }}>
                  TOTAL A PAGAR
                </Typography>
                <Typography fontWeight="900" sx={{ my: 1, fontSize: { xs: '1.8rem', sm: '3rem' }, textAlign: 'center', lineHeight: 1.2 }}>
                  {formatCurrency(Math.max(0, invoiceData.totalInvoice - invoiceData.totalPaid))}
                </Typography>
                {invoiceData.totalPaid > 0 && (
                  <Chip size="small" label={`Já Pago: ${formatCurrency(invoiceData.totalPaid)}`}
                    sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 'bold', mt: 1 }} />
                )}
                <Typography variant="caption" sx={{ mt: 2, opacity: 0.8, textAlign: 'center' }}>
                  Vencimento: {invoiceData.dueDate ? new Date(invoiceData.dueDate + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}
                </Typography>
                {invoiceData.cardLimit > 0 && (
                  <Box sx={{ width: '100%', mt: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, px: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 'bold' }}>Limite Usado</Typography>
                      <Typography variant="caption">
                        {Math.min(100, (invoiceData.totalUsedLimit / invoiceData.cardLimit) * 100).toFixed(0)}%
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate"
                      value={Math.min(100, (invoiceData.totalUsedLimit / invoiceData.cardLimit) * 100)}
                      sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: invoiceData.totalUsedLimit > invoiceData.cardLimit ? 'error.main' : 'secondary.main' } }} />
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 0.5, opacity: 0.8 }}>
                      {formatCurrency(invoiceData.totalUsedLimit)} / {formatCurrency(invoiceData.cardLimit)}
                    </Typography>
                  </Box>
                )}
              </CardContent>
              <CardActions sx={{ p: { xs: 2, sm: 3 }, justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.1)' }}>
                <Button variant="contained" color="secondary" size="large" fullWidth startIcon={<CheckCircle />}
                  onClick={() => handlePayInvoice(invoiceData.totalInvoice - invoiceData.totalPaid)}
                  disabled={invoiceData.totalInvoice - invoiceData.totalPaid <= 0.01}
                  sx={{ fontWeight: 'bold', py: 1.5, borderRadius: 3, boxShadow: 'none' }}>
                  PAGAR
                </Button>
              </CardActions>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            {invoiceData.payments.length > 0 && (
              <Paper sx={{ mb: 2, borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'success.light' }}>
                <Box sx={{ bgcolor: 'success.light', p: 1, px: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Paid sx={{ color: 'white', fontSize: 20 }} />
                  <Typography variant="subtitle2" color="white" fontWeight="bold">PAGAMENTOS EFETUADOS</Typography>
                </Box>
                <List dense>
                  {invoiceData.payments.map((p: any) => (
                    <ListItem key={p.id} sx={{ borderBottom: '1px dashed #e0e0e0' }}>
                      <ListItemText primary={p.description} secondary={`Data: ${new Date(p.date).toLocaleDateString('pt-BR')}`} />
                      <Typography fontWeight="bold" color="success.main">-{formatCurrency(p.amount)}</Typography>
                      <IconButton size="small" color="error" onClick={() => handleOpenDelete(p)} sx={{ ml: 1 }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
                <Box sx={{ bgcolor: '#f1f8e9', p: 0.5, textAlign: 'center' }}><ArrowDownward color="success" fontSize="small" /></Box>
              </Paper>
            )}

            <Paper sx={{ borderRadius: 5, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="bold" display="flex" alignItems="center" gap={1}>
                  <ShoppingBag fontSize="small" color="primary" /> DETALHES DA FATURA
                </Typography>
              </Box>

              {invoiceData.items.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>
                  <Typography>Nenhuma compra nesta fatura.</Typography>
                </Box>
              ) : isMobile ? (
                // ── Cards no mobile: substitui a tabela de 5 colunas ──────────
                <Stack divider={<Divider />} sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {[...invoiceData.items]
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map((t: any) => (
                      <Box key={t.id} sx={{ p: 2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ pr: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap>{t.description}</Typography>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{formatRegistrationDate(t.created_at)}</Typography>
                              <Chip label={t.user_name} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                            </Stack>
                          </Box>
                          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                            <Typography variant="body2" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(t.amount)}</Typography>
                            <IconButton size="small" onClick={() => handleOpenEdit(t)}><Edit fontSize="small" /></IconButton>
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                </Stack>
              ) : (
                <TableContainer sx={{ maxHeight: 600 }}>
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
                      {[...invoiceData.items]
                        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .map((t: any) => (
                          <TableRow key={t.id} hover>
                            <TableCell sx={{ fontSize: '0.85rem' }}>{formatRegistrationDate(t.created_at)}</TableCell>
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
              )}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── ABA 2: Análise ───────────────────────────────────────────────── */}
      {tabValue === 2 && (
        <>
          <TransactionFilters
            typeFilter={typeFilter} categoryFilter={categoryFilter}
            startDate={startDate} endDate={endDate}
            defaultStartDate={DEFAULT_START} defaultEndDate={DEFAULT_END}
            categories={categories}
            onChange={handleFilterChange} onReset={handleFilterReset}
          />
          <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 5 }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <Payments color="primary" /> RESUMO — {activeLabel.toUpperCase()}
              </Typography>
              <Grid container spacing={2}>
                {[
                  { label: 'MÉDIA SEMANAL',    val: analyticsData.avgWeekly,    color: 'text.secondary' },
                  { label: 'MÉDIA MENSAL',     val: analyticsData.avgMonthly,   color: 'text.secondary' },
                  { label: 'TOTAL NO PERÍODO', val: analyticsData.totalPeriodo, color: 'error.main' },
                ].map((item) => (
                  <Grid size={{ xs: 12, sm: 4 }} key={item.label}>
                    <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', textAlign: 'center' }}>
                      <Typography variant="caption" fontWeight="bold" color="text.secondary">{item.label}</Typography>
                      <Typography fontWeight="900" color={item.color} sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{formatCurrency(item.val)}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 5, bgcolor: `${theme.palette.success.main}08`, border: '1px solid', borderColor: theme.palette.success.light }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <Savings color="success" /> ECONOMIA
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">NO PERÍODO:</Typography>
                  <Typography variant="h5" fontWeight="900" color="success.main" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>{formatCurrency(analyticsData.savingsTotal)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', gap: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold">PROJEÇÃO FINAL DO MÊS:</Typography>
                  <Typography variant="h6" fontWeight="900" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>{formatCurrency(analyticsData.projectedSavings)}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 5, height: { xs: 'auto', md: 480 } }}>
              <Typography variant="h6" fontWeight="900" mb={2}><EmojiEvents color="warning" /> MAIORES GASTOS</Typography>
              <List>
                {analyticsData.top5.map((t: any, i: number) => (
                  <ListItem key={i} disableGutters>
                    <ListItemAvatar><Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary', fontWeight: 'bold' }}>{i + 1}</Avatar></ListItemAvatar>
                    <ListItemText primary={<Typography fontWeight="700" noWrap>{t.description}</Typography>} secondary={t.category_name} />
                    <Typography fontWeight="900" color="error.main">{formatCurrency(t.amount)}</Typography>
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 5, height: { xs: 'auto', md: 480 } }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, mb: 3 }}>
                <Typography variant="h6" fontWeight="bold">Evolução de Gastos</Typography>
                <ToggleButtonGroup size="small" value={evolutionMode} exclusive onChange={(_, v) => v && setEvolutionMode(v)}>
                  <ToggleButton value="daily"><CalendarViewDay fontSize="small" sx={{ mr: { xs: 0, sm: 1 } }} /> {!isMobile && 'Dia'}</ToggleButton>
                  <ToggleButton value="weekly"><CalendarViewWeek fontSize="small" sx={{ mr: { xs: 0, sm: 1 } }} /> {!isMobile && 'Sem'}</ToggleButton>
                  <ToggleButton value="monthly"><CalendarMonth fontSize="small" sx={{ mr: { xs: 0, sm: 1 } }} /> {!isMobile && 'Mês'}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box sx={{ height: { xs: 260, sm: 350 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.lineData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis hide />
                    <ReTooltip formatter={(v: any) => [formatCurrency(v), 'Gasto']} />
                    <Line type="monotone" dataKey="valor" stroke={theme.palette.error.main} strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
        </>
      )}

      {/* ── ABA 3: Tendência ─────────────────────────────────────────────── */}
      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{
              p: 2, borderRadius: 5, display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' },
              flexWrap: 'wrap', gap: 2,
            }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ rowGap: 1 }}>
                <IconButton onClick={() => setChartOffset((p) => p - 1)}><ChevronLeft /></IconButton>
                <Button variant="outlined" size="small" startIcon={<Today />} onClick={() => setChartOffset(0)}>Reset</Button>
                <IconButton onClick={() => setChartOffset((p) => p + 1)}><ChevronRight /></IconButton>
                <Typography variant="body2" color="text.secondary" sx={{ ml: { xs: 0, sm: 2 }, fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }}>
                  Visualizando: {analyticsData.trendData[0]?.name} até {analyticsData.trendData[11]?.name}
                </Typography>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: { xs: 2, sm: 4 }, borderRadius: 5 }}>
              <Typography variant="h6" fontWeight="900" mb={{ xs: 2, sm: 4 }} display="flex" alignItems="center" gap={1}>
                <Payments color="primary" /> FLUXO DE CAIXA
              </Typography>
              <Box sx={{ height: { xs: 280, sm: 400 } }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.trendData} margin={{ left: isMobile ? 4 : 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: isMobile ? 9 : 11 }} interval={isMobile ? 1 : 0} />
                    <YAxis hide />
                    <ReTooltip formatter={(v: any) => formatCurrency(v)} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: isMobile ? 11 : 13 }} />
                    <Bar name="Receitas" dataKey="Receitas" fill={theme.palette.success.main} radius={[4, 4, 0, 0]}>
                      {analyticsData.trendData.map((e: any, i: number) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}
                    </Bar>
                    <Bar name="Despesas" dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]}>
                      {analyticsData.trendData.map((e: any, i: number) => <Cell key={i} fillOpacity={e.isFuture ? 0.4 : 1} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <TransactionFormDialog
        open={open}
        isEditing={isEditing}
        editingHasGroup={editingHasGroup}
        editAllFuture={editAllFuture}
        paymentMode={paymentMode}
        form={form}
        categories={categories}
        paymentMethods={paymentMethods}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        onFormChange={setForm}
        onPaymentModeChange={setPaymentMode}
        onEditAllFutureChange={setEditAllFuture}
      />

      <DeleteTransactionDialog
        open={deleteDialogOpen}
        transaction={transactionToDelete}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleExecuteDelete}
      />
    </Box>
  );
}