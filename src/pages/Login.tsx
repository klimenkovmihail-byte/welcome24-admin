import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, InputAdornment, Alert, IconButton, Chip,
} from '@mui/material';
import { motion } from 'framer-motion';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { login, trySsoFromUrl } from '../auth/auth';
import Logo from '../components/Logo';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);

  useEffect(() => {
    const ssoUser = trySsoFromUrl();
    if (ssoUser) navigate('/dashboard', { replace: true });
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setRedirect(null);
    const result = login(email);
    if (result.ok) {
      navigate('/dashboard', { replace: true });
    } else {
      setError(result.error);
      if (result.redirectTo) {
        setRedirect(result.redirectTo);
        setTimeout(() => { window.location.href = result.redirectTo!; }, 1800);
      }
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 20% 30%, rgba(239,68,68,0.06), transparent 50%), radial-gradient(circle at 80% 70%, rgba(201,168,76,0.06), transparent 50%), #080C18', position: 'relative', overflow: 'hidden' }}>
      {/* Background decoration */}
      {[...Array(20)].map((_, i) => (
        <motion.div key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.05, 0.15, 0.05], y: [0, -20, 0] }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: i * 0.2 }}
          style={{
            position: 'absolute',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: 4, height: 4, borderRadius: '50%',
            background: i % 2 === 0 ? '#C9A84C' : '#EF4444',
          }} />
      ))}

      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }}>
        <Box sx={{ width: 420, p: 4.5, borderRadius: 4, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: '1px solid rgba(201,168,76,0.15)', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, filter: 'drop-shadow(0 8px 32px rgba(201,168,76,0.25))' }}>
            <Logo variant="full" size={56} color="#F1F5F9" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, mb: 3 }}>
            <Chip label="ADMIN PANEL" size="small" sx={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontWeight: 800, letterSpacing: '0.08em', fontSize: 11 }} />
          </Box>
          <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', mb: 3.5 }}>
            Вход в административную панель управления
          </Typography>

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <Alert severity={redirect ? 'info' : 'error'} sx={{ mb: 2.5, borderRadius: 2 }}>{error}</Alert>
            </motion.div>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth size="small" autoFocus
              label="Email" value={email} onChange={e => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><EmailRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
            />
            <TextField
              fullWidth size="small"
              label="Пароль" type={showPw ? 'text' : 'password'}
              value={password} onChange={e => setPassword(e.target.value)}
              sx={{ mb: 3 }}
              slotProps={{ input: {
                startAdornment: <InputAdornment position="start"><LockRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment>,
                endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setShowPw(s => !s)} sx={{ color: '#64748B' }}>{showPw ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}</IconButton></InputAdornment>,
              } }}
            />
            <Button type="submit" fullWidth variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} sx={{ py: 1.3 }}>
              Войти в админку
            </Button>
          </form>

          <Box sx={{ mt: 3, p: 2, borderRadius: 2.5, background: 'rgba(201,168,76,0.04)', border: '1px dashed rgba(201,168,76,0.15)' }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>
              Демо-доступ
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: 12, display: 'block' }}>
              Админ: <code style={{ color: '#C9A84C' }}>admin@w24.agency</code>
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748B', fontSize: 12 }}>
              Любой агент → перенаправит на портал агента
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </Box>
  );
}
