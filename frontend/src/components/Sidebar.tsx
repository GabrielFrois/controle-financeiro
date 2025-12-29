import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Toolbar, Typography, Divider, IconButton, Box, useTheme } from '@mui/material';
import { Dashboard, SwapHoriz, Settings, PieChart, Assessment, Brightness4, Brightness7, Savings } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 240;

interface SidebarProps {
  toggleTheme: () => void;
  mode: 'light' | 'dark';
}

export default function Sidebar({ toggleTheme, mode }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const menuItems = [
    { text: 'Dashboard', icon: <Dashboard />, path: '/' },
    { text: 'Transações', icon: <SwapHoriz />, path: '/transactions' },
    { text: 'Investimentos', icon: <Savings />, path: '/investments' },
    { text: 'Metas', icon: <PieChart />, path: '/budgets' },
    { text: 'Relatórios', icon: <Assessment />, path: '/reports' },
    { text: 'Gestão', icon: <Settings />, path: '/management' },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
      }}
    >
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" noWrap fontWeight="bold" color="primary">
          Financias
        </Typography>
        <IconButton onClick={toggleTheme}>
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Toolbar>
      <Divider />
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => {
            const isSelected = location.pathname === item.path;
            
            return (
              <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton 
                  onClick={() => navigate(item.path)}
                  selected={isSelected}
                  sx={{
                    mx: 1,
                    borderRadius: '10px',
                    '&.Mui-selected': {
                      bgcolor: `${theme.palette.primary.main}15`,
                      color: theme.palette.primary.main,
                      '&:hover': {
                        bgcolor: `${theme.palette.primary.main}25`,
                      },
                      '& .MuiListItemIcon-root': {
                        color: theme.palette.primary.main,
                      }
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: isSelected ? 'inherit' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text} 
                    primaryTypographyProps={{ fontWeight: isSelected ? 'bold' : 'medium' }} 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Drawer>
  );
}