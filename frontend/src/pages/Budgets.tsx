import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, Typography, LinearProgress, Paper, Grid, CircularProgress, 
  useTheme, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, MenuItem, IconButton, Stack,
  Divider, Tooltip
} from '@mui/material';
import { Add, Delete, Edit, Warning, CalendarMonth, QueryStats, HelpOutline } from '@mui/icons-material';
import api from '../services/api';

export default function Budgets() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'MONTHLY' });

  // ESTADOS PARA EXCLUSÃO
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, budgetRes, catRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/budgets'),
        api.get('/categories')
      ]);
      setTransactions(transRes.data);
      setBudgets(budgetRes.data);
      setCategories(catRes.data.filter((c: any) => c.type === 'EXPENSE'));
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpen = (budget?: any) => {
    if (budget) {
      setEditingId(budget.id);
      setForm({
        category_id: budget.category_id,
        amount: budget.amount.toString(),
        period: budget.period
      });
    } else {
      setEditingId(null);
      setForm({ category_id: '', amount: '', period: 'MONTHLY' });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
    setForm({ category_id: '', amount: '', period: 'MONTHLY' });
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await api.put(`/budgets/${editingId}`, form);
      } else {
        await api.post('/budgets', form);
      }
      handleClose();
      fetchData();
    } catch { 
      alert(`Erro ao salvar meta`); 
    }
  };

  const handleOpenDelete = (budget: any) => {
    setBudgetToDelete(budget);
    setDeleteDialogOpen(true);
  };

  const handleExecuteDelete = async () => {
    try {
      if (budgetToDelete) {
        await api.delete(`/budgets/${budgetToDelete.id}`);
        setDeleteDialogOpen(false);
        fetchData();
      }
    } catch {
      alert("Erro ao excluir meta");
    }
  };

  const analysis = useMemo(() => {
    const now = new Date();
    const curMonth = now.getUTCMonth() + 1;
    const curYear = now.getUTCFullYear();

    return budgets.map(b => {
      const spent = transactions
        .filter(t => {
          const d = new Date(t.date);
          const matchCat = Number(t.category_id) === Number(b.category_id);
          const matchYear = d.getUTCFullYear() === curYear;
          const matchMonth = b.period === 'MONTHLY' ? (d.getUTCMonth() + 1) === curMonth : true;
          return t.type === 'EXPENSE' && matchCat && matchYear && matchMonth;
        })
        .reduce((acc, t) => acc + Number(t.amount), 0);

      const percent = b.amount > 0 ? (spent / Number(b.amount)) * 100 : 0;
      return { ...b, spent, percent };
    });
  }, [transactions, budgets]);

  const renderBudgetCard = (b: any) => {
    let progressColor = theme.palette.success.main;
    if (b.percent > 90) progressColor = theme.palette.error.main;
    else if (b.percent > 70) progressColor = theme.palette.warning.main;

    return (
      <Grid item xs={12} sm={6} md={3} key={b.id}>
        <Paper sx={{ 
          p: 3, 
          borderRadius: 5, 
          border: '1px solid', 
          borderColor: 'divider',
          minHeight: 200,
          minWidth: { xs: '100%', sm: '280px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease-in-out',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
          '&:hover': { 
            transform: 'translateY(-4px)', 
            boxShadow: theme.shadows[4],
            borderColor: theme.palette.primary.main
          }
        }}>
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase' }}>
                {b.category_name || 'Categoria'} 
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" onClick={() => handleOpen(b)} color="primary">
                  <Edit sx={{ fontSize: 18 }} />
                </IconButton>
                <IconButton size="small" onClick={() => handleOpenDelete(b)} color="error">
                  <Delete sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            </Stack>
            
            <Box sx={{ my: 1.5 }}>
              <Typography variant="h4" fontWeight="900">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.spent)}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight="bold">
                LIMITE: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.amount)}
              </Typography>
            </Box>
          </Box>

          <Box>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(b.percent, 100)} 
              sx={{ 
                height: 12, borderRadius: 6, mb: 1, bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: progressColor }
              }} 
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="caption" fontWeight="900" color={b.percent > 100 ? 'error.main' : 'text.secondary'}>
                {b.percent.toFixed(0)}% consumido
              </Typography>
              {b.percent > 100 && <Warning color="error" sx={{ fontSize: 18 }} />}
            </Box>
          </Box>
        </Paper>
      </Grid>
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 4, px: 3, pb: 4, maxWidth: '1300px', margin: '0 auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="900">Metas Financeiras</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()} sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}>
          Nova Meta
        </Button>
      </Stack>

      <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
        <CalendarMonth color="primary" /> MENSAIS
      </Typography>
      <Grid container spacing={3} mb={6}>
        {analysis.filter(b => b.period === 'MONTHLY').map(renderBudgetCard)}
      </Grid>

      <Divider sx={{ mb: 6 }} />

      <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
        <QueryStats color="secondary" /> ANUAIS
      </Typography>
      <Grid container spacing={3}>
        {analysis.filter(b => b.period === 'YEARLY').map(renderBudgetCard)}
      </Grid>

      {/* CONFIGURAR META */}
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>
          {editingId ? 'Editar Meta' : 'Configurar Meta'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField 
              select 
              fullWidth 
              label="Categoria" 
              value={form.category_id} 
              onChange={(e) => setForm({...form, category_id: e.target.value})}
            >
              {categories.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Valor Limite" type="number" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} />
            <TextField select fullWidth label="Período" value={form.period} onChange={(e) => setForm({...form, period: e.target.value})}>
              <MenuItem value="MONTHLY">Mensal</MenuItem>
              <MenuItem value="YEARLY">Anual</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} color="inherit" sx={{ fontWeight: 'bold' }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} sx={{ fontWeight: 'bold', borderRadius: 2 }}>
            {editingId ? 'Atualizar' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* EXCLUSÃO */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 900 }}>
          <HelpOutline color="primary" /> Excluir Meta
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" fontWeight="700">
            Tem certeza que deseja excluir a meta da categoria "{budgetToDelete?.category_name}"?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} color="inherit" variant="outlined">Cancelar</Button>
          <Button onClick={handleExecuteDelete} variant="contained" color="error">Confirmar Exclusão</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}