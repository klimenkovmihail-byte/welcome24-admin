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
import CalculateRoundedIcon from '@mui/icons-material/CalculateRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import Checkbox from '@mui/material/Checkbox';
import type { Deal, Agent } from '../types';
import type { Role } from '../auth/roles';
import { dealsApi } from '../api/deals';
import ConfirmDialog from '../components/ConfirmDialog';
import DealApprovals from '../components/DealApprovals';
import { useAgents } from '../hooks/useAgents';
import { useFullScreenDialog } from '../hooks/useFullScreenDialog';
import { api, API_BASE_URL, getToken } from '../api/apiClient';
import { getCurrentUser } from '../auth/auth';
import { plural, formatDate, formatRub } from '../utils/format';

const typeLabels: Record<string, string> = {
  primary: 'Первичка', secondary: 'Вторичка', commercial: 'Коммерция', suburban: 'Загородная', rent: 'Аренда',
};

// role приходит из бэка (см. normalizeAgent), но в тип Agent не входит — расширяем локально.
type AgentWithRole = Agent & { role?: Role };

const fmt = (n: number) => n.toLocaleString('ru-RU');

// Минимальный год данных — единый источник для фильтра списка и диалога пересчёта.
const MIN_DEAL_YEAR = 2022;

const dealsWord = (n: number) => plural(n, 'сделка', 'сделки', 'сделок');

// Липкая первая колонка «Агент» — на узком экране таблица скроллится вбок,
// а имя агента остаётся на месте. Фон под тёмную тему перекрывает уезжающий контент.
const stickyAgentCell = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
};

// Тап-таргет иконок-действий: на телефоне зона нажатия ≥40px (визуал иконки прежний).
// Отрицательный margin компенсирует паддинг, чтобы строка не подросла по высоте.
const actionTapTarget = {
  color: '#64748B',
  minWidth: { xs: 40, sm: 'auto' },
  minHeight: { xs: 40, sm: 'auto' },
  m: { xs: '-3px', sm: 0 },
};

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
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [suggestion, setSuggestion] = useState<{ ytdVkdBefore: number; suggestedCommission: number; level: number; year: number } | null>(null);
  const [commissionEdited, setCommissionEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vkdError, setVkdError] = useState<string | null>(null);
  const [commissionError, setCommissionError] = useState<string | null>(null);

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
    setVkdError(null);
    setCommissionError(null);
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

  // Сделку заводят только на агентов: убираем из выбора штаб (админ/юрист/брокер/…).
  // Заблокированных/уволенных агентов оставляем в списке, но помечаем и опускаем вниз —
  // редактируя старую сделку, можно оставить прежнего исполнителя, даже если он уже уволен.
  const isBlockedAgent = (a: Agent) => a.status !== 'active' || Boolean(a.terminatedAt);
  const agentOptions = useMemo(() => {
    const onlyAgents = agents.filter(a => ((a as AgentWithRole).role || 'agent') === 'agent');
    return [...onlyAgents].sort((x, y) => Number(isBlockedAgent(x)) - Number(isBlockedAgent(y)));
  }, [agents]);

  const handleAgentChange = (agent: Agent | null) => {
    setForm(f => ({ ...f, agentId: agent?.id || null }));
    setCommissionEdited(false);
  };

  const handleSave = async () => {
    if (!form.agentId || !form.vkd) return;
    const vkdNum = parseFloat(form.vkd);
    // Валидация перед записью в финансовое ядро: ВКД строго > 0, комиссия в диапазоне 1..100.
    const vkdMsg = !Number.isFinite(vkdNum) || vkdNum <= 0 ? 'ВКД должен быть больше нуля' : null;
    const commMsg = !Number.isFinite(form.commission) || form.commission < 1 || form.commission > 100
      ? 'Комиссия должна быть от 1 до 100' : null;
    setVkdError(vkdMsg);
    setCommissionError(commMsg);
    if (vkdMsg || commMsg) return;
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { ...paperSafeArea } } }}
    >
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
            options={agentOptions}
            disabled={!!editTarget}
            getOptionLabel={a => a.name}
            value={agents.find(a => a.id === form.agentId) || null}
            onChange={(_, v) => handleAgentChange(v)}
            renderInput={params => <TextField {...params} label="Агент *" size="small" />}
            renderOption={(props, a) => {
              const blocked = isBlockedAgent(a);
              return (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8, opacity: blocked ? 0.6 : 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                      {blocked && (
                        <Chip
                          label={a.terminatedAt ? 'уволен' : 'заблокирован'}
                          size="small"
                          sx={{ height: 18, fontSize: 10, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.14)' }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{a.city}</Typography>
                  </Box>
                </Box>
              );
            }}
          />

          <TextField
            fullWidth
            label="Город"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            size="small"
          />

          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
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
            <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                fullWidth
                label="ВКД (₽) *"
                type="number"
                value={form.vkd}
                onChange={e => { setForm(f => ({ ...f, vkd: e.target.value })); if (vkdError) setVkdError(null); }}
                size="small"
                error={!!vkdError}
                helperText={vkdError || undefined}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
              />
              <TextField
                fullWidth
                label="Комиссия %"
                type="number"
                value={form.commission}
                onChange={e => { setForm(f => ({ ...f, commission: Number(e.target.value) })); setCommissionEdited(true); if (commissionError) setCommissionError(null); }}
                size="small"
                error={!!commissionError}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                helperText={commissionError || (commissionEdited ? 'Изменено вручную' : 'Рекомендовано системой')}
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
                    ВКД агента в {suggestion.year} г. до этой сделки: <b style={{ color: '#F1F5F9' }}>{formatRub(suggestion.ytdVkdBefore)}</b>
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
                <Typography variant="body2" sx={{ fontWeight: 800, color: '#22C55E' }}>{formatRub(income)}</Typography>
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
  total: number;
}

function ImportDealsDialog({ open, onClose, onImported, total }: ImportDialogProps) {
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ parsedRows: number; logs: string[] } | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false); // финальное подтверждение перед заменой всей базы
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null); setReplace(false); setError(null); setResult(null); setConfirmReplace(false);
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
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { ...paperSafeArea } } }}
    >
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
              onClick={() => { if (replace) setConfirmReplace(true); else handleSubmit(); }} disabled={busy || !file}
            >
              {busy ? 'Импорт…' : replace ? 'Заменить и импортировать' : 'Импортировать'}
            </Button>
          </>
        )}
      </DialogActions>

      <ConfirmDialog
        open={confirmReplace}
        danger
        title="Заменить все сделки?"
        text={`Заменить ВСЕ ${fmt(total)} ${dealsWord(total)} данными из файла? Текущие сделки будут удалены безвозвратно.`}
        confirmLabel="Заменить"
        loading={busy}
        onConfirm={() => { setConfirmReplace(false); handleSubmit(); }}
        onClose={() => setConfirmReplace(false)}
      />
    </Dialog>
  );
}

// ============================================================
// S2: пересчёт комиссий по правилу прогрессии — инструмент с diff-превью (решение CEO: НЕ авто).
// Сделка задней датой меняет YTD-прогрессию последующих сделок года — превью показывает
// «было→стало», применяются ТОЛЬКО отмеченные строки. «Понижения» (пересчёт СНИЖАЕТ % против
// текущего = вероятная ручная надбавка админа, в БД не помечена) по умолчанию ИСКЛЮЧЕНЫ.
// Применение — только super_admin (бэк перепроверяет diff в транзакции; 409 = данные изменились).
// ============================================================
interface RecomputeChange {
  id: number; date: string; vkd: number; oldPct: number; newPct: number; oldIncome: number; newIncome: number;
  client_name: string; address: string; status: string; joint: boolean; lowered: boolean;
}
interface RecomputePreview {
  agent: { id: number; name: string; commission_fixed: number | null };
  thresholds: { l1: number; l2: number };
  year: string | null;
  changes: RecomputeChange[];
  unprocessable: { id: number; date: string | null; vkd: number | null; client_name: string }[];
}

const STATUS_RU: Record<string, string> = { pending: 'черновик', confirmed: 'проведена', paid: 'выплачена', cancelled: 'отменена' };

function RecomputeDialog({ open, onClose, agents, onApplied }: { open: boolean; onClose: () => void; agents: Agent[]; onApplied: () => void }) {
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  const isSuper = getCurrentUser()?.role === 'super_admin';
  const curYear = String(new Date().getFullYear());
  const [agentId, setAgentId] = useState<number | null>(null);
  const [year, setYear] = useState(curYear);
  const [preview, setPreview] = useState<RecomputePreview | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const reqSeq = useRef(0); // анти-гонка: устаревший ответ превью не перезаписывает свежий выбор

  useEffect(() => {
    if (!open) { setAgentId(null); setYear(curYear); setPreview(null); setChecked(new Set()); setError(null); setDone(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const yearOptions = useMemo(() => {
    const ys: string[] = [];
    for (let y = Number(curYear); y >= MIN_DEAL_YEAR; y--) ys.push(String(y));
    return ys;
  }, [curYear]);

  const loadPreview = async (aid = agentId, yr = year) => {
    if (!aid) return;
    const seq = ++reqSeq.current;
    setBusy(true); setError(null); setDone(null);
    try {
      const p = await api.post<RecomputePreview>('/api/deals/recompute/preview', { agentId: aid, year: yr === 'all' ? '' : yr });
      if (seq !== reqSeq.current) return; // выбор сменился, пока грузили — ответ устарел
      setPreview(p);
      // Дефолт (решение CEO): понижения НЕ отмечены — админ включает осознанно.
      setChecked(new Set(p.changes.filter(c => !c.lowered).map(c => c.id)));
    } catch (e) {
      if (seq !== reqSeq.current) return;
      setPreview(null); setError(e instanceof Error ? e.message : 'Не удалось получить превью');
    } finally { if (seq === reqSeq.current) setBusy(false); }
  };

  const apply = async () => {
    if (!preview || !agentId) return;
    const rows = preview.changes.filter(c => checked.has(c.id))
      .map(({ id, oldPct, newPct, oldIncome, newIncome }) => ({ id, oldPct, newPct, oldIncome, newIncome }));
    if (!rows.length) return;
    if (!confirm(`Применить пересчёт ${rows.length} строк агента «${preview.agent.name}»? Комиссия/доход изменятся задним числом (включая выплаченные).`)) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<{ ok: boolean; applied: number }>('/api/deals/recompute/apply', { agentId, year: year === 'all' ? '' : year, changes: rows });
      setDone(r.applied); setPreview(null); onApplied();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось применить';
      setBusy(false);
      if (msg.includes('изменились')) {
        await loadPreview();  // TOCTOU: сначала свежий diff…
        setError(msg);        // …потом сообщение — иначе setError(null) внутри loadPreview его затирает
      } else {
        setError(msg);
      }
      return;
    }
    setBusy(false);
  };

  const sel = preview ? preview.changes.filter(c => checked.has(c.id)) : [];
  const deltaIncome = sel.reduce((s, c) => s + (c.newIncome - c.oldIncome), 0);
  // «Выбрать все» оперирует только не-понижениями — понижения (снятые по решению CEO)
  // включаются исключительно вручную и одним кликом не отмечаются.
  const selectable = preview ? preview.changes.filter(c => !c.lowered) : [];
  const allChecked = selectable.length > 0 && selectable.every(c => checked.has(c.id));
  const toggleAll = () => {
    if (!preview) return;
    setChecked(prev => {
      if (allChecked) {
        // снимаем только не-понижения; вручную отмеченные понижения не трогаем
        const n = new Set(prev);
        for (const c of selectable) n.delete(c.id);
        return n;
      }
      // добавляем не-понижения к текущему выбору, сохраняя ручные отметки понижений
      const n = new Set(prev);
      for (const c of selectable) n.add(c.id);
      return n;
    });
  };
  const toggle = (id: number) => setChecked(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullScreen}
      slotProps={{ paper: { sx: { ...paperSafeArea } } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Пересчёт комиссий по правилу</Typography>
        <IconButton size="small" onClick={onClose} disabled={busy} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {done != null && <Alert severity="success" sx={{ mb: 2 }}>Применено строк: <b>{done}</b>. Комиссии/доход обновлены, запись в журнале пересчётов.</Alert>}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Autocomplete
            sx={{ flex: 1 }}
            options={agents}
            disabled={busy}
            getOptionLabel={a => a.name}
            value={agents.find(a => a.id === agentId) || null}
            onChange={(_, v) => { reqSeq.current++; setAgentId(v?.id || null); setPreview(null); setDone(null); setError(null); }}
            renderInput={params => <TextField {...params} label="Агент *" size="small" />}
          />
          <FormControl size="small" sx={{ minWidth: 120 }} disabled={busy}>
            <InputLabel>Год</InputLabel>
            <Select value={year} label="Год" onChange={e => { reqSeq.current++; setYear(e.target.value); setPreview(null); setDone(null); setError(null); }}>
              {yearOptions.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
              <MenuItem value="all">Все годы</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" disabled={busy || !agentId} onClick={() => loadPreview()} sx={{ flexShrink: 0 }}>
            {busy && !preview ? 'Считаю…' : 'Показать превью'}
          </Button>
        </Stack>

        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 1.5 }}>
          Правило: % сделки = уровень по накопленному ВКД года СТРОГО до её даты (сделки одного дня друг друга не видят).
          Сделка, внесённая задней датой, меняет уровень последующих — этот инструмент показывает разницу и применяет только отмеченные строки.
        </Typography>

        {preview && (
          <>
            {preview.agent.commission_fixed != null && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                Агент на фикс-тарифе <b>{preview.agent.commission_fixed}%</b> — пересчёт приведёт ВСЮ историю (все годы превью) к этому проценту, включая сделки до перевода на фикс.
              </Alert>
            )}
            {preview.unprocessable.length > 0 && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                {preview.unprocessable.length} строк без даты/ВКД не пересчитываются (id: {preview.unprocessable.map(u => u.id).join(', ')}).
              </Alert>
            )}
            {preview.changes.length === 0 ? (
              <Alert severity="success">Расхождений с правилом нет — все комиссии агента{preview.year ? ` за ${preview.year}` : ''} уже соответствуют прогрессии (пороги L2 {formatRub(preview.thresholds.l1)} / L3 {formatRub(preview.thresholds.l2)}).</Alert>
            ) : (
              <>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 700 }}>
                    Расхождений: {preview.changes.length} · отмечено {sel.length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: deltaIncome >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                    Δ дохода по отмеченным: {deltaIncome >= 0 ? '+' : ''}{formatRub(deltaIncome)}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption" sx={{ color: '#64748B' }}>пороги: L2 от {formatRub(preview.thresholds.l1)}, L3 от {formatRub(preview.thresholds.l2)}</Typography>
                </Stack>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  Ручные корректировки в базе НЕ помечены. Строки-«понижения» (вероятные ручные надбавки) по умолчанию сняты,
                  но и ПОВЫШЕНИЕ может перезаписать намеренно заниженный % (договорённость/доля co-broking) — просмотрите строки перед применением.
                </Alert>
                <TableContainer sx={{ maxHeight: 380, borderRadius: 1.5, border: '1px solid rgba(201,168,76,0.12)' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox"><Checkbox size="small" checked={allChecked} indeterminate={checked.size > 0 && !allChecked} onChange={toggleAll} /></TableCell>
                        <TableCell>Дата</TableCell>
                        <TableCell>Сделка</TableCell>
                        <TableCell align="right">ВКД</TableCell>
                        <TableCell align="right">%: было → станет</TableCell>
                        <TableCell align="right">Доход: было → станет</TableCell>
                        <TableCell align="right">Δ</TableCell>
                        <TableCell>Метки</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.changes.map(c => {
                        const d = c.newIncome - c.oldIncome;
                        return (
                          <TableRow key={c.id} hover selected={checked.has(c.id)}>
                            <TableCell padding="checkbox"><Checkbox size="small" checked={checked.has(c.id)} onChange={() => toggle(c.id)} /></TableCell>
                            <TableCell><Typography variant="caption" sx={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>{formatDate(c.date)}</Typography></TableCell>
                            <TableCell sx={{ maxWidth: 160 }}>
                              <Typography variant="caption" sx={{ color: '#CBD5E1', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                #{c.id}{c.client_name && c.client_name !== '—' ? ` · ${c.client_name}` : ''}{c.address ? ` · ${c.address}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell align="right"><Typography variant="caption" sx={{ color: '#F1F5F9', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatRub(c.vkd)}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="caption" sx={{ fontWeight: 700, color: '#C9A84C', whiteSpace: 'nowrap' }}>{c.oldPct}% → {c.newPct}%</Typography></TableCell>
                            <TableCell align="right"><Typography variant="caption" sx={{ color: '#F1F5F9', whiteSpace: 'nowrap' }}>{formatRub(c.oldIncome)} → {formatRub(c.newIncome)}</Typography></TableCell>
                            <TableCell align="right"><Typography variant="caption" sx={{ fontWeight: 700, color: d >= 0 ? '#22C55E' : '#EF4444' }}>{d >= 0 ? '+' : ''}{fmt(d)}</Typography></TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                {c.lowered && <Tooltip title="Пересчёт СНИЖАЕТ значение: либо ручная надбавка (не трогать), либо легитимная коррекция (например, после отмены ранней сделки года — тогда отметьте). По умолчанию не отмечено."><Chip label="понижение" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.14)' }} /></Tooltip>}
                                {c.status === 'paid' && <Tooltip title="Сделка уже выплачена — пересчёт изменит доход задним числом."><Chip label="выплачена" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: '#60A5FA', background: 'rgba(96,165,250,0.14)' }} /></Tooltip>}
                                {c.joint && <Tooltip title="Нога совместной сделки (co-broking) — суммарный доход группы изменится."><Chip label="совместная" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700, color: '#C9A84C', background: 'rgba(201,168,76,0.14)' }} /></Tooltip>}
                                {!c.lowered && c.status !== 'paid' && !c.joint && <Typography variant="caption" sx={{ color: '#475569' }}>{STATUS_RU[c.status] || c.status}</Typography>}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} sx={{ color: '#64748B' }} disabled={busy}>Закрыть</Button>
        {preview && preview.changes.length > 0 && (
          isSuper ? (
            <Button variant="contained" color="warning" onClick={apply} disabled={busy || sel.length === 0}>
              {busy ? 'Применяю…' : `Применить ${sel.length} строк`}
            </Button>
          ) : (
            <Tooltip title="Применить пересчёт может только super_admin"><span>
              <Button variant="contained" disabled>Применить (super_admin)</Button>
            </span></Tooltip>
          )
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
  const { data: agents = [] } = useAgents(); // общий кэш агентов
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
  const [recomputeOpen, setRecomputeOpen] = useState(false); // S2: пересчёт комиссий с diff-превью
  const [editTarget, setEditTarget] = useState<Deal | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Deal | null>(null); // сделка на отмену (обратимо: откат комиссий/объекта)
  const [cancelBusy, setCancelBusy] = useState(false);
  // Удалять/отменять сделки могут super_admin и admin (влияет на комиссию/MLM).
  const canDelete = ['super_admin', 'admin'].includes(getCurrentUser()?.role ?? '');

  // Дебаунс поиска — серверный запрос не на каждый символ.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const reloadDeals = useCallback(() => {
    setLoading(true);
    return dealsApi.listPaged({ year, month, q: debouncedSearch, limit })
      .then(({ deals: rows, total: cnt }) => { setDeals(rows); setTotal(cnt); })
      .catch(err => setError(err?.message || 'Ошибка загрузки сделок'))
      .finally(() => setLoading(false));
  }, [year, month, debouncedSearch, limit]);

  useEffect(() => { reloadDeals(); }, [reloadDeals]);

  // Сервер уже отсортировал по дате DESC и ограничил лимитом — выводим как есть.
  const filtered = deals;
  // Годы для фильтра: от текущего до минимального года данных (единый источник с пересчётом).
  const yearOptions = useMemo(() => {
    const cur = new Date().getFullYear();
    const ys: string[] = [];
    for (let y = cur; y >= MIN_DEAL_YEAR; y--) ys.push(String(y));
    return ys;
  }, []);
  const RU_MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  const openCreate = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = useCallback((deal: Deal) => { setEditTarget(deal); setDialogOpen(true); }, []);

  const handleDelete = useCallback(async (deal: Deal) => {
    // Двойное подтверждение — удаление сделки необратимо.
    if (!confirm(`Удалить сделку #${deal.id} (${deal.agentName}, ${formatRub(deal.vkd)})?`)) return;
    if (!confirm('Вы уверены? Сделка будет удалена БЕЗВОЗВРАТНО — это повлияет на ВКД, комиссию и MLM агента.')) return;
    try {
      await dealsApi.remove(deal.id);
      setDeals(prev => prev.filter(d => d.id !== deal.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сделку');
    }
  }, []);

  // Отмена сделки (в отличие от удаления сохраняет историю): бэк в транзакции
  // откатывает комиссии/начисления всей co-broking группы и возвращает объект в продажу.
  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelBusy(true); setError(null);
    try {
      await dealsApi.cancel(cancelTarget.id);
      setDeals(prev => prev.map(d => d.id === cancelTarget.id ? { ...d, status: 'cancelled' } : d));
      setCancelTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отменить сделку');
    } finally {
      setCancelBusy(false);
    }
  }, [cancelTarget]);

  return (
    <Box>
      {['admin', 'super_admin'].includes(getCurrentUser()?.role || '') && <DealApprovals onChanged={reloadDeals} />}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          {loading && <CircularProgress size={14} sx={{ color: '#C9A84C' }} />}
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            {total} {dealsWord(total)}
          </Typography>
        </Box>
        <Button
          variant="outlined" startIcon={<CalculateRoundedIcon />} onClick={() => setRecomputeOpen(true)}
          sx={{ ml: 'auto', flexShrink: 0, borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.06)' } }}
        >
          Пересчёт %
        </Button>
        <Button
          variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => setImportOpen(true)}
          sx={{ flexShrink: 0, borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.06)' } }}
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
        total={total}
      />

      <RecomputeDialog
        open={recomputeOpen}
        onClose={() => setRecomputeOpen(false)}
        agents={agents}
        onApplied={reloadDeals}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      {loading && deals.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: '#C9A84C' }} />
        </Box>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', display: (loading && deals.length === 0) ? 'none' : 'block', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s', overflowX: 'auto' }}>
        <Table sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={stickyAgentCell}>Агент</TableCell>
              <TableCell>Тип</TableCell>
              <TableCell align="right">ВКД</TableCell>
              <TableCell align="right">%</TableCell>
              <TableCell align="right">Доход</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((deal) => (
              <TableRow key={deal.id} hover>
                <TableCell sx={stickyAgentCell}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9', whiteSpace: 'nowrap' }}>{deal.agentName.split(' ').slice(0, 2).join(' ')}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.city}</Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip label={typeLabels[deal.type] || deal.type} size="small" sx={{ background: 'rgba(67,97,238,0.12)', color: '#60A5FA', fontWeight: 600, fontSize: 11 }} />
                    {deal.status === 'cancelled' && (
                      <Chip label="Отменена" size="small" sx={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 600, fontSize: 11 }} />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9', whiteSpace: 'nowrap' }}>{formatRub(deal.vkd)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{deal.commission}%</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#22C55E', whiteSpace: 'nowrap' }}>{formatRub(deal.income)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: '#94A3B8', whiteSpace: 'nowrap' }}>{formatDate(deal.date)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <Tooltip title="Редактировать">
                      <IconButton size="small" onClick={() => openEdit(deal)} sx={{ ...actionTapTarget, '&:hover': { color: '#C9A84C' } }}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDelete && deal.status !== 'cancelled' && (
                      <Tooltip title="Отменить сделку">
                        <IconButton size="small" onClick={() => setCancelTarget(deal)} sx={{ ...actionTapTarget, '&:hover': { color: '#F59E0B' } }}>
                          <CancelRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {canDelete && (
                      <Tooltip title="Удалить сделку">
                        <IconButton size="small" onClick={() => handleDelete(deal)} sx={{ ...actionTapTarget, '&:hover': { color: '#EF4444' } }}>
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

      <ConfirmDialog
        open={!!cancelTarget}
        danger
        title="Отменить сделку?"
        text="Комиссии и начисления участников откатятся, объект вернётся в продажу."
        confirmLabel="Отменить сделку"
        cancelLabel="Не отменять"
        loading={cancelBusy}
        onConfirm={handleCancel}
        onClose={() => { if (!cancelBusy) setCancelTarget(null); }}
      />
    </Box>
  );
}
