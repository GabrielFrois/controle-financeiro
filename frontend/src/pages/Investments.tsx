import { useState, useEffect } from 'react';
import {
  Grid, Paper, Typography, Box, CircularProgress, useTheme,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Slider, styled,
  Tooltip as MuiTooltip, TablePagination, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, InputAdornment, TextField,
} from '@mui/material';
import {
  TrendingUp, AccountBalance, Stars, PieChart as PieIcon,
  Timeline, QueryStats, BarChart as BarIcon, EmojiEvents,
  InfoOutlined, TableView, Edit,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import api from '../services/api';
import { useInvestments } from '../hooks/useInvestments';
import { useFamily } from '../context/FamilyContext';
import KPICard from '../components/investments/KPICard';
import AllocationChart from '../components/investments/AllocationChart';

// ─── styled ─────────────────────────────────────────────────────────────────
const SmoothSlider = styled(Slider)(({ theme }) => ({
  '& .MuiSlider-thumb': { transition: theme.transitions.create(['left', 'box-shadow'], { duration: theme.transitions.duration.shorter }) },
  '& .MuiSlider-track': { transition: theme.transitions.create(['width'], { duration: theme.transitions.duration.shorter }) },
}));

// ─── helpers ─────────────────────────────────────────────────────────────────
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

const formatQuantity = (val: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 8 }).format(val || 0);

const WINDOW_SIZE = 12;
const compactCell = { px: 1 };

// ─── component ───────────────────────────────────────────────────────────────
export default function Investments() {
  const theme = useTheme();
  const { activeLabel } = useFamily();

  // userFilter fixo em 'Todos' — filtragem real já vem do FamilyContext via useInvestments
  const { loading, stats, fetchData } = useInvestments('Todos');

  const [tabValue, setTabValue]           = useState(0);
  const [chartViewMode, setChartViewMode] = useState<'assets' | 'types' | 'geo'>('types');
  const [page, setPage]                   = useState(0);
  const [detailPage, setDetailPage]       = useState(0);
  const rowsPerPage       = 7;
  const detailRowsPerPage = 10;

  const [startDiv, setStartDiv] = useState(0);
  const [startPat, setStartPat] = useState(0);

  const [editOpen, setEditOpen]   = useState(false);
  const [editAsset, setEditAsset] = useState<{ ticker: string; currentPm: number } | null>(null);
  const [newPm, setNewPm]         = useState('');

  useEffect(() => {
    if (stats.fullHistory.length > 0) {
      const latestStart = Math.max(0, stats.fullHistory.length - WINDOW_SIZE);
      setStartDiv(latestStart);
      setStartPat(latestStart);
    }
  }, [stats.fullHistory.length]);

  const handleOpenEdit = (ticker: string, currentVal: number) => {
    setEditAsset({ ticker, currentPm: currentVal });
    setNewPm(currentVal.toFixed(2));
    setEditOpen(true);
  };

  const handleSavePm = async () => {
    if (!editAsset) return;
    try {
      await api.put('/assets/price', { ticker: editAsset.ticker, price: newPm });
      setEditOpen(false);
      fetchData();
    } catch {
      alert('Erro ao salvar preço.');
    }
  };

  const getAssetColor = (type: string) => {
    switch (type) {
      case 'RENDA_FIXA':    return theme.palette.success.main;
      case 'ACOES':         return theme.palette.primary.main;
      case 'FII':           return theme.palette.warning.main;
      case 'CRIPTOS':       return theme.palette.secondary.main;
      case 'INTERNACIONAL': return theme.palette.error.main;
      case 'Brasil':        return theme.palette.success.dark;
      case 'Exterior':      return theme.palette.info.main;
      default:              return theme.palette.grey[500];
    }
  };

  const currentChartData =
    chartViewMode === 'assets' ? stats.allocationByAsset :
    chartViewMode === 'types'  ? stats.allocationByType  : stats.allocationByGeo;

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ pt: 2, px: 2, pb: 2, maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab icon={<PieIcon />}   iconPosition="start" label="Visão Geral" />
          <Tab icon={<TableView />} iconPosition="start" label="Posições" />
          <Tab icon={<Timeline />}  iconPosition="start" label="Evolução" />
        </Tabs>
        <Chip
          label={`Visão: ${activeLabel}`}
          color="primary"
          variant="outlined"
          size="small"
          sx={{ fontWeight: 700, mb: 1 }}
        />
      </Box>

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 2 }} justifyContent="center">
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Patrimônio Atual"  value={formatCurrency(stats.patrimonioTotal)} icon={<AccountBalance />} color="#9c27b0" performance={stats.performanceGeral} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Total Investido"   value={formatCurrency(stats.dinheiroDoBolso)} icon={<Stars />}          color={theme.palette.primary.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Total Proventos"   value={formatCurrency(stats.dividendos)}      icon={<TrendingUp />}     color={theme.palette.success.main} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KPICard title="Lucro/Prejuízo"    value={formatCurrency(stats.lucroReal)}        icon={<EmojiEvents />}    color={stats.lucroReal >= 0 ? '#ff9800' : theme.palette.error.main} />
        </Grid>
      </Grid>

      {/* ── TAB 0: Visão Geral ─────────────────────────────────────────────── */}
      {tabValue === 0 && (
        <Grid container spacing={2} justifyContent="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AllocationChart
                viewMode={chartViewMode} data={currentChartData}
                patrimonioTotal={stats.patrimonioTotal}
                onViewModeChange={setChartViewMode}
                getAssetColor={getAssetColor}
              />
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <TableContainer component={Paper} sx={{ borderRadius: 5, height: 600, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <QueryStats color="primary" /> Minha Carteira
                </Typography>
                <MuiTooltip title={<div style={{ textAlign: 'center' }}>Cotações em tempo real.<br /><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Rentabilidade da Renda Fixa é apenas uma previsão.</span></div>}>
                  <InfoOutlined sx={{ color: 'text.disabled', fontSize: 20 }} />
                </MuiTooltip>
              </Box>
              <Box sx={{ flexGrow: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {['ATIVO', 'QTD', 'PREÇO', 'TOTAL', 'RESULTADO'].map((h) => (
                        <TableCell key={h} align={h === 'ATIVO' ? 'left' : 'right'} sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.consolidatedPosition.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((p) => (
                      <TableRow key={p.ticker} hover>
                        <TableCell>
                          <Chip label={p.ticker} size="medium" sx={{ fontWeight: 800, bgcolor: `${getAssetColor(p.type)}15`, color: getAssetColor(p.type), borderRadius: '8px' }} />
                        </TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight="bold" color="text.secondary">{formatQuantity(p.quantity)}</Typography></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{p.isRF ? 'Inv.: ' : 'PM: '}{formatCurrency(p.avgPrice)}</Typography>
                          <Typography variant="body2">Atual: {formatCurrency(p.currentPrice)}</Typography>
                        </TableCell>
                        <TableCell align="right"><Typography variant="body1" fontWeight="900">{formatCurrency(p.currentTotal)}</Typography></TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <Typography variant="body2" sx={{ color: p.profitLoss >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold', mb: 0.5 }}>
                              {p.profitLoss >= 0 ? '+' : ''}{formatCurrency(p.profitLoss)}
                            </Typography>
                            <Chip label={`${Math.abs(p.performance).toFixed(2)}%`} size="small"
                              sx={{ height: 22, fontSize: '0.75rem', fontWeight: 'bold', bgcolor: p.performance >= 0 ? 'success.main' : 'error.main', color: '#fff' }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
              <Divider />
              <TablePagination component="div" count={stats.consolidatedPosition.length} rowsPerPage={rowsPerPage} page={page}
                onPageChange={(_, p) => setPage(p)} rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} sx={{ borderTop: 'none' }} />
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* ── TAB 1: Posições ───────────────────────────────────────────────── */}
      {tabValue === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TableContainer component={Paper} sx={{ borderRadius: 5, overflow: 'hidden' }}>
              <Box sx={{ p: 3, pb: 1 }}>
                <Typography variant="h6" fontWeight="900" color="text.secondary" display="flex" alignItems="center" gap={1}>
                  <TableView color="primary" /> Detalhamento das Posições
                </Typography>
              </Box>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    {['ATIVO', 'QTD', 'PREÇO MÉDIO', 'PREÇO ATUAL', 'TOTAL INVESTIDO', 'TOTAL ATUAL', 'RESULTADO'].map((h) => (
                      <TableCell key={h} align={h === 'ATIVO' ? 'left' : 'right'} sx={{ fontWeight: 900, px: 1 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.consolidatedPosition.slice(detailPage * detailRowsPerPage, detailPage * detailRowsPerPage + detailRowsPerPage).map((p) => (
                    <TableRow key={p.ticker} hover>
                      <TableCell sx={compactCell}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 4, height: 32, bgcolor: getAssetColor(p.type), borderRadius: 1 }} />
                          <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '0.9rem' }}>{p.ticker}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={compactCell}><Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatQuantity(p.quantity)}</Typography></TableCell>
                      <TableCell align="right" sx={compactCell}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.avgPrice)}</Typography>
                          <IconButton size="small" onClick={() => !p.isRF && handleOpenEdit(p.ticker, p.avgPrice)}
                            sx={{ padding: 0.5, visibility: p.isRF ? 'hidden' : 'visible', pointerEvents: p.isRF ? 'none' : 'auto' }}>
                            <Edit fontSize="small" sx={{ fontSize: 16, color: 'text.disabled' }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={compactCell}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.currentPrice)}</Typography>
                          <IconButton size="small" onClick={() => p.isRF && handleOpenEdit(p.ticker, p.currentTotal)}
                            sx={{ padding: 0.5, visibility: !p.isRF ? 'hidden' : 'visible', pointerEvents: !p.isRF ? 'none' : 'auto' }}>
                            <Edit fontSize="small" sx={{ fontSize: 16, color: 'text.disabled' }} />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={compactCell}><Typography variant="body2" sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.totalCost)}</Typography></TableCell>
                      <TableCell align="right" sx={compactCell}><Typography variant="body2" fontWeight={900} sx={{ fontSize: '0.9rem' }}>{formatCurrency(p.currentTotal)}</Typography></TableCell>
                      <TableCell align="right" sx={compactCell}>
                        <Chip label={`${p.profitLoss >= 0 ? '+' : ''}${formatCurrency(p.profitLoss)}`} size="small"
                          sx={{ bgcolor: p.profitLoss >= 0 ? `${theme.palette.success.main}15` : `${theme.palette.error.main}15`, color: p.profitLoss >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold', borderRadius: '8px', fontSize: '0.8rem', height: 24 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination component="div" count={stats.consolidatedPosition.length} rowsPerPage={detailRowsPerPage} page={detailPage}
                onPageChange={(_, p) => setDetailPage(p)} rowsPerPageOptions={[]}
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`} sx={{ borderTop: 'none' }} />
            </TableContainer>
          </Grid>
        </Grid>
      )}

      {/* ── TAB 2: Evolução ───────────────────────────────────────────────── */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <BarIcon color="success" /> DIVIDENDOS RECEBIDOS
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.fullHistory.slice(startDiv, startDiv + WINDOW_SIZE)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 'bold' }} minTickGap={20} />
                    <YAxis tickFormatter={(v) => `R$ ${v}`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="dividendos" name="Dividendos" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider size="small" value={startDiv} min={0} max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)}
                  onChange={(_, v) => setStartDiv(v as number)} sx={{ color: theme.palette.success.main }} />
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 4, pb: 2, borderRadius: 5, height: 520, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" fontWeight="900" mb={3} display="flex" alignItems="center" gap={1}>
                <AccountBalance color="primary" /> CRESCIMENTO PATRIMONIAL
              </Typography>
              <Box sx={{ flexGrow: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.fullHistory.slice(startPat, startPat + WINDOW_SIZE)}>
                    <defs>
                      <linearGradient id="colorPatrimony" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={theme.palette.primary.main} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 'bold' }} minTickGap={20} />
                    <YAxis tickFormatter={(v) => `R$ ${v / 1000}k`} tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
                    <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="patrimony" name="Patrimônio Acumulado" stroke={theme.palette.primary.main} strokeWidth={3} fillOpacity={1} fill="url(#colorPatrimony)" dot={false} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ px: 4, mt: 2 }}>
                <SmoothSlider size="small" value={startPat} min={0} max={Math.max(0, stats.fullHistory.length - WINDOW_SIZE)}
                  onChange={(_, v) => setStartPat(v as number)} sx={{ color: theme.palette.primary.main }} />
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── Dialog edição de preço ─────────────────────────────────────────── */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          Editar {editAsset?.ticker && stats.consolidatedPosition.find((p) => p.ticker === editAsset.ticker)?.isRF ? 'Saldo Atual' : 'Preço Médio'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {editAsset?.ticker && stats.consolidatedPosition.find((p) => p.ticker === editAsset.ticker)?.isRF
              ? `Informe o saldo bruto atual para "${editAsset.ticker}".`
              : `Defina um preço médio unitário manual para "${editAsset?.ticker}".`}
            <br /><br />
            <span style={{ fontSize: '0.8rem' }}>Deixe <b>0</b> para voltar ao cálculo automático.</span>
          </Typography>
          <TextField
            autoFocus fullWidth margin="dense" type="number" value={newPm}
            onChange={(e) => setNewPm(e.target.value)}
            label={editAsset?.ticker && stats.consolidatedPosition.find((p) => p.ticker === editAsset.ticker)?.isRF ? 'Saldo Total Atual (R$)' : 'Preço Médio Unitário (R$)'}
            InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
            inputProps={{ step: '0.01' }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancelar</Button>
          <Button onClick={handleSavePm} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}