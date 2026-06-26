import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Chip, Button, CircularProgress, Alert, Stack, useMediaQuery } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import { casesAdminApi, STATUS_RU as CASE_STATUS } from '../api/cases';
import { adRequestsApi, KIND_LABEL } from '../api/adRequests';
import { api } from '../api/apiClient';
import { sseSubscribe } from '../lib/sse';
import { getCurrentUser } from '../auth/auth';
import Thread from '../components/Thread';

const AD_ST: Record<string, string> = { new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена' };
const stColor = (s: string) =>
  ['done', 'approved', 'issued', 'act'].includes(s) ? '#22C55E'
    : ['cancelled', 'rejected'].includes(s) ? '#EF4444'
    : ['new', 'consultation'].includes(s) ? '#94A3B8' : '#4361EE';
// SQLite UTC ('YYYY-MM-DD HH:MM:SS') → мс. Без 'Z' браузер парсит как локальное — добавляем.
const tsMs = (iso?: string) => (iso ? new Date(iso.replace(' ', 'T') + 'Z').getTime() : 0);
// Относительный возраст: «только что / N мин / N ч / N дн».
const ago = (iso?: string) => {
  if (!iso) return '';
  const min = Math.floor((Date.now() - tsMs(iso)) / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 день' : `${d} дн`;
};
// SLA-цвет по времени ожидания (для очереди): зелёный < 4ч, жёлтый < 24ч, красный дальше.
const slaColor = (iso?: string) => {
  if (!iso) return '#64748B';
  const h = (Date.now() - tsMs(iso)) / 3600000;
  return h >= 24 ? '#EF4444' : h >= 4 ? '#F59E0B' : '#22C55E';
};

type Track = 'all' | 'legal' | 'mortgage' | 'ad';

interface Row {
  key: string; kind: 'case' | 'ad'; track: Track; group: 'queue' | 'mine';
  takeId: number; openPath: string; apiBase: string;
  source: string; title: string; sub: string; status: string;
  agent: string; assignee: string; unread: number; updated?: string;
  preview?: string; slaOverdue: boolean;
}

// Элемент серверного инбокса (GET /api/inbox) — cases-задача или рекламная заявка.
interface InboxItem {
  domain: 'case' | 'ad';
  task_id?: number; case_id?: number; track?: 'legal' | 'mortgage';
  client_name?: string; object_address?: string; city?: string;
  id?: number; kind?: string; object_ref?: string; region?: string;
  status: string; agent_name?: string; assignee_name?: string;
  created_at?: string; updated_at?: string; unread?: number;
  last_message?: string | null; last_sender?: string | null; last_message_at?: string | null;
  sla_overdue?: number;
}

const FILTERS: { key: Track; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'legal', label: 'Юрист' },
  { key: 'mortgage', label: 'Ипотека' },
  { key: 'ad', label: 'Реклама' },
];

export default function Inbox() {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width:900px)');
  const user = getCurrentUser();
  const myId = typeof user?.id === 'number' ? user.id : null;

  const [queueItems, setQueueItems] = useState<InboxItem[]>([]);
  const [mineItems, setMineItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Track>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Один серверный агрегат вместо склейки трёх запросов (роль учитывает бэк).
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    api.get<{ queue: InboxItem[]; mine: InboxItem[] }>('/api/inbox')
      .then(d => { setQueueItems(d.queue); setMineItems(d.mine); })
      .catch(e => setError(e?.message || 'Ошибка'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => { if (!document.hidden) load(true); }, 30000);
    // SSE: любое событие тредов (сообщение/взятие/статус) → живой инбокс
    // (с дебаунсом — пачка событий не даёт шквала запросов). Интервал — фоллбэк.
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = sseSubscribe('thread', () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => load(true), 400);
    });
    return () => { clearInterval(iv); off(); if (t) clearTimeout(t); };
  }, [load]);

  const toRow = (it: InboxItem, group: 'queue' | 'mine'): Row => it.domain === 'case' ? {
    key: `c${it.task_id}`, kind: 'case', track: it.track || 'legal', group, takeId: it.task_id!,
    openPath: `/cases?open=${it.case_id}&track=${it.track}`, apiBase: `/cases/${it.case_id}`,
    source: it.track === 'legal' ? 'Юрист' : 'Ипотека', title: it.client_name || 'Заявка',
    sub: it.object_address || it.city || '', status: it.status, agent: it.agent_name || '',
    assignee: it.assignee_name || '', unread: it.unread || 0, updated: it.created_at,
    preview: it.last_message ? `${it.last_sender || 'участник'}: ${it.last_message}` : undefined,
    slaOverdue: !!it.sla_overdue,
  } : {
    key: `a${it.id}`, kind: 'ad', track: 'ad', group, takeId: it.id!,
    openPath: `/ad-requests?open=${it.id}`, apiBase: `/ad-requests/${it.id}`,
    source: 'Реклама', title: KIND_LABEL[it.kind || ''] || 'Заявка в рекламу',
    sub: [it.object_ref, it.region].filter(Boolean).join(' · '), status: it.status, agent: it.agent_name || '',
    assignee: it.assignee_name || '', unread: it.unread || 0, updated: it.created_at,
    preview: it.last_message ? `${it.last_sender || 'участник'}: ${it.last_message}` : undefined,
    slaOverdue: !!it.sla_overdue,
  };

  const byFilter = (r: Row) => filter === 'all' || r.track === filter;
  const queue: Row[] = queueItems.map(it => toRow(it, 'queue')).filter(byFilter);
  const mine: Row[] = mineItems.map(it => toRow(it, 'mine')).filter(byFilter);
  const selected = [...queue, ...mine].find(r => r.key === selectedKey) || null;
  const overdueCount = queue.filter(r => r.slaOverdue).length;

  const take = (r: Row) => {
    const p = r.kind === 'case' ? casesAdminApi.take(r.takeId) : adRequestsApi.take(r.takeId);
    p.then(() => load(true)).catch(e => setError(e?.message || 'Не удалось взять'));
  };

  // Клик по карточке: desktop — открыть справа; мобильный — уйти на полную страницу.
  const openRow = (r: Row) => { isDesktop ? setSelectedKey(r.key) : navigate(r.openPath); };

  const SourceIcon = ({ r }: { r: Row }) => {
    const color = r.kind === 'ad' ? '#C9A84C' : r.source === 'Юрист' ? '#22C55E' : '#8B5CF6';
    const icon = r.kind === 'ad' ? <CampaignRoundedIcon /> : r.source === 'Юрист' ? <GavelRoundedIcon /> : <AccountBalanceRoundedIcon />;
    return <Box sx={{ flexShrink: 0, width: 36, height: 36, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}1f`, color }}>{icon}</Box>;
  };

  const RowCard = ({ r }: { r: Row }) => {
    const active = isDesktop && r.key === selectedKey;
    return (
      <Paper onClick={() => openRow(r)} sx={{
        p: 1.3, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1.3,
        border: active ? '1px solid rgba(201,168,76,0.6)'
          : r.unread > 0 ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(201,168,76,0.1)',
        background: active ? 'rgba(201,168,76,0.08)' : undefined,
        // Очередь горит: левый акцент по SLA (зелёный/жёлтый/красный по времени ожидания).
        borderLeft: r.group === 'queue' ? `3px solid ${slaColor(r.updated)}` : undefined,
        transition: 'all .15s', '&:hover': { borderColor: 'rgba(201,168,76,0.4)' },
      }}>
        <SourceIcon r={r} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
            <Chip label={r.source} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, background: 'rgba(148,163,184,0.15)', color: '#94A3B8' }} />
            {r.slaOverdue && <Chip label="SLA" size="small" sx={{ height: 18, fontSize: 9.5, fontWeight: 800, background: 'rgba(239,68,68,0.18)', color: '#EF4444' }} />}
            <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</Typography>
          </Stack>
          {r.sub && <Typography variant="caption" sx={{ color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.sub}</Typography>}
          {r.preview && (
            <Typography variant="caption" sx={{ color: r.unread > 0 ? '#E2E8F0' : '#94A3B8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: 'italic' }}>
              {r.preview}
            </Typography>
          )}
          <Typography variant="caption" sx={{ color: r.group === 'queue' ? slaColor(r.updated) : '#475569', fontWeight: r.group === 'queue' ? 700 : 400 }}>{r.agent && `${r.agent} · `}{ago(r.updated)}</Typography>
        </Box>
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.8 }}>
          {r.unread > 0 && <Box sx={{ minWidth: 20, height: 20, px: 0.6, borderRadius: 10, background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{r.unread}</Box>}
          {r.group === 'queue' && (
            <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); take(r); }}
              sx={{ minWidth: 0, px: 1.2, background: '#C9A84C', color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Взять</Button>
          )}
        </Box>
      </Paper>
    );
  };

  // Правая панель (desktop): заголовок + действия + единый чат заявки.
  const DetailPane = ({ r }: { r: Row }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Chip label={r.source} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, background: 'rgba(148,163,184,0.15)', color: '#94A3B8' }} />
          <Chip label={(CASE_STATUS[r.status] || AD_ST[r.status] || r.status)} size="small" sx={{ background: `${stColor(r.status)}22`, color: stColor(r.status), fontWeight: 700 }} />
          {r.slaOverdue && <Chip label="просрочено SLA" size="small" sx={{ background: 'rgba(239,68,68,0.18)', color: '#EF4444', fontWeight: 700 }} />}
          <Box sx={{ flex: 1 }} />
          {r.group === 'queue' && (
            <Button size="small" variant="contained" onClick={() => take(r)}
              sx={{ background: '#C9A84C', color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Взять в работу</Button>
          )}
          <Button size="small" variant="outlined" endIcon={<OpenInNewRoundedIcon />} onClick={() => navigate(r.openPath)}
            sx={{ color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)', textTransform: 'none' }}>Полностью</Button>
        </Stack>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9', lineHeight: 1.2 }}>{r.title}</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          {[r.sub, r.agent && `агент ${r.agent}`, r.assignee ? `исполнитель ${r.assignee}` : 'не взята'].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <Thread apiBase={r.apiBase} myId={myId} myRole={user?.role} fillHeight privateFiles={r.apiBase.startsWith('/cases/')} />
      </Box>
    </Box>
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;

  const ListColumn = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...(isDesktop ? { overflowY: 'auto', pr: 0.5 } : {}) }}>
      <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 1.2 }}>
          Очередь — взять в работу ({queue.length}){overdueCount > 0 && <Box component="span" sx={{ color: '#EF4444', ml: 1, fontSize: 13 }}>· {overdueCount} просрочено</Box>}
        </Typography>
        {queue.length === 0
          ? <Typography variant="body2" sx={{ color: '#64748B', py: 1 }}>Очередь пуста — всё разобрано.</Typography>
          : <Stack spacing={1}>{queue.map(r => <RowCard key={r.key} r={r} />)}</Stack>}
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 1.2 }}>
          В работе у меня ({mine.length})
        </Typography>
        {mine.length === 0
          ? <Typography variant="body2" sx={{ color: '#64748B', py: 1 }}>Активных задач в работе нет.</Typography>
          : <Stack spacing={1}>{mine.map(r => <RowCard key={r.key} r={r} />)}</Stack>}
      </Paper>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, ...(isDesktop ? { height: 'calc(100vh - 150px)' } : {}) }}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Инбокс задач</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Очередь и ваши задачи по всем дорожкам в одном месте. Обновляется автоматически.
        </Typography>
      </Box>

      <Stack direction="row" spacing={1}>
        {FILTERS.map(f => (
          <Chip key={f.key} label={f.label} onClick={() => setFilter(f.key)}
            sx={{ fontWeight: 700, cursor: 'pointer',
              background: filter === f.key ? '#C9A84C' : 'rgba(148,163,184,0.12)',
              color: filter === f.key ? '#0A0E1A' : '#94A3B8' }} />
        ))}
      </Stack>

      {isDesktop ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '400px 1fr', gap: 2 }}>
          {ListColumn}
          <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {selected
              ? <DetailPane r={selected} />
              : <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 1 }}>
                  <ForumRoundedIcon sx={{ fontSize: 40, opacity: 0.5 }} />
                  <Typography variant="body2">Выберите заявку слева — чат и действия откроются здесь</Typography>
                </Box>}
          </Paper>
        </Box>
      ) : ListColumn}
    </Box>
  );
}
