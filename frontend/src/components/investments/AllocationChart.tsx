import { Box, Typography, Stack, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { useTheme } from '@mui/material';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#9c27b0'];

const LABEL_MAP: Record<string, string> = {
  RENDA_FIXA: 'Renda Fixa', ACOES: 'Ações', FII: 'Fundos Imobiliários',
  CRIPTOS: 'Criptomoedas', INTERNACIONAL: 'Internacional', OUTROS: 'Outros',
  Brasil: 'Nacional', Exterior: 'Internacional',
};
const formatLabel = (key: string) => LABEL_MAP[key] || key;

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

interface Props {
  viewMode: 'assets' | 'types' | 'geo';
  data: { name: string; value: number }[];
  patrimonioTotal: number;
  onViewModeChange: (mode: 'assets' | 'types' | 'geo') => void;
  getAssetColor: (type: string) => string;
}

export default function AllocationChart({ viewMode, data, patrimonioTotal, onViewModeChange, getAssetColor }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <Typography variant="h6" fontWeight="900" color="text.secondary" mb={2}>
        Distribuição da Carteira
      </Typography>
      <ToggleButtonGroup
        value={viewMode} exclusive size="small"
        onChange={(_, v) => v && onViewModeChange(v)}
        sx={{
          mb: 1, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 8,
          '& .MuiToggleButton-root': {
            border: 'none', borderRadius: 8, px: 2, py: 0.5, mx: 0.5, my: 0.5,
            textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary',
            '&.Mui-selected': { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } },
          },
        }}
      >
        <ToggleButton value="assets">Ativos</ToggleButton>
        <ToggleButton value="types">Tipos</ToggleButton>
        <ToggleButton value="geo">Geo</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ flexGrow: 1, width: '100%', minHeight: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={90} outerRadius={130} dataKey="value" stroke="none" paddingAngle={5}>
              {data.map((entry, index) => (
                <Cell key={index} fill={viewMode === 'assets' ? COLORS[index % COLORS.length] : getAssetColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              cursor={{ fill: 'transparent' }}
              formatter={(value: number, name: string) => [
                `${formatCurrency(value)} (${((value / patrimonioTotal) * 100).toFixed(2)}%)`,
                formatLabel(name),
              ]}
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>

      <Stack spacing={1} sx={{ mt: 3, px: 2, width: '100%', maxHeight: 150, overflowY: 'auto' }}>
        {data.slice(0, 5).map((item, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: viewMode === 'assets' ? COLORS[i % COLORS.length] : getAssetColor(item.name) }} />
              <Typography variant="body2" fontWeight="bold">{formatLabel(item.name)}</Typography>
            </Box>
            <Typography variant="body2" fontWeight="900">
              {patrimonioTotal > 0 ? ((item.value / patrimonioTotal) * 100).toFixed(1) : 0}%
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}