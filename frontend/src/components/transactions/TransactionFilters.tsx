import { Paper, Grid, TextField, MenuItem, Button } from '@mui/material';
import { Clear } from '@mui/icons-material';
import type { Category } from '../../types';

interface Props {
  typeFilter: string;
  categoryFilter: string;
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  defaultEndDate: string;
  categories: Category[];
  onChange: (field: string, value: string) => void;
  onReset: () => void;
}

export default function TransactionFilters({
  typeFilter, categoryFilter,
  startDate, endDate,
  categories,
  onChange, onReset,
}: Props) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select fullWidth label="Tipo" size="small" value={typeFilter} onChange={(e) => onChange('typeFilter', e.target.value)}>
            <MenuItem value="Todos">Todos</MenuItem>
            <MenuItem value="INCOME">Receitas</MenuItem>
            <MenuItem value="EXPENSE">Despesas</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField select fullWidth label="Categoria" size="small" value={categoryFilter} onChange={(e) => onChange('categoryFilter', e.target.value)}>
            <MenuItem value="Todas">Todas</MenuItem>
            {categories.map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth type="date" label="Início" size="small" InputLabelProps={{ shrink: true }} value={startDate} onChange={(e) => onChange('startDate', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField fullWidth type="date" label="Fim" size="small" InputLabelProps={{ shrink: true }} value={endDate} onChange={(e) => onChange('endDate', e.target.value)} />
        </Grid>
        <Grid size={{ xs: 12, md: 1 }}>
          <Button fullWidth startIcon={<Clear />} onClick={onReset}>Reset</Button>
        </Grid>
      </Grid>
    </Paper>
  );
}