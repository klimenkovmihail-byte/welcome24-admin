import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Tooltip, Avatar, Stack, Divider,
  Radio, RadioGroup, FormControlLabel, FormLabel, Autocomplete,
  ToggleButtonGroup, ToggleButton, Alert,
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
import { Rating } from '@mui/material';
import { companySettings } from '../data/mockData';
import type { AgentReview, ReviewModeration, AgentSocials } from '../types';
import { impersonate } from '../auth/auth';
import type { Agent, AgentLevel, AgentStatus } from '../types';
import { agentsApi, enrichAgents } from '../api/agents';
import { CircularProgress } from '@mui/material';

const SPECIALIZATIONS = ['Жилая', 'Вторичная', 'Коммерческая', 'Загородная', 'Новостройки', 'Аренда'];

const levelColor = (level: AgentLevel) => ({
  1: { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'Уровень 1' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', label: 'Уровень 2' },
  3: { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Уровень 3' },
}[level]);

const statusConfig = {
  active: { label: 'Активен', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', icon: <CheckCircleRoundedIcon sx={{ fontSize: 13 }} /> },
  inactive: { label: 'Неактивен', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: <PauseCircleRoundedIcon sx={{ fontSize: 13 }} /> },
  blocked: { label: 'Заблокирован', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', icon: <BlockRoundedIcon sx={{ fontSize: 13 }} /> },
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

const emptyForm = {
  name: '', email: '', phone: '', city: '',
  password: '' as string, // только при создании
  level: 1 as AgentLevel, commission: 80 as 80 | 90 | 95,
  status: 'active' as AgentStatus,
  parentType: 'company' as 'company' | 'agent',
  parentId: null as number | null,
  parentName: null as string | null,
  specialization: [] as string[],
  // Public profile fields
  photo: '' as string,
  bio: '' as string,
  socials: {} as AgentSocials,
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<AgentStatus | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<AgentLevel | 0>(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Agent | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  // Reviews
  const [reviews, setReviews] = useState<AgentReview[]>([]);     // отзывы открытого в модалке агента
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewsDlgFor, setReviewsDlgFor] = useState<Agent | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const pendingReviewsCount = pendingCount;

  const reloadAgents = () => {
    setLoading(true);
    return agentsApi.list()
      .then(list => setAgents(list))
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

  const filtered = useMemo(() => agents.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.city.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    const matchLevel = filterLevel === 0 || a.level === filterLevel;
    return matchQ && matchStatus && matchLevel;
  }), [agents, search, filterStatus, filterLevel]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditTarget(agent);
    setForm({
      name: agent.name, email: agent.email, phone: agent.phone, city: agent.city,
      level: agent.level, commission: agent.commission, status: agent.status,
      parentType: agent.parentId ? 'agent' : 'company',
      parentId: agent.parentId, parentName: agent.parentName,
      specialization: agent.specialization,
      photo: agent.photo || '',
      bio: agent.bio || '',
      socials: { ...(agent.socials || {}) },
    });
    setDialogOpen(true);
  };

  const handleLevelChange = (level: AgentLevel) => {
    const commMap: Record<AgentLevel, 80 | 90 | 95> = { 1: 80, 2: 90, 3: 95 };
    setForm(f => ({ ...f, level, commission: commMap[level] }));
  };

  const handleParentAgentChange = (agent: Agent | null) => {
    setForm(f => ({ ...f, parentId: agent ? agent.id : null, parentName: agent ? agent.name : null }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editTarget && !form.password.trim()) {
      setError('Введите пароль для нового агента');
      return;
    }
    const parentId = form.parentType === 'company' ? null : form.parentId;
    setSaving(true); setError(null);
    try {
      if (editTarget) {
        await agentsApi.update(editTarget.id, {
          name: form.name, email: form.email, phone: form.phone, city: form.city,
          level: form.level, commission: form.commission, status: form.status,
          parentId, specialization: form.specialization,
          photo: form.photo || null, bio: form.bio, socials: form.socials,
        });
      } else {
        await agentsApi.create({
          name: form.name, email: form.email, password: form.password,
          phone: form.phone, city: form.city,
          level: form.level, commission: form.commission, status: form.status,
          parentId, specialization: form.specialization,
          photo: form.photo || null, bio: form.bio, socials: form.socials,
        });
      }
      await reloadAgents();
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить агента');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: number, status: AgentStatus) => {
    try {
      await agentsApi.update(id, { status });
      setAgents(prev => enrichAgents(prev.map(a => a.id === id ? { ...a, status } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    }
  };

  const stats = useMemo(() => ({
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    level3: agents.filter(a => a.level === 3).length,
    totalShares: agents.reduce((s, a) => s + a.shares, 0),
    pendingReviews: pendingReviewsCount,
  }), [agents, pendingReviewsCount]);

  return (
    <Box>
      {/* Stats row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Всего агентов', value: stats.total, icon: <PeopleRoundedIcon />, color: '#4361EE' },
          { label: 'Активных', value: stats.active, icon: <CheckCircleRoundedIcon />, color: '#22C55E' },
          { label: 'Уровень 3 (95%)', value: stats.level3, icon: <DiamondRoundedIcon />, color: '#C9A84C' },
          { label: 'Отзывы на модерации', value: stats.pendingReviews, icon: <RateReviewRoundedIcon />, color: '#F59E0B' },
        ].map((s, i) => (
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
            <MenuItem value="inactive">Неактивные</MenuItem>
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
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ ml: 'auto', flexShrink: 0 }}>
          Добавить агента
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
              <TableCell align="right">ВКД (год)</TableCell>
              <TableCell align="right">Комиссия</TableCell>
              <TableCell align="right">Акции</TableCell>
              <TableCell align="right">Команда</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((agent, i) => {
              const lc = levelColor(agent.level);
              const sc = statusConfig[agent.status];
              return (
                <motion.tr key={agent.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} style={{ display: 'table-row' }}>
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
                    </Box>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B' }}>Агенты не найдены</Typography>
          </Box>
        )}
      </TableContainer>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {editTarget ? 'Редактировать агента' : 'Добавить агента'}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField fullWidth label="ФИО агента" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" />
              <TextField fullWidth label="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} size="small" />
            </Box>
            {!editTarget && (
              <TextField
                fullWidth size="small" type="password"
                label="Пароль (минимум 6 символов)"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                helperText="Агент сможет сменить позже в личном кабинете"
              />
            )}
            <TextField fullWidth label="Город" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} size="small" />

            {/* MLM binding */}
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <FormLabel sx={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Источник агента (MLM)
              </FormLabel>
              <RadioGroup row value={form.parentType} onChange={e => setForm(f => ({ ...f, parentType: e.target.value as 'company' | 'agent', parentId: null, parentName: null }))}>
                <FormControlLabel value="company" control={<Radio size="small" sx={{ color: '#C9A84C', '&.Mui-checked': { color: '#C9A84C' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><BusinessRoundedIcon sx={{ fontSize: 16, color: '#C9A84C' }} /><Typography variant="body2" sx={{ fontWeight: 600 }}>Welcome 24</Typography></Box>} />
                <FormControlLabel value="agent" control={<Radio size="small" sx={{ color: '#4361EE', '&.Mui-checked': { color: '#4361EE' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AccountTreeRoundedIcon sx={{ fontSize: 16, color: '#4361EE' }} /><Typography variant="body2" sx={{ fontWeight: 600 }}>От агента</Typography></Box>} />
              </RadioGroup>
              {form.parentType === 'agent' && (
                <Autocomplete
                  sx={{ mt: 1.5 }}
                  options={agents.filter(a => !editTarget || a.id !== editTarget.id)}
                  getOptionLabel={a => a.name}
                  value={agents.find(a => a.id === form.parentId) || null}
                  onChange={(_, v) => handleParentAgentChange(v)}
                  renderInput={params => <TextField {...params} label="Выберите ментора" size="small" />}
                  renderOption={(props, a) => (
                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, background: `${levelColor(a.level).color}30`, color: levelColor(a.level).color }}>
                        {a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{a.city} · {a.commission}%</Typography>
                      </Box>
                    </Box>
                  )}
                />
              )}
            </Box>

            {/* Level */}
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                Уровень комиссии
              </Typography>
              <ToggleButtonGroup exclusive value={form.level} onChange={(_, v) => v && handleLevelChange(v as AgentLevel)} size="small" sx={{ width: '100%' }}>
                {([1, 2, 3] as AgentLevel[]).map(l => {
                  const lc = levelColor(l);
                  const commMap: Record<AgentLevel, 80 | 90 | 95> = { 1: 80, 2: 90, 3: 95 };
                  return (
                    <ToggleButton key={l} value={l} sx={{ flex: 1, borderColor: 'rgba(201,168,76,0.15)', '&.Mui-selected': { background: lc.bg, color: lc.color, borderColor: `${lc.color}40` } }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>L{l} · {commMap[l]}%</Typography>
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
              <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.1)' }}>
                <Typography variant="caption" sx={{ color: '#64748B' }}>
                  L2 порог: {fmt(companySettings.level1Threshold)} ₽ ВКД · L3 порог: {fmt(companySettings.level2Threshold)} ₽ ВКД
                </Typography>
              </Box>
            </Box>

            {/* Specialization */}
            <Autocomplete
              multiple
              options={SPECIALIZATIONS}
              value={form.specialization}
              onChange={(_, v) => setForm(f => ({ ...f, specialization: v }))}
              renderInput={params => <TextField {...params} label="Специализация" size="small" />}
              renderTags={(val, getTagProps) => val.map((opt, i) => (
                <Chip label={opt} size="small" {...getTagProps({ index: i })} sx={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }} />
              ))}
            />

            {/* Status */}
            <FormControl size="small" fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select value={form.status} label="Статус" onChange={e => setForm(f => ({ ...f, status: e.target.value as AgentStatus }))}>
                <MenuItem value="active">Активен</MenuItem>
                <MenuItem value="inactive">Неактивен</MenuItem>
                <MenuItem value="blocked">Заблокирован</MenuItem>
              </Select>
            </FormControl>

            {/* Photo + bio */}
            <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>ПУБЛИЧНЫЙ ПРОФИЛЬ</Typography>
            </Divider>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={form.photo || undefined}
                sx={{ width: 64, height: 64, fontSize: 18, fontWeight: 800, background: 'rgba(201,168,76,0.18)', color: '#C9A84C', border: '2px solid rgba(201,168,76,0.3)' }}
              >
                {form.name.split(' ').map(n => n[0]).slice(0, 2).join('') || '—'}
              </Avatar>
              <TextField
                fullWidth size="small" label="Фото (URL)"
                value={form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
                placeholder="https://… или оставьте пустым"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhotoCameraRoundedIcon sx={{ color: '#64748B', fontSize: 18 }} /></InputAdornment> } }}
              />
            </Box>
            <TextField
              fullWidth size="small" label="Биография" multiline rows={2}
              value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Короткое описание для публичной карточки — что делаете, в чём сильны"
            />

            {/* Socials */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField size="small" label="Telegram" value={form.socials.telegram || ''}
                onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, telegram: e.target.value.replace(/^@/, '') } }))}
                placeholder="username"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><TelegramIcon sx={{ color: '#229ED9', fontSize: 18 }} /></InputAdornment> } }}
              />
              <TextField size="small" label="TG-канал" value={form.socials.telegramChannel || ''}
                onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, telegramChannel: e.target.value } }))}
                placeholder="@channel"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><CampaignRoundedIcon sx={{ color: '#229ED9', fontSize: 18 }} /></InputAdornment> } }}
              />
              <TextField size="small" label="Instagram" value={form.socials.instagram || ''}
                onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, instagram: e.target.value.replace(/^@/, '') } }))}
                placeholder="username"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><InstagramIcon sx={{ color: '#E4405F', fontSize: 18 }} /></InputAdornment> } }}
              />
              <TextField size="small" label="ВКонтакте" value={form.socials.vk || ''}
                onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, vk: e.target.value } }))}
                placeholder="username или id"
              />
              <TextField size="small" label="MAX мессенджер" value={form.socials.max || ''}
                onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, max: e.target.value.replace(/^@/, '') } }))}
                placeholder="username"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><ChatRoundedIcon sx={{ color: '#7C3AED', fontSize: 18 }} /></InputAdornment> } }}
              />
            </Box>

            {!form.name.trim() && <Alert severity="warning" sx={{ py: 0.5 }}>Введите имя агента</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.email.trim() || (!editTarget && !form.password.trim())}>
            {saving ? 'Сохранение…' : editTarget ? 'Сохранить' : 'Создать агента'}
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
