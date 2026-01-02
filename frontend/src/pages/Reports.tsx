import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { Download as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';

export default function Reports() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>Relatórios e Exportação</Typography>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Selecione o formato para exportar seu extrato atual (com base nos filtros aplicados).
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="contained" startIcon={<DownloadIcon />} color="primary">
            Exportar para Excel (CSV)
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} color="secondary">
            Gerar PDF
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}