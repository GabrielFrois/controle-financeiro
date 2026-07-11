import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  ThemeProvider, createTheme, CssBaseline, Box,
  AppBar, Toolbar, IconButton, Typography, useMediaQuery,
} from '@mui/material';
import { Menu as MenuIcon, Brightness4, Brightness7 } from '@mui/icons-material';
import { AuthProvider } from './context/AuthContext';
import { FamilyProvider } from './context/FamilyContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar, { drawerWidth } from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Investments from './pages/Investments';
import Management from './pages/Management';
import Budgets from './pages/Budgets';
import Reports from './pages/Reports';

function AppLayout({ toggleTheme, mode }: { toggleTheme: () => void; mode: 'light' | 'dark' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('md'));

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Barra superior só aparece em telas pequenas, com o botão de menu */}
      {isMobile && (
        <AppBar
          position="fixed"
          color="default"
          elevation={1}
          sx={{ display: { xs: 'block', md: 'none' }, zIndex: (t) => t.zIndex.drawer + 1 }}
        >
          <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" fontWeight="bold" color="primary" noWrap>
                ZeloFy
              </Typography>
            </Box>
            <IconButton onClick={toggleTheme}>
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      <Sidebar
        toggleTheme={toggleTheme}
        mode={mode}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          pt: { xs: 8, md: 1 }, // espaço extra no mobile por causa da AppBar fixa
          px: { xs: 1.5, sm: 2, md: 3 },
          pb: 3,
          minWidth: 0, // evita que filhos com tabelas "empurrem" o layout
        }}
      >
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/investments"  element={<Investments />} />
          <Route path="/management"   element={<Management />} />
          <Route path="/budgets"      element={<Budgets />} />
          <Route path="/reports"      element={<Reports />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

const THEME_KEY = 'app-theme-mode';

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(THEME_KEY, next);
      return next;
    });
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary:    { main: '#1976d2' },
      secondary:  { main: '#dc004e' },
      background: { default: mode === 'light' ? '#f4f6f8' : '#121212' },
    },
  }), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <FamilyProvider>
                  <AppLayout toggleTheme={toggleTheme} mode={mode} />
                </FamilyProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}