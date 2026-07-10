import { Card, CardContent, Avatar, Typography, Box } from '@mui/material';

interface Props {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  performance?: number;
}

export default function KPICard({ title, value, icon, color, performance }: Props) {
  return (
    <Card sx={{ borderRadius: 5, boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Avatar sx={{ bgcolor: `${color}12`, color, mx: 'auto', mb: 1, width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 }, borderRadius: '14px' }}>
          {icon}
        </Avatar>
        <Typography variant="caption" color="text.secondary" fontWeight="900" sx={{ textTransform: 'uppercase', fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
          {title}
        </Typography>
        <Typography fontWeight="900" sx={{ mt: 0.5, fontSize: { xs: '1.05rem', sm: '1.5rem' }, lineHeight: 1.3 }}>{value}</Typography>
        <Box sx={{ minHeight: '20px', mt: 0.5 }}>
          {performance !== undefined && (
            <Typography variant="caption" color={performance >= 0 ? 'success.main' : 'error.main'} fontWeight="bold">
              {performance >= 0 ? '+' : ''}{performance.toFixed(2)}%
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}