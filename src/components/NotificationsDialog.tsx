import { useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, Button, Chip, CircularProgress,
  IconButton, Tooltip, Divider, Alert,
} from '@mui/material';
import TelegramIcon from '@mui/icons-material/Telegram';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { agentsApi } from '../api/agents';
import { getPushState, enablePush, type PushState } from '../push';
import ConfirmDialog from './ConfirmDialog';

const GOLD = '#C9A84C';

/**
 * Подключение бота/уведомлений для сотрудника (юрист/брокер/листинг-менеджер/админ).
 * Тот же бэкенд, что и в портале агента: привязка Telegram (deep-link) и MAX (по коду).
 * После привязки роль-уведомления (новая заявка / сообщение) приходят в мессенджер.
 */
export default function NotificationsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tg, setTg] = useState<{ linked: boolean; available: boolean; deepLink?: string } | null>(null);
  const [mx, setMx] = useState<{ linked: boolean; available: boolean; botLink?: string; code?: string } | null>(null);
  const [tgLoading, setTgLoading] = useState(true);
  const [mxLoading, setMxLoading] = useState(true);
  const [push, setPush] = useState<PushState>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Подтверждение отвязки: канал (для текста) и функция, выполняющая отвязку.
  const [unlinkFor, setUnlinkFor] = useState<{ channel: string; run: () => Promise<void> } | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const confirmUnlink = async () => {
    if (!unlinkFor) return;
    setUnlinking(true);
    setError(null);
    try {
      await unlinkFor.run();
      setUnlinkFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отвязать мессенджер');
    } finally {
      setUnlinking(false);
    }
  };

  const loadTg = useCallback(() => { agentsApi.telegramLink().then(setTg).catch(() => setTg(null)).finally(() => setTgLoading(false)); }, []);
  const loadMx = useCallback(() => { agentsApi.maxLink().then(setMx).catch(() => setMx(null)).finally(() => setMxLoading(false)); }, []);

  useEffect(() => {
    if (!open) { setError(null); setUnlinkFor(null); return; }
    loadTg(); loadMx(); getPushState().then(setPush).catch(() => setPush('unsupported'));
  }, [open, loadTg, loadMx]);
  // Вернулся из мессенджера (нажал Start / отправил код) — обновляем статус.
  useEffect(() => {
    if (!open) return;
    const onFocus = () => { loadTg(); loadMx(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open, loadTg, loadMx]);

  const enablePushClick = () => { setPushBusy(true); enablePush().then(setPush).catch(() => {}).finally(() => setPushBusy(false)); };
  const copyCode = () => { if (mx?.code) { navigator.clipboard?.writeText(mx.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      slotProps={{ paper: { sx: { background: 'linear-gradient(135deg, #0F1629, #0A0E1A)', border: '1px solid rgba(201,168,76,0.18)', borderRadius: 3 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#F1F5F9' }}>
        <NotificationsActiveRoundedIcon sx={{ color: GOLD }} /> Уведомления и бот
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 2 }}>
          Подключите мессенджер — и новые заявки вашего отдела и сообщения в чате будут приходить туда мгновенно.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Telegram */}
        <Section icon={<TelegramIcon sx={{ color: '#229ED9', fontSize: 20 }} />} title="Telegram" subtitle="Новые заявки и сообщения в чат">
          {tgLoading ? <CircularProgress size={18} sx={{ color: '#229ED9' }} /> : tg?.linked ? (
            <LinkedRow onUnlink={() => setUnlinkFor({ channel: 'Telegram', run: () => agentsApi.telegramUnlink().then(loadTg) })} />
          ) : tg?.available && tg.deepLink ? (
            <Box>
              <Button variant="contained" fullWidth component="a" href={tg.deepLink} target="_blank" rel="noopener noreferrer" startIcon={<TelegramIcon />}
                sx={{ background: 'linear-gradient(135deg, #229ED9, #2AABEE)', color: '#fff', fontWeight: 700 }}>Подключить Telegram</Button>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1 }}>Откроется бот — нажмите «Start», затем вернитесь сюда.</Typography>
            </Box>
          ) : <Typography variant="caption" sx={{ color: '#64748B' }}>Бот недоступен (не настроен токен).</Typography>}
        </Section>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', my: 2 }} />

        {/* MAX */}
        <Section icon={<ChatRoundedIcon sx={{ color: '#8B5CF6', fontSize: 20 }} />} title="MAX" subtitle="То же, в мессенджере MAX">
          {mxLoading ? <CircularProgress size={18} sx={{ color: '#8B5CF6' }} /> : mx?.linked ? (
            <LinkedRow onUnlink={() => setUnlinkFor({ channel: 'MAX', run: () => agentsApi.maxUnlink().then(loadMx) })} />
          ) : mx?.available && mx.botLink ? (
            <Box>
              <Button variant="contained" fullWidth component="a" href={mx.botLink} target="_blank" rel="noopener noreferrer" startIcon={<ChatRoundedIcon />}
                sx={{ background: 'linear-gradient(135deg, #8B5CF6, #6E4AE6)', color: '#fff', fontWeight: 700 }}>Открыть бота MAX</Button>
              <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 2, background: 'rgba(139,92,246,0.06)', border: '1px dashed rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', flex: 1 }}>Отправьте боту код: <b style={{ color: '#C4B5FD', fontFamily: 'monospace' }}>{mx.code}</b></Typography>
                <Tooltip title={copied ? 'Скопировано!' : 'Скопировать'}>
                  <IconButton size="small" onClick={copyCode} sx={{ color: copied ? '#22C55E' : '#64748B' }}>
                    {copied ? <CheckCircleRoundedIcon sx={{ fontSize: 16 }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ) : <Typography variant="caption" sx={{ color: '#64748B' }}>Бот недоступен (не настроен токен).</Typography>}
        </Section>

        <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)', my: 2 }} />

        {/* Web Push */}
        <Section icon={<NotificationsActiveRoundedIcon sx={{ color: GOLD, fontSize: 20 }} />} title="Web Push" subtitle="Прямо в браузер, даже когда панель закрыта">
          {push === 'subscribed' ? (
            <Chip icon={<CheckCircleRoundedIcon sx={{ fontSize: 16 }} />} label="Включено" size="small"
              sx={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700, '& .MuiChip-icon': { color: '#22C55E' } }} />
          ) : push === 'unsupported' ? (
            <Typography variant="caption" sx={{ color: '#64748B' }}>Браузер не поддерживает push.</Typography>
          ) : push === 'server-off' ? (
            <Typography variant="caption" sx={{ color: '#64748B' }}>Push на сервере не настроен.</Typography>
          ) : (
            <Button variant="outlined" disabled={pushBusy} onClick={enablePushClick}
              sx={{ color: GOLD, borderColor: GOLD + '55', textTransform: 'none' }}>
              {pushBusy ? <CircularProgress size={16} sx={{ color: GOLD }} /> : 'Включить Web Push'}
            </Button>
          )}
        </Section>
      </DialogContent>

      <ConfirmDialog
        open={!!unlinkFor}
        title="Отвязать мессенджер?"
        text={unlinkFor ? <>Отвязать {unlinkFor.channel}? Уведомления о заявках перестанут приходить.</> : ''}
        confirmLabel="Отвязать"
        danger
        loading={unlinking}
        onConfirm={confirmUnlink}
        onClose={() => { if (!unlinking) setUnlinkFor(null); }}
      />
    </Dialog>
  );
}

function Section({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 1 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</Box>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{title}</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>{subtitle}</Typography>
        </Box>
      </Box>
      {children}
    </Box>
  );
}

function LinkedRow({ onUnlink }: { onUnlink: () => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
      <Chip icon={<CheckCircleRoundedIcon sx={{ fontSize: 16 }} />} label="Подключено" size="small"
        sx={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700, '& .MuiChip-icon': { color: '#22C55E' } }} />
      <Button size="small" onClick={onUnlink} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>Отвязать</Button>
    </Box>
  );
}
