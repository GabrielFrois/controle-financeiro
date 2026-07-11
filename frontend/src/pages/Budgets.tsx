import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFamily } from '../context/FamilyContext';
import { useAuth } from '../context/AuthContext';
import { 
  Box, Typography, LinearProgress, Paper, Grid, CircularProgress, 
  useTheme, useMediaQuery, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, MenuItem, IconButton, Stack,
  Divider, Chip
} from '@mui/material';
import { Add, Delete, Edit, Warning, CalendarMonth, QueryStats, HelpOutline, TrackChanges } from '@mui/icons-material';
import api from '../services/api';

export default function Budgets() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { families, activeUserIds, activeLabel } = useFamily();
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // Sempre a família inteira do usuário logado (independe do toggle "Só eu / Família"
  // do menu lateral) — o GASTO de qualquer meta visível sempre soma a casa toda.
  const myHouseholdIds = useMemo(() => {
    const ids = new Set<number>();
    if (user) ids.add(user.id);
    families.forEach((f: any) => f.members.forEach((m: any) => ids.add(m.id)));
    return Array.from(ids);
  }, [families, user]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ category_id: '', amount: '', period: 'MONTHLY' });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // QUAIS metas aparecem segue o toggle "Só eu / Família" (activeUserIds) —
      // em "Família" você vê as suas metas e as dos seus familiares também.
      const [transRes, budgetRes, catRes] = await Promise.all([
        api.get('/transactions', { params: { user_ids: myHouseholdIds.join(',') } }),
        api.get('/budgets', { params: { user_ids: activeUserIds.join(',') } }),
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
  }, [myHouseholdIds, activeUserIds]);

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

    const canManage = isAdmin || b.user_id === user?.id;

    return (
      <Grid size={{ xs: 12, sm: 6, md: 3 }} key={b.id}>
        <Paper sx={{ 
          p: { xs: 1.5, sm: 3 }, 
          borderRadius: 5, 
          border: '1px solid', 
          borderColor: 'divider',
          minHeight: { xs: 170, sm: 200 },
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
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1} gap={0.5}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase', fontSize: { xs: '0.7rem', sm: '0.875rem' }, lineHeight: 1.3 }}>
                {b.category_name || 'Categoria'} 
              </Typography>
              {canManage && (
                <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => handleOpen(b)} color="primary" sx={{ p: { xs: 0.4, sm: 0.75 } }}>
                    <Edit sx={{ fontSize: { xs: 15, sm: 18 } }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleOpenDelete(b)} color="error" sx={{ p: { xs: 0.4, sm: 0.75 } }}>
                    <Delete sx={{ fontSize: { xs: 15, sm: 18 } }} />
                  </IconButton>
                </Box>
              )}
            </Stack>

            <Chip
              size="small"
              label={b.user_name}
              sx={{
                mb: 1, height: { xs: 18, sm: 20 }, fontSize: { xs: '0.6rem', sm: '0.7rem' }, fontWeight: 700,
                bgcolor: `${b.user_color}22`, color: b.user_color,
              }}
            />

            <Box sx={{ my: { xs: 0.75, sm: 1.5 } }}>
              <Typography fontWeight="900" sx={{ fontSize: { xs: '1.05rem', sm: '2.125rem' }, lineHeight: 1.2 }}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.spent)}
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                LIMITE: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.amount)}
              </Typography>
            </Box>
          </Box>

          <Box>
            <LinearProgress 
              variant="determinate" 
              value={Math.min(b.percent, 100)} 
              sx={{ 
                height: { xs: 8, sm: 12 }, borderRadius: 6, mb: 1, bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: progressColor }
              }} 
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography fontWeight="900" color={b.percent > 100 ? 'error.main' : 'text.secondary'} sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                {b.percent.toFixed(0)}% consumido
              </Typography>
              {b.percent > 100 && <Warning color="error" sx={{ fontSize: { xs: 15, sm: 18 } }} />}
            </Box>
          </Box>
        </Paper>
      </Grid>
    );
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: { xs: 2, md: 4 }, px: { xs: 1.5, sm: 2, md: 4 }, pb: { xs: 2, md: 4 }, maxWidth: '1400px', margin: '0 auto' }}>
      <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
            <TrackChanges fontSize={isMobile ? 'medium' : 'large'} color="primary" /> Metas Financeiras
        </Typography>
        <Button 
            variant="contained" 
            startIcon={<Add />} 
            onClick={() => handleOpen()} 
            fullWidth={isMobile}
            sx={{ borderRadius: 3, px: 3, fontWeight: 'bold' }}
        >
          Nova Meta
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Visão: {activeLabel} — o gasto de cada meta sempre soma você e sua família.
      </Typography>

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