import { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, LinearProgress, Paper, Grid, CircularProgress, Chip, useTheme, Divider } from '@mui/material';
import { Warning, CheckCircle, Speed, FilterAlt } from '@mui/icons-material';
import api from '../services/api';

export default function Budgets() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Limites manuais (A serem arrumados em breve)
  const categoryLimits: Record<string, number> = {
    'Alimentação': 1200,
    'Lazer': 500,
    'Moradia': 3000,
    'Transporte': 600,
    'Saúde': 400,
    'Educação': 1000
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const budgetAnalysis = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();

    // Filtrar despesas do mês atual
    const monthlyExpenses = transactions.filter(t => {
      const d = new Date(t.date);
      return t.type === 'EXPENSE' && (d.getUTCMonth() + 1) === currentMonth && d.getUTCFullYear() === currentYear;
    });

    const spentByCategory = monthlyExpenses.reduce((acc: any, t: any) => {
      acc[t.category_name] = (acc[t.category_name] || 0) + Number(t.amount);
      return acc;
    }, {});

    return Object.keys(categoryLimits).map(cat => {
      const spent = spentByCategory[cat] || 0;
      const limit = categoryLimits[cat];
      const percent = (spent / limit) * 100;
      return { category: cat, spent, limit, percent };
    }).sort((a, b) => b.percent - a.percent);
  }, [transactions]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 2, px: 2, pb: 4, maxWidth: '1200px', margin: '0 auto' }}>
      <Typography variant="h4" fontWeight="900" mb={1}>
        Metas de <Typography component="span" variant="h4" color="primary" fontWeight="900">Gastos Mensais</Typography>
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>Acompanhamento em tempo real baseado nas despesas deste mês.</Typography>

      <Grid container spacing={3}>
        {budgetAnalysis.map((b) => (
          <Grid item xs={12} md={6} key={b.category}>
            <Paper sx={{ p: 3, borderRadius: 5, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight="900">{b.category}</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight="bold">LIMITE: {formatCurrency(b.limit)}</Typography>
                </Box>
                <Chip 
                  label={b.percent > 100 ? 'Excedido' : b.percent > 80 ? 'Atenção' : 'Saudável'}
                  color={b.percent > 100 ? 'error' : b.percent > 80 ? 'warning' : 'success'}
                  size="small"
                  sx={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '0.65rem' }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1 }}>
                <Typography variant="h5" fontWeight="900" color={b.percent > 100 ? 'error.main' : 'text.primary'}>
                  {formatCurrency(b.spent)}
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="text.secondary">
                  {b.percent.toFixed(0)}%
                </Typography>
              </Box>

              <LinearProgress 
                variant="determinate" 
                value={Math.min(b.percent, 100)} 
                sx={{ 
                  height: 12, 
                  borderRadius: 5, 
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: b.percent > 100 ? theme.palette.error.main : b.percent > 80 ? theme.palette.warning.main : theme.palette.primary.main
                  }
                }}
              />
              
              {b.percent > 100 && (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 'bold' }}>
                  <Warning sx={{ fontSize: 14 }} /> Ultrapassou {formatCurrency(b.spent - b.limit)} do planejado.
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}