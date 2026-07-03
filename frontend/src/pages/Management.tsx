import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Paper, TextField, Button, IconButton,
  List, ListItem, ListItemText, Avatar, Stack, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Divider, Tabs, Tab, Chip, Tooltip,
  Alert, Checkbox, FormControlLabel, Card, CardContent,
} from '@mui/material';
import { Grid } from '@mui/material';
import {
  Delete, Add, Person, Category, Edit, Search,
  CreditCard, AccountBalanceWallet, Warning, Settings,
  AdminPanelSettings, Block, LockReset, Group, GroupAdd,
  ManageAccounts, Save, Visibility, VisibilityOff,
  EmailOutlined, LockOutlined, BadgeOutlined,
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { AuthUser, Category as CategoryType, PaymentMethod } from '../types';

// ── Tipos locais ──────────────────────────────────────────────────────────────

interface UserItem extends AuthUser {
  active: boolean;
  email: string;
}

interface FamilyMember { id: number; name: string; color: string; email?: string; }
interface Family       { id: number; name: string; members: FamilyMember[]; }

type EditSource = 'users' | 'categories' | 'payment-methods';

interface EditingItem {
  source: EditSource;
  id: number;
  name: string;
  active: boolean;
  email?: string;
  color?: string;
  role?: 'admin' | 'member';
  newPassword?: string;
  type?: 'INCOME' | 'EXPENSE';
  closing_day?: number | string | null;
  due_day?: number | string | null;
  card_limit?: number | string | null;
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Management() {
  const { user: me, isAdmin, login, token } = useAuth();
  const [tab, setTab] = useState(0);

  // Dados
  const [users, setUsers]           = useState<UserItem[]>([]);
  const [categories, setCategories] = useState<CategoryType[]>([]);
  const [methods, setMethods]       = useState<PaymentMethod[]>([]);
  const [families, setFamilies]     = useState<Family[]>([]);

  // Perfil próprio
  const [profileName, setProfileName]         = useState(me?.name ?? '');
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirm, setProfileConfirm]   = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [profileSuccess, setProfileSuccess]   = useState('');
  const [profileError, setProfileError]       = useState('');
  const [profileLoading, setProfileLoading]   = useState(false);

  // Form novo usuário
  const emptyUser = { name: '', email: '', password: '', color: '#1976d2', role: 'member' };
  const [newUser, setNewUser]     = useState(emptyUser);
  const [userError, setUserError] = useState('');

  // Form nova categoria / método
  const [newCat, setNewCat]       = useState({ name: '', type: 'EXPENSE', color: '#9e9e9e' });
  const [newMethod, setNewMethod] = useState({ name: '', closing_day: '', due_day: '', card_limit: '' });

  // Edição item genérico
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem]       = useState<EditingItem | null>(null);
  const [editError, setEditError]           = useState('');

  // Exclusão / inativação
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete]         = useState<{ route: string; id: number; name: string } | null>(null);

  // Grupos (famílias)
  const emptyFamily = { name: '', member_ids: [] as number[] };
  const [familyDialogOpen, setFamilyDialogOpen] = useState(false);
  const [editingFamily, setEditingFamily]       = useState<{ id?: number; name: string; member_ids: number[] }>(emptyFamily);
  const [familyError, setFamilyError]           = useState('');
  const [deleteFamilyOpen, setDeleteFamilyOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete]     = useState<Family | null>(null);

  const [catSearch, setCatSearch] = useState('');

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [uRes, cRes, mRes] = await Promise.all([
        api.get<UserItem[]>('/users'),
        api.get<CategoryType[]>('/categories'),
        api.get<PaymentMethod[]>('/payment-methods'),
      ]);
      setUsers(uRes.data);
      setCategories(cRes.data);
      setMethods(mRes.data);
    } catch (err) { console.error(err); }
  }, []);

  const fetchFamilies = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const { data } = await api.get<Family[]>('/families');
      setFamilies(data);
    } catch (err) { console.error(err); }
  }, [isAdmin]);

  useEffect(() => { fetchData(); fetchFamilies(); }, [fetchData, fetchFamilies]);

  // ── Ordenação ────────────────────────────────────────────────────────────────
  const sortFn = (a: { active: boolean; name: string }, b: { active: boolean; name: string }) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.name.localeCompare(b.name);
  };

  const sortedUsers        = useMemo(() => [...users].sort(sortFn), [users]);
  const sortedMethods      = useMemo(() => [...methods].sort(sortFn), [methods]);
  const filteredCategories = useMemo(() =>
    categories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase())).sort(sortFn),
    [categories, catSearch]
  );

  // ── Perfil próprio ────────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');
    if (!profileName.trim()) { setProfileError('O nome é obrigatório.'); return; }
    if (profilePassword && profilePassword !== profileConfirm) {
      setProfileError('As senhas não coincidem.'); return;
    }
    if (profilePassword && (profilePassword.length < 8 || !/[A-Za-z]/.test(profilePassword) || !/[0-9]/.test(profilePassword))) {
      setProfileError('A senha deve ter ao menos 8 caracteres, com letras e números.'); return;
    }
    setProfileLoading(true);
    try {
      const payload: { name: string; password?: string } = { name: profileName };
      if (profilePassword) payload.password = profilePassword;
      const { data } = await api.put('/profile/me', payload);
      // Quando a senha é trocada, o backend revoga o token antigo e retorna um novo (token + user), sem troca de senha, retorna só o usuário atualizado.
      if (data.token && data.user) {
        login(data.token, data.user);
      } else if (me && token) {
        login(token, { ...me, name: data.name });
      }
      setProfilePassword('');
      setProfileConfirm('');
      setProfileSuccess('Perfil atualizado com sucesso!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setProfileError(msg ?? 'Erro ao atualizar perfil.');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Usuários ─────────────────────────────────────────────────────────────────
  const handleAddUser = async () => {
    setUserError('');
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setUserError('Nome, e-mail e senha são obrigatórios.');
      return;
    }
    try {
      await api.post('/users', newUser);
      setNewUser(emptyUser);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setUserError(msg ?? 'Erro ao criar usuário.');
    }
  };

  const handleToggleBlock = async (u: UserItem) => {
    if (u.id === me?.id) return;
    try {
      await api.put(`/users/${u.id}`, { name: u.name, email: u.email, color: u.color, role: u.role, active: !u.active });
      fetchData();
    } catch (err) { console.error(err); }
  };

  // ── Categorias / Métodos ──────────────────────────────────────────────────────
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

  // ── Edição genérica ───────────────────────────────────────────────────────────
  const openEdit = (item: UserItem | CategoryType | PaymentMethod, source: EditSource) => {
    setEditingItem({ ...item, source } as EditingItem);
    setEditError('');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setEditError('');
    const { source, id, ...payload } = editingItem;

    if (source === 'users' && (!payload.name?.trim() || !payload.email?.trim())) {
      setEditError('Nome e e-mail são obrigatórios.');
      return;
    }

    const clean: Record<string, unknown> = { name: payload.name, active: payload.active };
    if (source === 'users') {
      clean.email = payload.email; clean.color = payload.color; clean.role = payload.role;
      if (payload.newPassword?.trim()) clean.password = payload.newPassword;
    }
    if (source === 'categories')      { clean.color = payload.color; clean.type = payload.type; }
    if (source === 'payment-methods') { clean.closing_day = payload.closing_day; clean.due_day = payload.due_day; clean.card_limit = payload.card_limit; }

    try {
      await api.put(`/${source}/${id}`, clean);
      setEditDialogOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEditError(msg ?? 'Erro ao salvar.');
    }
  };

  // ── Exclusão / inativação ─────────────────────────────────────────────────────
  const requestDelete = (route: string, item: { id: number; name: string }) => {
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
    } catch { alert('Erro ao inativar item.'); }
  };

  // ── Grupos (famílias) ─────────────────────────────────────────────────────────
  const openCreateFamily = () => {
    setEditingFamily(emptyFamily);
    setFamilyError('');
    setFamilyDialogOpen(true);
  };

  const openEditFamily = (fam: Family) => {
    setEditingFamily({ id: fam.id, name: fam.name, member_ids: fam.members.map(m => m.id) });
    setFamilyError('');
    setFamilyDialogOpen(true);
  };

  const handleSaveFamily = async () => {
    setFamilyError('');
    if (!editingFamily.name.trim()) { setFamilyError('Nome do grupo é obrigatório.'); return; }
    if (editingFamily.member_ids.length < 2) { setFamilyError('Selecione ao menos 2 membros.'); return; }
    try {
      if (editingFamily.id) {
        await api.put(`/families/${editingFamily.id}`, { name: editingFamily.name, member_ids: editingFamily.member_ids });
      } else {
        await api.post('/families', { name: editingFamily.name, member_ids: editingFamily.member_ids });
      }
      setFamilyDialogOpen(false);
      fetchFamilies();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setFamilyError(msg ?? 'Erro ao salvar grupo.');
    }
  };

  const confirmDeleteFamily = async () => {
    if (!familyToDelete) return;
    try {
      await api.delete(`/families/${familyToDelete.id}`);
      setDeleteFamilyOpen(false);
      setFamilyToDelete(null);
      fetchFamilies();
    } catch { alert('Erro ao remover grupo.'); }
  };

  const toggleMember = (uid: number) => {
    setEditingFamily(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(uid)
        ? prev.member_ids.filter(id => id !== uid)
        : [...prev.member_ids, uid],
    }));
  };

  // ── Tabs dinâmicas ────────────────────────────────────────────────────────────
  const tabs = [
    { label: 'Meu Perfil', icon: <ManageAccounts /> },
    { label: 'Categorias', icon: <Category /> },
    { label: 'Cartões',    icon: <CreditCard /> },
    ...(isAdmin ? [
      { label: 'Grupos',   icon: <Group /> },
      { label: 'Usuários', icon: <Person /> },
    ] : []),
  ];

  const TAB_GRUPOS   = 3;
  const TAB_USUARIOS = 4;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 4, maxWidth: '1200px', margin: '0 auto' }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center' }}>
        <Typography variant="h4" fontWeight={900} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Settings fontSize="large" color="primary" /> Gestão de Configurações
        </Typography>
      </Box>

      <Paper sx={{ mb: 4, borderRadius: 4 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} centered variant="fullWidth">
          {tabs.map((t, i) => <Tab key={i} icon={t.icon} label={t.label} />)}
        </Tabs>
      </Paper>

      {/* ── ABA 0: MEU PERFIL ─────────────────────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={3} justifyContent="center">
          {/* Coluna esquerda: identidade */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ borderRadius: 4, textAlign: 'center', p: 2, height: '100%' }}>
              <CardContent>
                <Avatar
                  sx={{
                    bgcolor: me?.color ?? '#1976d2',
                    width: 80, height: 80,
                    fontSize: 34, fontWeight: 900,
                    mx: 'auto', mb: 2,
                  }}
                >
                  {profileName?.[0]?.toUpperCase() ?? '?'}
                </Avatar>

                <Typography variant="h6" fontWeight={900} gutterBottom>
                  {me?.name}
                </Typography>

                {me?.role === 'admin' && (
                  <Chip
                    icon={<AdminPanelSettings fontSize="small" />}
                    label="Administrador"
                    color="secondary"
                    variant="outlined"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                )}

                <Divider sx={{ my: 2 }} />

                <Stack spacing={1.5} alignItems="flex-start" sx={{ px: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailOutlined fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                      {me?.email}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <BadgeOutlined fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      {me?.role === 'admin' ? 'Administrador' : 'Membro'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LockOutlined fontSize="small" color="action" />
                    <Typography variant="body2" color="text.secondary">
                      Senha protegida
                    </Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Coluna direita: formulário */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 4, borderRadius: 4, height: '100%' }}>
              <Typography variant="h6" fontWeight={900} mb={3}>
                Editar informações
              </Typography>

              <Stack spacing={2.5}>
                {profileError   && <Alert severity="error"   onClose={() => setProfileError('')}>{profileError}</Alert>}
                {profileSuccess && <Alert severity="success" onClose={() => setProfileSuccess('')}>{profileSuccess}</Alert>}

                <TextField
                  fullWidth label="Nome" value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />

                <Divider>
                  <Typography variant="caption" color="text.secondary">Alterar senha (opcional)</Typography>
                </Divider>

                <TextField
                  fullWidth label="Nova senha"
                  type={showPassword ? 'text' : 'password'}
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword(s => !s)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <TextField
                  fullWidth label="Confirmar nova senha"
                  type={showPassword ? 'text' : 'password'}
                  value={profileConfirm}
                  onChange={(e) => setProfileConfirm(e.target.value)}
                />

                <Button
                  variant="contained" size="large" fullWidth
                  startIcon={<Save />}
                  disabled={profileLoading}
                  onClick={handleSaveProfile}
                  sx={{ mt: 1 }}
                >
                  {profileLoading ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ── ABA 1: CATEGORIAS ─────────────────────────────────────────────── */}
      {tab === 1 && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Stack spacing={2} mb={3}>
            <Stack direction="row" spacing={1}>
              <TextField fullWidth label="Nova Categoria" size="small"
                value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <input type="color" value={newCat.color}
                style={{ width: 60, height: 40, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField select fullWidth size="small" value={newCat.type}
                onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}>
                <MenuItem value="EXPENSE">Despesa</MenuItem>
                <MenuItem value="INCOME">Receita</MenuItem>
              </TextField>
              <Button variant="contained" onClick={handleAddCategory}><Add /></Button>
            </Stack>
          </Stack>
          <TextField fullWidth size="small" placeholder="Buscar..." value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)} sx={{ mb: 2 }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> } }} />
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3, maxHeight: 500, overflow: 'auto' }}>
            {filteredCategories.map((c) => (
              <ListItem key={c.id} sx={{ opacity: c.active ? 1 : 0.5 }}
                secondaryAction={
                  <Stack direction="row">
                    <IconButton onClick={() => openEdit(c, 'categories')} color="primary"><Edit /></IconButton>
                    {c.active && <IconButton onClick={() => requestDelete('categories', c)} color="error"><Delete /></IconButton>}
                  </Stack>
                }>
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: c.color, mr: 2, flexShrink: 0 }} />
                <ListItemText primary={c.name} secondary={c.active ? c.type : 'Inativa'} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* ── ABA 2: CARTÕES/MÉTODOS ────────────────────────────────────────── */}
      {tab === 2 && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: 'background.default', borderRadius: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary">NOVO MÉTODO / CARTÃO</Typography>
            <TextField fullWidth label="Nome (Ex: Nubank, Carteira)" size="small"
              value={newMethod.name} onChange={(e) => setNewMethod({ ...newMethod, name: e.target.value })} />
            <Grid container spacing={1}>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth type="number" label="Dia Fech." size="small"
                  value={newMethod.closing_day} onChange={(e) => setNewMethod({ ...newMethod, closing_day: e.target.value })}
                  helperText="Para Cartões" />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth type="number" label="Dia Venc." size="small"
                  value={newMethod.due_day} onChange={(e) => setNewMethod({ ...newMethod, due_day: e.target.value })}
                  helperText="Para Cartões" />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth type="number" label="Limite" size="small"
                  value={newMethod.card_limit} onChange={(e) => setNewMethod({ ...newMethod, card_limit: e.target.value })}
                  helperText="Opcional" />
              </Grid>
            </Grid>
            <Button variant="contained" fullWidth onClick={handleAddMethod} startIcon={<Add />}>Adicionar</Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="h6" fontWeight={900} sx={{ mb: 1, mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CreditCard color="secondary" /> Cartões de Crédito
          </Typography>
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3, mb: 3 }}>
            {sortedMethods.filter(m => m.closing_day).length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Nenhum cartão configurado.</Typography>
            )}
            {sortedMethods.filter(m => m.closing_day).map(m => (
              <ListItem key={m.id} sx={{ opacity: m.active ? 1 : 0.5 }}
                secondaryAction={
                  <Stack direction="row">
                    <IconButton onClick={() => openEdit(m, 'payment-methods')} color="primary"><Edit /></IconButton>
                    {m.active && <IconButton onClick={() => requestDelete('payment-methods', m)} color="error"><Delete /></IconButton>}
                  </Stack>
                }>
                <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}><CreditCard /></Avatar>
                <ListItemText primary={m.name}
                  secondary={<Typography variant="caption" fontWeight="bold">Fecha dia {m.closing_day} / Vence dia {m.due_day}</Typography>} />
              </ListItem>
            ))}
          </List>
          <Typography variant="h6" fontWeight={900} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalanceWallet color="primary" /> Outros Métodos
          </Typography>
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
            {sortedMethods.filter(m => !m.closing_day).map(m => (
              <ListItem key={m.id} sx={{ opacity: m.active ? 1 : 0.5 }}
                secondaryAction={
                  <Stack direction="row">
                    <IconButton onClick={() => openEdit(m, 'payment-methods')} color="primary"><Edit /></IconButton>
                    {m.active && <IconButton onClick={() => requestDelete('payment-methods', m)} color="error"><Delete /></IconButton>}
                  </Stack>
                }>
                <Avatar sx={{ bgcolor: 'grey.500', mr: 2 }}><AccountBalanceWallet /></Avatar>
                <ListItemText primary={m.name} secondary="Débito / À Vista" />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* ── ABA 3: GRUPOS (só admin) ──────────────────────────────────────── */}
      {tab === TAB_GRUPOS && isAdmin && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight={900} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Group color="primary" /> Grupos / Famílias
            </Typography>
            <Button variant="contained" startIcon={<GroupAdd />} onClick={openCreateFamily}>
              Novo Grupo
            </Button>
          </Stack>

          {families.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Group sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
              <Typography>Nenhum grupo criado ainda.</Typography>
              <Typography variant="caption">Crie um grupo para vincular usuários e ver a visão familiar.</Typography>
            </Box>
          ) : (
            <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
              {families.map(fam => (
                <ListItem key={fam.id} alignItems="flex-start"
                  secondaryAction={
                    <Stack direction="row">
                      <Tooltip title="Editar grupo">
                        <IconButton onClick={() => openEditFamily(fam)} color="primary"><Edit /></IconButton>
                      </Tooltip>
                      <Tooltip title="Remover grupo">
                        <IconButton onClick={() => { setFamilyToDelete(fam); setDeleteFamilyOpen(true); }} color="error">
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  }>
                  <ListItemText
                    primary={<Typography fontWeight={700}>{fam.name}</Typography>}
                    secondary={
                      <Stack direction="row" spacing={1} flexWrap="wrap" mt={0.5}>
                        {fam.members.map(m => (
                          <Chip key={m.id} size="small"
                            avatar={<Avatar sx={{ bgcolor: m.color }}>{m.name[0]}</Avatar>}
                            label={m.name} variant="outlined" />
                        ))}
                      </Stack>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Paper>
      )}

      {/* ── ABA 4: USUÁRIOS (só admin) ────────────────────────────────────── */}
      {tab === TAB_USUARIOS && isAdmin && (
        <Paper sx={{ p: 3, borderRadius: 5 }}>
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 3, mb: 3 }}>
            <Typography variant="subtitle2" fontWeight="bold" color="primary" mb={2}>NOVO USUÁRIO</Typography>
            {userError && <Alert severity="error" sx={{ mb: 2 }}>{userError}</Alert>}
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField fullWidth label="Nome" size="small"
                  value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField fullWidth label="E-mail" size="small" type="email"
                  value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField select fullWidth label="Papel" size="small"
                  value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}>
                  <MenuItem value="member">Membro</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField fullWidth label="Senha" size="small" type="password"
                  value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 6, sm: 2 }} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">Cor</Typography>
                <input type="color" value={newUser.color}
                  style={{ width: 40, height: 36, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                  onChange={(e) => setNewUser({ ...newUser, color: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 6, sm: 5 }} sx={{ display: 'flex', alignItems: 'center' }}>
                <Button variant="contained" fullWidth onClick={handleAddUser} startIcon={<Add />}>Adicionar</Button>
              </Grid>
            </Grid>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <List sx={{ bgcolor: 'action.hover', borderRadius: 3 }}>
            {sortedUsers.map(u => {
              const isMe = u.id === me?.id;
              return (
                <ListItem key={u.id} sx={{ opacity: u.active ? 1 : 0.45 }}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Editar">
                        <IconButton onClick={() => openEdit(u, 'users')} color="primary"><Edit /></IconButton>
                      </Tooltip>
                      {!isMe && (
                        <Tooltip title={u.active ? 'Bloquear' : 'Desbloquear'}>
                          <IconButton onClick={() => handleToggleBlock(u)} color={u.active ? 'error' : 'success'}>
                            <Block />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  }>
                  <Avatar sx={{ bgcolor: u.color, mr: 2 }}>{u.name[0].toUpperCase()}</Avatar>
                  <ListItemText
                    primary={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <span>{u.name}</span>
                        {isMe && <Chip label="você" size="small" color="primary" variant="outlined" />}
                        {u.role === 'admin' && (
                          <Chip icon={<AdminPanelSettings fontSize="small" />} label="Admin"
                            size="small" color="secondary" variant="outlined" />
                        )}
                        {!u.active && <Chip label="Bloqueado" size="small" color="error" />}
                      </Stack>
                    }
                    secondary={u.email}
                  />
                </ListItem>
              );
            })}
          </List>
        </Paper>
      )}

      {/* ── DIALOG: CRIAR / EDITAR GRUPO ──────────────────────────────────── */}
      <Dialog open={familyDialogOpen} onClose={() => setFamilyDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Group color="primary" />
          {editingFamily.id ? 'Editar Grupo' : 'Novo Grupo'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {familyError && <Alert severity="error">{familyError}</Alert>}
            <TextField fullWidth label="Nome do grupo" value={editingFamily.name}
              onChange={(e) => setEditingFamily(p => ({ ...p, name: e.target.value }))} />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                Membros ({editingFamily.member_ids.length} selecionados)
              </Typography>
              <Paper variant="outlined" sx={{ p: 1, maxHeight: 300, overflow: 'auto', borderRadius: 2 }}>
                {sortedUsers.filter(u => u.active).map(u => (
                  <FormControlLabel key={u.id}
                    sx={{ display: 'flex', mx: 0, py: 0.5, borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                      ...(editingFamily.member_ids.includes(u.id) ? { bgcolor: 'action.selected' } : {}) }}
                    control={
                      <Checkbox
                        checked={editingFamily.member_ids.includes(u.id)}
                        onChange={() => toggleMember(u.id)}
                        sx={{ color: u.color, '&.Mui-checked': { color: u.color } }}
                      />
                    }
                    label={
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Avatar sx={{ bgcolor: u.color, width: 28, height: 28, fontSize: 13 }}>
                          {u.name[0].toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{u.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                        </Box>
                      </Stack>
                    }
                  />
                ))}
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFamilyDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveFamily} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── DIALOG: REMOVER GRUPO ─────────────────────────────────────────── */}
      <Dialog open={deleteFamilyOpen} onClose={() => setDeleteFamilyOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" /> Remover Grupo
        </DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja remover o grupo <b>{familyToDelete?.name}</b>?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Os usuários não serão afetados, apenas o grupo será removido.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteFamilyOpen(false)} color="inherit">Cancelar</Button>
          <Button onClick={confirmDeleteFamily} variant="contained" color="error">Remover</Button>
        </DialogActions>
      </Dialog>

      {/* ── DIALOG: EDIÇÃO GENÉRICA ───────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingItem?.source === 'users' ? 'Editar Usuário' : 'Editar Item'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            <TextField fullWidth label="Nome" value={editingItem?.name ?? ''}
              onChange={(e) => setEditingItem(editingItem ? { ...editingItem, name: e.target.value } : null)} />
            {editingItem?.source === 'users' && (
              <>
                <TextField fullWidth label="E-mail" type="email" value={editingItem?.email ?? ''}
                  onChange={(e) => setEditingItem({ ...editingItem, email: e.target.value })} />
                <TextField select fullWidth label="Papel" value={editingItem?.role ?? 'member'}
                  onChange={(e) => setEditingItem({ ...editingItem, role: e.target.value as 'admin' | 'member' })}>
                  <MenuItem value="member">Membro</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </TextField>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">Cor do avatar</Typography>
                  <input type="color" value={editingItem?.color ?? '#1976d2'}
                    style={{ width: 48, height: 36, border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                    onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })} />
                </Stack>
                <TextField fullWidth label="Nova senha (deixe em branco para não alterar)" type="password"
                  value={editingItem?.newPassword ?? ''}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><LockReset fontSize="small" /></InputAdornment> } }}
                  onChange={(e) => setEditingItem({ ...editingItem, newPassword: e.target.value })} />
              </>
            )}
            {editingItem?.source === 'categories' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Cor</Typography>
                <input type="color" value={editingItem?.color ?? '#9e9e9e'}
                  style={{ width: 48, height: 36, border: '1px solid #ccc', borderRadius: '4px' }}
                  onChange={(e) => setEditingItem({ ...editingItem, color: e.target.value })} />
              </Stack>
            )}
            {editingItem?.source === 'payment-methods' && (
              <>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth type="number" label="Dia Fechamento"
                      value={editingItem?.closing_day ?? ''}
                      onChange={(e) => setEditingItem({ ...editingItem, closing_day: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth type="number" label="Dia Vencimento"
                      value={editingItem?.due_day ?? ''}
                      onChange={(e) => setEditingItem({ ...editingItem, due_day: e.target.value })} />
                  </Grid>
                </Grid>
                <TextField fullWidth type="number" label="Limite do Cartão"
                  value={editingItem?.card_limit ?? ''}
                  onChange={(e) => setEditingItem({ ...editingItem, card_limit: e.target.value })} />
              </>
            )}
            {!(editingItem?.source === 'users' && editingItem?.id === me?.id) && (
              <TextField select fullWidth label="Status"
                value={editingItem?.active ? 'true' : 'false'}
                onChange={(e) => setEditingItem(editingItem ? { ...editingItem, active: e.target.value === 'true' } : null)}>
                <MenuItem value="true">Ativo</MenuItem>
                <MenuItem value="false">Inativo</MenuItem>
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSaveEdit} variant="contained">Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* ── DIALOG: INATIVAR ITEM GENÉRICO ───────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" /> Inativar Item
        </DialogTitle>
        <DialogContent>
          <Typography>Tem certeza que deseja inativar <b>{itemToDelete?.name}</b>?</Typography>
          <Typography variant="caption" color="text.secondary">
            Ele não aparecerá mais nas listas, mas o histórico será mantido.
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