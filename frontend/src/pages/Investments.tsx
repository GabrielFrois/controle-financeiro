import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Grid, Paper, Typography, Card, CardContent, Box, 
  CircularProgress, useTheme, Avatar, Divider, List, 
  ListItem, ListItemText, ListItemAvatar, Stack, Chip
} from '@mui/material';
import { 
  TrendingUp, TrendingDown, AccountBalance, Stars, History, PieChart as PieIcon 
} from '@mui/icons-material';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip 
} from 'recharts';
import api from '../services/api';

export default function Investments() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#9c27b0'];

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "---";
    const date = new Date(dateStr);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/transactions');
      setTransactions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Erro ao carregar investimentos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const filtered = transactions.filter(t => 
      t.category_name?.toLowerCase().includes('investimento')
    );

    const aportes = filtered.filter(t => t.category_name.includes('Aporte')).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const resgates = filtered.filter(t => t.category_name.includes('Resgate')).reduce((acc, curr) => acc + Number(curr.amount), 0);
    const dividendos = filtered.filter(t => t.category_name.includes('Dividendos')).reduce((acc, curr) => acc + Number(curr.amount), 0);

    const allocationMap = filtered
      .filter(t => t.asset_ticker && t.category_name.includes('Aporte'))
      .reduce((acc: any, t: any) => {
        const ticker = t.asset_ticker.toUpperCase();
        acc[ticker] = (acc[ticker] || 0) + Number(t.amount);
        return acc;
      }, {});

    const allocationData = Object.keys(allocationMap).map(name => ({
      name,
      value: allocationMap[name]
    })).sort((a, b) => b.value - a.value);

    return {
      patrimonio: aportes - resgates,
      aportes,
      resgates,
      dividendos,
      allocationData,
      recent: filtered.slice(0, 5)
    };
  }, [transactions]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ pt: 4, px: 2, pb: 4, maxWidth: '1200px', margin: '0 auto' }}>
  
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h4" fontWeight="900">
          Análise Geral de <Typography component="span" variant="h4" color="primary" fontWeight="900">Investimentos</Typography>
        </Typography>
      </Box>

      {/* Cards KPI */}
      <Grid container spacing={2} sx={{ mb: 6 }} justifyContent="center">
        <Grid item xs={12} sm={6} md={3}>
          <KPICard title="Patrimônio" value={formatCurrency(stats.patrimonio)} icon={<AccountBalance />} color="#9c27b0" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard title="Total Aportado" value={formatCurrency(stats.aportes)} icon={<Stars />} color={theme.palette.primary.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard title="Dividendos" value={formatCurrency(stats.dividendos)} icon={<TrendingUp />} color={theme.palette.success.main} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <KPICard title="Total Resgates" value={formatCurrency(stats.resgates)} icon={<TrendingDown />} color={theme.palette.error.main} />
        </Grid>
      </Grid>

      <Grid container spacing={3} justifyContent="center">
        {/* Alocação com Gráfico Donut Centralizado */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 4, borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column', textAlign: 'center', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="900" mb={4} color="text.secondary" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <PieIcon color="primary" /> ALOCAÇÃO POR ATIVO
            </Typography>
            <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold">TOTAL</Typography>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 900 }}>{formatCurrency(stats.aportes)}</Typography>
                </Box>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.allocationData} innerRadius={85} outerRadius={115} dataKey="value" stroke="none" paddingAngle={5}>
                      {stats.allocationData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
            </Box>
            <Box sx={{ mt: 3, px: 2 }}>
              {stats.allocationData.slice(0, 3).map((item, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" fontWeight="bold" sx={{ color: COLORS[index % COLORS.length] }}>● {item.name}</Typography>
                  <Typography variant="body2" fontWeight="900">{((item.value / (stats.aportes || 1)) * 100).toFixed(1)}%</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Bloco: Últimas Movimentações*/}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 4, borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight="900" mb={3} color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History color="primary" /> ÚLTIMAS MOVIMENTAÇÕES
            </Typography>
            <Divider />
            <List sx={{ mt: 1 }}>
              {stats.recent.map((t: any) => (
                <ListItem key={t.id} sx={{ py: 2, px: 0 }}>
                  <ListItemAvatar sx={{ minWidth: 54 }}>
                    <Avatar sx={{ 
                      width: 42, height: 42, borderRadius: '12px',
                      bgcolor: t.category_name.includes('Resgate') ? `${theme.palette.error.main}12` : `${theme.palette.success.main}12`,
                      color: t.category_name.includes('Resgate') ? 'error.main' : 'success.main',
                    }}>
                      {t.category_name.includes('Resgate') ? <TrendingDown /> : <TrendingUp />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={<Typography variant="body1" fontWeight="700" noWrap>{t.description} {t.asset_ticker && `(${t.asset_ticker})`}</Typography>} 
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                        <Typography variant="caption" fontWeight="600" color="text.secondary" noWrap>
                          {t.category_name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">•</Typography>
                        <Typography variant="caption" fontWeight="500" color="text.disabled">
                          {formatDate(t.date)}
                        </Typography>
                      </Box>
                    } 
                  />
                  <Typography variant="body1" fontWeight="900" color={t.category_name.includes('Dividendos') ? 'success.main' : 'text.primary'} sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                    {formatCurrency(Number(t.amount))}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function KPICard({ title, value, icon, color }: any) {
  return (
    <Card sx={{ borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2, textAlign: 'center' }}>
        <Avatar sx={{ bgcolor: `${color}12`, color, mx: 'auto', mb: 1, width: 44, height: 44, borderRadius: '14px' }}>{icon}</Avatar>
        <Typography variant="body2" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase' }}>{title}</Typography>
        <Typography variant="h5" fontWeight="900" sx={{ mt: 0.5 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}