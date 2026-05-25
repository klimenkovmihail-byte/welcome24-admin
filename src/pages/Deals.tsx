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
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import type { Deal, DealStatus, Agent } from '../types';
import { dealsApi } from '../api/deals';
import { agentsApi } from '../api/agents';
import { api } from '../api/apiClient';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deal | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  // Подсказка процента комиссии от бэка (по накопленному ВКД агента за год)
  const [suggestion, setSuggestion] = useState<{ ytdVkdBefore: number; suggestedCommission: number; level: number; year: number } | null>(null);
  const [commissionEdited, setCommissionEdited] = useState(false);  // админ изменил вручную

  const income = useMemo(() => Math.round((parseFloat(form.vkd) || 0) * form.commission / 100), [form.vkd, form.commission]);

  // Запрашиваем подсказку при изменении агента или даты.
  // При редактировании передаём excludeDealId — чтоб сама сделка не учитывалась в sumBefore.
  useEffect(() => {
    if (!dialogOpen || !form.agentId || !form.date) { setSuggestion(null); return; }
    const params = new URLSearchParams({ date: form.date });
    if (editTarget) params.set('excludeDealId', String(editTarget.id));
    let cancelled = false;
    api.get<{ ytdVkdBefore: number; suggestedCommission: number; level: number; year: number }>(
      `/api/agents/${form.agentId}/commission-suggestion?${params.toString()}`
    )
      .then(s => {
        if (cancelled) return;
        setSuggestion(s);
        // Подставляем рекомендованный % если админ не правил вручную
        if (!commissionEdited) {
          setForm(f => ({ ...f, commission: s.suggestedCommission }));
        }
      })
      .catch(() => { /* tolerate */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.agentId, form.date, dialogOpen, editTarget]);

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
    return !q || d.agentName.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q) || d.address.toLowerCase().includes(q);
  }), [deals, search]);

  const openCreate = () => {
    setEditTarget(null);
    setForm({ ...emptyForm });
    setCommissionEdited(false);
    setSuggestion(null);
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
    setCommissionEdited(true); // при редактировании сохраняем существующий процент
    setSuggestion(null);
    setDialogOpen(true);
  };

  const handleAgentChange = (agent: Agent | null) => {
    if (agent) {
      setForm(f => ({ ...f, agentId: agent.id, agentName: agent.name }));
    } else {
      setForm(f => ({ ...f, agentId: null, agentName: '' }));
    }
    setCommissionEdited(false); // позволим эффекту подставить процент по новому агенту
  };

  const handleSave = async () => {
    if (!form.agentId || !form.vkd) return;
    const vkdNum = parseFloat(form.vkd);
    setSaving(true); setError(null);
    // Поле «Клиент (ФИО)» убрано из формы, но колонка в БД NOT NULL — подставим прочерк.
    const clientName = form.clientName?.trim() || '—';
    try {
      if (editTarget) {
        await dealsApi.update(editTarget.id, {
          clientName, address: form.address, city: form.city,
          type: form.type as Deal['type'], vkd: vkdNum,
          income: Math.round(vkdNum * form.commission / 100),
          commission: form.commission, notes: form.notes, status: form.status, date: form.date,
        });
      } else {
        await dealsApi.create({
          agentId: form.agentId!,
          clientName, address: form.address, city: form.city,
          type: form.type as Deal['type'], vkd: vkdNum,
          commission: form.commission as 80 | 90 | 95,
          notes: form.notes, status: 'pending', date: form.date,
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

  const handleDelete = async (deal: Deal) => {
    if (!confirm(`Удалить сделку «${deal.address || deal.clientName || `#${deal.id}`}»?`)) return;
    try {
      await dealsApi.remove(deal.id);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сделку');
    }
  };

  return (
    <Box>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Поиск по агенту, клиенту, адресу…"
          value={search} onChange={e => setSearch(e.target.value)} size="small" sx={{ flex: '1 1 260px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <Typography variant="caption" sx={{ color: '#64748B', mr: 1 }}>
          {filtered.length} {filtered.length % 10 === 1 && filtered.length % 100 !== 11 ? 'сделка' : (filtered.length % 10 >= 2 && filtered.length % 10 <= 4 && (filtered.length % 100 < 12 || filtered.length % 100 > 14) ? 'сделки' : 'сделок')}
        </Typography>
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
              <TableCell>Адрес</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell align="right">ВКД</TableCell>
              <TableCell align="right">Ком-я</TableCell>
              <TableCell align="right">Доход</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((deal, i) => (
              <motion.tr key={deal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ display: 'table-row' }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{deal.agentName.split(' ').slice(0, 2).join(' ')}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.city}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ color: '#F1F5F9', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.address || '—'}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={typeLabels[deal.type] || deal.type} size="small" sx={{ background: 'rgba(67,97,238,0.12)', color: '#60A5FA', fontWeight: 600, fontSize: 11 }} />
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
                    <Tooltip title="Удалить">
                      <IconButton size="small" onClick={() => handleDelete(deal)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </motion.tr>
            ))}
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
              <TextField fullWidth label="Город" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} size="small" />
              <TextField fullWidth label="Адрес объекта" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} size="small" />
            </Box>

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
                  value={form.commission}
                  onChange={e => { setForm(f => ({ ...f, commission: Number(e.target.value) })); setCommissionEdited(true); }}
                  size="small"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                  helperText={commissionEdited ? 'Изменено вручную' : 'Рекомендовано системой'}
                />
              </Box>
              {suggestion && (
                <Box sx={{ mt: 1.5, p: 1.2, borderRadius: 1.5, background: 'rgba(67,97,238,0.08)', border: '1px solid rgba(67,97,238,0.2)', display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: '#60A5FA', mt: 0.2 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 600, display: 'block' }}>
                      Рекомендуется {suggestion.suggestedCommission}% (L{suggestion.level})
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>
                      ВКД агента в {suggestion.year} г. до этой сделки: <b style={{ color: '#F1F5F9' }}>{fmt(suggestion.ytdVkdBefore)} ₽</b>
                      {' · '}порог L2 — 2 млн, L3 — 5 млн{' · '}
                      с 1 января все возвращаются на 80%
                    </Typography>
                    {commissionEdited && (
                      <Button
                        size="small"
                        onClick={() => { setForm(f => ({ ...f, commission: suggestion.suggestedCommission })); setCommissionEdited(false); }}
                        sx={{ mt: 0.5, fontSize: 11, p: 0, minHeight: 0, color: '#60A5FA' }}
                      >
                        вернуть {suggestion.suggestedCommission}%
                      </Button>
                    )}
                  </Box>
                </Box>
              )}
              {income > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Доход агента:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#22C55E' }}>{fmt(income)} ₽</Typography>
                </Box>
              )}
            </Box>

            <TextField fullWidth label="Примечания" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} size="small" multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.agentId || !form.vkd}>
            {saving ? 'Сохранение…' : editTarget ? 'Сохранить' : 'Создать сделку'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
