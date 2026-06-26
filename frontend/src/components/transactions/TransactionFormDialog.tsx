import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Stack, TextField, Grid, FormControl, InputLabel,
  Select, MenuItem, Divider, Chip, Box, ToggleButtonGroup,
  ToggleButton, FormControlLabel, Switch,
} from '@mui/material';
import { AccountBalanceWallet } from '@mui/icons-material';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useMemo } from 'react';
import type { Category, User, PaymentMethod } from '../../types';
export interface TransactionForm {
  description: string; amount: string; type: string;
  category_id: string; user_id: string; date: string;
  payment_method_id: string; installments: string;
  asset_ticker: string; quantity: string;
  investment_type: string; yield_rate: string;
}

interface Props {
  open: boolean;
  isEditing: boolean;
  editingHasGroup: boolean;
  editAllFuture: boolean;
  paymentMode: 'DEBIT' | 'CREDIT';
  form: TransactionForm;
  users: User[];
  categories: Category[];
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFormChange: (updated: TransactionForm) => void;
  onPaymentModeChange: (mode: 'DEBIT' | 'CREDIT') => void;
  onEditAllFutureChange: (val: boolean) => void;
}

export default function TransactionFormDialog({
  open, isEditing, editingHasGroup, editAllFuture,
  paymentMode, form,
  users, categories, paymentMethods,
  onClose, onSubmit, onFormChange,
  onPaymentModeChange, onEditAllFutureChange,
}: Props) {
  const isInvestmentForm = useMemo(
    () => categories.find((c) => c.id === Number(form.category_id))?.name.toLowerCase().includes('investimento'),
    [form.category_id, categories]
  );

  const availablePaymentMethods = useMemo(
    () => paymentMethods.filter((m) => {
      if (!m.active) return false;
      return paymentMode === 'CREDIT' ? m.closing_day != null : m.closing_day == null;
    }),
    [paymentMethods, paymentMode]
  );

  const set = (field: keyof TransactionForm) => (e: { target: { value: string } }) =>
    onFormChange({ ...form, [field]: e.target.value });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isEditing ? 'Editar Registro' : 'Novo Lançamento'}
      </DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Stack spacing={2.5}>
            {isEditing && editingHasGroup && (
              <FormControlLabel
                control={<Switch checked={editAllFuture} onChange={(e) => onEditAllFutureChange(e.target.checked)} />}
                label="Aplicar mudanças a todas as parcelas deste grupo?"
              />
            )}

            <TextField fullWidth label="Descrição" required value={form.description} onChange={set('description')} />

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth type="number" label="Valor" required value={form.amount} onChange={set('amount')} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField fullWidth type="date" label="Data" required value={form.date} onChange={set('date')} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Tipo</InputLabel>
                  <Select value={form.type} label="Tipo" onChange={(e) => onFormChange({ ...form, type: e.target.value, category_id: '' })}>
                    <MenuItem value="EXPENSE">Despesa</MenuItem>
                    <MenuItem value="INCOME">Receita</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Usuário</InputLabel>
                  <Select value={form.user_id} label="Usuário" onChange={set('user_id')}>
                    {users.filter((u) => u.active).map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <FormControl fullWidth required>
              <InputLabel>Categoria</InputLabel>
              <Select value={form.category_id} label="Categoria" onChange={set('category_id')}>
                {categories.filter((c) => c.active && c.type === form.type).map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 1 }}><Chip label="PAGAMENTO" size="small" /></Divider>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <ToggleButtonGroup
                color="primary" value={paymentMode} exclusive size="small"
                onChange={(_, val) => { if (val) { onPaymentModeChange(val); onFormChange({ ...form, payment_method_id: '' }); } }}
              >
                <ToggleButton value="DEBIT" sx={{ px: 3 }}>
                  <AccountBalanceWallet sx={{ mr: 1, fontSize: 20 }} /> À VISTA / DÉBITO
                </ToggleButton>
                <ToggleButton value="CREDIT" sx={{ px: 3 }}>
                  <CreditCardIcon sx={{ mr: 1, fontSize: 20 }} /> CRÉDITO PARCELADO
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Grid container spacing={2}>
              <Grid size={{ xs: (paymentMode === 'CREDIT' && !isEditing) ? 8 : 12 }}>
                <FormControl fullWidth required>
                  <InputLabel>{paymentMode === 'CREDIT' ? 'Cartão de Crédito' : 'Conta / Carteira'}</InputLabel>
                  <Select value={form.payment_method_id} label={paymentMode === 'CREDIT' ? 'Cartão de Crédito' : 'Conta / Carteira'} onChange={set('payment_method_id')}>
                    {availablePaymentMethods.length === 0 && (
                      <MenuItem disabled value="">{paymentMode === 'CREDIT' ? 'Nenhum cartão cadastrado' : 'Nenhuma conta encontrada'}</MenuItem>
                    )}
                    {availablePaymentMethods.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {paymentMode === 'CREDIT' && !isEditing && (
                <Grid size={{ xs: 4 }}>
                  <TextField fullWidth type="number" label="Parcelas" value={form.installments} onChange={set('installments')} InputProps={{ inputProps: { min: 1 } }} />
                </Grid>
              )}
            </Grid>

            {isInvestmentForm && (
              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid size={{ xs: 12 }}>
                  <TextField select fullWidth label="Tipo de Ativo" value={form.investment_type} onChange={set('investment_type')}>
                    <MenuItem value="RENDA_FIXA">Renda Fixa (CDB/Tesouro)</MenuItem>
                    <MenuItem value="ACOES">Ações</MenuItem>
                    <MenuItem value="FII">FIIs</MenuItem>
                    <MenuItem value="CRIPTOS">Criptoativos</MenuItem>
                    <MenuItem value="INTERNACIONAL">Internacional</MenuItem>
                    <MenuItem value="OUTROS">Outros</MenuItem>
                  </TextField>
                </Grid>
                {form.investment_type === 'RENDA_FIXA' ? (
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth label="Rentabilidade (% do CDI)" type="number" placeholder="Ex: 102" value={form.yield_rate} onChange={set('yield_rate')} />
                  </Grid>
                ) : (
                  <>
                    <Grid size={{ xs: 6 }}>
                      <TextField fullWidth label="Ticker (Ex: PETR4)" value={form.asset_ticker} onChange={set('asset_ticker')} />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <TextField fullWidth type="number" label="Quantidade" value={form.quantity} onChange={set('quantity')} />
                    </Grid>
                  </>
                )}
              </Grid>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained">{isEditing ? 'Salvar Alterações' : 'Salvar'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}