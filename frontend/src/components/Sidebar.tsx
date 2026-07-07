import {
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography, Divider, IconButton, Box, useTheme, useMediaQuery,
} from '@mui/material';
import {
  Dashboard, SwapHoriz, Settings, TrackChanges,
  Assessment, Brightness4, Brightness7, Savings, Logout,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FamilyToggle from './FamilyToggle';

export const drawerWidth = 240;

interface SidebarProps {
  toggleTheme: () => void;
  mode: 'light' | 'dark';
  mobileOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ toggleTheme, mode, mobileOpen, onClose }: SidebarProps) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const menuItems = [
    { text: 'Dashboard',    icon: <Dashboard />,    path: '/' },
    { text: 'Transações',   icon: <SwapHoriz />,    path: '/transactions' },
    { text: 'Investimentos', icon: <Savings />,      path: '/investments' },
    { text: 'Metas',        icon: <TrackChanges />, path: '/budgets' },
    { text: 'Relatórios',   icon: <Assessment />,   path: '/reports' },
    { text: 'Gestão',       icon: <Settings />,     path: '/management' },
  ];

  const handleNavigate = (path: string) => {
    navigate(path);
    // No mobile, o drawer é temporário: fecha após navegar para não cobrir a tela
    if (isMobile) onClose();
  };

  const drawerContent = (
    <>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap fontWeight="bold" color="primary">
          Financias
        </Typography>
        <IconButton onClick={toggleTheme}>
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Toolbar>

      <Divider />

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <List>
          {menuItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  onClick={() => handleNavigate(item.path)}
                  selected={isSelected}
                  sx={{ borderRadius: 2, mx: 1 }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider />
      <FamilyToggle />
      <Divider />

      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={logout} sx={{ borderRadius: 2, mx: 1 }}>
            <ListItemIcon><Logout /></ListItemIcon>
            <ListItemText
              primary="Sair"
              secondary={user?.name}
              secondaryTypographyProps={{ noWrap: true }}
            />
          </ListItemButton>
        </ListItem>
      </List>
    </>
  );

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {/* Mobile / tablet: drawer temporário, fica escondido por padrão e some ao clicar fora */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop: drawer permanente, sempre visível */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}