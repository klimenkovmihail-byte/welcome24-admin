import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Tooltip, Avatar, Stack, Divider,
  Radio, RadioGroup, FormControlLabel, FormLabel, Autocomplete,
  ToggleButtonGroup, ToggleButton, Alert, Checkbox,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PauseCircleRoundedIcon from '@mui/icons-material/PauseCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import TelegramIcon from '@mui/icons-material/Telegram';
import InstagramIcon from '@mui/icons-material/Instagram';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Rating } from '@mui/material';
import { companySettings } from '../data/mockData';
import type { AgentReview, ReviewModeration, AgentSocials } from '../types';
import { impersonate, getCurrentUser } from '../auth/auth';
import { ROLE_LABEL, ROLE_COLOR, SECTION_LIST, ROLE_ACCESS, type Role } from '../auth/roles';
import type { Agent, AgentLevel, AgentStatus } from '../types';
import { agentsApi, enrichAgents, enrichSharesFromHolders, type MentorHistoryEntry } from '../api/agents';
import { sharesApi } from '../api/shares';
import { CircularProgress } from '@mui/material';
import AgentFormDialog from './AgentFormDialog';

// Расширяем тип Agent (role приходит из бэка, добавлен в normalizeAgent).
type AgentWithRole = Agent & { role?: Role };

const SPECIALIZATIONS = ['Жилая', 'Вторичная', 'Коммерческая', 'Загородная', 'Новостройки', 'Аренда'];

const levelColor = (level: AgentLevel) => ({
  1: { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'Уровень 1' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', label: 'Уровень 2' },
  3: { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Уровень 3' },
}[level]);

const statusConfig = {
  active: { label: 'Активен', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> },
  // 'inactive' оставлен для обратной совместимости с историческими данными — на UI он
  // отображается как 'Заблокирован' (миграция БД переводит все inactive → blocked).
  inactive: { label: 'Заблокирован', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: <BlockRoundedIcon sx={{ fontSize: 13 }} /> },
  blocked: { label: 'Заблокирован', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: <BlockRoundedIcon sx={{ fontSize: 13 }} /> },
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<AgentLevel | 0>(0);
  // По умолчанию показываем только обычных агентов — сотрудники не «загрязняют» базу.
  // Чтобы увидеть сотрудников, нужно явно переключить фильтр.
  const [filterRole, setFilterRole] = useState<'all' | 'staff' | Role>('agent');
  // Пагинация списка (рендерим порциями — иначе 795 строк тормозят).
  const PAGE_SIZE = 50;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  // Reviews
  const [reviews, setReviews] = useState<AgentReview[]>([]);     // отзывы открытого в модалке агента
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewsDlgFor, setReviewsDlgFor] = useState<Agent | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const pendingReviewsCount = pendingCount;

  const reloadAgents = () => {
    setLoading(true);
    return Promise.all([
      agentsApi.list(),
      sharesApi.holders().catch(() => []),
    ])
      .then(([list, holders]) => setAgents(enrichSharesFromHolders(list, holders)))
      .catch(err => setError(err?.message || 'Ошибка загрузки агентов'))
      .finally(() => setLoading(false));
  };

  const reloadPending = () => {
    agentsApi.pendingReviews()
      .then(rows => setPendingCount(rows.length))
      .catch(() => { /* tolerate */ });
  };

  // Начальная загрузка списка + счётчика отзывов на модерации.
  useEffect(() => { reloadAgents(); reloadPending(); }, []);

  // При открытии модалки отзывов агента — грузим ВСЕ отзывы (включая pending/rejected).
  useEffect(() => {
    if (!reviewsDlgFor) { setReviews([]); return; }
    let cancelled = false;
    setReviewsLoading(true);
    agentsApi.reviews(reviewsDlgFor.id, { all: true })
      .then(rows => { if (!cancelled) setReviews(rows); })
      .catch(() => { if (!cancelled) setReviews([]); })
      .finally(() => { if (!cancelled) setReviewsLoading(false); });
    return () => { cancelled = true; };
  }, [reviewsDlgFor]);

  const setReviewModeration = async (id: number, status: ReviewModeration) => {
    await agentsApi.setReviewModeration(id, status);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, moderation: status } : r));
    reloadPending();
    reloadAgents(); // у агента пересчитался rating
  };
  const deleteReview = async (id: number) => {
    await agentsApi.deleteReview(id);
    setReviews(prev => prev.filter(r => r.id !== id));
    reloadPending();
    reloadAgents();
  };

  // Верхняя вкладка: «Агенты» (role==='agent') или «Сотрудники» (admin/manager/super_admin).
  // Это главный визуальный переключатель — пользователь сразу видит где сейчас.
  const [view, setView] = useState<'agents' | 'staff'>('agents');

  // useDeferredValue откладывает дорогой пересчёт filtered (793 строки → тормозит
  // при наборе). Каждый keystroke обновляет инпут моментально, а фильтрация
  // происходит на следующем idle-кадре.
  const deferredSearch = useDeferredValue(search);
  const filtered = useMemo(() => agents.filter(a => {
    const q = deferredSearch.toLowerCase();
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.city.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchLevel = filterLevel === 0 || a.level === filterLevel;
    const aRole = ((a as AgentWithRole).role || 'agent') as Role;
    // Сначала отсекаем по верхней вкладке. «Сотрудники» = все не-агенты.
    const matchView = view === 'agents' ? aRole === 'agent' : aRole !== 'agent';
    // Затем (только для вкладки «Сотрудники») фильтр по конкретной роли.
    const matchRole = view === 'agents'
      ? true
      : (filterRole === 'all' || filterRole === 'staff' ? true : aRole === filterRole);
    return matchQ && matchStatus && matchLevel && matchView && matchRole;
  }), [agents, deferredSearch, filterStatus, filterLevel, filterRole, view]);

  // Сброс пагинации при любой смене фильтра/поиска/вкладки.
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [deferredSearch, filterStatus, filterLevel, filterRole, view]);

  const agentCount = useMemo(() =>
    agents.filter(a => ((a as AgentWithRole).role || 'agent') === 'agent').length,
  [agents]);
  const staffCount = useMemo(() =>
    agents.filter(a => (((a as AgentWithRole).role || 'agent') as Role) !== 'agent').length,
  [agents]);

  const openCreate = () => {
    setEditTarget(null);
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditTarget(agent);
    setDialogOpen(true);
  };

  const toggleStatus = async (id: number, status: AgentStatus) => {
    try {
      await agentsApi.update(id, { status });
      setAgents(prev => enrichAgents(prev.map(a => a.id === id ? { ...a, status } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!window.confirm(`Удалить учётку «${agent.name}» навсегда? Действие необратимо.\n(Удаление запрещено, если у агента есть сделки.)`)) return;
    try {
      await agentsApi.remove(agent.id);
      setAgents(prev => enrichAgents(prev.filter(a => a.id !== agent.id)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Не удалось удалить');
    }
  };

  // Смена роли (только super_admin видит этот UI).
  const currentUser = getCurrentUser();
  const currentRole = (currentUser?.role || 'agent') as Role;
  const canManageRoles = currentRole === 'super_admin';

  const changeRole = async (id: number, role: Role) => {
    try {
      const updated = await agentsApi.setRole(id, role);
      setAgents(prev => enrichAgents(prev.map(a => a.id === id ? { ...a, ...updated } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить роль');
    }
  };

  // Объединение дубликатов (смена фамилии и т.п.)
  const [mergeSource, setMergeSource] = useState<Agent | null>(null);
  const [mergeTarget, setMergeTarget] = useState<Agent | null>(null);
  const [merging, setMerging] = useState(false);

  // История менторов
  const [mentorHistoryFor, setMentorHistoryFor] = useState<Agent | null>(null);
  const [mentorHistory, setMentorHistory] = useState<MentorHistoryEntry[]>([]);
  const [mentorHistoryLoading, setMentorHistoryLoading] = useState(false);
  // Редактор доступа к разделам (super_admin → сотруднику).
  const [sectionsFor, setSectionsFor] = useState<Agent | null>(null);

  useEffect(() => {
    if (!mentorHistoryFor) { setMentorHistory([]); return; }
    let cancelled = false;
    setMentorHistoryLoading(true);
    agentsApi.mentorHistory(mentorHistoryFor.id)
      .then(h => { if (!cancelled) setMentorHistory(h); })
      .catch(() => { if (!cancelled) setMentorHistory([]); })
      .finally(() => { if (!cancelled) setMentorHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [mentorHistoryFor]);

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget) return;
    if (!confirm(`Перенести все сделки/акции/команду от «${mergeSource.name}» к «${mergeTarget.name}» и удалить «${mergeSource.name}»? Действие необратимо.`)) return;
    setMerging(true); setError(null);
    try {
      await agentsApi.mergeInto(mergeTarget.id, mergeSource.id);
      setMergeSource(null); setMergeTarget(null);
      await reloadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось объединить');
    } finally {
      setMerging(false);
    }
  };

  const stats = useMemo(() => ({
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    level3: agents.filter(a => a.level === 3).length,
    totalShares: agents.reduce((s, a) => s + a.shares, 0),
    pendingReviews: pendingReviewsCount,
  }), [agents, pendingReviewsCount]);

  // Кнопки stats зависят от текущей вкладки.
  const isStaffView = view === 'staff';
  const statCards = isStaffView
    ? [
        { label: 'Всего сотрудников', value: staffCount,
          icon: <PeopleRoundedIcon />, color: '#C9A84C' },
        { label: 'Супер-админов',
          value: agents.filter(a => ((a as AgentWithRole).role) === 'super_admin').length,
          icon: <CheckCircleRoundedIcon />, color: ROLE_COLOR.super_admin },
        { label: 'Админов',
          value: agents.filter(a => ((a as AgentWithRole).role) === 'admin').length,
          icon: <DiamondRoundedIcon />, color: ROLE_COLOR.admin },
        { label: 'Менеджеров',
          value: agents.filter(a => ((a as AgentWithRole).role) === 'manager').length,
          icon: <RateReviewRoundedIcon />, color: ROLE_COLOR.manager },
      ]
    : [
        { label: 'Всего агентов',       value: agentCount,           icon: <PeopleRoundedIcon />,        color: '#4361EE' },
        { label: 'Активных',            value: stats.active,         icon: <CheckCircleRoundedIcon />,    color: '#22C55E' },
        { label: 'Уровень 3 (95%)',     value: stats.level3,         icon: <DiamondRoundedIcon />,        color: '#C9A84C' },
        { label: 'Отзывы на модерации', value: stats.pendingReviews, icon: <RateReviewRoundedIcon />,     color: '#F59E0B' },
      ];

  return (
    <Box>
      {/* Top tabs: Агенты / Сотрудники */}
      <Box sx={{ mb: 3, display: 'flex', gap: 1, p: 0.5, borderRadius: 3, background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(201,168,76,0.1)', maxWidth: 520 }}>
        <Box
          onClick={() => { setView('agents'); setFilterRole('agent'); }}
          sx={{
            flex: 1, px: 2.5, py: 1.2, borderRadius: 2.5, cursor: 'pointer',
            background: view === 'agents' ? 'linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.08))' : 'transparent',
            border: view === 'agents' ? '1px solid rgba(201,168,76,0.3)' : '1px solid transparent',
            display: 'flex', alignItems: 'center', gap: 1.5,
            transition: 'all 0.2s',
            '&:hover': { background: view !== 'agents' ? 'rgba(201,168,76,0.06)' : undefined },
          }}
        >
          <PeopleRoundedIcon sx={{ color: view === 'agents' ? '#C9A84C' : '#64748B' }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: view === 'agents' ? '#C9A84C' : '#94A3B8' }}>Агенты</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>{agentCount} в базе</Typography>
          </Box>
        </Box>
        <Box
          onClick={() => { setView('staff'); setFilterRole('all'); }}
          sx={{
            flex: 1, px: 2.5, py: 1.2, borderRadius: 2.5, cursor: 'pointer',
            background: view === 'staff' ? `linear-gradient(135deg, ${ROLE_COLOR.admin}30, ${ROLE_COLOR.admin}10)` : 'transparent',
            border: view === 'staff' ? `1px solid ${ROLE_COLOR.admin}50` : '1px solid transparent',
            display: 'flex', alignItems: 'center', gap: 1.5,
            transition: 'all 0.2s',
            '&:hover': { background: view !== 'staff' ? `${ROLE_COLOR.admin}10` : undefined },
          }}
        >
          <BadgeRoundedIcon sx={{ color: view === 'staff' ? ROLE_COLOR.admin : '#64748B' }} />
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: view === 'staff' ? ROLE_COLOR.admin : '#94A3B8' }}>Сотрудники</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>{staffCount} в команде</Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {statCards.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ flex: '1 1 160px' }}>
            <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                {s.icon}
              </Box>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>{s.label}</Typography>
              </Box>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Поиск по имени, email, городу…"
          value={search} onChange={e => setSearch(e.target.value)}
          size="small" sx={{ flex: '1 1 260px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Статус</InputLabel>
          <Select value={filterStatus} label="Статус" onChange={e => setFilterStatus(e.target.value as AgentStatus | 'all')}>
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="active">Активные</MenuItem>
            <MenuItem value="blocked">Заблокированные</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Уровень</InputLabel>
          <Select value={filterLevel} label="Уровень" onChange={e => setFilterLevel(e.target.value as AgentLevel | 0)}>
            <MenuItem value={0}>Все</MenuItem>
            <MenuItem value={1}>Уровень 1 (80%)</MenuItem>
            <MenuItem value={2}>Уровень 2 (90%)</MenuItem>
            <MenuItem value={3}>Уровень 3 (95%)</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Роль</InputLabel>
          <Select value={filterRole} label="Роль" onChange={e => setFilterRole(e.target.value as 'all' | 'staff' | Role)}>
            <MenuItem value="all">Все</MenuItem>
            <MenuItem value="staff" sx={{ color: '#C9A84C', fontWeight: 700 }}>
              Только сотрудники ({staffCount})
            </MenuItem>
            <MenuItem value="super_admin" sx={{ color: ROLE_COLOR.super_admin, fontWeight: 600 }}>{ROLE_LABEL.super_admin}</MenuItem>
            <MenuItem value="admin"       sx={{ color: ROLE_COLOR.admin,       fontWeight: 600 }}>{ROLE_LABEL.admin}</MenuItem>
            <MenuItem value="manager"     sx={{ color: ROLE_COLOR.manager,     fontWeight: 600 }}>{ROLE_LABEL.manager}</MenuItem>
            <MenuItem value="lawyer"      sx={{ color: ROLE_COLOR.lawyer,      fontWeight: 600 }}>{ROLE_LABEL.lawyer}</MenuItem>
            <MenuItem value="broker"      sx={{ color: ROLE_COLOR.broker,      fontWeight: 600 }}>{ROLE_LABEL.broker}</MenuItem>
            <MenuItem value="agent"       sx={{ color: ROLE_COLOR.agent,       fontWeight: 600 }}>{ROLE_LABEL.agent}</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ ml: 'auto', flexShrink: 0 }}>
          {isStaffView ? 'Добавить сотрудника' : 'Добавить агента'}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#C9A84C' }} />
        </Box>
      )}

      {/* Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', display: loading ? 'none' : 'block' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Агент</TableCell>
              <TableCell>Уровень</TableCell>
              <TableCell>Источник / Ментор</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Роль</TableCell>
              <TableCell align="right">ВКД (год)</TableCell>
              <TableCell align="right">Комиссия</TableCell>
              <TableCell align="right">Акции</TableCell>
              <TableCell align="right">Команда</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.slice(0, visibleCount).map((agent) => {
              const lc = levelColor(agent.level);
              const sc = statusConfig[agent.status];
              return (
                <TableRow key={agent.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, background: `linear-gradient(135deg, ${lc.color}40, ${lc.color}20)`, color: lc.color, fontSize: 14, fontWeight: 700, border: `1px solid ${lc.color}30` }}>
                        {agent.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9', lineHeight: 1.2 }}>{agent.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>
                          {agent.email.endsWith('@w24.local') ? 'архивная запись (без логина)' : agent.email}
                        </Typography>
                        <Typography variant="caption" sx={{ color: agent.terminatedAt ? '#EF4444' : '#475569', fontSize: 10 }}>
                          {agent.terminatedAt
                            ? `с ${agent.joinDate} · уволен ${agent.terminatedAt}`
                            : `с ${agent.joinDate}`}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip label={lc.label} size="small" sx={{ background: lc.bg, color: lc.color, fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    {agent.parentId ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <AccountTreeRoundedIcon sx={{ fontSize: 14, color: '#4361EE' }} />
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>{agent.parentName?.split(' ').slice(0, 2).join(' ')}</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <BusinessRoundedIcon sx={{ fontSize: 14, color: '#C9A84C' }} />
                        <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 600 }}>Welcome 24</Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={sc.label}
                      icon={sc.icon}
                      size="small"
                      sx={{ background: sc.bg, color: sc.color, fontWeight: 600, fontSize: 11, '& .MuiChip-icon': { color: sc.color } }}
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const r = ((agent as AgentWithRole).role || 'agent') as Role;
                      const c = ROLE_COLOR[r] || '#94A3B8';
                      if (canManageRoles) {
                        return (
                          <Select
                            value={r}
                            size="small"
                            variant="standard"
                            disableUnderline
                            onChange={e => changeRole(agent.id, e.target.value as Role)}
                            sx={{ fontSize: 11, fontWeight: 700, color: c, '& .MuiSelect-select': { p: 0, pr: '20px !important' }, '& .MuiSvgIcon-root': { color: c, fontSize: 16 } }}
                          >
                            {(['super_admin', 'admin', 'manager', 'agent'] as Role[]).map(opt => (
                              <MenuItem key={opt} value={opt} sx={{ fontSize: 12, color: ROLE_COLOR[opt], fontWeight: 600 }}>
                                {ROLE_LABEL[opt]}
                              </MenuItem>
                            ))}
                          </Select>
                        );
                      }
                      return (
                        <Chip label={ROLE_LABEL[r] || r} size="small" sx={{ background: `${c}22`, color: c, fontWeight: 700, fontSize: 11 }} />
                      );
                    })()}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{fmt(agent.vkdYear)} ₽</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{agent.commission}%</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>{fmt(agent.shares)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>{agent.teamSize}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Войти как этот агент">
                        <IconButton size="small" onClick={() => impersonate(agent.id, agent.name)} sx={{ color: '#64748B', '&:hover': { color: '#4361EE' } }}>
                          <LoginRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={`Отзывы (${agent.reviewsCount})`}>
                        <IconButton size="small" onClick={() => setReviewsDlgFor(agent)} sx={{
                          color: '#64748B',
                          '&:hover': { color: '#F59E0B' },
                        }}>
                          <RateReviewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(agent)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="История смены менторов">
                        <IconButton size="small" onClick={() => setMentorHistoryFor(agent)} sx={{ color: '#64748B', '&:hover': { color: '#06B6D4' } }}>
                          <HistoryRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canManageRoles && (agent as Agent & { role?: Role }).role && (agent as Agent & { role?: Role }).role !== 'agent' && (
                        <Tooltip title="Доступ к разделам админки">
                          <IconButton size="small" onClick={() => setSectionsFor(agent)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                            <TuneRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canManageRoles && (
                        <Tooltip title="Объединить с другой карточкой (смена фамилии и т.п.)">
                          <IconButton size="small" onClick={() => { setMergeSource(agent); setMergeTarget(null); }} sx={{ color: '#64748B', '&:hover': { color: '#8B5CF6' } }}>
                            <MergeRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {agent.status !== 'active' && (
                        <Tooltip title="Активировать">
                          <IconButton size="small" onClick={() => toggleStatus(agent.id, 'active')} sx={{ color: '#64748B', '&:hover': { color: '#22C55E' } }}>
                            <CheckCircleRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {agent.status !== 'blocked' && (
                        <Tooltip title="Заблокировать">
                          <IconButton size="small" onClick={() => toggleStatus(agent.id, 'blocked')} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                            <BlockRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canManageRoles && (
                        <Tooltip title="Удалить учётку навсегда">
                          <IconButton size="small" onClick={() => handleDelete(agent)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B' }}>Агенты не найдены</Typography>
          </Box>
        )}
        {filtered.length > visibleCount && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Button variant="outlined" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
              sx={{ borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C' }}>
              Показать ещё ({filtered.length - visibleCount})
            </Button>
          </Box>
        )}
      </TableContainer>

      {/* Create / Edit Dialog — вынесен в AgentFormDialog (свой state → таблица не ре-рендерится на каждом keystroke) */}
      <AgentFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        agents={agents}
        editTarget={editTarget}
        canManageRoles={canManageRoles}
        defaultKind={isStaffView ? 'staff' : 'agent'}
        onSaved={() => { reloadAgents(); }}
      />

      {/* Редактор доступа к разделам (super_admin) */}
      <SectionsDialog
        agent={sectionsFor}
        onClose={() => setSectionsFor(null)}
        onSaved={() => { setSectionsFor(null); reloadAgents(); }}
      />

      {/* Mentor history dialog */}
      <Dialog open={!!mentorHistoryFor} onClose={() => setMentorHistoryFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>История менторов</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              {mentorHistoryFor?.name} · вступил {mentorHistoryFor?.joinDate}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setMentorHistoryFor(null)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {mentorHistoryLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress sx={{ color: '#06B6D4' }} />
            </Box>
          )}
          {!mentorHistoryLoading && mentorHistory.length === 0 && (
            <Alert severity="info">У агента ещё не было записей в истории менторов.</Alert>
          )}
          {!mentorHistoryLoading && mentorHistory.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {mentorHistory.map((h, i) => {
                const isCurrent = h.effectiveUntil === null;
                const days = isCurrent
                  ? Math.floor((Date.now() - new Date(h.effectiveFrom).getTime()) / 86_400_000)
                  : Math.floor((new Date(h.effectiveUntil!).getTime() - new Date(h.effectiveFrom).getTime()) / 86_400_000);
                return (
                  <Box key={h.id} sx={{
                    p: 2, borderRadius: 2.5,
                    background: isCurrent ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isCurrent ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                          {h.parentName || 'Welcome 24 (без ментора)'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                          {new Date(h.effectiveFrom).toLocaleDateString('ru-RU')} →{' '}
                          {h.effectiveUntil
                            ? new Date(h.effectiveUntil).toLocaleDateString('ru-RU')
                            : 'сейчас'}
                          {' · '}<b style={{ color: '#F1F5F9' }}>{days} дн.</b>
                        </Typography>
                      </Box>
                      {isCurrent && (
                        <Chip label="Сейчас" size="small" sx={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700 }} />
                      )}
                      {!isCurrent && i === 0 && (
                        <Chip label="Изменён недавно" size="small" sx={{ background: 'rgba(67,97,238,0.15)', color: '#4361EE', fontWeight: 700 }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>Сделок агента</Typography>
                        <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 700 }}>{h.periodDeals}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>ВКД за период</Typography>
                        <Typography variant="body2" sx={{ color: '#C9A84C', fontWeight: 700 }}>{fmt(h.periodVkd)} ₽</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>Доход агента</Typography>
                        <Typography variant="body2" sx={{ color: '#22C55E', fontWeight: 700 }}>{fmt(h.periodIncome)} ₽</Typography>
                      </Box>
                    </Box>
                    {h.reason && (
                      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 1, fontStyle: 'italic' }}>
                        «{h.reason}»{h.changedByName ? ` — ${h.changedByName}` : ''}
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setMentorHistoryFor(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={!!mergeSource} onClose={() => { if (!merging) { setMergeSource(null); setMergeTarget(null); } }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Объединить дубликат</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Сделки/акции/команда дубля перенесутся к основной карточке. Дубль будет удалён.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2}>
            <Alert severity="warning" icon={false}>
              <Typography variant="caption" sx={{ display: 'block' }}>
                <b>Дубликат (будет удалён):</b>
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                {mergeSource?.name}
              </Typography>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {mergeSource?.email} · {mergeSource?.vkdYear?.toLocaleString('ru-RU') || 0} ₽ ВКД год · {mergeSource?.shares || 0} акций · {mergeSource?.teamSize || 0} в команде
              </Typography>
            </Alert>
            <Autocomplete
              options={agents.filter(a => a.id !== mergeSource?.id)}
              getOptionLabel={a => a.name}
              value={mergeTarget}
              onChange={(_, v) => setMergeTarget(v)}
              renderInput={params => <TextField {...params} label="Основная карточка (target) *" size="small" />}
              renderOption={(props, a) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 11, background: 'rgba(139,92,246,0.2)', color: '#8B5CF6' }}>
                    {a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{a.email} · ВКД {(a.vkdYear || 0).toLocaleString('ru-RU')} ₽</Typography>
                  </Box>
                </Box>
              )}
            />
            {mergeTarget && (
              <Alert severity="info" icon={false}>
                <Typography variant="caption" sx={{ display: 'block' }}>
                  <b>Куда переносим:</b>
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                  {mergeTarget.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                  {mergeTarget.email} · {(mergeTarget.vkdYear || 0).toLocaleString('ru-RU')} ₽ ВКД год · {mergeTarget.shares || 0} акций
                </Typography>
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => { setMergeSource(null); setMergeTarget(null); }} disabled={merging}>Отмена</Button>
          <Button variant="contained" color="warning" onClick={handleMerge} disabled={!mergeTarget || merging}>
            {merging ? 'Объединяю…' : 'Объединить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Reviews moderation dialog ===== */}
      <Dialog open={!!reviewsDlgFor} onClose={() => setReviewsDlgFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
              Отзывы на агента
            </Typography>
            {reviewsDlgFor && (
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                {reviewsDlgFor.name} · средний рейтинг {reviewsDlgFor.rating.toFixed(1)}
              </Typography>
            )}
          </Box>
          <IconButton size="small" onClick={() => setReviewsDlgFor(null)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 2 }}>
          {reviewsLoading && (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#C9A84C' }} />
            </Box>
          )}
          {!reviewsLoading && reviewsDlgFor && (() => {
            const list = [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            if (list.length === 0) {
              return (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#64748B' }}>У этого агента ещё нет отзывов</Typography>
                </Box>
              );
            }
            return (
              <Stack spacing={1.5}>
                {list.map(r => {
                  const modCfg = {
                    approved: { label: 'Одобрен',          color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  icon: <CheckCircleRoundedIcon sx={{ fontSize: 14 }} /> },
                    pending:  { label: 'На модерации',     color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: <HourglassEmptyRoundedIcon sx={{ fontSize: 14 }} /> },
                    rejected: { label: 'Отклонён',         color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  icon: <CancelRoundedIcon sx={{ fontSize: 14 }} /> },
                  }[r.moderation];
                  return (
                    <Box key={r.id} sx={{
                      p: 2, borderRadius: 2,
                      background: r.moderation === 'pending' ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.025)',
                      border: r.moderation === 'pending' ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{r.authorName}</Typography>
                            <Rating value={r.rating} readOnly size="small"
                              icon={<StarRoundedIcon sx={{ color: '#F59E0B', fontSize: 14 }} fontSize="inherit" />}
                              emptyIcon={<StarBorderRoundedIcon sx={{ color: '#475569', fontSize: 14 }} fontSize="inherit" />}
                            />
                            <Typography variant="caption" sx={{ color: '#64748B' }}>
                              {new Date(r.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip icon={modCfg.icon} label={modCfg.label} size="small" sx={{ background: modCfg.bg, color: modCfg.color, fontWeight: 700, fontSize: 11, '& .MuiChip-icon': { color: modCfg.color } }} />
                      </Box>
                      <Typography variant="body2" sx={{ color: '#CBD5E1', lineHeight: 1.6, mb: 1.5 }}>{r.text}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {r.moderation !== 'approved' && (
                          <Button size="small" variant="outlined" startIcon={<CheckCircleRoundedIcon />}
                            onClick={() => setReviewModeration(r.id, 'approved')}
                            sx={{ borderColor: 'rgba(34,197,94,0.3)', color: '#22C55E', '&:hover': { borderColor: '#22C55E', background: 'rgba(34,197,94,0.08)' } }}>
                            Одобрить
                          </Button>
                        )}
                        {r.moderation !== 'rejected' && (
                          <Button size="small" variant="outlined" startIcon={<CancelRoundedIcon />}
                            onClick={() => setReviewModeration(r.id, 'rejected')}
                            sx={{ borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444', '&:hover': { borderColor: '#EF4444', background: 'rgba(239,68,68,0.08)' } }}>
                            Отклонить
                          </Button>
                        )}
                        <Button size="small" startIcon={<CloseRoundedIcon />}
                          onClick={() => deleteReview(r.id)}
                          sx={{ color: '#64748B', ml: 'auto', '&:hover': { color: '#EF4444' } }}>
                          Удалить
                        </Button>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

// ---- Редактор доступа к разделам для сотрудника (super_admin) ----
function SectionsDialog({ agent, onClose, onSaved }: {
  agent: (Agent & { role?: Role; sectionAccess?: string[] | null }) | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const role = (agent?.role || 'admin') as Role;
  const roleDefault = useMemo(
    () => new Set(SECTION_LIST.filter(s => (ROLE_ACCESS[s.path] || []).includes(role)).map(s => s.path)),
    [role],
  );

  useEffect(() => {
    if (!agent) return;
    const sa = agent.sectionAccess;
    if (Array.isArray(sa)) { setCustom(true); setChecked(new Set(sa)); }
    else { setCustom(false); setChecked(new Set(roleDefault)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent]);

  const toggle = (p: string) => setChecked(prev => {
    const n = new Set(prev); if (n.has(p)) n.delete(p); else n.add(p); return n;
  });

  const save = async (resetToRole: boolean) => {
    if (!agent) return;
    setBusy(true);
    try {
      await agentsApi.setSections(agent.id, resetToRole ? null : Array.from(checked));
      onSaved();
    } catch (e) { alert(e instanceof Error ? e.message : 'Не удалось сохранить'); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!agent} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Доступ к разделам</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>{agent?.name} · {ROLE_LABEL[role]}</Typography>
      </DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={<Checkbox checked={custom} onChange={e => { setCustom(e.target.checked); if (!e.target.checked) setChecked(new Set(roleDefault)); }} />}
          label={<Typography variant="body2" sx={{ color: '#F1F5F9' }}>Индивидуальная настройка<br /><Typography component="span" variant="caption" sx={{ color: '#64748B' }}>иначе — доступ по умолчанию для роли</Typography></Typography>}
          sx={{ mb: 1, alignItems: 'flex-start' }}
        />
        <Stack sx={{ opacity: custom ? 1 : 0.45, pointerEvents: custom ? 'auto' : 'none' }}>
          {SECTION_LIST.map(s => (
            <FormControlLabel key={s.path}
              control={<Checkbox size="small" checked={checked.has(s.path)} onChange={() => toggle(s.path)} />}
              label={<Typography variant="body2">{s.label}</Typography>}
            />
          ))}
        </Stack>
        <Alert severity="info" sx={{ mt: 1 }}>Настройки, AI-промпты и управление ролями — всегда только у супер-админа.</Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => save(true)} disabled={busy} sx={{ color: '#94A3B8' }}>Сбросить к роли</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={busy}>Отмена</Button>
        <Button variant="contained" onClick={() => save(false)} disabled={busy || !custom}>Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
}
