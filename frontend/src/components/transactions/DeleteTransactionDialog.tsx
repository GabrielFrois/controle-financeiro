import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Stack,
} from '@mui/material';
import { Warning, HelpOutline } from '@mui/icons-material';
import type { Transaction } from '../../types';

interface Props {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onConfirm: (deleteAllInSeries: boolean) => void;
}

export default function DeleteTransactionDialog({ open, transaction, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 900 }}>
        {transaction?.installment_group_id
          ? <Warning color="warning" />
          : <HelpOutline color="primary" />}
        Excluir Registro
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" fontWeight="700">
          Tem certeza que deseja excluir "{transaction?.description}"?
        </Typography>
        {transaction?.installment_group_id && (
          <Typography variant="body2" color="text.secondary"
            sx={{ mt: 2, bgcolor: '#fff3e0', p: 2, borderRadius: 2, border: '1px solid #ffe0b2' }}>
            <b>Atenção:</b> Este item faz parte de uma compra parcelada. Você pode excluir apenas esta parcela ou o grupo inteiro.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} color="inherit" variant="outlined">Cancelar</Button>
        {transaction?.installment_group_id ? (
          <Stack direction="row" spacing={1}>
            <Button onClick={() => onConfirm(false)} variant="contained" color="error">Apenas Esta</Button>
            <Button onClick={() => onConfirm(true)}  variant="contained" color="error">Excluir Todas</Button>
          </Stack>
        ) : (
          <Button onClick={() => onConfirm(false)} variant="contained" color="error">Confirmar Exclusão</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}