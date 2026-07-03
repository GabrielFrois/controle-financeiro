import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { FamilyProvider } from './context/FamilyContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Investments from './pages/Investments';
import Management from './pages/Management';
import Budgets from './pages/Budgets';
import Reports from './pages/Reports';

function AppLayout({ toggleTheme, mode }: { toggleTheme: () => void; mode: 'light' | 'dark' }) {
  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar toggleTheme={toggleTheme} mode={mode} />
      <Box component="main" sx={{ flexGrow: 1, pt: 1, px: 3, pb: 3 }}>
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