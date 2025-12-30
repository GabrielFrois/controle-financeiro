import { useEffect, useState, useCallback } from 'react';
import { 
  Grid, Paper, Typography, Card, CardContent, Box, 
  CircularProgress, useTheme, Avatar, Divider, List, 
  ListItem, ListItemText, ListItemAvatar,
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { 
  TrendingUp, TrendingDown, AccountBalanceWallet, Savings 
} from '@mui/icons-material';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip 
} from 'recharts';
import api from '../services/api';

export default function Dashboard() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  
  // Estado de visualização: Mês, Ano ou Tudo
  const [viewMode, setViewMode] = useState<'month' | 'year' | 'all'>('month');
  
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
  const [totalBalance, setTotalBalance] = useState(0);
  const [patrimonio, setPatrimonio] = useState(0);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  // --- Funções de Formatação ---
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // getUTC garante consistência independente do fuso horário do navegador
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchData = useCallback(async () => {
  setLoading(true);
  try {
    const now = new Date();
    const currentMonth = now.getUTCMonth() + 1;
    const currentYear = now.getUTCFullYear();
    const todayStr = now.toISOString().split('T')[0]; // Data de hoje para o Saldo

    // Define a URL baseada no filtro selecionado
    let summaryUrl = '/summary';
    if (viewMode === 'month') {
      summaryUrl = `/summary?month=${currentMonth}&year=${currentYear}`;
    } else if (viewMode === 'year') {
      summaryUrl = `/summary?year=${currentYear}`;
    }

    const [sumRes, transRes] = await Promise.all([
      api.get(summaryUrl),
      api.get('/transactions')
    ]);

    setSummary(sumRes.data);
    const allTransactions = transRes.data;

    // --- CÁLCULO DO SALDO ---
    const accumulated = allTransactions
      .filter((t: any) => t.date <= todayStr)
      .reduce((acc: number, t: any) => 
        t.type === 'INCOME' ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount), 0
      );
    setTotalBalance(accumulated);

    // Cálculo do Patrimônio
    const totalAportes = allTransactions
      .filter((t: any) => t.category_name === 'Investimentos - Aporte')
      .reduce((acc: any, curr: any) => acc + parseFloat(curr.amount), 0);
    const totalResgates = allTransactions
      .filter((t: any) => t.category_name === 'Investimentos - Resgate')
      .reduce((acc: any, curr: any) => acc + parseFloat(curr.amount), 0);
    setPatrimonio(totalAportes - totalResgates);

    // Filtragem local para os blocos visuais
    let filteredTransactions = allTransactions;
    if (viewMode === 'month') {
      filteredTransactions = allTransactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return (tDate.getUTCMonth() + 1) === currentMonth && tDate.getUTCFullYear() === currentYear;
      });
    } else if (viewMode === 'year') {
      filteredTransactions = allTransactions.filter((t: any) => {
        const tDate = new Date(t.date);
        return tDate.getUTCFullYear() === currentYear;
      });
    }

    setRecentTransactions(filteredTransactions.slice(0, 5));

    const expensesByCategory = filteredTransactions
      .filter((t: any) => t.type === 'EXPENSE')
      .reduce((acc: any, curr: any) => {
        acc[curr.category_name] = (acc[curr.category_name] || 0) + parseFloat(curr.amount);
        return acc;
      }, {});

    setCategoryData(
      Object.keys(expensesByCategory)
        .map(name => ({ name, value: expensesByCategory[name] }))
        .sort((a, b) => b.value - a.value)
    );

  } catch (error) {
    console.error("Erro no Dashboard:", error);
  } finally {
    setLoading(false);
  }
}, [viewMode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ p: 2, width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Filtro Centralizado */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 5 }}>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, next) => next && setViewMode(next)}
          size="small"
          sx={{ 
            bgcolor: 'background.paper', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            border: `1px solid ${theme.palette.primary.main}`,
            overflow: 'hidden',
            '& .MuiToggleButton-root': { 
              border: 'none', borderRadius: 0, px: 3, fontWeight: 'bold', 
              color: theme.palette.primary.main,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: `${theme.palette.primary.main}1A !important`,
              },
              '&.Mui-selected': { 
                backgroundColor: `${theme.palette.primary.main} !important`, 
                color: 'white !important',
                '&:hover': {
                  backgroundColor: `${theme.palette.primary.dark} !important`,
                },
              },
              '&:not(:first-of-type)': { borderLeft: `1px solid ${theme.palette.primary.main}40` }
            }
          }}
        >
          <ToggleButton value="month">MÊS ATUAL</ToggleButton>
          <ToggleButton value="year">ANO ATUAL</ToggleButton>
          <ToggleButton value="all">HISTÓRICO GERAL</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Cards KPI */}
      <Grid container spacing={2} sx={{ mb: 5 }} justifyContent="center">
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Saldo" value={formatCurrency(totalBalance)} icon={<AccountBalanceWallet />} color={theme.palette.primary.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Receitas" value={formatCurrency(summary.income)} icon={<TrendingUp />} color={theme.palette.success.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Despesas" value={formatCurrency(summary.expense)} icon={<TrendingDown />} color={theme.palette.error.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Patrimônio" value={formatCurrency(patrimonio)} icon={<Savings />} color="#9c27b0" />
        </Grid>
      </Grid>

      {/* Blocos Analíticos */}
      <Grid container spacing={2} justifyContent="center">
        
        {/* Distribuição Geral */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 5, height: 500, display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="900" mb={1} color="text.secondary">DISTRIBUIÇÃO GERAL</Typography>
            <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', px: 2 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">LÍQUIDO</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 900 }}>{formatCurrency(summary.balance)}</Typography>
              </Box>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={[{ name: 'Entradas', value: summary.income }, { name: 'Saídas', value: summary.expense }]} innerRadius={85} outerRadius={115} dataKey="value" stroke="none">
                    <Cell fill={theme.palette.success.main} /><Cell fill={theme.palette.error.main} />
                  </Pie>
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
            <Box sx={{ mt: 1, px: 2 }}>
               <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight="bold" color="success.main">● Entradas</Typography>
                  <Typography variant="body2" fontWeight="900">{summary.income > 0 ? ((summary.income / (summary.income + summary.expense)) * 100).toFixed(0) : 0}%</Typography>
               </Box>
               <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" fontWeight="bold" color="error.main">● Saídas</Typography>
                  <Typography variant="body2" fontWeight="900">{summary.expense > 0 ? ((summary.expense / (summary.income + summary.expense)) * 100).toFixed(0) : 0}%</Typography>
               </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Gastos por Categoria */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 5, height: 500, display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
            <Typography variant="h6" fontWeight="900" mb={1} color="text.secondary">GASTOS POR CATEGORIA</Typography>
            <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
               <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none', px: 2 }}>
                <Typography variant="body2" color="text.secondary" fontWeight="bold">GASTOS</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 900 }}>{formatCurrency(summary.expense)}</Typography>
              </Box>
              {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} innerRadius={85} outerRadius={115} dataKey="value" stroke="none">
                      {categoryData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Typography color="text.secondary">Sem dados.</Typography>}
            </Box>
            <Box sx={{ mt: 1, px: 2, minHeight: '60px' }}>
               {categoryData.slice(0, 3).map((item, index) => (
                 <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight="bold" sx={{ color: COLORS[index % COLORS.length], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>● {item.name}</Typography>
                    <Typography variant="body2" fontWeight="900">{formatCurrency(item.value)}</Typography>
                 </Box>
               ))}
            </Box>
          </Paper>
        </Grid>

        {/* Lançamentos Recentes */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, borderRadius: 5, height: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Typography variant="h6" fontWeight="900" mb={2} color="text.secondary" textAlign="center">LANÇAMENTOS RECENTES</Typography>
            <Divider />
            <List sx={{ mt: 1, p: 0 }}>
              {recentTransactions.map((t: any) => (
                <ListItem key={t.id} sx={{ py: 1.5, px: 0 }}>
                  <ListItemAvatar sx={{ minWidth: 54 }}>
                    <Avatar sx={{ 
                      width: 42, height: 42, borderRadius: '12px',
                      bgcolor: t.type === 'INCOME' ? `${theme.palette.success.main}12` : `${theme.palette.error.main}12`,
                      color: t.type === 'INCOME' ? 'success.main' : 'error.main',
                    }}>
                      {t.type === 'INCOME' ? <TrendingUp /> : <TrendingDown />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={<Typography variant="body1" fontWeight="700" noWrap sx={{ maxWidth: '180px' }}>{t.description}</Typography>} 
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                        <Typography 
                          variant="caption" 
                          fontWeight="600" 
                          color="text.secondary"
                          sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '110px', display: 'block' }}
                        >
                          {t.category_name}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>•</Typography>
                        <Typography variant="caption" fontWeight="500" color="text.disabled" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                          {formatDate(t.date)}
                        </Typography>
                      </Box>
                    } 
                  />
                  <Typography variant="body1" fontWeight="900" color={t.type === 'INCOME' ? 'success.main' : 'error.main'} sx={{ ml: 1, whiteSpace: 'nowrap' }}>
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