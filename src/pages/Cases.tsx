import { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress, Alert,
  Tabs, Tab, Stack, Divider, MenuItem, Select, FormControl, TextField,
  Dialog, DialogTitle, DialogContent, IconButton, Link, Badge, Tooltip,
  Menu, Autocomplete, Avatar, InputAdornment, useMediaQuery, useTheme,
} from '@mui/material';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import {
  casesAdminApi, type QueueTask, type TaskTrack, type CaseItem,
  TYPE_LABEL, STATUS_RU, TRACK_STATUSES,
} from '../api/cases';
import { getCurrentUser } from '../auth/auth';
import DealParticipants from '../components/DealParticipants';
import ConfirmDialog from '../components/ConfirmDialog';
import { uploadCaseAttachment, openCaseAttachment } from '../lib/attachments';
import Thread from '../components/Thread';
import CaseStatusStepper from '../components/CaseStatusStepper';
import CaseFinance from '../components/CaseFinance';
import CasesAnalytics from '../components/CasesAnalytics';
import CaseTimeline from '../components/CaseTimeline';
import { useAgents } from '../hooks/useAgents';
import { plural, formatDateTime } from '../utils/format';
import type { Agent } from '../types';
import type { Role } from '../auth/roles';

function statusColor(status: string): string {
  switch (status) {
    case 'done': case 'approved': case 'issued': return '#22C55E';
    case 'cancelled': case 'rejected': return '#EF4444';
    case 'in_progress': case 'approval': case 'consultation': return '#F59E0B';
    default: return '#64748B';
  }
}

// Дата+время из строки SQLite (UTC) через единый форматтер: «05.07.2026 14:32».
const fmtDate = (s?: string): string => formatDateTime(s) || '—';
// «Зависла»: в работе и без движения > 7 дней.
function isStale(t: { status: string; updated_at?: string; assignee_id?: number | null }): boolean {
  const closed = ['done', 'cancelled', 'issued', 'rejected'].includes(t.status);
  if (closed || !t.assignee_id || !t.updated_at) return false;
  const last = new Date(t.updated_at.replace(' ', 'T') + 'Z').getTime();
  return Date.now() - last > 7 * 86400000;
}
const CLOSED_STATUSES = ['done', 'cancelled', 'issued', 'rejected'];

const trackIcon = (track: string) =>
  track === 'mortgage'
    ? <AccountBalanceRoundedIcon sx={{ fontSize: 18, color: '#8B5CF6' }} />
    : <GavelRoundedIcon sx={{ fontSize: 18, color: '#C9A84C' }} />;

// Поле доли участника в %. Коммит по blur/Enter, иначе сетевой вызов на каждый символ.
function ShareField({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n >= 0 && n <= 100 && n !== value) onCommit(n);
    else setV(String(value));
  };
  return (
    <TextField value={v} onChange={e => setV(e.target.value.replace(/[^\d]/g, ''))} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
      size="small" sx={{ width: 78, '& input': { py: 0.5, textAlign: 'right' } }}
      InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
  );
}

export default function Cases() {
  const user = getCurrentUser();
  const role = user?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';
  const theme = useTheme();
  // Детальный диалог заявки на телефоне — во весь экран (CEO смотрит заявки с телефона).
  const fsXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isSuperAdmin = role === 'super_admin';
  const [adminTrack, setAdminTrack] = useState<TaskTrack>('legal');

  const [tab, setTab] = useState<'queue' | 'assigned' | 'analytics'>('queue');
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [assigned, setAssigned] = useState<QueueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Детальный диалог заявки.
  const [detail, setDetail] = useState<CaseItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0); // инкремент → перезагрузка таймлайна
  // На телефоне (xs) детали и чат заявки — раздельными вкладками (иначе чат в самом
  // низу длинной простыни). На планшете+ обе колонки видны рядом, вкладки скрыты.
  const [detailTab, setDetailTab] = useState<'details' | 'chat'>('details');

  // Фильтры списка.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<'active' | 'done' | 'stale' | 'all'>('active');
  const [specialistFilter, setSpecialistFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'new' | 'stale'>('new');
  // На телефоне (xs) селекты-фильтры прячем за кнопку «Фильтры (N)», оставляя только поиск.
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Список агентов (для добавления второго агента и передачи задачи специалисту).
  const { data: allAgents = [] } = useAgents(); // общий кэш — один фетч на все экраны
  const roleOf = (a: Agent) => (a as Agent & { role?: Role }).role || 'agent';
  // Передача задачи: меню выбора специалиста той же дорожки.
  const [transfer, setTransfer] = useState<{ anchor: HTMLElement; taskId: number; track: TaskTrack } | null>(null);
  // Подтверждения (themed вместо window.confirm): удаление файла и снятие агента.
  const [confirmDelFile, setConfirmDelFile] = useState<{ id: number; name: string } | null>(null);
  const [confirmRemoveAgent, setConfirmRemoveAgent] = useState<{ id: number; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const handleTransfer = (taskId: number, agentId: number) => {
    setTransfer(null);
    casesAdminApi.updateTask(taskId, { assigneeId: agentId })
      .then(u => { if (detail) setDetail(u); load(); bumpTimeline(); })
      .catch(e => setError(e?.message || 'Не удалось передать задачу'));
  };
  const handleAddParticipant = (agentId: number) => {
    if (!detail) return;
    casesAdminApi.addParticipant(detail.id, agentId)
      .then(u => { setDetail(u); bumpTimeline(); })
      .catch(e => setError(e?.message || 'Не удалось добавить агента'));
  };
  const handleShare = (agentId: number, sharePct: number) => {
    if (!detail) return;
    casesAdminApi.updateParticipantShare(detail.id, agentId, sharePct)
      .then(u => { setDetail(u); bumpTimeline(); })
      .catch(e => setError(e?.message || 'Не удалось изменить долю'));
  };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      casesAdminApi.queue(isAdmin ? adminTrack : undefined),
      casesAdminApi.assigned(),
    ])
      .then(([q, a]) => { setQueue(q); setAssigned(a); })
      .catch(e => setError(e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [isAdmin, adminTrack]);

  useEffect(() => { load(); }, [load]);

  const openDetail = (caseId: number) => {
    setDetailLoading(true);
    setDetailTab('details'); // новую заявку открываем на вкладке деталей
    casesAdminApi.get(caseId)
      .then(setDetail)
      .catch(e => {
        // 404 = заявку удалили, а карточка в списке устарела. Понятное сообщение
        // + обновляем список, чтобы «мёртвая» карточка исчезла (а не сырое "not found").
        if (e?.status === 404) { setError('Заявка не найдена — возможно, она была удалена. Список обновлён.'); load(); }
        else setError(e?.message || 'Не удалось открыть заявку');
      })
      .finally(() => setDetailLoading(false));
    // Отмечаем заявку прочитанной (сбрасываем бейдж) при открытии. Счётчик
    // непрочитанных обнуляем локально в списке — без полной перезагрузки со
    // спиннером (иначе весь список мигает при каждом открытии заявки).
    const clearUnread = (t: QueueTask) => (t.case_id === caseId ? { ...t, unread: 0 } : t);
    casesAdminApi.markRead(caseId)
      .then(() => { setQueue(prev => prev.map(clearUnread)); setAssigned(prev => prev.map(clearUnread)); })
      .catch(() => {});
  };

  // Deep-link из бота/пуша/колокола: /cases?open=<id>&track=<legal|mortgage> → открыть заявку.
  const location = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get('open'));
    const track = params.get('track');
    if (isAdmin && (track === 'legal' || track === 'mortgage')) setAdminTrack(track);
    if (id) openDetail(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const bumpTimeline = () => setTimelineKey(k => k + 1);
  const handleTake = (taskId: number) => {
    casesAdminApi.take(taskId).then(u => { load(); if (detail) setDetail(u); bumpTimeline(); }).catch(e => setError(e?.message || 'Не удалось взять задачу'));
  };
  const handleStatus = (taskId: number, status: string) => {
    casesAdminApi.updateTask(taskId, { status }).then(updated => {
      load();
      if (detail) setDetail(updated);
      bumpTimeline();
    }).catch(e => setError(e?.message || 'Не удалось обновить'));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !detail) return;
    setUploading(true);
    try {
      // Последовательно (как в DealParticipants): каждый ответ — свежая заявка.
      let cur = detail;
      for (const f of files) cur = await uploadCaseAttachment(detail.id, f);
      setDetail(cur);
      bumpTimeline();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteCase = (caseId: number, clientName: string) => {
    if (!window.confirm(`Удалить заявку «${clientName}» полностью? Будут удалены все задачи, чат, файлы и история. Действие необратимо.\n(Проведённая сделка в разделе «Сделки» останется.)`)) return;
    casesAdminApi.remove(caseId).then(() => { setDetail(null); load(); }).catch(e => setError(e?.message || 'Не удалось удалить заявку'));
  };

  const handleDeleteAttachment = () => {
    if (!detail || !confirmDelFile) return;
    setConfirmBusy(true);
    casesAdminApi.deleteAttachment(detail.id, confirmDelFile.id)
      .then(u => { setDetail(u); setConfirmDelFile(null); bumpTimeline(); })
      .catch(e => setError(e?.message || 'Не удалось удалить файл'))
      .finally(() => setConfirmBusy(false));
  };

  const handleConfirmRemoveAgent = () => {
    if (!detail || !confirmRemoveAgent) return;
    setConfirmBusy(true);
    casesAdminApi.removeParticipant(detail.id, confirmRemoveAgent.id)
      .then(u => { setDetail(u); setConfirmRemoveAgent(null); bumpTimeline(); })
      .catch(e => setError(e?.message || 'Не удалось убрать агента'))
      .finally(() => setConfirmBusy(false));
  };

  const renderTask = (t: QueueTask, mode: 'queue' | 'assigned') => {
    const stale = isStale(t);
    return (
    <Card key={t.task_id} sx={{ mb: 1.5, cursor: 'pointer',
      border: stale ? '1px solid rgba(239,68,68,0.45)' : undefined,
      '&:hover': { borderColor: stale ? '#EF4444' : 'rgba(201,168,76,0.3)' } }}
      onClick={() => openDetail(t.case_id)}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
            {trackIcon(t.track)}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{TYPE_LABEL[t.type] || t.type}</Typography>
              <Typography variant="body2" sx={{ color: '#F1F5F9' }}>{t.client_name}</Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                {[t.object_address, t.city].filter(Boolean).join(' · ') || 'объект не указан'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.3 }}>
                {t.agent_name ? `Агент: ${t.agent_name} · ` : ''}создана {fmtDate(t.created_at)}
                {t.updated_at && t.updated_at !== t.created_at ? ` · движение ${fmtDate(t.updated_at)}` : ''}
                {stale && <Box component="span" sx={{ color: '#EF4444', fontWeight: 700 }}> · зависла</Box>}
              </Typography>
              {mode === 'assigned' && isAdmin && t.assignee_name && (
                <Typography variant="caption" sx={{ color: '#8B5CF6', display: 'block' }}>Исполнитель: {t.assignee_name}</Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
            {mode === 'queue' ? (
              <Button size="small" variant="contained" onClick={() => handleTake(t.task_id)}
                sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 700 }}>
                Взять в работу
              </Button>
            ) : (
              <Chip label={STATUS_RU[t.status] || t.status} size="small"
                sx={{ background: `${statusColor(t.status)}22`, color: statusColor(t.status), fontWeight: 700 }} />
            )}
            <Badge badgeContent={t.unread || 0} color="error" sx={{ '& .MuiBadge-badge': { fontWeight: 800 } }}>
              <Button size="small" onClick={() => openDetail(t.case_id)} sx={{ color: t.unread ? '#C9A84C' : '#94A3B8', textTransform: 'none', fontWeight: t.unread ? 700 : 400 }}>
                {t.unread ? 'Новое сообщение' : 'Открыть'}
              </Button>
            </Badge>
          </Box>
        </Box>

        {/* Этапы (как Trello): клик двигает задачу вправо к завершению */}
        {mode === 'assigned' && (
          <Box sx={{ mt: 1.5 }} onClick={e => e.stopPropagation()}>
            <CaseStatusStepper track={t.track} status={t.status} onChange={(s) => handleStatus(t.task_id, s)} />
          </Box>
        )}
      </CardContent>
    </Card>
  ); };

  const rawList = tab === 'queue' ? queue : assigned;
  const q = search.trim().toLowerCase();
  // Список специалистов для фильтра (только в «Мои задачи» у админа).
  const specialists = isAdmin && tab === 'assigned'
    ? [...new Map(assigned.filter(t => t.assignee_id).map(t => [t.assignee_id, t.assignee_name || '—'])).entries()]
    : [];
  const list = rawList.filter(t => {
    const matchQ = !q || t.client_name.toLowerCase().includes(q)
      || (t.object_address || '').toLowerCase().includes(q)
      || (t.city || '').toLowerCase().includes(q)
      || (t.agent_name || '').toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchType = typeFilter === 'all' || t.type === typeFilter;
    const closed = CLOSED_STATUSES.includes(t.status);
    const matchState = tab !== 'assigned' || stateFilter === 'all'
      || (stateFilter === 'active' && !closed)
      || (stateFilter === 'done' && closed)
      || (stateFilter === 'stale' && isStale(t));
    const matchSpec = specialistFilter === 'all' || String(t.assignee_id) === specialistFilter;
    return matchQ && matchStatus && matchType && matchState && matchSpec;
  }).sort((a, b) => {
    if (sortBy === 'stale') {
      // Сначала зависшие, потом по давности движения (старые сверху).
      const sa = isStale(a) ? 1 : 0, sb = isStale(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return (a.updated_at || '').localeCompare(b.updated_at || '');
    }
    return (b.created_at || '').localeCompare(a.created_at || ''); // новые сверху
  });
  // Число активных фильтров (для бейджа кнопки «Фильтры» на телефоне): считаем
  // сужающие от дефолта — стартовое состояние не должно давать бейдж.
  const activeFilters = [
    typeFilter !== 'all',
    statusFilter !== 'all',
    tab === 'assigned' && stateFilter !== 'active',
    specialistFilter !== 'all',
    sortBy !== 'new',
  ].filter(Boolean).length;
  // Статусы для фильтра — из текущей дорожки (для админа — выбранная, иначе обе).
  const filterTracks: TaskTrack[] = isAdmin ? [adminTrack] : ['legal', 'mortgage'];
  const statusOptions = [...new Set(filterTracks.flatMap(tr => TRACK_STATUSES[tr]))];
  const typeOptions = (Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[])
    .filter(k => filterTracks.includes(k === 'mortgage' ? 'mortgage' : 'legal'));

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Заявки специалистам</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Откройте заявку, прочитайте описание, прикрепите файлы и ведите статусы. Уведомления агенту — автоматически.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}
          sx={{ '& .MuiTab-root': { color: '#64748B', fontWeight: 700 }, '& .Mui-selected': { color: '#C9A84C !important' }, '& .MuiTabs-indicator': { background: '#C9A84C' } }}>
          <Tab value="queue" label={`Очередь (${queue.length})`} />
          <Tab value="assigned" label={`Мои задачи (${assigned.length})`} />
          <Tab value="analytics" label="Аналитика" />
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

      {/* Фильтры и поиск (скрыты на вкладке аналитики) */}
      {tab !== 'analytics' && (
      <Box sx={{ mb: 2 }}>
        {/* Строка поиска + кнопка «Фильтры» (кнопка видна только на телефоне) */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            size="small" placeholder="Поиск: клиент, объект, город…"
            value={search} onChange={e => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 0 }}
            slotProps={{ input: {
              startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: '#64748B', mr: 1 }} />,
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" aria-label="Очистить поиск" onClick={() => setSearch('')} sx={{ color: '#64748B' }}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : undefined,
            } }}
          />
          <Button variant="outlined" size="small" startIcon={<FilterListRoundedIcon />}
            onClick={() => setFiltersOpen(o => !o)}
            sx={{ display: { xs: 'inline-flex', sm: 'none' }, flexShrink: 0, color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)', textTransform: 'none' }}>
            Фильтры{activeFilters ? ` (${activeFilters})` : ''}
          </Button>
        </Box>
        {/* Селекты: на телефоне раскрываются кнопкой, на планшете+ всегда видны */}
        <Box sx={{ display: { xs: filtersOpen ? 'flex' : 'none', sm: 'flex' }, gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mt: 1.5 }}>
          <FormControl size="small" sx={{ minWidth: 150, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
            <Select value={typeFilter} displayEmpty onChange={e => setTypeFilter(e.target.value)}>
              <MenuItem value="all">Все типы</MenuItem>
              {typeOptions.map(k => <MenuItem key={k} value={k}>{TYPE_LABEL[k]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
            <Select value={statusFilter} displayEmpty onChange={e => setStatusFilter(e.target.value)}>
              <MenuItem value="all">Все этапы</MenuItem>
              {statusOptions.map(s => <MenuItem key={s} value={s}>{STATUS_RU[s] || s}</MenuItem>)}
            </Select>
          </FormControl>
          {tab === 'assigned' && (
            <FormControl size="small" sx={{ minWidth: 150, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
              <Select value={stateFilter} onChange={e => setStateFilter(e.target.value as typeof stateFilter)}>
                <MenuItem value="active">Активные</MenuItem>
                <MenuItem value="done">Завершённые</MenuItem>
                <MenuItem value="stale">Зависшие &gt;7 дн</MenuItem>
                <MenuItem value="all">Все</MenuItem>
              </Select>
            </FormControl>
          )}
          {specialists.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 170, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
              <Select value={specialistFilter} onChange={e => setSpecialistFilter(e.target.value)}>
                <MenuItem value="all">Все специалисты</MenuItem>
                {specialists.map(([id, name]) => <MenuItem key={id} value={String(id)}>{name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl size="small" sx={{ minWidth: 150, flex: { xs: '1 1 45%', sm: '0 0 auto' } }}>
            <Select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
              <MenuItem value="new">Сначала новые</MenuItem>
              <MenuItem value="stale">Сначала зависшие</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Найдено: {list.length} {plural(list.length, 'заявка', 'заявки', 'заявок')}
          </Typography>
        </Box>
      </Box>
      )}

      <Divider sx={{ mb: 2, borderColor: 'rgba(201,168,76,0.08)' }} />

      {tab === 'analytics' ? (
        <CasesAnalytics />
      ) : loading ? (
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

      {/* Детальный диалог заявки */}
      <Dialog open={!!detail || detailLoading} onClose={() => { setDetail(null); load(); }} fullWidth maxWidth="lg" fullScreen={fsXs}
        slotProps={{ paper: { sx: { background: 'linear-gradient(135deg, #0F1629, #0A0E1A)', border: fsXs ? 'none' : '1px solid rgba(201,168,76,0.15)', height: { md: '88vh' }, pt: fsXs ? 'env(safe-area-inset-top)' : 0, pb: fsXs ? 'env(safe-area-inset-bottom)' : 0 } } }}>
        {detailLoading || !detail ? (
          <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
        ) : (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              {/* minWidth:0 — длинные ФИО/дата переносятся, а не подлезают под иконки. */}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9', overflowWrap: 'anywhere' }}>{detail.client_name}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                  Заявка от {detail.agent_name || 'агента'} · {fmtDate(detail.created_at)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                {(isSuperAdmin || (getCurrentUser()?.role === 'broker' && detail.tasks.some(t => t.assignee_id === getCurrentUser()?.id))) && (
                  <Tooltip title="Удалить заявку полностью">
                    <IconButton onClick={() => handleDeleteCase(detail.id, detail.client_name)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                      <DeleteOutlineRoundedIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton onClick={() => { setDetail(null); load(); }} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
              </Box>
            </DialogTitle>
            {/* Вкладки Детали/Обсуждение — только на телефоне (на планшете+ обе колонки видны рядом) */}
            <Tabs value={detailTab} onChange={(_, v) => setDetailTab(v)} variant="fullWidth"
              sx={{ display: { xs: 'flex', md: 'none' }, minHeight: 40, borderBottom: '1px solid rgba(201,168,76,0.08)',
                '& .MuiTab-root': { minHeight: 40, color: '#64748B', fontWeight: 700, textTransform: 'none' },
                '& .Mui-selected': { color: '#C9A84C !important' }, '& .MuiTabs-indicator': { background: '#C9A84C' } }}>
              <Tab value="details" label="Детали" />
              <Tab value="chat" label="Обсуждение" />
            </Tabs>
            <DialogContent dividers sx={{ borderColor: 'rgba(201,168,76,0.08)', p: 0, overflow: { xs: 'auto', md: 'hidden' }, height: { md: 'calc(88vh - 80px)' } }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, height: { xs: 'auto', md: '100%' } }}>
              {/* ЛЕВАЯ колонка — детали/задачи/файлы/таймлайн (скроллится).
                  На телефоне видна только на вкладке «Детали». */}
              <Box sx={{ display: { xs: detailTab === 'details' ? 'block' : 'none', md: 'block' }, overflowY: { xs: 'visible', md: 'auto' }, p: { xs: 2, md: 3 }, borderRight: { md: '1px solid rgba(201,168,76,0.08)' } }}>
              <Stack spacing={2.5}>
                {/* Объект */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Объект</Typography>
                  <Typography variant="body2" sx={{ color: '#F1F5F9' }}>
                    {[detail.object_address, detail.city].filter(Boolean).join(', ') || '—'}
                  </Typography>
                </Box>

                {/* Описание от агента */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Описание от агента</Typography>
                  <Typography variant="body2" sx={{ color: detail.note ? '#E2E8F0' : '#64748B', whiteSpace: 'pre-wrap', mt: 0.5 }}>
                    {detail.note || 'Без описания'}
                  </Typography>
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Задачи */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Задачи</Typography>
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {detail.tasks.map(t => (
                      <Box key={t.id} sx={{ p: 1.2, borderRadius: 1.5, background: 'rgba(255,255,255,0.02)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: t.assignee_id ? 1 : 0 }}>
                          {trackIcon(t.track)}
                          <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600, flex: '1 1 auto' }}>{TYPE_LABEL[t.type] || t.type}</Typography>
                          {!t.assignee_id && (
                            <Button size="small" variant="contained" onClick={() => handleTake(t.id)}
                              sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 700 }}>
                              Взять
                            </Button>
                          )}
                          {t.assignee_id && (
                            <Button size="small" variant="outlined"
                              startIcon={<SwapHorizRoundedIcon sx={{ fontSize: 16 }} />}
                              onClick={e => setTransfer({ anchor: e.currentTarget, taskId: t.id, track: t.track })}
                              sx={{ color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)', textTransform: 'none', fontSize: 12, py: 0.2,
                                '&:hover': { borderColor: '#8B5CF6', background: 'rgba(139,92,246,0.08)' } }}>
                              Передать
                            </Button>
                          )}
                        </Box>
                        {t.assignee_id && (
                          <CaseStatusStepper track={t.track} status={t.status} onChange={(s) => handleStatus(t.id, s)} />
                        )}
                        {/* Финансы сделки — для юр-задач у исполнителя (с этапа «Сделка») */}
                        {t.assignee_id && t.track === 'legal' && (
                          <CaseFinance caseId={detail.id} task={t} caseCity={detail.city} onSaved={() => { openDetail(detail.id); bumpTimeline(); }} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Агенты по заявке (создатель + доп. для совместной сделки) + доли комиссии */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Агенты по заявке</Typography>
                  {(() => {
                    const ps = detail.participants || [];
                    const sumP = ps.reduce((s, p) => s + Number(p.share_pct || 0), 0);
                    const mainShare = Math.max(0, 100 - sumP);
                    const joint = ps.length > 0;
                    const over = sumP > 100;
                    return (
                      <>
                        <Stack spacing={0.8} sx={{ mt: 0.8 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip size="small" avatar={<Avatar sx={{ bgcolor: 'rgba(201,168,76,0.2)', color: '#C9A84C', fontSize: 11 }}>{(detail.agent_name || 'А')[0]}</Avatar>}
                              label={`${detail.agent_name || 'агент'} · создатель`}
                              sx={{ background: 'rgba(201,168,76,0.12)', color: '#E2C97E', fontWeight: 600 }} />
                            {joint && <Chip size="small" label={`${mainShare}%`}
                              sx={{ background: over ? 'rgba(239,68,68,0.15)' : 'rgba(201,168,76,0.18)', color: over ? '#FCA5A5' : '#E2C97E', fontWeight: 700 }} />}
                          </Box>
                          {ps.map(p => (
                            <Box key={p.agent_id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip size="small" label={p.agent_name || `агент #${p.agent_id}`}
                                onDelete={() => setConfirmRemoveAgent({ id: p.agent_id, name: p.agent_name || `агент #${p.agent_id}` })}
                                sx={{ background: 'rgba(67,97,238,0.12)', color: '#93B4FF' }} />
                              <ShareField value={Number(p.share_pct || 0)} onCommit={v => handleShare(p.agent_id, v)} />
                            </Box>
                          ))}
                        </Stack>
                        {joint && (
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.6, color: over ? '#FCA5A5' : '#64748B' }}>
                            {over
                              ? `Сумма долей участников ${sumP}% превышает 100% — уменьшите.`
                              : 'Комиссия делится по долям; каждый агент — по своему % уровня. Доля растит его уровень и MLM.'}
                          </Typography>
                        )}
                      </>
                    );
                  })()}
                  <Autocomplete
                    size="small" sx={{ mt: 1, maxWidth: 340 }}
                    options={allAgents.filter(a => roleOf(a) === 'agent' && a.id !== detail.agent_id && !(detail.participants || []).some(p => p.agent_id === a.id))}
                    getOptionLabel={a => a.name}
                    value={null} blurOnSelect clearOnBlur
                    onChange={(_, v) => { if (v) handleAddParticipant(v.id); }}
                    renderInput={params => <TextField {...params} label={fsXs ? 'Добавить агента' : 'Добавить агента (совместная сделка)'} placeholder="ФИО агента" helperText={fsXs ? 'Совместная сделка' : undefined} />}
                  />
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Ипотека: документы по участникам сделки (вид брокера) */}
                {detail.tasks.some(t => t.track === 'mortgage') && (
                  <>
                    <DealParticipants caseItem={detail}
                      myId={getCurrentUser()?.id ?? null}
                      isAdmin={['admin', 'super_admin'].includes(getCurrentUser()?.role ?? '')}
                      onChanged={(c) => setDetail(c)} />
                    <Divider sx={{ borderColor: 'rgba(139,92,246,0.12)' }} />
                  </>
                )}

                {/* Вложения */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Файлы</Typography>
                    <Button component="label" size="small" disabled={uploading} startIcon={uploading ? <CircularProgress size={14} /> : <AttachFileRoundedIcon />} sx={{ color: '#C9A84C', textTransform: 'none' }}>
                      Прикрепить
                      <input type="file" hidden multiple onChange={handleUpload} />
                    </Button>
                  </Box>
                  {(detail.attachments || []).filter(a => a.participant_id == null).length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#64748B' }}>Файлов пока нет.</Typography>
                  ) : (
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {(detail.attachments || []).filter(a => a.participant_id == null).map(at => (
                        <Box key={at.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, background: 'rgba(255,255,255,0.03)' }}>
                          <DescriptionRoundedIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
                          <Link component="button" type="button"
                            onClick={() => { openCaseAttachment(detail.id, at).catch(e => setError(e instanceof Error ? e.message : 'Не удалось открыть файл')); }}
                            sx={{ color: '#E2C97E', flex: 1, fontSize: 13, textAlign: 'left', textDecoration: 'none', background: 'none', border: 0, cursor: 'pointer', p: 0, '&:hover': { textDecoration: 'underline' } }}>
                            {at.name}
                          </Link>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>{at.uploader_name}</Typography>
                          <IconButton size="small" onClick={() => setConfirmDelFile({ id: at.id, name: at.name })} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Таймлайн событий */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1 }}>История</Typography>
                  <CaseTimeline caseId={detail.id} refreshKey={timelineKey} />
                </Box>
              </Stack>
              </Box>

              {/* ПРАВАЯ колонка — чат во всю высоту. На телефоне видна только на вкладке
                  «Обсуждение»; на планшете+ грид-ячейка авто-высоты, поэтому задаём явную
                  minHeight, иначе fillHeight (height:100%) схлопывается в 0 и поле ввода исчезает. */}
              <Box sx={{ display: { xs: detailTab === 'chat' ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', p: 2, minHeight: 0 }}>
                <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' }, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', mb: 1 }}>Обсуждение</Typography>
                <Box sx={{ flex: 1, minHeight: { xs: 420, md: 0 } }}>
                  <Thread apiBase={`/cases/${detail.id}`} myId={getCurrentUser()?.id ?? null} myRole={getCurrentUser()?.role} fillHeight privateFiles />
                </Box>
              </Box>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Меню передачи задачи: специалисты дорожки + админы (кто может вести заявки), кроме текущего */}
      <Menu anchorEl={transfer?.anchor} open={!!transfer} onClose={() => setTransfer(null)}>
        {transfer && (() => {
          const trackRole = transfer.track === 'legal' ? 'lawyer' : 'broker';
          const trackLabel = transfer.track === 'legal' ? 'юрист' : 'брокер';
          const curAssignee = detail?.tasks.find(t => t.id === transfer.taskId)?.assignee_id;
          const candidates = allAgents.filter(a => {
            const r = roleOf(a);
            return (r === trackRole || r === 'admin' || r === 'super_admin') && a.id !== curAssignee;
          });
          if (!candidates.length) return <MenuItem disabled>Нет других {trackLabel}ов / админов</MenuItem>;
          return candidates.map(a => {
            const r = roleOf(a);
            const tag = r === trackRole ? trackLabel : (r === 'super_admin' ? 'супер-админ' : 'админ');
            return (
              <MenuItem key={a.id} onClick={() => handleTransfer(transfer.taskId, a.id)}>
                {a.name}
                <Typography component="span" variant="caption" sx={{ color: '#64748B', ml: 1 }}>· {tag}</Typography>
              </MenuItem>
            );
          });
        })()}
      </Menu>

      {/* Подтверждение удаления файла заявки */}
      <ConfirmDialog
        open={!!confirmDelFile}
        title="Удалить файл?"
        text={confirmDelFile ? <>Удалить файл «{confirmDelFile.name}»? Действие необратимо.</> : undefined}
        confirmLabel="Удалить"
        danger
        loading={confirmBusy}
        onConfirm={handleDeleteAttachment}
        onClose={() => setConfirmDelFile(null)}
      />

      {/* Подтверждение снятия агента-участника */}
      <ConfirmDialog
        open={!!confirmRemoveAgent}
        title="Убрать агента из заявки?"
        text={confirmRemoveAgent ? <>Убрать {confirmRemoveAgent.name} из заявки? Его доля вернётся создателю.</> : undefined}
        confirmLabel="Убрать"
        danger
        loading={confirmBusy}
        onConfirm={handleConfirmRemoveAgent}
        onClose={() => setConfirmRemoveAgent(null)}
      />
    </Box>
  );
}
