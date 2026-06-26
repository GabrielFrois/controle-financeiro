import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Box, Typography, Grid, Paper, TextField, Button, IconButton, 
  List, ListItem, ListItemText, Avatar, Stack, MenuItem, 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  InputAdornment, Divider, Tabs, Tab
} from '@mui/material';
import { Delete, Add, Person, Category, Edit, Search, CreditCard, AccountBalanceWallet, Warning, Settings } from '@mui/icons-material';
import api from '../services/api';

export default function Management() {
  const [tab, setTab] = useState(0);
  
  // Dados
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);

  // Forms de Criação
  const [newUser, setNewUser] = useState({ name: '', color: '#1976d2' });
  const [newCat, setNewCat] = useState({ name: '', type: 'EXPENSE', color: '#9e9e9e' });
  const [newMethod, setNewMethod] = useState({ name: '', closing_day: '', due_day: '', card_limit: '' });

  // Estados de Edição
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Estados de Exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ route: string, id: string, name: string } | null>(null);
  
  // Filtros
  const [catSearch, setCatSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [uRes, cRes, mRes] = await Promise.all([
        api.get('/users'), 
        api.get('/categories'),
        api.get('/payment-methods')
      ]);
      setUsers(uRes.data);
      setCategories(cRes.data);
      setMethods(mRes.data);
    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortFunction = (a: any, b: any) => {
    if (a.active === b.active) return a.name.localeCompare(b.name);
    return a.active ? -1 : 1;
  };

  const sortedUsers = useMemo(() => [...users].sort(sortFunction), [users]);
  const sortedMethods = useMemo(() => [...methods].sort(sortFunction), [methods]);
  
  const filteredCategories = useMemo(() => {
    return categories
      .filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
      .sort(sortFunction);
  }, [categories, catSearch]);

  // --- Handlers de Adição ---
  const handleAddUser = async () => {
    if (!newUser.name.trim()) return;
    await api.post('/users', newUser);
    setNewUser({ name: '', color: '#1976d2' });
    fetchData();
  };

  const handleAddCategory = async () => {
    if (!newCat.name.trim()) return;
    await api.post('/categories', newCat);
    setNewCat({ ...newCat, name: '' });
    fetchData();
  };

  const handleAddMethod = async () => {
    if (!newMethod.name.trim()) return;
    await api.post('/payment-methods', newMethod);
    setNewMethod({ name: '', closing_day: '', due_day: '', card_limit: '' });
    fetchData();
  };

  // --- Handlers de Edição ---
  const openEdit = (item: any, source: string) => {
    setEditingItem({ ...item, source });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    const { source, id, ...payload } = editingItem;
    // Remove dados extras que não vão pro backend
    const cleanPayload: any = { 
        name: payload.name, 
        active: payload.active 
    };

    if (source === 'users') cleanPayload.color = payload.color;
    if (source === 'categories') {
        cleanPayload.color = payload.color;
        cleanPayload.type = payload.type;
    }
    if (source === 'payment-methods') {
        cleanPayload.closing_day = payload.closing_day;
        cleanPayload.due_day = payload.due_day;
        cleanPayload.card_limit = payload.card_limit;
    }
    
    await api.put(`/${source}/${id}`, cleanPayload);
    setEditDialogOpen(false);
    fetchData();
  };

  // --- Handlers de Exclusão ---
  const requestDelete = (route: string, item: any) => {
    setItemToDelete({ route, id: item.id, name: item.name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
        await api.delete(`/${itemToDelete.route}/${itemToDelete.id}`);
        setDeleteDialogOpen(false);
        setItemToDelete(null);
        fetchData();
    } catch (error) {
        alert("Erro ao inativar item.");
    }
  };

  return (
    <Box sx={{ p: 4, pt: 4, maxWidth: '1200px', margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h4" fontWeight="900" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Settings fontSize="large" color="primary" /> Gestão de Configurações
        </Typography>
      </Box>

      <Paper sx={{ mb: 4, borderRadius: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered variant="fullWidth">
          <Tab icon={<Category />} label="Categorias" />
          <Tab icon={<CreditCard />} label="Cartões e Contas" />
          <Tab icon={<Person />} label="Usuários" />
        </Tabs>
      </Paper>

      {/* --- ABA 0: CATEGORIAS --- */}
      {tab === 0 && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Stack spacing={2} mb={3}>
            <Stack direction="row" spacing={1}>
              <TextField fullWidth label="Nova Categoria" size="small" value={newCat.name} onChange={(e) => setNewCat({...newCat, name: e.target.value})} />
              <input type="color" value={newCat.color} style={{ width: 60, height: 40, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }} onChange={(e) => setNewCat({...newCat, color: e.target.value})} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField select fullWidth size="small" value={newCat.type} onChange={(e) => setNewCat({...newCat, type: e.target.value})}><MenuItem value="EXPENSE">Despesa</MenuItem><MenuItem value="INCOME">Receita</MenuItem></TextField>
              <Button variant="contained" onClick={handleAddCategory}><Add /></Button>
            </Stack>
          </Stack>
          <TextField fullWidth size="small" placeholder="Buscar..." value={catSearch} onChange={(e) => setCatSearch(e.target.value)} sx={{ mb: 2 }} InputProps={{ startAdornment: (<InputAdornment position="start"><Search fontSize="small" /></InputAdornment>) }} />
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3, maxHeight: 500, overflow: 'auto' }}>
            {filteredCategories.map((c) => (
              <ListItem key={c.id} sx={{ opacity: c.active ? 1 : 0.5 }} secondaryAction={<Stack direction="row"><IconButton onClick={() => openEdit(c, 'categories')} color="primary"><Edit /></IconButton>{c.active && <IconButton onClick={() => requestDelete('categories', c)} color="error"><Delete /></IconButton>}</Stack>}>
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, mr: 2, flexShrink: 0 }} />
                <ListItemText primary={c.name} secondary={c.active ? c.type : "Inativa"} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* --- ABA 1: MÉTODOS DE PAGAMENTO E CARTÕES --- */}
      {tab === 1 && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary">NOVO MÉTODO / CARTÃO</Typography>
            <TextField fullWidth label="Nome (Ex: Nubank, Carteira)" size="small" value={newMethod.name} onChange={(e) => setNewMethod({...newMethod, name: e.target.value})} sx={{ bgcolor: 'background.paper' }} />
            <Grid container spacing={1}>
              <Grid item xs={4}>
                <TextField fullWidth type="number" label="Dia Fech." size="small" value={newMethod.closing_day} onChange={(e) => setNewMethod({...newMethod, closing_day: e.target.value})} helperText="Para Cartões" sx={{ bgcolor: 'background.paper' }} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth type="number" label="Dia Venc." size="small" value={newMethod.due_day} onChange={(e) => setNewMethod({...newMethod, due_day: e.target.value})} helperText="Para Cartões" sx={{ bgcolor: 'background.paper' }} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth type="number" label="Limite" size="small" value={newMethod.card_limit} onChange={(e) => setNewMethod({...newMethod, card_limit: e.target.value})} helperText="Opcional" sx={{ bgcolor: 'background.paper' }} />
              </Grid>
            </Grid>
            <Button variant="contained" fullWidth onClick={handleAddMethod} startIcon={<Add />}>Adicionar</Button>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* LISTA DE CARTÕES DE CRÉDITO */}
          <Typography variant="h6" fontWeight="900" sx={{ mb: 1, mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CreditCard color="secondary" /> Cartões de Crédito
          </Typography>
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3, mb: 3 }}>
            {sortedMethods.filter(m => m.closing_day).length === 0 && (
               <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nenhum cartão configurado.</Typography>
            )}
            {sortedMethods.filter(m => m.closing_day).map((m) => (
              <ListItem key={m.id} sx={{ opacity: m.active ? 1 : 0.5 }} secondaryAction={<Stack direction="row"><IconButton onClick={() => openEdit(m, 'payment-methods')} color="primary"><Edit /></IconButton>{m.active && <IconButton onClick={() => requestDelete('payment-methods', m)} color="error"><Delete /></IconButton>}</Stack>}>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}><CreditCard /></Avatar>
                <ListItemText 
                  primary={m.name} 
                  secondary={<Typography variant="caption" fontWeight="bold">Fecha dia {m.closing_day} / Vence dia {m.due_day}</Typography>} 
                />
              </ListItem>
            ))}
          </List>

          {/* LISTA DE OUTROS MÉTODOS (PIX, DINHEIRO, ETC) */}
          <Typography variant="h6" fontWeight="900" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWallet color="primary" /> Outros Métodos
          </Typography>
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
            {sortedMethods.filter(m => !m.closing_day).map((m) => (
              <ListItem key={m.id} sx={{ opacity: m.active ? 1 : 0.5 }} secondaryAction={<Stack direction="row"><IconButton onClick={() => openEdit(m, 'payment-methods')} color="primary"><Edit /></IconButton>{m.active && <IconButton onClick={() => requestDelete('payment-methods', m)} color="error"><Delete /></IconButton>}</Stack>}>
                <Avatar sx={{ bgcolor: 'grey.500', mr: 2 }}><AccountBalanceWallet /></Avatar>
                <ListItemText 
                  primary={m.name} 
                  secondary="Débito / À Vista" 
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* --- ABA 2: USUÁRIOS --- */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Stack direction="row" spacing={1} mb={3}>
            <TextField fullWidth label="Nome" size="small" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
            <input type="color" value={newUser.color} style={{ width: 60, height: 40, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }} onChange={(e) => setNewUser({...newUser, color: e.target.value})} />
            <Button variant="contained" onClick={handleAddUser}><Add /></Button>
          </Stack>
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
            {sortedUsers.map((u) => (
              <ListItem key={u.id} sx={{ opacity: u.active ? 1 : 0.5 }} secondaryAction={<Stack direction="row"><IconButton onClick={() => openEdit(u, 'users')} color="primary"><Edit /></IconButton>{u.active && <IconButton onClick={() => requestDelete('users', u)} color="error"><Delete /></IconButton>}</Stack>}>
                <Avatar sx={{ bgcolor: u.color, mr: 2 }}>{u.name[0]}</Avatar>
                <ListItemText primary={u.name} secondary={u.active ? "Ativo" : "Inativo"} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* DIALOGO DE EDIÇÃO */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Editar Item</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField fullWidth label="Nome" value={editingItem?.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} />
            
            {/* Campos Específicos de Usuário/Categoria */}
            {editingItem?.source !== 'payment-methods' && (
               <input type="color" value={editingItem?.color || '#000000'} style={{ width: '100%', height: 40 }} onChange={(e) => setEditingItem({...editingItem, color: e.target.value})} />
            )}

            {/* Campos Específicos de Cartão */}
            {editingItem?.source === 'payment-methods' && (
              <>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="Dia Fechamento" value={editingItem?.closing_day || ''} onChange={(e) => setEditingItem({...editingItem, closing_day: e.target.value})} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="Dia Vencimento" value={editingItem?.due_day || ''} onChange={(e) => setEditingItem({...editingItem, due_day: e.target.value})} />
                  </Grid>
                </Grid>
                <TextField fullWidth type="number" label="Limite do Cartão" value={editingItem?.card_limit || ''} onChange={(e) => setEditingItem({...editingItem, card_limit: e.target.value})} />
              </>
            )}

            <TextField select fullWidth label="Status" value={editingItem?.active ? 'true' : 'false'} onChange={(e) => setEditingItem({...editingItem, active: e.target.value === 'true'})}><MenuItem value="true">Ativo</MenuItem><MenuItem value="false">Inativo</MenuItem></TextField>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveEdit} variant="contained">Salvar</Button></DialogActions>
      </Dialog>

      {/* DIALOGO DE EXCLUSÃO */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Warning color="error" /> Inativar Item
        </DialogTitle>
        <DialogContent>
            <Typography>
                Tem certeza que deseja inativar <b>{itemToDelete?.name}</b>?
            </Typography>
            <Typography variant="caption" color="text.secondary">
                Ele não aparecerá mais nas listas de seleção, mas o histórico será mantido.
            </Typography>
        </DialogContent>
        <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">Cancelar</Button>
            <Button onClick={confirmDelete} variant="contained" color="error">Inativar</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}