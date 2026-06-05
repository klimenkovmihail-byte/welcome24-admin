import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Tooltip, Stack, Divider,
  Autocomplete, CircularProgress, Alert, Switch, FormControlLabel,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { Deal, Agent } from '../types';
import { dealsApi } from '../api/deals';
import { agentsApi } from '../api/agents';
import { api, API_BASE_URL, getToken } from '../api/apiClient';
import { getCurrentUser } from '../auth/auth';

const typeLabels: Record<string, string> = {
  primary: 'Первичка', secondary: 'Вторичка', commercial: 'Коммерция', suburban: 'Загородная', rent: 'Аренда',
};

const fmt = (n: number) => n.toLocaleString('ru-RU');

function pluralDeals(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'сделка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'сделки';
  return 'сделок';
}

// ============================================================
// Внутренний state формы изолирован в этом компоненте.
// Любой ввод не ререндерит таблицу из 1800+ строк наверху.
// ============================================================
interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  editTarget: Deal | null;
  onSaved: () => void;
}

type Category = 'primary' | 'secondary' | 'rent';

type FormState = {
  agentId: number | null;
  city: string;
  category: Category;
  type: string;
  vkd: string;
  commission: number;
  date: string;
};

// Если категория уже сохранена — используем её; иначе выводим из type.
function categoryFromType(type: string): Category {
  if (type === 'primary') return 'primary';
  if (type === 'rent')    return 'rent';
  return 'secondary';
}

const emptyForm: FormState = {
  agentId: null,
  city: '',
  category: 'secondary',
  type: 'secondary',
  vkd: '',
  commission: 80,
  date: new Date().toISOString().slice(0, 10),
};

function DealFormDialog({ open, onClose, agents, editTarget, onSaved }: FormDialogProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [suggestion, setSuggestion] = useState<{ ytdVkdBefore: number; suggestedCommission: number; level: number; year: number } | null>(null);
  const [commissionEdited, setCommissionEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Инициализация формы при открытии (create или edit)
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setForm({
        agentId: editTarget.agentId,
        city: editTarget.city || '',
        category: (editTarget.category as Category) || categoryFromType(editTarget.type),
        type: editTarget.type,
        vkd: String(editTarget.vkd),
        commission: editTarget.commission,
        date: editTarget.date,
      });
      setCommissionEdited(true); // не подменяем сохранённый %
    } else {
      setForm({ ...emptyForm });
      setCommissionEdited(false);
    }
    setSuggestion(null);
    setError(null);
  }, [open, editTarget]);

  // Подсказка % комиссии при выборе агента и/или даты
  useEffect(() => {
    if (!open || !form.agentId || !form.date) { setSuggestion(null); return; }
    const params = new URLSearchParams({ date: form.date });
    if (editTarget) params.set('excludeDealId', String(editTarget.id));
    let cancelled = false;
    api.get<{ ytdVkdBefore: number; suggestedCommission: number; level: number; year: number }>(
      `/api/agents/${form.agentId}/commission-suggestion?${params.toString()}`
    )
      .then(s => {
        if (cancelled) return;
        setSuggestion(s);
        if (!commissionEdited) {
          setForm(f => ({ ...f, commission: s.suggestedCommission }));
        }
      })
      .catch(() => { /* tolerate */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.agentId, form.date, open, editTarget]);

  const income = useMemo(
    () => Math.round((parseFloat(form.vkd) || 0) * form.commission / 100),
    [form.vkd, form.commission],
  );

  const handleAgentChange = (agent: Agent | null) => {
    setForm(f => ({ ...f, agentId: agent?.id || null }));
    setCommissionEdited(false);
  };

  const handleSave = async () => {
    if (!form.agentId || !form.vkd) return;
    const vkdNum = parseFloat(form.vkd);
    setSaving(true); setError(null);
    try {
      if (editTarget) {
        await dealsApi.update(editTarget.id, {
          clientName: editTarget.clientName || '—',
          address: editTarget.address || '',
          city: form.city,
          type: form.type as Deal['type'],
          category: form.category,
          vkd: vkdNum,
          income: Math.round(vkdNum * form.commission / 100),
          commission: form.commission,
          notes: editTarget.notes || '',
          status: editTarget.status,
          date: form.date,
        });
      } else {
        await dealsApi.create({
          agentId: form.agentId!,
          clientName: '—',
          address: '',
          city: form.city,
          type: form.type as Deal['type'],
          category: form.category,
          vkd: vkdNum,
          commission: form.commission as 80 | 90 | 95,
          notes: '',
          status: 'paid',  // статусы убраны из UI — сделка сразу считается выполненной
          date: form.date,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить сделку');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
          {editTarget ? 'Редактировать сделку' : 'Новая сделка'}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748B' }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        <Stack spacing={2.5}>
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
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{a.city}</Typography>
                </Box>
              </Box>
            )}
          />

          <TextField
            fullWidth
            label="Город"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            size="small"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Категория</InputLabel>
              <Select
                value={form.category}
                label="Категория"
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
              >
                <MenuItem value="primary">Первичка</MenuItem>
                <MenuItem value="secondary">Вторичка</MenuItem>
                <MenuItem value="rent">Аренда</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Подтип</InputLabel>
              <Select value={form.type} label="Подтип" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <MenuItem value="primary">Жилая (первичка)</MenuItem>
                <MenuItem value="secondary">Жилая (вторичка)</MenuItem>
                <MenuItem value="commercial">Коммерция</MenuItem>
                <MenuItem value="suburban">Загородная</MenuItem>
                <MenuItem value="rent">Аренда</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <TextField
            fullWidth
            label="Дата"
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />

          <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
              Финансы сделки
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="ВКД (₽) *"
                type="number"
                value={form.vkd}
                onChange={e => setForm(f => ({ ...f, vkd: e.target.value }))}
                size="small"
                slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
              />
              <TextField
                fullWidth
                label="Комиссия %"
                type="number"
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
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.agentId || !form.vkd}>
          {saving ? 'Сохранение…' : editTarget ? 'Сохранить' : 'Создать сделку'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ============================================================
// Диалог импорта xlsx сделок с MLM-связями.
// Отправляет multipart/form-data на /api/admin/import/deals-mlm.
// Чекбокс «Заменить все» — опасная операция (DELETE + INSERT).
// ============================================================
interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

function ImportDealsDialog({ open, onClose, onImported }: ImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ parsedRows: number; logs: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null); setReplace(false); setError(null); setResult(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const url = `${API_BASE_URL}/api/admin/import/deals-mlm${replace ? '?replace=1' : ''}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setResult(json);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось импортировать');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Импорт сделок из xlsx</Typography>
        <IconButton size="small" onClick={onClose} disabled={busy} sx={{ color: '#64748B' }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {result ? (
          <Box>
            <Alert severity="success" sx={{ mb: 2 }}>
              Загружено строк: <b>{result.parsedRows}</b>. {replace ? 'База сделок заменена.' : 'Новые сделки добавлены (дубли пропущены).'}
            </Alert>
            <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1 }}>Логи импорта:</Typography>
            <Box sx={{ maxHeight: 240, overflowY: 'auto', p: 1.5, borderRadius: 1.5, background: 'rgba(0,0,0,0.3)', fontFamily: 'monospace', fontSize: 11 }}>
              {result.logs.map((line, i) => (
                <Box key={i} sx={{ color: line.startsWith('[warn]') ? '#F59E0B' : '#94A3B8', whiteSpace: 'pre-wrap' }}>{line}</Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>
              Ожидаемый формат: xlsx с колонками <b>ФИО</b>, <b>Дата сделки</b>, <b>Сумма ВКД</b>, <b>Сумма ВКД Агента</b>, <b>Кто привёл</b>, <b>Тип сделки</b> (новостройка / вторичка / аренда).
            </Typography>
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
              <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => fileInputRef.current?.click()} fullWidth>
                {file ? file.name : 'Выбрать файл .xlsx'}
              </Button>
            </Box>
            <FormControlLabel
              control={<Switch checked={replace} onChange={e => setReplace(e.target.checked)} color="warning" />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600 }}>Заменить все существующие сделки</Typography>
                  <Typography variant="caption" sx={{ color: '#F59E0B' }}>
                    Без галочки — добавит новые, дубли пропустит. С галочкой — сначала удалит ВСЕ сделки из БД, потом зальёт из файла.
                  </Typography>
                </Box>
              }
            />
            {replace && (
              <Alert severity="warning" icon={<WarningAmberRoundedIcon />}>
                <b>Опасно.</b> Все текущие сделки будут удалены и заменены содержимым файла. Действие необратимо.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        {result ? (
          <Button variant="contained" onClick={onClose}>Готово</Button>
        ) : (
          <>
            <Button onClick={onClose} sx={{ color: '#64748B' }} disabled={busy}>Отмена</Button>
            <Button
              variant="contained" color={replace ? 'warning' : 'primary'}
              onClick={handleSubmit} disabled={busy || !file}
            >
              {busy ? 'Импорт…' : replace ? 'Заменить и импортировать' : 'Импортировать'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ============================================================
// Главный компонент страницы
// ============================================================
export default function Deals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [limit, setLimit] = useState(25); // последние 25; «Показать ещё» добавляет по 50
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deal | null>(null);
  // Удалять сделки может только super_admin (необратимо, влияет на комиссию/MLM).
  const canDelete = getCurrentUser()?.role === 'super_admin';

  // Дебаунс поиска — серверный запрос не на каждый символ.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const reloadDeals = useCallback(() => {
    setLoading(true);
    const filter = { year, month, q: debouncedSearch };
    return Promise.all([
      dealsApi.list({ ...filter, limit }),
      dealsApi.count(filter),
    ])
      .then(([rows, cnt]) => { setDeals(rows); setTotal(cnt); })
      .catch(err => setError(err?.message || 'Ошибка загрузки сделок'))
      .finally(() => setLoading(false));
  }, [year, month, debouncedSearch, limit]);

  useEffect(() => { reloadDeals(); }, [reloadDeals]);
  useEffect(() => { agentsApi.list().then(setAgents).catch(() => { /* ignore */ }); }, []);

  // Сервер уже отсортировал по дате DESC и ограничил лимитом — выводим как есть.
  const filtered = deals;
  // Годы для фильтра: от текущего до 2024.
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const ys: string[] = [];
    for (let y = cur; y >= 2024; y--) ys.push(String(y));
    return ys;
  }, []);
  const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = useCallback((deal: Deal) => { setEditTarget(deal); setDialogOpen(true); }, []);

  const handleDelete = useCallback(async (deal: Deal) => {
    // Двойное подтверждение — удаление сделки необратимо.
    if (!confirm(`Удалить сделку #${deal.id} (${deal.agentName}, ${fmt(deal.vkd)} ₽)?`)) return;
    if (!confirm('Вы уверены? Сделка будет удалена БЕЗВОЗВРАТНО — это повлияет на ВКД, комиссию и MLM агента.')) return;
    try {
      await dealsApi.remove(deal.id);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сделку');
    }
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Поиск по агенту, городу…"
          value={search} onChange={e => { setSearch(e.target.value); setLimit(25); }} size="small" sx={{ flex: '1 1 220px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Месяц</InputLabel>
          <Select value={month} label="Месяц" onChange={e => { setMonth(e.target.value); setLimit(25); }}>
            <MenuItem value="all">Все</MenuItem>
            {RU_MONTHS.map((m, i) => <MenuItem key={i} value={String(i + 1).padStart(2, '0')}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel>Год</InputLabel>
          <Select value={year} label="Год" onChange={e => { setYear(e.target.value); setLimit(25); }}>
            <MenuItem value="all">Все</MenuItem>
            {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="caption" sx={{ color: '#64748B', mr: 1 }}>
          {total} {pluralDeals(total)}
        </Typography>
        <Button
          variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => setImportOpen(true)}
          sx={{ ml: 'auto', flexShrink: 0, borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.06)' } }}
        >
          Импорт xlsx
        </Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          Новая сделка
        </Button>
      </Box>

      <ImportDealsDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={reloadDeals}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#C9A84C' }} />
        </Box>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', display: loading ? 'none' : 'block' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Агент</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell align="right">ВКД</TableCell>
              <TableCell align="right">Ком-я</TableCell>
              <TableCell align="right">Доход</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((deal) => (
              <TableRow key={deal.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{deal.agentName.split(' ').slice(0, 2).join(' ')}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.city}</Typography>
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
                    {canDelete && (
                      <Tooltip title="Удалить сделку (super_admin)">
                        <IconButton size="small" onClick={() => handleDelete(deal)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!loading && filtered.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B' }}>Сделки не найдены</Typography>
          </Box>
        )}
        {deals.length < total && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Button variant="outlined" disabled={loading} onClick={() => setLimit(l => l + 50)}
              sx={{ borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C' }}>
              Показать ещё 50 (показано {deals.length} из {total})
            </Button>
          </Box>
        )}
      </TableContainer>

      <DealFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        agents={agents}
        editTarget={editTarget}
        onSaved={reloadDeals}
      />
    </Box>
  );
}
