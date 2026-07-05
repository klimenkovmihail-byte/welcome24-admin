import { useEffect, useState } from 'react';
import { Box, Button, IconButton, Typography, CircularProgress, Collapse, Snackbar, Alert } from '@mui/material';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { getPushState, enablePush } from '../push';

const DISMISS_KEY = 'w24_admin_push_dismissed';

/** Баннер «Включить уведомления?» для админки — появляется через 2.5с,
 *  если push можно предложить и его раньше не отклоняли. */
export default function PushBanner() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const state = await getPushState().catch(() => 'unsupported' as const);
      if (!cancelled && state === 'default') setShow(true);
    }, 2500);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setShow(false); };
  const handleEnable = async () => {
    setBusy(true);
    const state = await enablePush().catch(() => 'default' as const);
    setBusy(false);
    if (state === 'subscribed') {
      localStorage.setItem(DISMISS_KEY, '1');
      setShow(false);
      return;
    }
    // denied — разрешение заблокировано; остальное (отмена/ошибка/сервер) — общая причина.
    setSnack(state === 'denied'
      ? 'Не удалось включить: уведомления заблокированы в настройках браузера'
      : 'Не удалось включить уведомления. Попробуйте ещё раз.');
  };

  return (
    <>
    <Collapse in={show}>
      <Box sx={{
        mb: 3, p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        background: 'linear-gradient(135deg, rgba(201,168,76,0.14), rgba(201,168,76,0.05))',
        border: '1px solid rgba(201,168,76,0.25)',
      }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, background: 'rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <NotificationsActiveRoundedIcon sx={{ color: '#C9A84C' }} />
        </Box>
        <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Включить уведомления?</Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            Новые заявки и сообщения по сделкам будут приходить на это устройство.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Button size="small" onClick={dismiss} sx={{ color: '#64748B' }}>Позже</Button>
          <Button size="small" variant="contained" disabled={busy} onClick={handleEnable}
            startIcon={busy ? <CircularProgress size={14} sx={{ color: '#0A0E1A' }} /> : undefined}
            sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 700 }}>
            Включить
          </Button>
          <IconButton size="small" onClick={dismiss} sx={{ color: '#64748B' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
    </Collapse>
    <Snackbar
      open={!!snack}
      autoHideDuration={6000}
      onClose={() => setSnack(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity="warning" variant="filled" onClose={() => setSnack(null)} sx={{ width: '100%' }}>
        {snack}
      </Alert>
    </Snackbar>
    </>
  );
}
