import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#C9A84C', light: '#E2C97E', dark: '#A07830', contrastText: '#0A0E1A' },
    secondary: { main: '#4361EE', light: '#6B80F5', dark: '#2D44C5' },
    error: { main: '#EF4444' },
    success: { main: '#22C55E' },
    warning: { main: '#F59E0B' },
    info: { main: '#3B82F6' },
    background: { default: '#080C18', paper: '#0F1629' },
    text: { primary: '#F1F5F9', secondary: '#94A3B8' },
    divider: 'rgba(201,168,76,0.1)',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    button: { fontWeight: 600, textTransform: 'none' },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: '#080C18',
          scrollbarWidth: 'thin',
          scrollbarColor: '#C9A84C30 transparent',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { background: '#C9A84C40', borderRadius: 3 },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, rgba(15,22,41,0.95) 0%, rgba(12,18,35,0.98) 100%)',
          border: '1px solid rgba(201,168,76,0.1)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 10, padding: '8px 20px', fontWeight: 600 },
        containedPrimary: {
          background: 'linear-gradient(135deg, #C9A84C, #E2C97E)',
          color: '#0A0E1A',
          '&:hover': { boxShadow: '0 6px 20px rgba(201,168,76,0.35)' },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            '& fieldset': { borderColor: 'rgba(201,168,76,0.2)' },
            '&:hover fieldset': { borderColor: 'rgba(201,168,76,0.4)' },
            '&.Mui-focused fieldset': { borderColor: '#C9A84C' },
          },
          '& .MuiInputLabel-root.Mui-focused': { color: '#C9A84C' },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.4)' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#C9A84C' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(135deg, #0F1629 0%, #0A0E1A 100%)',
          border: '1px solid rgba(201,168,76,0.15)',
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 999, height: 6, backgroundColor: 'rgba(201,168,76,0.12)' },
        bar: { background: 'linear-gradient(90deg, #C9A84C, #E2C97E)', borderRadius: 999 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: { '& .MuiTableCell-head': { background: 'rgba(201,168,76,0.06)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B', borderBottom: '1px solid rgba(201,168,76,0.12)' } },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: '1px solid rgba(255,255,255,0.04)', padding: '12px 16px' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:hover': { background: 'rgba(201,168,76,0.04)' }, transition: 'background 0.15s' },
      },
    },
  },
});
