import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, CircularProgress, Alert,
  Tabs, Tab, Stack, Divider, MenuItem, Select, FormControl, TextField, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Switch, Tooltip, Badge,
  Table, TableHead, TableRow, TableCell, TableBody, InputAdornment, Link,
} from '@mui/material';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import {
  adRequestsApi, type AdRequest, type AdStatus, type AdMessage, type AdEvent,
  type RosterAgent, type PlatformStats, type AdAnalytics, type ConnectPlatform,
  KIND_LABEL, AD_STATUS_RU, PLATFORM_LABEL,
} from '../api/adRequests';
import {
  adPackagesApi, downloadDriveXlsx, PLATFORMS, PKG_PLATFORM_LABEL,
  type Platform, type Drive, type DriveSummary, type AdCategory,
} from '../api/adPackages';
import { getCurrentUser } from '../auth/auth';
import { API_BASE_URL, getToken } from '../api/apiClient';

const GOLD = '#C9A84C';
// Цвет участника чата по роли (агент золото, юрист зелёный, брокер фиолет,
// листинг-менеджер циан, админ синий).
const ROLE_COLOR: Record<string, string> = {
  agent: '#C9A84C', lawyer: '#22C55E', broker: '#8B5CF6',
  listing_manager: '#06B6D4', admin: '#4361EE', super_admin: '#4361EE', manager: '#4361EE',
};
const roleColor = (r?: string | null) => ROLE_COLOR[r || ''] || '#94A3B8';
const money = (n: number) => Number(n || 0).toLocaleString('ru-RU');
function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
function fmtDateTime(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function statusColor(s: AdStatus): string {
  return s === 'done' ? '#22C55E' : s === 'cancelled' ? '#EF4444' : s === 'in_progress' ? GOLD : '#64748B';
}
async function uploadFile(file: File): Promise<{ url: string; name: string; size: number }> {
  const fd = new FormData();
  fd.append('file', file); fd.append('type', 'doc');
  const res = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
  if (!res.ok) throw new Error('Не удалось загрузить файл');
  const data = await res.json();
  return { url: data.url, name: file.name, size: file.size };
}

const cardSx = { background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 3 } as const;

export default function AdRequests() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <CampaignRoundedIcon sx={{ color: GOLD, fontSize: 30 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Отдел рекламы</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Заявки на рекламу объектов · сбор пакетов · база подключений</Typography>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2, '& .MuiTab-root': { color: '#94A3B8', fontWeight: 700, textTransform: 'none' }, '& .Mui-selected': { color: GOLD + ' !important' }, '& .MuiTabs-indicator': { background: GOLD } }}>
        <Tab label="Реклама объектов" />
        <Tab label="Прикрепление к площадкам" />
        <Tab label="Сбор пакета" />
        <Tab label="Прайс-лист" />
        <Tab label="База подключений" />
      </Tabs>

      {tab === 0 && <RequestsTab kinds={['quota', 'fix']} />}
      {tab === 1 && <RequestsTab kinds={['connect']} />}
      {tab === 2 && <PackagesTab />}
      {tab === 3 && <PriceListTab />}
      {tab === 4 && <ConnectionsTab />}
    </Box>
  );
}

/* ============ ВКЛАДКА: ЗАЯВКИ (объектные / прикрепление — по kinds) ============ */
function RequestsTab({ kinds }: { kinds: AdKind[] }) {
  const [items, setItems] = useState<AdRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | AdStatus | 'all'>('active');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<AdRequest | null>(null);
  const kindsKey = kinds.join(',');

  // silent — без спиннера (для фонового поллинга).
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    adRequestsApi.list(kindsKey.split(',') as AdKind[]).then(setItems)
      .catch(e => setError(e?.message || 'Ошибка'))
      .finally(() => { if (!silent) setLoading(false); });
  }, [kindsKey]);
  // Поллинг каждые 20с — новые заявки появляются без перезагрузки.
  useEffect(() => { load(); const iv = setInterval(() => load(true), 20000); return () => clearInterval(iv); }, [load]);

  // Счётчики — из загруженного (отфильтрованного по kinds) списка.
  const analytics = {
    total: items.length,
    queue: items.filter(r => !r.assignee_id && r.status !== 'done' && r.status !== 'cancelled').length,
    in_progress: items.filter(r => r.status === 'in_progress').length,
    done: items.filter(r => r.status === 'done').length,
  };

  const term = q.trim().toLowerCase();
  const filtered = items.filter(r => {
    const statusOk = statusFilter === 'all' ? true
      : statusFilter === 'active' ? (r.status === 'new' || r.status === 'in_progress')
      : r.status === statusFilter;
    const searchOk = !term
      || (r.agent_name || '').toLowerCase().includes(term)
      || (r.object_ref || '').toLowerCase().includes(term)
      || (r.region || '').toLowerCase().includes(term)
      || (r.kind_label || '').toLowerCase().includes(term);
    return statusOk && searchOk;
  });

  // Тихий load (без спиннера) — иначе список размонтируется и скролл прыгает наверх (#4).
  const take = (id: number) => adRequestsApi.take(id).then(() => load(true)).catch(e => setError(e?.message));
  const setStatus = (id: number, status: AdStatus) => adRequestsApi.update(id, { status }).then(() => load(true)).catch(e => setError(e?.message));

  if (loading) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress sx={{ color: GOLD }} /></Box>;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {(
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <StatChip label="Всего" value={analytics.total} />
          <StatChip label="В очереди" value={analytics.queue} color="#F59E0B" />
          <StatChip label="В работе" value={analytics.in_progress} color={GOLD} />
          <StatChip label="Готово" value={analytics.done} color="#22C55E" />
        </Stack>
      )}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <TextField size="small" placeholder="Поиск: агент / объект / регион" value={q} onChange={e => setQ(e.target.value)}
          sx={{ minWidth: 240, flex: 1, '.MuiOutlinedInput-root': { color: '#E2E8F0' }, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' } }} />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            sx={{ color: '#E2E8F0', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' } }}>
            <MenuItem value="active">Активные</MenuItem>
            <MenuItem value="new">Новые</MenuItem>
            <MenuItem value="in_progress">В работе</MenuItem>
            <MenuItem value="done">Готово</MenuItem>
            <MenuItem value="cancelled">Отменённые</MenuItem>
            <MenuItem value="all">Все</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={1.2}>
        {filtered.length === 0 && <Typography sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>Заявок нет</Typography>}
        {filtered.map(r => (
          <Card key={r.id} sx={{ ...cardSx, cursor: 'pointer', '&:hover': { borderColor: 'rgba(201,168,76,0.3)' } }} onClick={() => setDetail(r)}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Badge color="error" variant="dot" invisible={!r.unread}>
                  <Chip label={r.kind_label || KIND_LABEL[r.kind]} size="small" sx={{ background: 'rgba(201,168,76,0.15)', color: GOLD, fontWeight: 700 }} />
                </Badge>
                {r.object_ref && <Typography sx={{ color: '#E2E8F0', fontWeight: 600 }}>{r.object_ref}</Typography>}
                {r.region && <Typography sx={{ color: '#94A3B8', fontSize: 14 }}>{r.region}</Typography>}
                <Stack direction="row" spacing={0.5}>
                  {r.platforms.map(p => <Chip key={p} label={PLATFORM_LABEL[p]} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, color: '#94A3B8', borderColor: 'rgba(148,163,184,0.3)' }} />)}
                </Stack>
                <Box sx={{ flex: 1 }} />
                <Tooltip title="Последнее действие по заявке">
                  <Typography sx={{ color: '#CBD5E1', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtDateTime(r.updated_at || r.created_at)}</Typography>
                </Tooltip>
                <Typography sx={{ color: '#64748B', fontSize: 12 }}>{r.agent_name}</Typography>
                <Chip label={AD_STATUS_RU[r.status]} size="small" sx={{ background: statusColor(r.status) + '22', color: statusColor(r.status), fontWeight: 700 }} />
                {!r.assignee_id ? (
                  <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); take(r.id); }}
                    sx={{ background: GOLD, color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Взять</Button>
                ) : (
                  <Tooltip title={`Исполнитель: ${r.assignee_name}`}><Chip label={r.assignee_name} size="small" sx={{ background: 'rgba(148,163,184,0.15)', color: '#CBD5E1' }} /></Tooltip>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {detail && <RequestDetail request={detail} onClose={() => { setDetail(null); load(true); }} onChanged={() => load(true)} setStatus={setStatus} take={take} />}
    </Box>
  );
}

function StatChip({ label, value, color = '#94A3B8' }: { label: string; value: number; color?: string }) {
  return (
    <Card sx={{ ...cardSx, minWidth: 110 }}>
      <CardContent sx={{ py: 1, px: 2, '&:last-child': { pb: 1 } }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, color }}>{value}</Typography>
        <Typography sx={{ fontSize: 11, color: '#64748B' }}>{label}</Typography>
      </CardContent>
    </Card>
  );
}

/* ---- Детальный диалог заявки: инфо + таймлайн + чат ---- */
function RequestDetail({ request, onClose, onChanged, setStatus, take }: {
  request: AdRequest; onClose: () => void; onChanged: () => void;
  setStatus: (id: number, s: AdStatus) => void; take: (id: number) => void;
}) {
  const [r, setR] = useState(request);
  const [messages, setMessages] = useState<AdMessage[]>([]);
  const [events, setEvents] = useState<AdEvent[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const user = getCurrentUser();

  const reload = useCallback(() => {
    adRequestsApi.get(r.id).then(setR).catch(() => {});
    adRequestsApi.messages(r.id).then(setMessages).catch(() => {});
    adRequestsApi.events(r.id).then(setEvents).catch(() => {});
  }, [r.id]);
  useEffect(() => { reload(); adRequestsApi.markRead(r.id).catch(() => {}); }, [reload, r.id]);
  // Поллинг чата — новые сообщения подтягиваются без переоткрытия.
  useEffect(() => {
    const iv = setInterval(() => { adRequestsApi.messages(r.id).then(setMessages).catch(() => {}); }, 4000);
    return () => clearInterval(iv);
  }, [r.id]);
  // Автоскролл вниз при новых сообщениях.
  // Автоскролл вниз — только при первом открытии или новом сообщении, и только если
  // пользователь уже внизу. Если он прокрутил вверх (читает историю) — не дёргаем.
  const chatRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const first = prevCount.current === 0;
    const grew = messages.length > prevCount.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (first || (grew && nearBottom)) el.scrollTop = el.scrollHeight;
    prevCount.current = messages.length;
  }, [messages]);

  const [uploading, setUploading] = useState(false);
  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const up = await uploadFile(file); await adRequestsApi.sendMessage(r.id, { attachmentUrl: up.url, attachmentName: up.name }); reload(); }
    catch { /* tolerate */ } finally { setUploading(false); e.target.value = ''; }
  };
  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await adRequestsApi.sendMessage(r.id, { body: text.trim() }); setText(''); reload(); }
    finally { setSending(false); }
  };
  const doStatus = (s: AdStatus) => { setStatus(r.id, s); setTimeout(() => { reload(); onChanged(); }, 300); };
  const removeRequest = async () => {
    if (!window.confirm('Удалить заявку безвозвратно? Чат и история будут стёрты.')) return;
    try { await adRequestsApi.remove(r.id); onChanged(); onClose(); }
    catch { window.alert('Не удалось удалить заявку'); }
  };

  const STATUS_FLOW: AdStatus[] = ['new', 'in_progress', 'done', 'cancelled'];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { background: '#0B1120', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3 } }}>
      <DialogTitle sx={{ color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 1 }}>
        {r.kind_label || KIND_LABEL[r.kind]}
        <Chip label={AD_STATUS_RU[r.status]} size="small" sx={{ background: statusColor(r.status) + '22', color: statusColor(r.status), fontWeight: 700 }} />
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {/* Левая колонка — инфо + действия + таймлайн */}
          <Box sx={{ flex: 1 }}>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              <Info label="Агент" value={r.agent_name || '—'} />
              {r.object_ref && <Info label="Объект" value={r.object_ref} />}
              {r.region && <Info label="Регион" value={r.region} />}
              <Info label="Подана" value={fmtDateTime(r.created_at)} />
              {r.platforms.length > 0 && <Info label="Площадки" value={r.platforms.map(p => PLATFORM_LABEL[p]).join(', ')} />}
              {r.comment && <Info label="Комментарий" value={r.comment} />}
              <Info label="Исполнитель" value={r.assignee_name || 'не взята'} />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
              {!r.assignee_id && <Button size="small" variant="contained" onClick={() => { take(r.id); setTimeout(reload, 300); }} sx={{ background: GOLD, color: '#0A0E1A', fontWeight: 700 }}>Взять в работу</Button>}
              {STATUS_FLOW.filter(s => s !== r.status).map(s => (
                <Button key={s} size="small" variant="outlined" onClick={() => doStatus(s)}
                  sx={{ color: statusColor(s), borderColor: statusColor(s) + '55', textTransform: 'none' }}>{AD_STATUS_RU[s]}</Button>
              ))}
              {user?.role === 'super_admin' && (
                <Button size="small" startIcon={<DeleteOutlineRoundedIcon />} onClick={removeRequest}
                  sx={{ color: '#EF4444', textTransform: 'none', ml: 'auto' }}>Удалить</Button>
              )}
            </Stack>

            {events.length > 0 && (
              <Box>
                <Typography sx={{ color: '#64748B', fontSize: 12, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Таймлайн</Typography>
                <Stack spacing={0.5}>
                  {events.map(e => (
                    <Typography key={e.id} sx={{ color: '#94A3B8', fontSize: 12.5 }}>
                      <span style={{ color: '#475569' }}>{fmtDateTime(e.created_at)}</span> · {e.text}
                      {e.actor_name && <span style={{ color: GOLD, fontWeight: 600 }}> — {e.actor_name}</span>}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>

          {/* Правая колонка — чат */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
            <Typography sx={{ color: '#64748B', fontSize: 12, mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Чат с агентом</Typography>
            <Box ref={chatRef} sx={{ flex: 1, overflowY: 'auto', maxHeight: 320, background: 'rgba(2,6,23,0.5)', borderRadius: 2, p: 1.5, mb: 1 }}>
              {messages.length === 0 && <Typography sx={{ color: '#475569', fontSize: 13, textAlign: 'center', py: 2 }}>Сообщений нет</Typography>}
              {messages.map(m => {
                const mine = m.sender_id === user?.id;
                const c = roleColor(m.sender_role);
                return (
                  <Box key={m.id} sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', mb: 0.8 }}>
                    <Box sx={{ maxWidth: '80%', background: c + '2E', border: `1px solid ${c}44`, borderRadius: 2, px: 1.3, py: 0.7 }}>
                      {!mine && <Typography sx={{ color: c, fontSize: 11, fontWeight: 700 }}>{m.sender_name}</Typography>}
                      {m.body && <Typography sx={{ color: '#E2E8F0', fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{m.body}</Typography>}
                      {m.attachment_url && (
                        <Link href={m.attachment_url} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: '#E2C97E', fontSize: 13, textDecoration: 'none', mt: 0.3, '&:hover': { textDecoration: 'underline' } }}>
                          <AttachFileRoundedIcon sx={{ fontSize: 14 }} /> {m.attachment_name || 'файл'}
                        </Link>
                      )}
                      <Typography sx={{ color: '#475569', fontSize: 10, textAlign: 'right' }}>{fmtDate(m.created_at)}</Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Прикрепить файл (чек, скрин)">
                <IconButton component="label" disabled={uploading} sx={{ color: '#94A3B8', '&:hover': { color: GOLD } }}>
                  {uploading ? <CircularProgress size={18} sx={{ color: GOLD }} /> : <AttachFileRoundedIcon />}
                  <input type="file" hidden onChange={handleAttach} />
                </IconButton>
              </Tooltip>
              <TextField size="small" fullWidth placeholder="Сообщение…" value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                sx={{ '& .MuiOutlinedInput-root': { color: '#E2E8F0', '& fieldset': { borderColor: 'rgba(201,168,76,0.2)' } } }} />
              <IconButton onClick={send} disabled={sending || !text.trim()} sx={{ color: GOLD }}><SendRoundedIcon /></IconButton>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return <Typography sx={{ fontSize: 13.5, color: '#94A3B8' }}><span style={{ color: '#64748B' }}>{label}:</span> <span style={{ color: '#E2E8F0' }}>{value}</span></Typography>;
}

/* ============ ВКЛАДКА: СБОР ПАКЕТА ============ */
function PackagesTab() {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>('cian');
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adPackagesApi.drives().then(setDrives).catch(e => setError(e?.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = () => {
    if (!title.trim()) return;
    adPackagesApi.createDrive({ platform, title: title.trim(), deadline: deadline || undefined })
      .then(() => { setCreateOpen(false); setTitle(''); setDeadline(''); load(); })
      .catch(e => setError(e?.message));
  };

  if (loading) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress sx={{ color: GOLD }} /></Box>;
  if (openId) return <DriveDetail id={openId} onBack={() => { setOpenId(null); load(); }} />;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={() => setCreateOpen(true)} sx={{ mb: 2, background: GOLD, color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Открыть сбор</Button>

      <Stack spacing={1.2}>
        {drives.length === 0 && <Typography sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>Сборов нет</Typography>}
        {drives.map(d => (
          <Card key={d.id} sx={{ ...cardSx, cursor: 'pointer', '&:hover': { borderColor: 'rgba(201,168,76,0.3)' } }} onClick={() => setOpenId(d.id)}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip label={d.platform_label} size="small" sx={{ background: 'rgba(201,168,76,0.15)', color: GOLD, fontWeight: 700 }} />
                <Typography sx={{ color: '#F1F5F9', fontWeight: 700 }}>{d.title}</Typography>
                <Chip label={d.status === 'open' ? 'Открыт' : d.status === 'closed' ? 'Закрыт' : 'Оплачен'} size="small"
                  sx={{ background: (d.status === 'open' ? '#22C55E' : '#64748B') + '22', color: d.status === 'open' ? '#22C55E' : '#94A3B8', fontWeight: 700 }} />
                {d.deadline && <Typography sx={{ color: '#94A3B8', fontSize: 13 }}>до {fmtDate(d.deadline)}</Typography>}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ color: '#94A3B8', fontSize: 13 }}>{d.totals?.entries || 0} заявок · {money(d.totals?.qty || 0)} квот</Typography>
                <Typography sx={{ color: GOLD, fontWeight: 800 }}>{money(d.totals?.cost || 0)} ₽</Typography>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { background: '#0B1120', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 3 } }}>
        <DialogTitle sx={{ color: '#F1F5F9' }}>Открыть сбор пакета</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: '#94A3B8' }}>Площадка</InputLabel>
              <Select label="Площадка" value={platform} onChange={e => setPlatform(e.target.value as Platform)} sx={{ color: '#E2E8F0' }}>
                {PLATFORMS.map(p => <MenuItem key={p} value={p}>{PKG_PLATFORM_LABEL[p]}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" label="Название" value={title} onChange={e => setTitle(e.target.value)} placeholder="Июнь 2026"
              InputLabelProps={{ sx: { color: '#94A3B8' } }} sx={{ '& .MuiOutlinedInput-root': { color: '#E2E8F0' } }} />
            <TextField size="small" type="date" label="Дедлайн" value={deadline} onChange={e => setDeadline(e.target.value)}
              slotProps={{ inputLabel: { shrink: true, sx: { color: '#94A3B8' } } }} sx={{ '& .MuiOutlinedInput-root': { color: '#E2E8F0' } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#94A3B8' }}>Отмена</Button>
          <Button onClick={create} variant="contained" sx={{ background: GOLD, color: '#0A0E1A', fontWeight: 700 }}>Открыть и объявить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---- Детали сбора: сводка-матрица + экспорт + оплата + статус ---- */
function DriveDetail({ id, onBack }: { id: number; onBack: () => void }) {
  const [drive, setDrive] = useState<Drive | null>(null);
  const [summary, setSummary] = useState<DriveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adPackagesApi.drive(id).then(d => { setDrive(d); setSummary(d.summary); }).catch(e => setError(e?.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!drive || !summary) return <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress sx={{ color: GOLD }} /></Box>;
  const cats = summary.categories;

  const togglePay = (entryId: number, paid: boolean) => adPackagesApi.payEntry(entryId, paid).then(load).catch(e => setError(e?.message));
  const setStatus = (status: 'open' | 'closed' | 'paid') => adPackagesApi.updateDrive(id, { status }).then(load).catch(e => setError(e?.message));

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Button onClick={onBack} sx={{ color: '#94A3B8' }}>← Назад</Button>
        <Chip label={drive.platform_label} size="small" sx={{ background: 'rgba(201,168,76,0.15)', color: GOLD, fontWeight: 700 }} />
        <Typography sx={{ color: '#F1F5F9', fontWeight: 800, fontSize: 18 }}>{drive.title}</Typography>
        <Box sx={{ flex: 1 }} />
        <FormControl size="small">
          <Select value={drive.status} onChange={e => setStatus(e.target.value as 'open' | 'closed' | 'paid')} sx={{ color: '#E2E8F0', minWidth: 130, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' } }}>
            <MenuItem value="open">Открыт</MenuItem>
            <MenuItem value="closed">Закрыт</MenuItem>
            <MenuItem value="paid">Оплачен</MenuItem>
          </Select>
        </FormControl>
        <Button startIcon={<DownloadRoundedIcon />} variant="contained" onClick={() => downloadDriveXlsx(id, `Пакет_${drive.platform_label}_${drive.title}.xlsx`)}
          sx={{ background: GOLD, color: '#0A0E1A', fontWeight: 700, '&:hover': { background: '#E2C97E' } }}>Экспорт xlsx</Button>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <StatChip label="Заявок" value={summary.totals.entriesCount} />
        <StatChip label="Квот всего" value={summary.totals.qty} color={GOLD} />
        <StatChip label="Сумма ₽" value={summary.totals.cost} />
        <StatChip label="Оплачено ₽" value={summary.totals.paidCost} color="#22C55E" />
      </Stack>

      <Card sx={{ ...cardSx, overflow: 'auto' }}>
        <CardContent sx={{ p: 0 }}>
          {summary.entries.length === 0 ? (
            <Typography sx={{ color: '#64748B', py: 4, textAlign: 'center' }}>Заявок в сборе пока нет</Typography>
          ) : (
            <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(148,163,184,0.1)', whiteSpace: 'nowrap' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#94A3B8', fontWeight: 700 }}>Агент</TableCell>
                  <TableCell sx={{ color: '#94A3B8', fontWeight: 700 }}>Город</TableCell>
                  {cats.map(c => <TableCell key={c.key} align="center" sx={{ color: '#94A3B8', fontWeight: 700, fontSize: 11 }}>{c.label}</TableCell>)}
                  <TableCell align="center" sx={{ color: GOLD, fontWeight: 700 }}>Квот</TableCell>
                  <TableCell align="right" sx={{ color: GOLD, fontWeight: 700 }}>Сумма ₽</TableCell>
                  <TableCell align="center" sx={{ color: '#94A3B8', fontWeight: 700 }}>Оплата</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.entries.map(e => {
                  const byKey: Record<string, { qty: number; unit_price: number }> = {};
                  e.lines.forEach(l => { byKey[l.category_key] = l; });
                  return (
                    <TableRow key={e.id} hover>
                      <TableCell sx={{ color: '#E2E8F0' }}>{e.agent_name}</TableCell>
                      <TableCell sx={{ color: '#CBD5E1' }}>{e.city}</TableCell>
                      {cats.map(c => (
                        <TableCell key={c.key} align="center" sx={{ color: byKey[c.key]?.qty ? '#E2E8F0' : '#334155' }}>
                          {byKey[c.key]?.qty || '·'}
                          {byKey[c.key]?.qty ? <span style={{ color: '#475569', fontSize: 10 }}><br />{money(byKey[c.key].unit_price)}₽</span> : null}
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ color: GOLD, fontWeight: 700 }}>{e.total_qty}</TableCell>
                      <TableCell align="right" sx={{ color: '#E2E8F0', fontWeight: 600 }}>{money(e.total_cost)}</TableCell>
                      <TableCell align="center"><Switch size="small" checked={e.paid} onChange={(_, v) => togglePay(e.id, v)} /></TableCell>
                    </TableRow>
                  );
                })}
                {/* Итоги */}
                <TableRow sx={{ background: 'rgba(201,168,76,0.06)' }}>
                  <TableCell sx={{ color: GOLD, fontWeight: 800 }}>ИТОГО</TableCell>
                  <TableCell />
                  {cats.map(c => <TableCell key={c.key} align="center" sx={{ color: GOLD, fontWeight: 700 }}>{summary.byCategory[c.key]?.qty || '·'}</TableCell>)}
                  <TableCell align="center" sx={{ color: GOLD, fontWeight: 800 }}>{summary.totals.qty}</TableCell>
                  <TableCell align="right" sx={{ color: GOLD, fontWeight: 800 }}>{money(summary.totals.cost)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

/* ============ ВКЛАДКА: ПРАЙС-ЛИСТ ============ */
function PriceListTab() {
  const [platform, setPlatform] = useState<Platform>('cian');
  const [cats, setCats] = useState<AdCategory[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [edits, setEdits] = useState<Record<string, Record<string, number>>>({});

  const load = useCallback(() => {
    setLoading(true);
    adPackagesApi.prices(platform).then(m => {
      setCats(m.categories.filter(c => c.active));
      setCities(m.cities); setPrices(m.prices); setEdits(JSON.parse(JSON.stringify(m.prices)));
    }).catch(e => setError(e?.message)).finally(() => setLoading(false));
  }, [platform]);
  useEffect(() => { load(); }, [load]);

  const saveCity = (city: string) => {
    adPackagesApi.setCityPrices(platform, city, edits[city] || {}).then(load).catch(e => setError(e?.message));
  };
  const addCity = () => {
    const c = newCity.trim();
    if (!c) return;
    setCities(prev => prev.includes(c) ? prev : [...prev, c]);
    setEdits(prev => ({ ...prev, [c]: prev[c] || {} }));
    setNewCity('');
  };
  const delCity = (city: string) => adPackagesApi.deleteCity(platform, city).then(load).catch(e => setError(e?.message));
  const setCell = (city: string, key: string, val: string) => {
    setEdits(prev => ({ ...prev, [city]: { ...(prev[city] || {}), [key]: Number(val) || 0 } }));
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControl size="small"><Select value={platform} onChange={e => setPlatform(e.target.value as Platform)} sx={{ color: '#E2E8F0', minWidth: 130, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.2)' } }}>
          {PLATFORMS.map(p => <MenuItem key={p} value={p}>{PKG_PLATFORM_LABEL[p]}</MenuItem>)}
        </Select></FormControl>
        <Typography sx={{ color: '#64748B', fontSize: 13 }}>Цена за квоту по городам и категориям</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Город (напр. Москва)" value={newCity} onChange={e => setNewCity(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCity(); }}
          sx={{ '& .MuiOutlinedInput-root': { color: '#E2E8F0' }, minWidth: 200 }} />
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={addCity} disabled={!newCity.trim()}
          sx={{ background: GOLD, color: '#0A0E1A', fontWeight: 700, whiteSpace: 'nowrap', '&:hover': { background: '#E2C97E' } }}>Добавить город</Button>
      </Stack>

      {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress sx={{ color: GOLD }} /></Box> : (
        <Card sx={{ ...cardSx, overflow: 'auto' }}>
          <CardContent sx={{ p: 0 }}>
            <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(148,163,184,0.1)', whiteSpace: 'nowrap' } }}>
              <TableHead><TableRow>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700 }}>Город</TableCell>
                {cats.map(c => <TableCell key={c.key} align="center" sx={{ color: '#94A3B8', fontWeight: 700, fontSize: 11 }}>{c.label}</TableCell>)}
                <TableCell />
              </TableRow></TableHead>
              <TableBody>
                {cities.length === 0 && <TableRow><TableCell colSpan={cats.length + 2} sx={{ color: '#64748B', textAlign: 'center', py: 3 }}>Добавьте город и задайте цены</TableCell></TableRow>}
                {cities.map(city => (
                  <TableRow key={city} hover>
                    <TableCell sx={{ color: '#E2E8F0', fontWeight: 600 }}>{city}</TableCell>
                    {cats.map(c => (
                      <TableCell key={c.key} align="center">
                        <TextField variant="standard" type="number" value={edits[city]?.[c.key] ?? ''}
                          onChange={e => setCell(city, c.key, e.target.value)}
                          sx={{ width: 64, '& input': { color: '#E2E8F0', textAlign: 'center', fontSize: 13 } }} />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Button size="small" onClick={() => saveCity(city)} sx={{ color: GOLD, minWidth: 0 }}>Сохр.</Button>
                        <IconButton size="small" onClick={() => delCity(city)} sx={{ color: '#64748B' }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

/* ============ ВКЛАДКА: БАЗА ПОДКЛЮЧЕНИЙ ============ */
const CONNECT_PLATFORMS: ConnectPlatform[] = ['cian', 'avito', 'domclick'];
function ConnectionsTab() {
  const [roster, setRoster] = useState<RosterAgent[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([adRequestsApi.roster(q).catch(() => []), adRequestsApi.platformStats().catch(() => null)])
      .then(([r, s]) => { setRoster(r); setStats(s); })
      .finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const toggle = (agentId: number, platform: ConnectPlatform, connected: boolean) => {
    setRoster(prev => prev.map(a => a.id === agentId ? { ...a, platforms: { ...a.platforms, [platform]: connected } } : a));
    adRequestsApi.setPlatform(agentId, platform, connected)
      .then(() => adRequestsApi.platformStats().then(setStats).catch(() => {}))
      .catch(e => { setError(e?.message); load(); });
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {stats && (
        <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {stats.byPlatform.map(p => (
            <Card key={p.platform} sx={{ ...cardSx, minWidth: 160 }}>
              <CardContent sx={{ py: 1.2, px: 2, '&:last-child': { pb: 1.2 } }}>
                <Typography sx={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>{p.label}</Typography>
                <Typography sx={{ fontSize: 24, fontWeight: 800, color: GOLD }}>{p.connected} <span style={{ fontSize: 14, color: '#64748B' }}>/ {p.total}</span></Typography>
                <Typography sx={{ fontSize: 12, color: '#22C55E' }}>{p.pct}% подключено · +{p.thisMonth} за месяц</Typography>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
      <TextField size="small" placeholder="Поиск агента / города" value={q} onChange={e => setQ(e.target.value)}
        sx={{ mb: 2, minWidth: 280, '& .MuiOutlinedInput-root': { color: '#E2E8F0' } }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B' }} /></InputAdornment> }} />

      {loading ? <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress sx={{ color: GOLD }} /></Box> : (
        <Card sx={{ ...cardSx, overflow: 'auto' }}>
          <CardContent sx={{ p: 0 }}>
            <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(148,163,184,0.1)' } }}>
              <TableHead><TableRow>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700 }}>Агент</TableCell>
                <TableCell sx={{ color: '#94A3B8', fontWeight: 700 }}>Город</TableCell>
                {CONNECT_PLATFORMS.map(p => <TableCell key={p} align="center" sx={{ color: '#94A3B8', fontWeight: 700 }}>{PLATFORM_LABEL[p]}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {roster.map(a => (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ color: '#E2E8F0' }}>{a.name}</TableCell>
                    <TableCell sx={{ color: '#94A3B8' }}>{a.city || '—'}</TableCell>
                    {CONNECT_PLATFORMS.map(p => (
                      <TableCell key={p} align="center"><Switch size="small" checked={!!a.platforms[p]} onChange={(_, v) => toggle(a.id, p, v)} /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
