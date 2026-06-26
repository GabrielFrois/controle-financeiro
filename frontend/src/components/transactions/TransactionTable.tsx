import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TablePagination, Stack,
  IconButton, Chip, Typography,
} from '@mui/material';
import { Edit, Delete } from '@mui/icons-material';
import type { Transaction } from '../../types';

const formatCurrency = (val: any) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

const safeFormatDate = (dateStr: string) => {
  if (!dateStr) return '---';
  return new Date(dateStr.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR');
};

interface Props {
  transactions: Transaction[];
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}

export default function TransactionTable({
  transactions, page, rowsPerPage,
  onPageChange, onRowsPerPageChange,
  onEdit, onDelete,
}: Props) {
  return (
    <TableContainer component={Paper} sx={{ borderRadius: 5 }}>
      <Table>
        <TableHead sx={{ bgcolor: 'action.hover' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 900 }}>DATA</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>USUÁRIO</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>DESCRIÇÃO</TableCell>
            <TableCell sx={{ fontWeight: 900 }}>CATEGORIA</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900 }}>VALOR</TableCell>
            <TableCell align="center" sx={{ fontWeight: 900 }}>AÇÕES</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions
            .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
            .map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>{safeFormatDate(t.date)}</TableCell>
                <TableCell>
                  <Chip label={t.user_name} size="small" variant="outlined"
                    sx={{ fontWeight: 'bold', borderColor: t.user_color, color: t.user_color }} />
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t.description}</TableCell>
                <TableCell>
                  <Chip label={t.category_name} size="small" variant="outlined"
                    sx={{ fontWeight: 'bold', borderColor: t.category_color, color: t.category_color, fontSize: '0.65rem' }} />
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="900" color={t.type === 'INCOME' ? 'success.main' : 'error.main'}>
                    {formatCurrency(t.amount)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <IconButton size="small" color="primary" onClick={() => onEdit(t)}><Edit fontSize="small" /></IconButton>
                    <IconButton size="small" color="error"   onClick={() => onDelete(t)}><Delete fontSize="small" /></IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={transactions.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
      />
    </TableContainer>
  );
}