import { useEffect, useState, useMemo } from 'react';
import SharesStage2 from '../components/SharesStage2';
import { getCurrentUser } from '../auth/auth';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Stack, Divider, Autocomplete,
  ToggleButtonGroup, ToggleButton, Alert, Tooltip, Tabs, Tab,
} from '@mui/material';
import { motion } from 'framer-motion';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import CorporateFareRoundedIcon from '@mui/icons-material/CorporateFareRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer } from 'recharts';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { companySettings as initialSettings } from '../data/mockData';
import type { ShareOperationType, Agent } from '../types';
import { sharesApi, type ShareOperation, type ShareQuote, type ShareHolder } from '../api/shares';
import TablePagination from '@mui/material/TablePagination';
import { useAgents } from '../hooks/useAgents';
import { settingsApi } from '../api/settings';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ConfirmDialog from '../components/ConfirmDialog';
import { plural, formatDate, formatRub } from '../utils/format';
import { useFullScreenDialog } from '../hooks/useFullScreenDialog';

const fmt = (n: number) => n.toLocaleString('ru-RU');

// Сегодняшняя дата в ЛОКАЛЬНОЙ зоне (МСК) в формате YYYY-MM-DD.
// new Date().toISOString() даёт UTC — в ранние часы МСК это ПРЕДЫДУЩИЙ день,
// из-за чего котировка сохранялась на день раньше выбранного.
const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Деньги: «N млн ₽» только от 1 млн, иначе обычные рубли (не «0.02 млн»).
const fmtMoney = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1e6).toFixed(2)} млн ₽` : `${fmt(Math.round(n))} ₽`;

const opConfig: Record<ShareOperationType, { label: string; color: string; bg: string }> = {
  issue: { label: 'Эмиссия', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  transfer: { label: 'Передача', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  buyback: { label: 'Выкуп', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

// Основания передачи/эмиссии акций.
// gift = бесплатная (по номиналу 1₽), discount = покупка со скидкой 10%, ''  = ручная цена.
type TransferReason = '' | 'first_deal_bonus' | 'recruit_bonus' | 'yearly_2m_vkd' | 'discount_purchase';

const REASON_OPTIONS: Array<{ value: TransferReason; label: string; priceMode: 'gift' | 'discount' | 'manual' }> = [
  { value: '',                   label: 'Без основания (ручная цена)',          priceMode: 'manual' },
  { value: 'first_deal_bonus',   label: 'Бонус за первую сделку (1 ₽)',         priceMode: 'gift' },
  { value: 'recruit_bonus',      label: 'Бонус за первую сделку рекрута (1 ₽)', priceMode: 'gift' },
  { value: 'yearly_2m_vkd',      label: 'Бонус за 2 млн ВКД за год (1 ₽)',      priceMode: 'gift' },
  { value: 'discount_purchase',  label: 'Покупка со скидкой 10% от котировки',  priceMode: 'discount' },
];

type FormState = {
  type: ShareOperationType;
  fromAgentId: number | null; fromAgentName: string | null;
  toAgentId: number | null; toAgentName: string | null;
  quantity: string; pricePerShare: string; notes: string;
  reason: TransferReason;
  date: string;
};

const emptyForm: FormState = {
  type: 'transfer',
  fromAgentId: null, fromAgentName: null,
  toAgentId: null, toAgentName: null,
  quantity: '', pricePerShare: '', notes: '',
  reason: '',
  date: '',
};

export default function Shares() {
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  // Эмиссия (выпуск новых акций) доступна только super_admin — остальные видят лишь передачи/выкуп.
  const isSuperAdmin = getCurrentUser()?.role === 'super_admin';
  const [ops, setOps] = useState<ShareOperation[]>([]);
  const [holders, setHolders] = useState<ShareHolder[]>([]);
  const { data: agents = [] } = useAgents(); // общий кэш агентов
  const [quotes, setQuotes] = useState<ShareQuote[]>([]);
  const [opsPage, setOpsPage] = useState(0);
  const [opsRowsPerPage, setOpsRowsPerPage] = useState(20);
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState(0); // 0 — Обзор и операции, 1 — Начисления и выкуп (Этап-2)

  const [dialogOpen, setDialogOpen] = useState(false);
  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [newTotal, setNewTotal] = useState(String(initialSettings.totalSharesIssued));
  const [filterType, setFilterType] = useState<ShareOperationType | 'all'>('all');
  const [holderSearch, setHolderSearch] = useState('');
  const [opSearch, setOpSearch] = useState('');      // поиск по ФИО в операциях
  const [opDateFrom, setOpDateFrom] = useState('');  // YYYY-MM-DD
  const [opDateTo, setOpDateTo] = useState('');
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ date: todayLocal(), price: '', note: '' });

  // Подтверждения удаления (замена window.confirm / тихого удаления котировки).
  const [quoteToDelete, setQuoteToDelete] = useState<ShareQuote | null>(null);
  const [opToDelete, setOpToDelete] = useState<ShareOperation | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const reloadAll = () => Promise.all([
    sharesApi.operations().then(setOps).catch(() => { /* tolerate */ }),
    sharesApi.holders().then(setHolders).catch(() => { /* tolerate */ }),
    sharesApi.quotes().then(qs => {
      setQuotes(qs);
      if (qs.length) setSettings(s => ({ ...s, sharePrice: qs[qs.length - 1].price }));
    }).catch(() => { /* tolerate */ }),
    settingsApi.get().then(s => {
      setSettings(prev => ({ ...prev, totalSharesIssued: s.totalSharesIssued || prev.totalSharesIssued }));
    }).catch(() => { /* tolerate */ }),
  ]);

  useEffect(() => { reloadAll(); }, []);

  const handleAddQuote = async () => {
    const p = parseFloat(quoteForm.price);
    if (!p || !quoteForm.date) return;
    try {
      await sharesApi.addQuote({ date: quoteForm.date, price: p, note: quoteForm.note || '' });
      await reloadAll();
      setQuoteDialogOpen(false);
      setQuoteForm({ date: todayLocal(), price: '', note: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить котировку');
    }
  };

  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;
    setConfirmBusy(true);
    try {
      await sharesApi.deleteQuote(quoteToDelete.id);
      await reloadAll();
      setQuoteToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить котировку');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleDeleteOp = async () => {
    if (!opToDelete) return;
    setConfirmBusy(true);
    try {
      await sharesApi.deleteOperation(opToDelete.id);
      await reloadAll();
      setOpToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось откатить операцию');
    } finally {
      setConfirmBusy(false);
    }
  };

  const totalAmount = useMemo(() => Math.round((parseFloat(form.quantity) || 0) * (parseFloat(form.pricePerShare) || 0)), [form.quantity, form.pricePerShare]);

  // Форма операции готова: положительные qty/price + выбраны нужные по типу агенты.
  const opFormValid = useMemo(() => {
    const qty = parseInt(form.quantity);
    const price = parseFloat(form.pricePerShare);
    if (!(qty > 0) || !(price > 0)) return false;
    if (form.type === 'issue') return !!form.toAgentId;
    if (form.type === 'transfer') return !!form.fromAgentId && !!form.toAgentId && form.fromAgentId !== form.toAgentId;
    return !!form.fromAgentId; // buyback
  }, [form.type, form.quantity, form.pricePerShare, form.fromAgentId, form.toAgentId]);

  const filtered = useMemo(() => {
    const q = opSearch.trim().toLowerCase();
    return ops.filter(o => {
      if (filterType !== 'all' && o.type !== filterType) return false;
      if (q && !`${o.fromAgentName || ''} ${o.toAgentName || ''}`.toLowerCase().includes(q)) return false;
      const d = (o.date || '').slice(0, 10);
      if (opDateFrom && d < opDateFrom) return false;
      if (opDateTo && d > opDateTo) return false;
      return true;
    });
  }, [ops, filterType, opSearch, opDateFrom, opDateTo]);

  const filteredHolders = useMemo(() => {
    const q = holderSearch.trim().toLowerCase();
    const sorted = [...holders].sort((a, b) => b.shares - a.shares);
    return q ? sorted.filter(h => h.name.toLowerCase().includes(q)) : sorted;
  }, [holders, holderSearch]);

  // Баланс акций каждого агента — из holders (бэк уже считает по share_packets).
  const agentShares = useMemo(() => {
    const map = new Map<number, number>();
    holders.forEach(h => map.set(h.id, h.shares));
    return map;
  }, [holders]);

  const handleOpSave = async (forceExceed = false) => {
    const qty = parseInt(form.quantity);
    const price = parseFloat(form.pricePerShare);
    if (!(qty > 0) || !(price > 0)) return;

    if (form.type === 'issue' && !form.toAgentId) return;
    if (form.type === 'transfer' && (!form.fromAgentId || !form.toAgentId)) return;
    if (form.type === 'transfer' && form.fromAgentId === form.toAgentId) { setError('Передача самому себе невозможна — выберите разных акционеров.'); return; }
    if (form.type === 'buyback' && !form.fromAgentId) return;

    // Потолок эмиссии ЖЁСТКИЙ. Превысить может только super_admin осознанно (увеличение уставного
    // капитала) — по явному подтверждению; тогда шлём confirmExceed, и бэк пропустит.
    let confirmExceed = forceExceed;
    if (form.type === 'issue' && !forceExceed) {
      const inCirculation = totalIssued - totalBuyback;
      if (inCirculation + qty > settings.totalSharesIssued) {
        confirmExceed = window.confirm(`Эмиссия превысит потолок ${fmt(settings.totalSharesIssued)} акций (в обращении ${fmt(inCirculation)}). Это увеличение уставного капитала. Подтвердить?`);
        if (!confirmExceed) return;
      }
    }

    // Контроль баланса: передача/выкуп не могут списать больше, чем есть у агента.
    if ((form.type === 'transfer' || form.type === 'buyback') && form.fromAgentId) {
      const available = agentShares.get(form.fromAgentId) || 0;
      if (qty > available) {
        setError(`У агента только ${fmt(available)} акций — нельзя списать ${fmt(qty)}.`);
        return;
      }
    }

    try {
      await sharesApi.addOperation({
        type: form.type,
        fromAgentId: form.fromAgentId,
        toAgentId: form.toAgentId,
        quantity: qty,
        pricePerShare: price,
        notes: form.notes,
        reason: form.reason,
        discountPct: form.reason === 'discount_purchase' ? 10 : 0,
        date: form.date || undefined,
        confirmExceed,
      });
      await reloadAll();
      setDialogOpen(false);
      setForm({ ...emptyForm });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Не удалось создать операцию';
      // Бэк отклонил эмиссию по потолку (напр. локальный settings разошёлся с реальным) — бэк
      // источник правды: предлагаем осознанно превысить и повторяем один раз с forceExceed.
      if (form.type === 'issue' && !forceExceed && /потолок/i.test(msg)) {
        if (window.confirm(`${msg} Провести как осознанное увеличение уставного капитала?`)) { void handleOpSave(true); return; }
      }
      setError(msg);
    }
  };

  const totalIssued = useMemo(() => ops.filter(o => o.type === 'issue').reduce((s, o) => s + o.quantity, 0), [ops]);
  const totalBuyback = useMemo(() => ops.filter(o => o.type === 'buyback').reduce((s, o) => s + o.quantity, 0), [ops]);
  const totalMarketCap = settings.sharePrice * settings.totalSharesIssued;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid rgba(148,163,184,0.15)' }}>
        <Tab label="Обзор и операции" sx={{ fontWeight: 700, textTransform: 'none' }} />
        <Tab label="Начисления и выкуп" sx={{ fontWeight: 700, textTransform: 'none' }} />
      </Tabs>

      {/* Этап 2: очередь начислений «положено» + право на покупку — отдельная вкладка */}
      {tab === 1 && <SharesStage2 onGranted={reloadAll} />}

      {tab === 0 && (<>
      {/* Share price hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 3, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.04) 100%)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DiamondRoundedIcon sx={{ fontSize: 28, color: '#0A0E1A' }} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Текущий курс акции</Typography>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#C9A84C', lineHeight: 1 }}>{fmt(settings.sharePrice)} ₽</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'right', cursor: isSuperAdmin ? 'pointer' : 'default' }}
              onClick={isSuperAdmin ? () => { setNewTotal(String(settings.totalSharesIssued)); setTotalDialogOpen(true); } : undefined}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Всего акций</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(settings.totalSharesIssued)}</Typography>
                {isSuperAdmin && <EditRoundedIcon sx={{ fontSize: 14, color: '#64748B' }} />}
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>В обращении</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(totalIssued - totalBuyback)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Капитализация</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#22C55E' }}>{(totalMarketCap / 1e6).toFixed(0)} млн ₽</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {/* Курс реально меняется ТОЛЬКО котировкой (бэк отдаёт последнюю из share_quotes).
                Раньше тут был диалог, менявший цену лишь в памяти экрана — обманка. */}
            <Button variant="outlined" startIcon={<TrendingUpRoundedIcon />}
              onClick={() => { setQuoteForm({ date: todayLocal(), price: '', note: '' }); setQuoteDialogOpen(true); }}
              sx={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.08)' } }}>
              Изменить курс
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setForm({ ...emptyForm, pricePerShare: String(settings.sharePrice), date: todayLocal() }); setDialogOpen(true); }}>
              Новая операция
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Operation type stats — скрываем типы без операций */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {(Object.entries(opConfig) as [ShareOperationType, typeof opConfig[ShareOperationType]][]).map(([type, cfg], i) => {
          const typeOps = ops.filter(o => o.type === type);
          if (typeOps.length === 0) return null;  // не показываем пустые типы (например Выкуп если 0)
          const totalQty = typeOps.reduce((s, o) => s + o.quantity, 0);
          const totalVal = typeOps.reduce((s, o) => s + o.totalAmount, 0);
          // Подсказка для понимания: для transfer объясняем что это «между агентами»
          const explain = type === 'issue' ? 'Эмиссия от компании к основателям'
                       : type === 'transfer' ? 'Передача между агентами (вне компании)'
                       : 'Выкуп компанией обратно';
          return (
            <motion.div key={type} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={{ flex: '1 1 240px' }}>
              <Tooltip title={explain}>
                <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: `1px solid ${cfg.color}20` }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Chip label={cfg.label} size="small" sx={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11 }} />
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{typeOps.length} {plural(typeOps.length, 'операция', 'операции', 'операций')}</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(totalQty)} акц.</Typography>
                  <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600 }}>{(totalVal / 1e6).toFixed(1)} млн ₽</Typography>
                </Box>
              </Tooltip>
            </motion.div>
          );
        })}
      </Box>

      {/* Quote history */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ShowChartRoundedIcon sx={{ color: '#C9A84C' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Котировки акции</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>{quotes.length} {plural(quotes.length, 'запись', 'записи', 'записей')} · обновляется вручную администратором</Typography>
            </Box>
          </Box>
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setQuoteForm({ date: todayLocal(), price: '', note: '' }); setQuoteDialogOpen(true); }}>
            Добавить котировку
          </Button>
        </Box>

        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={quotes} margin={{ left: 8, right: 16, top: 8 }}>
            <defs>
              <linearGradient id="adminQuoteGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v: string) => new Date(v).toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} domain={['dataMin - 200', 'dataMax + 200']} />
            <RechartTooltip
              contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}
              labelFormatter={(v: string) => new Date(v).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              formatter={(v: number) => [`${fmt(v)} ₽`, 'Цена']}
            />
            <Area type="monotone" dataKey="price" stroke="#C9A84C" strokeWidth={2.5} fill="url(#adminQuoteGrad)" dot={{ fill: '#C9A84C', r: 3 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>

        <TableContainer sx={{ mt: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell align="right">Цена за акцию</TableCell>
                <TableCell align="right">Изменение</TableCell>
                <TableCell align="center">Действие</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...quotes].reverse().map((q, idx, arr) => {
                const prev = arr[idx + 1];
                const delta = prev ? q.price - prev.price : 0;
                const deltaPct = prev && prev.price ? (delta / prev.price) * 100 : 0;
                return (
                  <TableRow key={q.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                        {formatDate(q.date)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{formatRub(q.price)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      {prev ? (
                        <Chip
                          label={`${delta >= 0 ? '+' : ''}${fmt(delta)} ₽ (${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                          size="small"
                          sx={{ background: delta >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: delta >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700, fontSize: 11 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => setQuoteToDelete(q)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Акционеры */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <DiamondRoundedIcon sx={{ color: '#C9A84C' }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Акционеры</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                {holders.length} {plural(holders.length, 'акционер', 'акционера', 'акционеров')} ·
                всего {fmt(holders.reduce((s, h) => s + h.shares, 0))} акций
              </Typography>
            </Box>
          </Box>
          <TextField size="small" placeholder="Поиск по ФИО…" value={holderSearch}
            onChange={e => setHolderSearch(e.target.value)} sx={{ minWidth: 220 }}
            slotProps={{ input: { startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: '#64748B', mr: 1 }} /> } }} />
        </Box>
        <TableContainer sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.06)', maxHeight: 480 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>ФИО</TableCell>
                <TableCell>Город</TableCell>
                <TableCell align="right">Акций</TableCell>
                <TableCell align="right">По текущему курсу</TableCell>
                <TableCell align="right">Доля</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHolders.map(h => {
                const value = h.shares * settings.sharePrice;
                const totalAll = holders.reduce((s, x) => s + x.shares, 0);
                const sharePct = totalAll ? (h.shares / totalAll) * 100 : 0;
                return (
                  <TableRow key={h.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600 }}>{h.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{h.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>{h.city || '—'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{fmt(h.shares)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#22C55E' }}>{fmtMoney(value)}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Chip label={`${sharePct.toFixed(2)}%`} size="small"
                        sx={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', fontWeight: 700, fontSize: 11 }} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredHolders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ textAlign: 'center', color: '#64748B', py: 3 }}>
                    {holderSearch ? 'Ничего не найдено по поиску' : 'Пока нет акционеров с положительным балансом'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Filter + table */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
          История операций <Typography component="span" variant="caption" sx={{ color: '#64748B', ml: 1 }}>· всего {filtered.length} {plural(filtered.length, 'операция', 'операции', 'операций')}</Typography>
        </Typography>
        <ToggleButtonGroup exclusive value={filterType} onChange={(_, v) => { if (v) { setFilterType(v); setOpsPage(0); } }} size="small">
          {(['all', 'issue', 'transfer', 'buyback'] as const).map(t => (
            <ToggleButton key={t} value={t} sx={{ px: 2, borderColor: 'rgba(201,168,76,0.15)', fontSize: 12, '&.Mui-selected': { background: 'rgba(201,168,76,0.1)', color: '#C9A84C', borderColor: 'rgba(201,168,76,0.3)' } }}>
              {t === 'all' ? 'Все' : opConfig[t].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Поиск по ФИО + диапазон дат операций */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <TextField size="small" placeholder="Поиск по ФИО (от/кому)…" value={opSearch}
          onChange={e => { setOpSearch(e.target.value); setOpsPage(0); }} sx={{ flex: '1 1 240px', minWidth: 200 }}
          slotProps={{ input: { startAdornment: <SearchRoundedIcon sx={{ fontSize: 18, color: '#64748B', mr: 1 }} /> } }} />
        <TextField size="small" type="date" label="С" value={opDateFrom}
          onChange={e => { setOpDateFrom(e.target.value); setOpsPage(0); }}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
        <TextField size="small" type="date" label="По" value={opDateTo}
          onChange={e => { setOpDateTo(e.target.value); setOpsPage(0); }}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 160 }} />
        {(opSearch || opDateFrom || opDateTo) && (
          <Button size="small" onClick={() => { setOpSearch(''); setOpDateFrom(''); setOpDateTo(''); setOpsPage(0); }}
            sx={{ color: '#64748B', textTransform: 'none' }}>Сбросить</Button>
        )}
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Тип</TableCell>
              <TableCell>От</TableCell>
              <TableCell>Кому</TableCell>
              <TableCell align="right">Кол-во акций</TableCell>
              <TableCell align="right">Цена за акцию</TableCell>
              <TableCell align="right">Сумма</TableCell>
              <TableCell>Дата</TableCell>
              <TableCell align="center">Действие</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.slice(opsPage * opsRowsPerPage, (opsPage + 1) * opsRowsPerPage).map(op => {
              const cfg = opConfig[op.type];
              return (
                <TableRow key={op.id} hover>
                  <TableCell>
                    <Chip label={cfg.label} size="small" sx={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell>
                    {op.fromAgentId ? (
                      <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 500 }}>{op.fromAgentName?.split(' ').slice(0, 2).join(' ')}</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CorporateFareRoundedIcon sx={{ fontSize: 14, color: '#C9A84C' }} />
                        <Typography variant="body2" sx={{ color: '#C9A84C', fontWeight: 600 }}>Компания</Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell>
                    {op.toAgentId ? (
                      <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 500 }}>{op.toAgentName?.split(' ').slice(0, 2).join(' ')}</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CorporateFareRoundedIcon sx={{ fontSize: 14, color: '#C9A84C' }} />
                        <Typography variant="body2" sx={{ color: '#C9A84C', fontWeight: 600 }}>Компания</Typography>
                      </Box>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{fmt(op.quantity)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>{fmt(op.pricePerShare)} ₽</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color }}>{fmtMoney(op.totalAmount)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{formatDate(op.date)}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Удалить операцию (откатит баланс)">
                      <IconButton
                        size="small"
                        sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}
                        onClick={() => setOpToDelete(op)}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={opsPage}
          onPageChange={(_, p) => setOpsPage(p)}
          rowsPerPage={opsRowsPerPage}
          onRowsPerPageChange={e => { setOpsRowsPerPage(parseInt(e.target.value, 10)); setOpsPage(0); }}
          rowsPerPageOptions={[20, 50, 100]}
          labelRowsPerPage="Строк на странице:"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
        />
      </TableContainer>
      </>)}

      {/* New operation dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={fullScreen} slotProps={{ paper: { sx: { ...paperSafeArea } } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Новая операция с акциями</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            {/* Operation type */}
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                Тип операции
              </Typography>
              <ToggleButtonGroup exclusive value={form.type} onChange={(_, v) => v && setForm(f => ({ ...f, type: v as ShareOperationType, fromAgentId: null, fromAgentName: null, toAgentId: null, toAgentName: null, reason: '', pricePerShare: String(settings.sharePrice) }))} fullWidth size="small">
                {(Object.entries(opConfig) as [ShareOperationType, typeof opConfig[ShareOperationType]][]).filter(([t]) => t !== 'issue' || isSuperAdmin).map(([t, cfg]) => (
                  <ToggleButton key={t} value={t} sx={{ flex: 1, borderColor: 'rgba(201,168,76,0.15)', '&.Mui-selected': { background: cfg.bg, color: cfg.color, borderColor: `${cfg.color}40` } }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{cfg.label}</Typography>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {/* From agent (transfer / buyback) */}
            {(form.type === 'transfer' || form.type === 'buyback') && (
              <Autocomplete
                options={agents}
                getOptionLabel={a => a.name}
                value={agents.find(a => a.id === form.fromAgentId) || null}
                onChange={(_, v) => setForm(f => ({ ...f, fromAgentId: v ? v.id : null, fromAgentName: v ? v.name : null }))}
                renderInput={params => <TextField {...params} label="От агента *" size="small"
                  helperText={form.fromAgentId ? `Акций на балансе: ${fmt(agentShares.get(form.fromAgentId) || 0)}` : ''} />}
                renderOption={(props, a) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{fmt(agentShares.get(a.id) || 0)} акций</Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            {/* To agent (issue / transfer) */}
            {(form.type === 'issue' || form.type === 'transfer') && (
              <Autocomplete
                options={agents}
                getOptionLabel={a => a.name}
                value={agents.find(a => a.id === form.toAgentId) || null}
                onChange={(_, v) => setForm(f => ({ ...f, toAgentId: v ? v.id : null, toAgentName: v ? v.name : null }))}
                renderInput={params => <TextField {...params} label="Кому (агент) *" size="small" />}
                renderOption={(props, a) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{fmt(agentShares.get(a.id) || 0)} акций</Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            {/* Reason — для эмиссии и передачи */}
            {(form.type === 'issue' || form.type === 'transfer') && (
              <FormControl size="small" fullWidth>
                <InputLabel>Основание</InputLabel>
                <Select
                  value={form.reason} label="Основание"
                  onChange={e => {
                    const newReason = e.target.value as TransferReason;
                    const opt = REASON_OPTIONS.find(o => o.value === newReason);
                    let newPrice = form.pricePerShare;
                    if (opt?.priceMode === 'gift') newPrice = '1';
                    else if (opt?.priceMode === 'discount') newPrice = String(Math.round(settings.sharePrice * 0.9));
                    setForm(f => ({ ...f, reason: newReason, pricePerShare: newPrice }));
                  }}
                >
                  {REASON_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {/* Quantity + price */}
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Параметры
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                <TextField fullWidth label="Кол-во акций *" type="number" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} size="small"
                  slotProps={{ htmlInput: { min: 0 } }} />
                <TextField fullWidth label="Цена за акцию *" type="number" value={form.pricePerShare}
                  onChange={e => setForm(f => ({ ...f, pricePerShare: e.target.value }))} size="small"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> }, htmlInput: { min: 0 } }}
                  helperText={
                    form.reason === 'discount_purchase' ? `Котировка ${fmt(settings.sharePrice)} ₽ × 0.9 = ${fmt(Math.round(settings.sharePrice * 0.9))} ₽` :
                    (form.reason && form.reason !== '') ? 'Подарочная акция — номинал 1 ₽' :
                    `Текущая котировка: ${fmt(settings.sharePrice)} ₽`
                  }
                />
              </Box>
              {totalAmount > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Итого:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#C9A84C' }}>{fmt(totalAmount)} ₽</Typography>
                </Box>
              )}
            </Box>

            <TextField fullWidth label="Дата операции" type="date" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Дата начисления/передачи акций (по умолчанию — сегодня)" />

            <TextField fullWidth label="Примечание" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} size="small" multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={() => handleOpSave()} disabled={!opFormValid}>
            Провести операцию
          </Button>
        </DialogActions>
      </Dialog>

      {/* Изменить общее число акций */}
      <Dialog open={totalDialogOpen} onClose={() => setTotalDialogOpen(false)} maxWidth="xs" fullWidth
        fullScreen={fullScreen} slotProps={{ paper: { sx: { ...paperSafeArea } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Общее количество акций</Typography>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, borderRadius: 2, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>Сейчас всего</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{fmt(settings.totalSharesIssued)} шт</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, borderRadius: 2, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>В обращении</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#22C55E' }}>{fmt(totalIssued - totalBuyback)} шт</Typography>
            </Box>
            <TextField
              fullWidth label="Новое значение" type="number" value={newTotal}
              onChange={e => setNewTotal(e.target.value)} size="small"
              helperText={`Не может быть меньше чем в обращении (${fmt(totalIssued - totalBuyback)})`}
            />
            {parseInt(newTotal) > 0 && parseInt(newTotal) < (totalIssued - totalBuyback) && (
              <Alert severity="error" sx={{ py: 0.5 }}>Значение меньше количества в обращении — нельзя</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setTotalDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained"
            disabled={!parseInt(newTotal) || parseInt(newTotal) < (totalIssued - totalBuyback)}
            onClick={async () => {
              const n = parseInt(newTotal);
              try {
                await settingsApi.update({ total_shares: n });
                setSettings(s => ({ ...s, totalSharesIssued: n }));
                setTotalDialogOpen(false);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Не удалось сохранить');
              }
            }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add quote dialog */}
      <Dialog open={quoteDialogOpen} onClose={() => setQuoteDialogOpen(false)} maxWidth="xs" fullWidth
        fullScreen={fullScreen} slotProps={{ paper: { sx: { ...paperSafeArea } } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Изменить курс (новая котировка)</Typography>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <TextField fullWidth size="small" label="Дата" type="date" value={quoteForm.date}
              onChange={e => setQuoteForm(f => ({ ...f, date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth size="small" label="Цена за акцию (₽)" type="number" value={quoteForm.price}
              onChange={e => setQuoteForm(f => ({ ...f, price: e.target.value }))}
              placeholder={`Текущий курс: ${fmt(settings.sharePrice)}`}
              slotProps={{ inputLabel: { shrink: true }, input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }} />
            <Alert severity="info" sx={{ py: 0.5 }}>
              После добавления курс автоматически синхронизируется с последней котировкой
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setQuoteDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={handleAddQuote} disabled={!parseFloat(quoteForm.price) || !quoteForm.date}>
            Добавить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Подтверждение удаления котировки */}
      <ConfirmDialog
        open={!!quoteToDelete}
        title="Удалить котировку?"
        text={quoteToDelete
          ? `Удалить котировку от ${formatDate(quoteToDelete.date)} (${formatRub(quoteToDelete.price)})? Текущий курс пересчитается по предыдущей.`
          : ''}
        confirmLabel="Удалить"
        danger
        loading={confirmBusy}
        onConfirm={handleDeleteQuote}
        onClose={() => setQuoteToDelete(null)}
      />

      {/* Подтверждение отката операции */}
      <ConfirmDialog
        open={!!opToDelete}
        title="Откатить операцию?"
        text="Балансы агентов будут пересчитаны, операция исчезнет из истории."
        confirmLabel="Откатить"
        danger
        loading={confirmBusy}
        onConfirm={handleDeleteOp}
        onClose={() => setOpToDelete(null)}
      />
    </Box>
  );
}
