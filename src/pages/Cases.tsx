import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress, Alert,
  Tabs, Tab, Stack, Divider, MenuItem, Select, FormControl, TextField,
  Dialog, DialogTitle, DialogContent, IconButton, Link,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import {
  casesAdminApi, type QueueTask, type TaskTrack, type CaseItem,
  TYPE_LABEL, STATUS_RU, TRACK_STATUSES,
} from '../api/cases';
import { getCurrentUser } from '../auth/auth';
import { API_BASE_URL, getToken } from '../api/apiClient';
import CaseChat from '../components/CaseChat';
import CaseStatusStepper from '../components/CaseStatusStepper';
import CaseFinance from '../components/CaseFinance';
import CasesAnalytics from '../components/CasesAnalytics';

function statusColor(status: string): string {
  switch (status) {
    case 'done': case 'approved': case 'issued': return '#22C55E';
    case 'cancelled': case 'rejected': return '#EF4444';
    case 'in_progress': case 'approval': case 'consultation': return '#F59E0B';
    default: return '#64748B';
  }
}

// Дата ДД.ММ.ГГ из строки SQLite (UTC).
function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
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

// Загрузка файла в Yandex Storage через /api/upload (как в портале).
async function uploadFile(file: File): Promise<{ url: string; name: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', 'doc');
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) throw new Error('Не удалось загрузить файл');
  const data = await res.json();
  return { url: data.url, name: file.name, size: file.size };
}

export default function Cases() {
  const user = getCurrentUser();
  const role = user?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';
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

  // Фильтры списка.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<'active' | 'done' | 'stale' | 'all'>('active');
  const [specialistFilter, setSpecialistFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'new' | 'stale'>('new');

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

  const openDetail = (caseId: number) => {
    setDetailLoading(true);
    casesAdminApi.get(caseId)
      .then(setDetail)
      .catch(e => setError(e?.message || 'Не удалось открыть заявку'))
      .finally(() => setDetailLoading(false));
  };

  const handleTake = (taskId: number) => {
    casesAdminApi.take(taskId).then(() => { load(); }).catch(e => setError(e?.message || 'Не удалось взять задачу'));
  };
  const handleStatus = (taskId: number, status: string) => {
    casesAdminApi.updateTask(taskId, { status }).then(updated => {
      load();
      if (detail) setDetail(updated);
    }).catch(e => setError(e?.message || 'Не удалось обновить'));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detail) return;
    setUploading(true);
    try {
      const meta = await uploadFile(file);
      const updated = await casesAdminApi.addAttachment(detail.id, meta);
      setDetail(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = (attId: number) => {
    if (!detail) return;
    casesAdminApi.deleteAttachment(detail.id, attId).then(setDetail).catch(() => { /* tolerate */ });
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
            <Button size="small" onClick={() => openDetail(t.case_id)} sx={{ color: '#94A3B8', textTransform: 'none' }}>Открыть</Button>
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
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <TextField
          size="small" placeholder="Поиск: клиент, объект, город…"
          value={search} onChange={e => setSearch(e.target.value)}
          sx={{ flex: '1 1 260px', minWidth: 200 }}
          slotProps={{ input: { startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: '#64748B', mr: 1 }} /> } }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={typeFilter} displayEmpty onChange={e => setTypeFilter(e.target.value)}>
            <MenuItem value="all">Все типы</MenuItem>
            {typeOptions.map(k => <MenuItem key={k} value={k}>{TYPE_LABEL[k]}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <Select value={statusFilter} displayEmpty onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="all">Все этапы</MenuItem>
            {statusOptions.map(s => <MenuItem key={s} value={s}>{STATUS_RU[s] || s}</MenuItem>)}
          </Select>
        </FormControl>
        {tab === 'assigned' && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select value={stateFilter} onChange={e => setStateFilter(e.target.value as typeof stateFilter)}>
              <MenuItem value="active">Активные</MenuItem>
              <MenuItem value="done">Завершённые</MenuItem>
              <MenuItem value="stale">Зависшие &gt;7 дн</MenuItem>
              <MenuItem value="all">Все</MenuItem>
            </Select>
          </FormControl>
        )}
        {specialists.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select value={specialistFilter} onChange={e => setSpecialistFilter(e.target.value)}>
              <MenuItem value="all">Все специалисты</MenuItem>
              {specialists.map(([id, name]) => <MenuItem key={id} value={String(id)}>{name}</MenuItem>)}
            </Select>
          </FormControl>
        )}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <MenuItem value="new">Сначала новые</MenuItem>
            <MenuItem value="stale">Сначала зависшие</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ color: '#64748B' }}>Найдено: {list.length}</Typography>
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
      <Dialog open={!!detail || detailLoading} onClose={() => setDetail(null)} fullWidth maxWidth="sm"
        slotProps={{ paper: { sx: { background: 'linear-gradient(135deg, #0F1629, #0A0E1A)', border: '1px solid rgba(201,168,76,0.15)' } } }}>
        {detailLoading || !detail ? (
          <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
        ) : (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{detail.client_name}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  Заявка от {detail.agent_name || 'агента'} · {new Date(detail.created_at).toLocaleDateString('ru-RU')}
                </Typography>
              </Box>
              <IconButton onClick={() => setDetail(null)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
            </DialogTitle>
            <DialogContent>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
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
                        </Box>
                        {t.assignee_id && (
                          <CaseStatusStepper track={t.track} status={t.status} onChange={(s) => handleStatus(t.id, s)} />
                        )}
                        {/* Финансы сделки — для юр-задач у исполнителя (с этапа «Сделка») */}
                        {t.assignee_id && t.track === 'legal' && (
                          <CaseFinance caseId={detail.id} task={t} onSaved={() => openDetail(detail.id)} />
                        )}
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Вложения */}
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>Файлы</Typography>
                    <Button component="label" size="small" disabled={uploading} startIcon={uploading ? <CircularProgress size={14} /> : <AttachFileRoundedIcon />} sx={{ color: '#C9A84C', textTransform: 'none' }}>
                      Прикрепить
                      <input type="file" hidden onChange={handleUpload} />
                    </Button>
                  </Box>
                  {detail.attachments.length === 0 ? (
                    <Typography variant="caption" sx={{ color: '#64748B' }}>Файлов пока нет.</Typography>
                  ) : (
                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                      {detail.attachments.map(at => (
                        <Box key={at.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1.5, background: 'rgba(255,255,255,0.03)' }}>
                          <DescriptionRoundedIcon sx={{ fontSize: 18, color: '#94A3B8' }} />
                          <Link href={at.url} target="_blank" rel="noopener" sx={{ color: '#E2C97E', flex: 1, fontSize: 13, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                            {at.name}
                          </Link>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>{at.uploader_name}</Typography>
                          <IconButton size="small" onClick={() => handleDeleteAttachment(at.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Box>

                <Divider sx={{ borderColor: 'rgba(201,168,76,0.08)' }} />

                {/* Чат заявки */}
                <Box>
                  <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em', display: 'block', mb: 1 }}>Обсуждение</Typography>
                  <CaseChat caseId={detail.id} myId={getCurrentUser()?.id ?? null} />
                </Box>
              </Stack>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
