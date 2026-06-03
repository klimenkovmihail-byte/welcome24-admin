import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Chip, Button, CircularProgress, Alert, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import { casesAdminApi, STATUS_RU as CASE_STATUS, type QueueTask } from '../api/cases';
import { adRequestsApi, type AdRequest } from '../api/adRequests';
import { getCurrentUser } from '../auth/auth';

const AD_ST: Record<string, string> = { new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена' };
const stColor = (s: string) =>
  ['done', 'approved', 'issued', 'act'].includes(s) ? '#22C55E'
    : ['cancelled', 'rejected'].includes(s) ? '#EF4444'
    : ['new', 'consultation'].includes(s) ? '#94A3B8' : '#4361EE';
const age = (iso?: string) => {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'сегодня' : d === 1 ? '1 день' : `${d} дн`;
};

interface Row {
  key: string; kind: 'case' | 'ad'; group: 'queue' | 'mine'; takeId: number; openPath: string;
  source: string; title: string; sub: string; status: string; agent: string; unread: number; updated?: string;
}

export default function Inbox() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const role = String(user?.role || '');
  const myId = typeof user?.id === 'number' ? user.id : -1;
  const canSeeCases = ['super_admin', 'admin', 'lawyer', 'broker'].includes(role);
  const canSeeAds = ['super_admin', 'admin', 'listing_manager'].includes(role);

  const [caseQueue, setCaseQueue] = useState<QueueTask[]>([]);
  const [caseMine, setCaseMine] = useState<QueueTask[]>([]);
  const [ads, setAds] = useState<AdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const jobs: Promise<void>[] = [];
    if (canSeeCases) {
      jobs.push(casesAdminApi.queue().then(setCaseQueue).catch(() => {}));
      jobs.push(casesAdminApi.assigned().then(setCaseMine).catch(() => {}));
    }
    if (canSeeAds) {
      jobs.push(adRequestsApi.list().then(setAds).catch(() => {}));
    }
    Promise.all(jobs).catch(e => setError(e?.message || 'Ошибка')).finally(() => setLoading(false));
  }, [canSeeCases, canSeeAds]);

  useEffect(() => {
    load();
    const iv = setInterval(() => { if (!document.hidden) load(true); }, 30000);
    return () => clearInterval(iv);
  }, [load]);

  const adQueue = ads.filter(a => !a.assignee_id && (a.status === 'new' || a.status === 'in_progress'));
  const adMine = ads.filter(a => a.assignee_id === myId && a.status !== 'done' && a.status !== 'cancelled');

  const caseRow = (t: QueueTask, group: 'queue' | 'mine'): Row => ({
    key: `c${t.task_id}`, kind: 'case', group, takeId: t.task_id, openPath: '/cases',
    source: t.track === 'legal' ? 'Юрист' : 'Ипотека', title: t.client_name || 'Заявка',
    sub: t.object_address || t.city || '', status: t.status, agent: t.agent_name || '',
    unread: t.unread || 0, updated: t.created_at,
  });
  const adRow = (a: AdRequest, group: 'queue' | 'mine'): Row => ({
    key: `a${a.id}`, kind: 'ad', group, takeId: a.id, openPath: '/ad-requests',
    source: 'Реклама', title: a.kind_label || 'Заявка в рекламу',
    sub: [a.object_ref, a.region].filter(Boolean).join(' · '), status: a.status, agent: a.agent_name || '',
    unread: a.unread || 0, updated: a.created_at,
  });

  const queue: Row[] = [...caseQueue.map(t => caseRow(t, 'queue')), ...adQueue.map(a => adRow(a, 'queue'))]
    .sort((x, y) => (x.updated || '').localeCompare(y.updated || '')); // старые сверху — горят
  const mine: Row[] = [...caseMine.map(t => caseRow(t, 'mine')), ...adMine.map(a => adRow(a, 'mine'))]
    .sort((x, y) => (y.updated || '').localeCompare(x.updated || ''));

  const take = (r: Row) => {
    const p = r.kind === 'case' ? casesAdminApi.take(r.takeId) : adRequestsApi.take(r.takeId);
    p.then(() => load(true)).catch(e => setError(e?.message || 'Не удалось взять'));
  };

  const SourceIcon = ({ r }: { r: Row }) => {
    const color = r.kind === 'ad' ? '#C9A84C' : r.source === 'Юрист' ? '#22C55E' : '#8B5CF6';
    const icon = r.kind === 'ad' ? <CampaignRoundedIcon /> : r.source === 'Юрист' ? <GavelRoundedIcon /> : <AccountBalanceRoundedIcon />;
    return <Box sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1f`, color }}>{icon}</Box>;
  };

  const RowCard = ({ r }: { r: Row }) => (
    <Paper onClick={() => navigate(r.openPath)} sx={{
      p: 1.5, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.5,
      border: r.unread > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(201,168,76,0.1)',
      transition: 'all .2s', '&:hover': { borderColor: 'rgba(201,168,76,0.4)' },
    }}>
      <SourceIcon r={r} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Chip label={r.source} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, background: 'rgba(148,163,184,0.15)', color: '#94A3B8' }} />
          <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</Typography>
        </Stack>
        {r.sub && <Typography variant="caption" sx={{ color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</Typography>}
        <Typography variant="caption" sx={{ color: '#475569' }}>{r.agent && `${r.agent} · `}{age(r.updated)}</Typography>
      </Box>
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        {r.unread > 0 && <Box sx={{ minWidth: 22, height: 22, px: 0.6, borderRadius: 11, background: '#EF4444', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.unread}</Box>}
        <Chip label={(CASE_STATUS[r.status] || AD_ST[r.status] || r.status)} size="small" sx={{ background: `${stColor(r.status)}22`, color: stColor(r.status), fontWeight: 700 }} />
        {r.group === 'queue' && (
          <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); take(r); }}
            sx={{ background: '#C9A84C', color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Взять</Button>
        )}
      </Box>
    </Paper>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Инбокс задач</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Очередь и ваши задачи по всем дорожкам в одном месте. Обновляется автоматически.
        </Typography>
      </Box>

      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 1.5 }}>
          Очередь — взять в работу ({queue.length})
        </Typography>
        {queue.length === 0
          ? <Typography variant="body2" sx={{ color: '#64748B', py: 2 }}>Очередь пуста — всё разобрано.</Typography>
          : <Stack spacing={1.2}>{queue.map(r => <RowCard key={r.key} r={r} />)}</Stack>}
      </Paper>

      <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 1.5 }}>
          В работе у меня ({mine.length})
        </Typography>
        {mine.length === 0
          ? <Typography variant="body2" sx={{ color: '#64748B', py: 2 }}>Активных задач в работе нет.</Typography>
          : <Stack spacing={1.2}>{mine.map(r => <RowCard key={r.key} r={r} />)}</Stack>}
      </Paper>
    </Box>
  );
}
