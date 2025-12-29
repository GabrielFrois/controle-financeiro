import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Grid, Paper, TextField, Button, IconButton, List, ListItem, ListItemText, Avatar, Stack, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Delete, Add, Person, Category, Edit } from '@mui/icons-material';
import api from '../services/api';

export default function Management() {
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newUser, setNewUser] = useState({ name: '', color: '#1976d2' });
  const [newCat, setNewCat] = useState({ name: '', type: 'EXPENSE', color: '#9e9e9e' });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, cRes] = await Promise.all([api.get('/users'), api.get('/categories')]);
      setUsers(uRes.data);
      setCategories(cRes.data);
    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddUser = async () => {
    await api.post('/users', newUser);
    setNewUser({ name: '', color: '#1976d2' });
    fetchData();
  };

  const handleAddCategory = async () => {
    await api.post('/categories', newCat);
    setNewCat({ ...newCat, name: '' });
    fetchData();
  };

  const handleDelete = async (route: string, id: string) => {
    if (window.confirm("Inativar este item?")) {
      await api.delete(`/${route}/${id}`);
      fetchData();
    }
  };

  const openEdit = (item: any, source: 'users' | 'categories') => {
    setEditingItem({ ...item, source });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    const { source, id, name, color, type, active } = editingItem;
    const payload = source === 'users' ? { name, color, active } : { name, color, type, active };
    await api.put(`/${source}/${id}`, payload);
    setEditDialogOpen(false);
    fetchData();
  };

  return (
    <Box sx={{ p: 2, maxWidth: '1200px', margin: '0 auto' }}>
      <Typography variant="h4" fontWeight="900" mb={4}>Gestão de <Typography component="span" variant="h4" color="primary" fontWeight="900">Configurações</Typography></Typography>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={3}><Person color="primary" /><Typography variant="h6" fontWeight="bold">Usuários</Typography></Stack>
            <Stack direction="row" spacing={1} mb={3}>
              <TextField fullWidth label="Nome" size="small" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
              <input type="color" value={newUser.color} style={{ width: 60, height: 40, border: '1px solid #ccc', borderRadius: '4px' }} onChange={(e) => setNewUser({...newUser, color: e.target.value})} />
              <Button variant="contained" onClick={handleAddUser}><Add /></Button>
            </Stack>
            <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
              {users.map((u) => (
                <ListItem key={u.id} sx={{ opacity: u.active ? 1 : 0.5 }} secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton onClick={() => openEdit(u, 'users')} color="primary"><Edit /></IconButton>
                    {u.active && <IconButton onClick={() => handleDelete('users', u.id)} color="error"><Delete /></IconButton>}
                  </Stack>
                }>
                  <Avatar sx={{ bgcolor: u.color, mr: 2 }}>{u.name[0]}</Avatar>
                  <ListItemText primary={u.name} secondary={u.active ? "Ativo" : "Inativo"} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, borderRadius: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={3}><Category color="primary" /><Typography variant="h6" fontWeight="bold">Categorias</Typography></Stack>
            <Stack spacing={2} mb={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth label="Nova Categoria" size="small" value={newCat.name} onChange={(e) => setNewCat({...newCat, name: e.target.value})} />
                <input type="color" value={newCat.color} style={{ width: 60, height: 40, border: '1px solid #ccc', borderRadius: '4px' }} onChange={(e) => setNewCat({...newCat, color: e.target.value})} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField select fullWidth size="small" value={newCat.type} onChange={(e) => setNewCat({...newCat, type: e.target.value})}><MenuItem value="EXPENSE">Despesa</MenuItem><MenuItem value="INCOME">Receita</MenuItem></TextField>
                <Button variant="contained" onClick={handleAddCategory}><Add /></Button>
              </Stack>
            </Stack>
            <List sx={{ bgcolor: 'action.hover', borderRadius: 3, maxHeight: 400, overflow: 'auto' }}>
              {categories.map((c) => (
                <ListItem key={c.id} sx={{ opacity: c.active ? 1 : 0.5 }} secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <IconButton onClick={() => openEdit(c, 'categories')} color="primary"><Edit /></IconButton>
                    {c.active && <IconButton onClick={() => handleDelete('categories', c.id)} color="error"><Delete /></IconButton>}
                  </Stack>
                }>
                  <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, mr: 2 }} />
                  <ListItemText primary={c.name} secondary={c.active ? c.type : "Inativa"} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Editar Item</DialogTitle>
        <DialogContent><Stack spacing={3} sx={{ mt: 1 }}>
          <TextField fullWidth label="Nome" value={editingItem?.name || ''} onChange={(e) => setEditingItem({...editingItem, name: e.target.value})} />
          <input type="color" value={editingItem?.color || '#000000'} style={{ width: '100%', height: 40 }} onChange={(e) => setEditingItem({...editingItem, color: e.target.value})} />
          <TextField select fullWidth label="Status" value={editingItem?.active ? 'true' : 'false'} onChange={(e) => setEditingItem({...editingItem, active: e.target.value === 'true'})}><MenuItem value="true">Ativo</MenuItem><MenuItem value="false">Inativo</MenuItem></TextField>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button><Button onClick={handleSaveEdit} variant="contained">Salvar</Button></DialogActions>
      </Dialog>
    </Box>
  );
}