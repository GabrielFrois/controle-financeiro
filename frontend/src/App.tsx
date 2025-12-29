import { useState, useMemo } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
//import Investments from './pages/Investments';
import Management from './pages/Manegements';
//import Budgets from './pages/Budgets';
//import Reports from './pages/Reports';

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: { default: mode === 'light' ? '#f4f6f8' : '#121212' }
    },
  }), [mode]);

  const toggleTheme = () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Box sx={{ display: 'flex' }}>
          <Sidebar toggleTheme={toggleTheme} mode={mode} />
          <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              {/* <Route path="/investments" element={<Investments />} /> */}
              <Route path="/management" element={<Management />} />
              {/* <Route path="/budgets" element={<Budgets />} /> */}
              {/* <Route path="/reports" element={<Reports />} /> */}
            </Routes>
          </Box>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}
export default App;