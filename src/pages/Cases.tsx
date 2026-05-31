import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress, Alert,
  Tabs, Tab, Stack, Divider, MenuItem, Select, FormControl,
} from '@mui/material';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import {
  casesAdminApi, type QueueTask, type TaskTrack,
  TYPE_LABEL, STATUS_RU, TRACK_STATUSES,
} from '../api/cases';
import { getCurrentUser } from '../auth/auth';

function statusColor(status: string): string {
  switch (status) {
    case 'done': case 'approved': case 'issued': return '#22C55E';
    case 'cancelled': case 'rejected': return '#EF4444';
    case 'in_progress': case 'approval': case 'consultation': return '#F59E0B';
    default: return '#64748B';
  }
}

const trackIcon = (track: string) =>
  track === 'mortgage'
    ? <AccountBalanceRoundedIcon sx={{ fontSize: 18, color: '#8B5CF6' }} />
    : <GavelRoundedIcon sx={{ fontSize: 18, color: '#C9A84C' }} />;

export default function Cases() {
  const user = getCurrentUser();
  const role = user?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';
  // Для админа — переключатель дорожки; для специалиста дорожка фиксирована бэком.
  const [adminTrack, setAdminTrack] = useState<TaskTrack>('legal');

  const [tab, setTab] = useState<'queue' | 'assigned'>('queue');
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [assigned, setAssigned] = useState<QueueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      casesAdminApi.queue(isAdmin ? adminTrack : undefined).catch(() => []),
      casesAdminApi.assigned().catch(() => []),
    ])
      .then(([q, a]) => { setQueue(q); setAssigned(a); })
      .catch(e => setError(e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [isAdmin, adminTrack]);

  useEffect(() => { load(); }, [load]);

  const handleTake = (taskId: number) => {
    casesAdminApi.take(taskId).then(load).catch(e => setError(e?.message || 'Не удалось взять задачу'));
  };
  const handleStatus = (taskId: number, status: string) => {
    casesAdminApi.updateTask(taskId, { status }).then(load).catch(e => setError(e?.message || 'Не удалось обновить'));
  };

  const renderTask = (t: QueueTask, mode: 'queue' | 'assigned') => (
    <Card key={t.task_id} sx={{ mb: 1.5 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
            {trackIcon(t.track)}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                {TYPE_LABEL[t.type] || t.type}
              </Typography>
              <Typography variant="body2" sx={{ color: '#F1F5F9' }}>{t.client_name}</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                {[t.object_address, t.city].filter(Boolean).join(' · ') || 'объект не указан'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={STATUS_RU[t.status] || t.status} size="small"
              sx={{ background: `${statusColor(t.status)}22`, color: statusColor(t.status), fontWeight: 700 }} />
            {mode === 'queue' ? (
              <Button size="small" variant="contained" onClick={() => handleTake(t.task_id)}
                sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 700 }}>
                Взять в работу
              </Button>
            ) : (
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <Select value={t.status} onChange={e => handleStatus(t.task_id, e.target.value)}>
                  {TRACK_STATUSES[t.track].map(s => (
                    <MenuItem key={s} value={s}>{STATUS_RU[s] || s}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  const list = tab === 'queue' ? queue : assigned;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Заявки специалистам</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Возьмите заявку в работу и ведите статусы. Уведомления агенту приходят автоматически.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ '& .MuiTab-root': { color: '#64748B', fontWeight: 700 }, '& .Mui-selected': { color: '#C9A84C !important' }, '& .MuiTabs-indicator': { background: '#C9A84C' } }}>
          <Tab value="queue" label={`Очередь (${queue.length})`} />
          <Tab value="assigned" label={`Мои задачи (${assigned.length})`} />
        </Tabs>
        {isAdmin && tab === 'queue' && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <Select value={adminTrack} onChange={e => setAdminTrack(e.target.value as TaskTrack)}>
              <MenuItem value="legal">Юридические</MenuItem>
              <MenuItem value="mortgage">Ипотека</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>

      <Divider sx={{ mb: 2, borderColor: 'rgba(201,168,76,0.08)' }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : list.length === 0 ? (
        <Card><CardContent sx={{ py: 6, textAlign: 'center' }}>
          <Typography sx={{ color: '#64748B' }}>
            {tab === 'queue' ? 'В очереди пока нет заявок.' : 'У вас нет задач в работе.'}
          </Typography>
        </CardContent></Card>
      ) : (
        <Stack>{list.map(t => renderTask(t, tab))}</Stack>
      )}
    </Box>
  );
}
