import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Tooltip, Stack, Divider,
  Autocomplete, CircularProgress, Alert,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import PendingRoundedIcon from '@mui/icons-material/PendingRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import type { Deal, DealStatus, Agent } from '../types';
import { dealsApi } from '../api/deals';
import { agentsApi } from '../api/agents';

const statusConfig: Record<DealStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Ожидание', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  confirmed: { label: 'Подтверждена', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  paid: { label: 'Выплачено', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  cancelled: { label: 'Отменена', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

const typeLabels: Record<string, string> = {
  primary: 'Первичка', secondary: 'Вторичка', commercial: 'Коммерция', suburban: 'Загородная', rent: 'Аренда',
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

type FormState = {
  agentId: number | null; agentName: string;
  clientName: string; address: string; city: string;
  type: string; vkd: string; commission: number; notes: string;
  status: DealStatus; date: string;
};

const emptyForm: FormState = {
  agentId: null, agentName: '', clientName: '', address: '', city: '',
  type: 'secondary', vkd: '', commission: 80, notes: '',
  status: 'pending', date: new Date().toISOString().slice(0, 10),
};

export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DealStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deal | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const income = useMemo(() => Math.round((parseFloat(form.vkd) || 0) * form.commission / 100), [form.vkd, form.commission]);

  const reloadDeals = () => {
    setLoading(true);
    return dealsApi.list()
      .then(setDeals)
      .catch(err => setError(err?.message || 'Ошибка загрузки сделок'))
      .finally(() => setLoading(false));
  };

  // Сделки + список агентов для Autocomplete на старте.
  useEffect(() => {
    reloadDeals();
    agentsApi.list().then(setAgents).catch(() => { /* ignore */ });
  }, []);

  const filtered = useMemo(() => deals.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || d.agentName.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q) || d.address.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchQ && matchStatus;
  }), [deals, search, filterStatus]);

  const totalVKD = useMemo(() => filtered.reduce((s, d) => s + d.vkd, 0), [filtered]);
  const totalIncome = useMemo(() => filtered.reduce((s, d) => s + d.income, 0), [filtered]);
  const pendingCount = deals.filter(d => d.status === 'pending').length;

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (deal: Deal) => {
    setEditTarget(deal);
    setForm({
      agentId: deal.agentId, agentName: deal.agentName,
      clientName: deal.clientName, address: deal.address, city: deal.city,
      type: deal.type, vkd: String(deal.vkd), commission: deal.commission,
      notes: deal.notes, status: deal.status, date: deal.date,
    });
    setDialogOpen(true);
  };

  const handleAgentChange = (agent: Agent | null) => {
    if (agent) {
      setForm(f => ({ ...f, agentId: agent.id, agentName: agent.name, commission: agent.commission }));
    } else {
      setForm(f => ({ ...f, agentId: null, agentName: '', commission: 80 }));
    }
  };

  const handleSave = async () => {
    if (!form.agentId || !form.clientName || !form.vkd) return;
    const vkdNum = parseFloat(form.vkd);
    setSaving(true); setError(null);
    try {
      if (editTarget) {
        await dealsApi.update(editTarget.id, {
          clientName: form.clientName, address: form.address, city: form.city,
          type: form.type as Deal['type'], vkd: vkdNum,
          income: Math.round(vkdNum * form.commission / 100),
          commission: form.commission, notes: form.notes, status: form.status, date: form.date,
        });
      } else {
        await dealsApi.create({
          agentId: form.agentId!,
          clientName: form.clientName, address: form.address, city: form.city,
          type: form.type as Deal['type'], vkd: vkdNum,
          commission: form.commission as 80 | 90 | 95,
          notes: form.notes, status: form.status, date: form.date,
        });
      }
      await reloadDeals();
      setDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить сделку');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: number, status: DealStatus) => {
    try {
      if (status === 'confirmed') await dealsApi.confirm(id);
      else if (status === 'paid') await dealsApi.pay(id);
      else if (status === 'cancelled') await dealsApi.cancel(id);
      else await dealsApi.update(id, { status });
      setDeals(prev => prev.map(d => d.id === id ? { ...d, status } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить статус');
    }
  };

  return (
    <Box>
      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Сделок найдено', value: filtered.length, icon: <HandshakeRoundedIcon />, color: '#4361EE' },
          { label: 'Ожидают оплаты', value: pendingCount, icon: <PendingRoundedIcon />, color: '#F59E0B' },
          { label: 'Общий ВКД', value: `${(totalVKD / 1e6).toFixed(1)} млн ₽`, icon: <MonetizationOnRoundedIcon />, color: '#C9A84C' },
          { label: 'Доход компании', value: `${(totalIncome / 1e6).toFixed(1)} млн ₽`, icon: <CheckCircleRoundedIcon />, color: '#22C55E' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ flex: '1 1 180px' }}>
            <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                {s.icon}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9', lineHeight: 1 }}>{s.value}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>{s.label}</Typography>
              </Box>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Поиск по агенту, клиенту, адресу…"
          value={search} onChange={e => setSearch(e.target.value)} size="small" sx={{ flex: '1 1 260px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Статус</InputLabel>
          <Select value={filterStatus} label="Статус" onChange={e => setFilterStatus(e.target.value as DealStatus | 'all')}>
            <MenuItem value="all">Все статусы</MenuItem>
            {(Object.entries(statusConfig) as [DealStatus, typeof statusConfig[DealStatus]][]).map(([k, v]) => (
              <MenuItem key={k} value={k}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ ml: 'auto', flexShrink: 0 }}>
          Новая сделка
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
              <TableCell>Клиент / Адрес</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell align="right">ВКД</TableCell>
              <TableCell align="right">Ком-я</TableCell>
              <TableCell align="right">Доход</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((deal, i) => {
              const sc = statusConfig[deal.status];
              return (
                <motion.tr key={deal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ display: 'table-row' }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{deal.agentName.split(' ').slice(0, 2).join(' ')}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.city}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#F1F5F9' }}>{deal.clientName}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.address}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={typeLabels[deal.type] || deal.type} size="small" sx={{ background: 'rgba(67,97,238,0.12)', color: '#60A5FA', fontWeight: 600, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    <Chip label={sc.label} size="small" sx={{ background: sc.bg, color: sc.color, fontWeight: 600, fontSize: 11 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{fmt(deal.vkd)} ₽</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{deal.commission}%</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#22C55E' }}>{fmt(deal.income)} ₽</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>{deal.date}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => openEdit(deal)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {deal.status === 'pending' && (
                        <Tooltip title="Подтвердить">
                          <IconButton size="small" onClick={() => updateStatus(deal.id, 'confirmed')} sx={{ color: '#64748B', '&:hover': { color: '#3B82F6' } }}>
                            <CheckCircleRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {deal.status === 'confirmed' && (
                        <Tooltip title="Выплачено">
                          <IconButton size="small" onClick={() => updateStatus(deal.id, 'paid')} sx={{ color: '#64748B', '&:hover': { color: '#22C55E' } }}>
                            <MonetizationOnRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {deal.status !== 'cancelled' && deal.status !== 'paid' && (
                        <Tooltip title="Отменить">
                          <IconButton size="small" onClick={() => updateStatus(deal.id, 'cancelled')} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                            <CancelRoundedIcon fontSize="small" />
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
            <Typography sx={{ color: '#64748B' }}>Сделки не найдены</Typography>
          </Box>
        )}
      </TableContainer>

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {editTarget ? 'Редактировать сделку' : 'Новая сделка'}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            {/* Agent picker */}
            <Autocomplete
              options={agents}
              getOptionLabel={a => a.name}
              value={agents.find(a => a.id === form.agentId) || null}
              onChange={(_, v) => handleAgentChange(v)}
              renderInput={params => <TextField {...params} label="Агент *" size="small" />}
              renderOption={(props, a) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8 }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{a.city} · {a.commission}% комиссия</Typography>
                  </Box>
                </Box>
              )}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth label="Клиент (ФИО) *" value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} size="small" />
              <TextField fullWidth label="Город" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} size="small" />
            </Box>

            <TextField fullWidth label="Адрес объекта" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} size="small" />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Тип сделки</InputLabel>
                <Select value={form.type} label="Тип сделки" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <MenuItem value="primary">Первичка</MenuItem>
                  <MenuItem value="secondary">Вторичка</MenuItem>
                  <MenuItem value="commercial">Коммерция</MenuItem>
                  <MenuItem value="suburban">Загородная</MenuItem>
                  <MenuItem value="rent">Аренда</MenuItem>
                </Select>
              </FormControl>
              <TextField fullWidth label="Дата" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} size="small"
                slotProps={{ inputLabel: { shrink: true } }} />
            </Box>

            {/* VKD + commission */}
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Финансы сделки
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth label="ВКД (₽) *" type="number"
                  value={form.vkd} onChange={e => setForm(f => ({ ...f, vkd: e.target.value }))}
                  size="small"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
                />
                <TextField
                  fullWidth label="Комиссия %" type="number"
                  value={form.commission} onChange={e => setForm(f => ({ ...f, commission: Number(e.target.value) }))}
                  size="small"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                />
              </Box>
              {income > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Доход компании:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#22C55E' }}>{fmt(income)} ₽</Typography>
                </Box>
              )}
            </Box>

            <FormControl size="small" fullWidth>
              <InputLabel>Статус</InputLabel>
              <Select value={form.status} label="Статус" onChange={e => setForm(f => ({ ...f, status: e.target.value as DealStatus }))}>
                {(Object.entries(statusConfig) as [DealStatus, typeof statusConfig[DealStatus]][]).map(([k, v]) => (
                  <MenuItem key={k} value={k}>{v.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField fullWidth label="Примечания" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} size="small" multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.agentId || !form.clientName || !form.vkd}>
            {saving ? 'Сохранение…' : editTarget ? 'Сохранить' : 'Создать сделку'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
