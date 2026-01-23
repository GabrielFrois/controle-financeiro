import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Typography, Button, Paper, Stack, Grid, TextField, 
  MenuItem, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, CircularProgress, useTheme, Avatar,
  Card, CardContent, Divider
} from '@mui/material';
import { 
  Download as DownloadIcon, 
  Print as PrintIcon, 
  Assessment,
  AccountBalanceWallet,
  TrendingUp,
  TrendingDown,
  ReceiptLong,
  Clear,
} from '@mui/icons-material';
import api from '../services/api';

export default function Reports() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  const getPresets = () => {
    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);
    return {
      start: oneYearAgo.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    };
  };

  const presets = getPresets();
  const [startDate, setStartDate] = useState(presets.start);
  const [endDate, setEndDate] = useState(presets.end);
  const [userFilter, setUserFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [categoryFilter, setCategoryFilter] = useState('Todas');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [transRes, userRes, catRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/users'),
        api.get('/categories')
      ]);
      setTransactions(Array.isArray(transRes.data) ? transRes.data : []);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      const tDate = t.date.split('T')[0];
      const matchUser = userFilter === 'Todos' || t.user_name === userFilter;
      const matchType = typeFilter === 'Todos' || t.type === typeFilter;
      const matchCategory = categoryFilter === 'Todas' || t.category_name === categoryFilter;
      return tDate >= startDate && tDate <= endDate && matchUser && matchType && matchCategory;
    });
  }, [transactions, startDate, endDate, userFilter, typeFilter, categoryFilter]);

  const stats = useMemo(() => {
    const income = filteredData.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount), 0);
    const expense = filteredData.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount), 0);
    
    const categoriesMap = filteredData.reduce((acc: any, t) => {
      if (!acc[t.category_name]) {
        acc[t.category_name] = { name: t.category_name, total: 0, type: t.type };
      }
      acc[t.category_name].total += Number(t.amount);
      return acc;
    }, {});

    const groupedMovements = filteredData.reduce((acc: any, t) => {
      const key = `${t.description}-${t.category_name}`;
      if (!acc[key]) {
        acc[key] = { description: t.description, category: t.category_name, total: 0, type: t.type };
      }
      acc[key].total += Number(t.amount);
      return acc;
    }, {});

    const sortedCats = Object.values(categoriesMap).sort((a: any, b: any) => b.total - a.total);
    const sortedMovs = Object.values(groupedMovements).sort((a: any, b: any) => b.total - a.total);

    return {
      income, expense, balance: income - expense, count: filteredData.length,
      categories: sortedCats.slice(0, 8),
      movements: sortedMovs.slice(0, 8),
      fullCategories: sortedCats,
      fullMovements: sortedMovs
    };
  }, [filteredData]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const formatDateBR = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Descricao', 'Categoria', 'Usuario', 'Tipo', 'Valor'];
    const rows = filteredData.map(t => [
      t.date.split('T')[0], 
      `"${t.description.replace(/"/g, '""')}"`, 
      t.category_name, 
      t.user_name, 
      t.type === 'INCOME' ? 'Receita' : 'Despesa', 
      t.amount
    ]);
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_financeiro_${startDate}_a_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ pt: 4, px: 4, pb: 4, maxWidth: '1400px', margin: '0 auto' }}>
      <Box className="no-print" sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Assessment fontSize="large" color="primary" /> Relatórios e Indicadores
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ borderRadius: '12px', fontWeight: 'bold', textTransform: 'none' }}>Imprimir</Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportCSV} sx={{ borderRadius: '12px', fontWeight: 'bold', textTransform: 'none' }}>Exportar CSV</Button>
        </Stack>
      </Box>

      {/* FILTROS */}
      <Paper className="no-print" sx={{ p: 3, mb: 3, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Tipo" size="small" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem><MenuItem value="INCOME">Receitas</MenuItem><MenuItem value="EXPENSE">Despesas</MenuItem></TextField></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Categoria" size="small" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><MenuItem value="Todas">Todas</MenuItem>{categories.map(c => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField select fullWidth label="Usuário" size="small" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><MenuItem value="Todos">Todos</MenuItem>{users.map(u => <MenuItem key={u.id} value={u.name}>{u.name}</MenuItem>)}</TextField></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Início" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Grid>
          <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth type="date" label="Fim" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Grid>
          <Grid size={{ xs: 12, md: 2 }}><Button fullWidth startIcon={<Clear />} onClick={() => { const p = getPresets(); setStartDate(p.start); setEndDate(p.end); setUserFilter('Todos'); setTypeFilter('Todos'); setCategoryFilter('Todas'); }}>Reset</Button></Grid>
        </Grid>
      </Paper>

      {/* KPI CARDS */}
      <Grid container spacing={3} sx={{ mb: 4 }} justifyContent="center" className="no-print">
        <Grid item xs={12} sm={6} md={3}><KPICard title="Entradas" value={formatCurrency(stats.income)} icon={<TrendingUp />} color={theme.palette.success.main} /></Grid>
        <Grid item xs={12} sm={6} md={3}><KPICard title="Saídas" value={formatCurrency(stats.expense)} icon={<TrendingDown />} color={theme.palette.error.main} /></Grid>
        <Grid item xs={12} sm={6} md={3}><KPICard title="Saldo do Período" value={formatCurrency(stats.balance)} icon={<AccountBalanceWallet />} color={theme.palette.primary.main} /></Grid>
        <Grid item xs={12} sm={6} md={3}><KPICard title="Lançamentos" value={stats.count} icon={<ReceiptLong />} color="#607d8b" /></Grid>
      </Grid>

      {/* TABELAS */}
      <Box className="no-print">
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 3.5, borderRadius: 4 }}>
              <Typography variant="h6" fontWeight="900" mb={2.5}>RESUMO POR CATEGORIA</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell sx={{ fontWeight: 900, py: 1.8 }}>CATEGORIA</TableCell><TableCell align="right" sx={{ fontWeight: 900, py: 1.8 }}>TOTAL</TableCell></TableRow></TableHead>
                <TableBody>{stats.categories.map((cat: any) => (<TableRow key={cat.name}><TableCell sx={{ fontWeight: 600, py: 1.4 }}>{cat.name}</TableCell><TableCell align="right" sx={{ fontWeight: 700, py: 1.4, color: cat.type === 'INCOME' ? 'success.main' : 'error.main' }}>{formatCurrency(cat.total)}</TableCell></TableRow>))}</TableBody>
              </Table></TableContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 3.5, borderRadius: 4 }}>
              <Typography variant="h6" fontWeight="900" mb={2.5}>MAIORES MOVIMENTAÇÕES</Typography>
              <TableContainer><Table size="small">
                <TableHead><TableRow><TableCell sx={{ fontWeight: 900, py: 1.8 }}>DESCRIÇÃO</TableCell><TableCell sx={{ fontWeight: 900, py: 1.8 }}>CATEGORIA</TableCell><TableCell align="right" sx={{ fontWeight: 900, py: 1.8 }}>TOTAL</TableCell></TableRow></TableHead>
                <TableBody>{stats.movements.map((m: any, idx) => (<TableRow key={idx} hover><TableCell sx={{ fontWeight: 600, py: 1.4 }}>{m.description}</TableCell><TableCell sx={{ color: 'text.secondary', py: 1.4 }}>{m.category}</TableCell><TableCell align="right" sx={{ fontWeight: 700, py: 1.4, color: m.type === 'INCOME' ? 'success.main' : 'error.main' }}>{formatCurrency(m.total)}</TableCell></TableRow>))}</TableBody>
              </Table></TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* --- ÁREA DE IMPRESSÃO --- */}
      <Box id="print-area" sx={{ display: 'none' }}>
        
        {/* Cabeçalho */}
        <Box sx={{ borderBottom: '3px solid #000', pb: 2, mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h3" fontWeight="900" sx={{ color: '#000', letterSpacing: '-1px' }}>
              RELATÓRIO FINANCEIRO
            </Typography>
            <Typography variant="body1" sx={{ color: '#333', mt: 0.5, fontWeight: 500 }}>
              Dashboard de Indicadores e Movimentações
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Gerado em: {new Date().toLocaleString('pt-BR')}</Typography>
          </Box>
        </Box>

        {/* Metadados da Pesquisa */}
        <Box sx={{ display: 'flex', gap: 4, mb: 4, bgcolor: '#f5f5f5', p: 2, borderRadius: 2, border: '1px solid #e0e0e0' }}>
           <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="900">PERÍODO</Typography>
              <Typography variant="body2" fontWeight="bold">{formatDateBR(startDate)} — {formatDateBR(endDate)}</Typography>
           </Box>
           <Divider orientation="vertical" flexItem />
           <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="900">USUÁRIO</Typography>
              <Typography variant="body2" fontWeight="bold">{userFilter.toUpperCase()}</Typography>
           </Box>
           <Divider orientation="vertical" flexItem />
           <Box>
              <Typography variant="caption" color="text.secondary" fontWeight="900">FILTROS ATIVOS</Typography>
              <Typography variant="body2" fontWeight="bold">Tipo: {typeFilter} | Cat: {categoryFilter}</Typography>
           </Box>
        </Box>

        {/* Quadro de Indicadores */}
        <Grid container spacing={0} sx={{ mb: 6, border: '1px solid #000', borderRadius: 2, overflow: 'hidden' }}>
          {[
            { label: 'RECEITAS TOTAIS', val: stats.income, color: '#2e7d32' },
            { label: 'DESPESAS TOTAIS', val: stats.expense, color: '#d32f2f' },
            { label: 'SALDO FINAL', val: stats.balance, color: '#000' },
            { label: 'LANÇAMENTOS', val: stats.count, color: '#424242' }
          ].map((item, i) => (
            <Grid item xs={3} key={i} sx={{ p: 3, textAlign: 'center', borderRight: i < 3 ? '1px solid #000' : 'none', bgcolor: '#fff' }}>
              <Typography variant="caption" fontWeight="900" color="text.secondary" sx={{ display: 'block', mb: 1, letterSpacing: 1 }}>{item.label}</Typography>
              <Typography variant="h5" fontWeight="900" sx={{ color: item.color }}>
                {typeof item.val === 'number' && item.label !== 'LANÇAMENTOS' ? formatCurrency(item.val) : item.val}
              </Typography>
            </Grid>
          ))}
        </Grid>

        {/* Tabelas Completas */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Box>
                {/* Barra lateral e título */}
                <Typography variant="h6" fontWeight="900" sx={{ mb: 2, color: '#000', borderLeft: '5px solid #000', pl: 1.5 }}>
                    RESUMO POR CATEGORIA
                </Typography>
                <TableContainer><Table className="print-table">
                  <TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell sx={{ fontWeight: 900 }}>CATEGORIA</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>TOTAL ACUMULADO</TableCell></TableRow></TableHead>
                  <TableBody>{stats.fullCategories.map((cat: any) => (<TableRow key={cat.name}><TableCell sx={{ fontWeight: 600 }}>{cat.name}</TableCell><TableCell align="right" sx={{ fontWeight: 700, color: cat.type === 'INCOME' ? '#2e7d32' : '#d32f2f' }}>{formatCurrency(cat.total)}</TableCell></TableRow>))}</TableBody>
                </Table></TableContainer>
            </Box>

            <Box>
                {/* Barra lateral e título */}
                <Typography variant="h6" fontWeight="900" sx={{ mb: 2, color: '#000', borderLeft: '5px solid #000', pl: 1.5 }}>
                    DETALHAMENTO DE MOVIMENTAÇÕES
                </Typography>
                <TableContainer><Table className="print-table">
                  <TableHead><TableRow sx={{ bgcolor: '#f5f5f5' }}><TableCell sx={{ fontWeight: 900 }}>DESCRIÇÃO</TableCell><TableCell sx={{ fontWeight: 900 }}>CATEGORIA</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>VALOR TOTAL</TableCell></TableRow></TableHead>
                  <TableBody>{stats.fullMovements.map((m: any, idx) => (<TableRow key={idx}><TableCell sx={{ fontWeight: 600 }}>{m.description}</TableCell><TableCell>{m.category}</TableCell><TableCell align="right" sx={{ fontWeight: 700, color: m.type === 'INCOME' ? '#2e7d32' : '#d32f2f' }}>{formatCurrency(m.total)}</TableCell></TableRow>))}</TableBody>
                </Table></TableContainer>
            </Box>
        </Box>

        {/* Rodapé de Impressão */}
        <Box sx={{ mt: 8, pt: 2, borderTop: '1px solid #eee', textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
                Este relatório é uma compilação automática de dados financeiros. Para fins de conferência, valide os lançamentos no sistema principal.
            </Typography>
        </Box>
      </Box>

      <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body * { visibility: hidden; }
          .no-print, .no-print * { display: none !important; }
          
          #print-area { 
            display: block !important; 
            visibility: visible !important; 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
          }
          #print-area * { visibility: visible !important; }
          
          .print-table { width: 100%; border-collapse: collapse; }
          .print-table th, .print-table td { 
            border-bottom: 1px solid #e0e0e0 !important; 
            padding: 10px 8px !important; 
            font-size: 10pt; 
          }
          
          /* Força cores no PDF */
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>
    </Box>
  );
}

function KPICard({ title, value, icon, color }: any) {
  return (
    <Card sx={{ borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: `${color}15`, color, width: 48, height: 48, borderRadius: 3 }}>{icon}</Avatar>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight="800" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</Typography>
            <Typography variant="h5" fontWeight="900" sx={{ color: 'text.primary' }}>{value}</Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}