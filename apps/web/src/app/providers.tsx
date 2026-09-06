'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

const theme = createTheme({
  palette: {
    primary: { main: '#165c46', dark: '#0f4535', light: '#d9eee6' },
    background: { default: '#f4f7f5', paper: '#ffffff' },
    text: { primary: '#16251f', secondary: '#607068' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Arial, Helvetica, sans-serif',
    h3: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.9px' },
    h4: { fontWeight: 700, letterSpacing: '-0.5px' },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { styleOverrides: { root: { borderRadius: 10, boxShadow: 'none', minHeight: 40 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 18 } } },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
});

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
