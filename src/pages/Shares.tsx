import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Stack, Divider, Autocomplete,
  ToggleButtonGroup, ToggleButton, Alert, Tooltip,
} from '@mui/material';
import { motion } from 'framer-motion';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
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
import { sharesApi, type ShareOperation, type ShareQuote } from '../api/shares';
import { agentsApi } from '../api/agents';
import { settingsApi } from '../api/settings';
import EditRoundedIcon from '@mui/icons-material/EditRounded';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const opConfig: Record<ShareOperationType, { label: string; color: string; bg: string }> = {
  issue: { label: 'Эмиссия', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  transfer: { label: 'Передача', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  buyback: { label: 'Выкуп', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
};

type FormState = {
  type: ShareOperationType;
  fromAgentId: number | null; fromAgentName: string | null;
  toAgentId: number | null; toAgentName: string | null;
  quantity: string; pricePerShare: string; notes: string;
};

const emptyForm: FormState = {
  type: 'issue',
  fromAgentId: null, fromAgentName: null,
  toAgentId: null, toAgentName: null,
  quantity: '', pricePerShare: '', notes: '',
};

export default function Shares() {
  const [ops, setOps] = useState<ShareOperation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [quotes, setQuotes] = useState<ShareQuote[]>([]);
  const [settings, setSettings] = useState(initialSettings);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(String(initialSettings.sharePrice));
  const [totalDialogOpen, setTotalDialogOpen] = useState(false);
  const [newTotal, setNewTotal] = useState(String(initialSettings.totalSharesIssued));
  const [filterType, setFilterType] = useState<ShareOperationType | 'all'>('all');
  const [form, setForm] = useState<FormState>({ ...emptyForm });

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ date: new Date().toISOString().slice(0, 10), price: '', note: '' });

  const reloadAll = () => Promise.all([
    sharesApi.operations().then(setOps).catch(() => { /* tolerate */ }),
    sharesApi.quotes().then(qs => {
      setQuotes(qs);
      if (qs.length) setSettings(s => ({ ...s, sharePrice: qs[qs.length - 1].price }));
    }).catch(() => { /* tolerate */ }),
    agentsApi.list().then(setAgents).catch(() => { /* tolerate */ }),
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
      setQuoteForm({ date: new Date().toISOString().slice(0, 10), price: '', note: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить котировку');
    }
  };

  const handleDeleteQuote = async (id: number) => {
    try {
      await sharesApi.deleteQuote(id);
      await reloadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить котировку');
    }
  };

  const totalAmount = useMemo(() => Math.round((parseFloat(form.quantity) || 0) * (parseFloat(form.pricePerShare) || 0)), [form.quantity, form.pricePerShare]);

  const filtered = useMemo(() => filterType === 'all' ? ops : ops.filter(o => o.type === filterType), [ops, filterType]);

  const agentShares = useMemo(() => {
    // a.shares в бэке нет (пересчитывается из share_packets). Пока 0.
    const map = new Map<number, number>();
    agents.forEach(a => map.set(a.id, 0));
    return map;
  }, [agents]);

  const handleOpSave = async () => {
    const qty = parseInt(form.quantity);
    const price = parseFloat(form.pricePerShare);
    if (!qty || !price) return;

    if (form.type === 'issue' && !form.toAgentId) return;
    if (form.type === 'transfer' && (!form.fromAgentId || !form.toAgentId)) return;
    if (form.type === 'buyback' && !form.fromAgentId) return;

    // Контроль лимита: эмиссия не может превысить общее число акций.
    if (form.type === 'issue') {
      const inCirculation = totalIssued - totalBuyback;
      if (inCirculation + qty > settings.totalSharesIssued) {
        setError(`Превышен лимит: всего акций ${fmt(settings.totalSharesIssued)}, в обращении ${fmt(inCirculation)}, можно эмитировать максимум ${fmt(settings.totalSharesIssued - inCirculation)} шт. Увеличьте лимит или измените количество.`);
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
      });
      await reloadAll();
      setDialogOpen(false);
      setForm({ ...emptyForm });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать операцию');
    }
  };

  const handlePriceSave = () => {
    const p = parseFloat(newPrice);
    if (p > 0) setSettings(s => ({ ...s, sharePrice: p }));
    setPriceDialogOpen(false);
  };

  const totalIssued = useMemo(() => ops.filter(o => o.type === 'issue').reduce((s, o) => s + o.quantity, 0), [ops]);
  const totalBuyback = useMemo(() => ops.filter(o => o.type === 'buyback').reduce((s, o) => s + o.quantity, 0), [ops]);
  const totalMarketCap = settings.sharePrice * settings.totalSharesIssued;

  return (
    <Box>
      {/* Share price hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Box sx={{ mb: 3, p: 3, borderRadius: 3, background: 'linear-gradient(135deg, rgba(201,168,76,0.1) 0%, rgba(201,168,76,0.04) 100%)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DiamondRoundedIcon sx={{ fontSize: 28, color: '#0A0E1A' }} />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Текущий курс акции</Typography>
              <Typography variant="h3" sx={{ fontWeight: 900, color: '#C9A84C', lineHeight: 1 }}>{fmt(settings.sharePrice)} ₽</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box sx={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => { setNewTotal(String(settings.totalSharesIssued)); setTotalDialogOpen(true); }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Всего акций</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(settings.totalSharesIssued)}</Typography>
                <EditRoundedIcon sx={{ fontSize: 14, color: '#64748B' }} />
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>В обращении</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(totalIssued - totalBuyback)}</Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Капитализация</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#22C55E' }}>{(totalMarketCap / 1e9).toFixed(2)} млрд ₽</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button variant="outlined" startIcon={<TrendingUpRoundedIcon />} onClick={() => { setNewPrice(String(settings.sharePrice)); setPriceDialogOpen(true); }}
              sx={{ borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C', '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.08)' } }}>
              Изменить курс
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => { setForm({ ...emptyForm, pricePerShare: String(settings.sharePrice) }); setDialogOpen(true); }}>
              Новая операция
            </Button>
          </Box>
        </Box>
      </motion.div>

      {/* Operation type stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {(Object.entries(opConfig) as [ShareOperationType, typeof opConfig[ShareOperationType]][]).map(([type, cfg], i) => {
          const typeOps = ops.filter(o => o.type === type);
          const totalQty = typeOps.reduce((s, o) => s + o.quantity, 0);
          const totalVal = typeOps.reduce((s, o) => s + o.totalAmount, 0);
          return (
            <motion.div key={type} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={{ flex: '1 1 200px' }}>
              <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: `1px solid ${cfg.color}20` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Chip label={cfg.label} size="small" sx={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11 }} />
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{typeOps.length} оп.</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{fmt(totalQty)} акц.</Typography>
                <Typography variant="caption" sx={{ color: cfg.color, fontWeight: 600 }}>{(totalVal / 1e6).toFixed(1)} млн ₽</Typography>
              </Box>
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
              <Typography variant="caption" sx={{ color: '#64748B' }}>{quotes.length} записей · обновляется вручную администратором</Typography>
            </Box>
          </Box>
          <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setQuoteDialogOpen(true)}>
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
              formatter={(v: number) => [`${fmt(v)} ₽`, 'Цена']}
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
                        {new Date(q.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{fmt(q.price)} ₽</Typography>
                    </TableCell>
                    <TableCell align="right">
                      {prev ? (
                        <Chip
                          label={`${delta >= 0 ? '+' : ''}${fmt(delta)} ₽ (${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
                          size="small"
                          sx={{ background: delta >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', color: delta >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700, fontSize: 11 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleDeleteQuote(q.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
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

      {/* Filter + table */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>История операций</Typography>
        <ToggleButtonGroup exclusive value={filterType} onChange={(_, v) => v && setFilterType(v)} size="small">
          {(['all', 'issue', 'transfer', 'buyback'] as const).map(t => (
            <ToggleButton key={t} value={t} sx={{ px: 2, borderColor: 'rgba(201,168,76,0.15)', fontSize: 12, '&.Mui-selected': { background: 'rgba(201,168,76,0.1)', color: '#C9A84C', borderColor: 'rgba(201,168,76,0.3)' } }}>
              {t === 'all' ? 'Все' : opConfig[t].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
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
            {filtered.map((op, i) => {
              const cfg = opConfig[op.type];
              return (
                <motion.tr key={op.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ display: 'table-row' }}>
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
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>{fmt(op.pricePerShare)} ₽</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: cfg.color }}>{(op.totalAmount / 1e6).toFixed(2)} млн ₽</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>{op.date}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Удалить операцию (откатит баланс)">
                      <IconButton
                        size="small"
                        sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}
                        onClick={async () => {
                          if (!confirm(`Удалить операцию #${op.id}? Баланс агентов будет откатан.`)) return;
                          try {
                            await sharesApi.deleteOperation(op.id);
                            await reloadAll();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Не удалось удалить');
                          }
                        }}
                      >
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New operation dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
              <ToggleButtonGroup exclusive value={form.type} onChange={(_, v) => v && setForm(f => ({ ...f, type: v as ShareOperationType, fromAgentId: null, fromAgentName: null, toAgentId: null, toAgentName: null }))} fullWidth size="small">
                {(Object.entries(opConfig) as [ShareOperationType, typeof opConfig[ShareOperationType]][]).map(([t, cfg]) => (
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
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{fmt(a.shares)} акций</Typography>
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
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{fmt(a.shares)} акций</Typography>
                    </Box>
                  </Box>
                )}
              />
            )}

            {/* Quantity + price */}
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Параметры
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField fullWidth label="Кол-во акций *" type="number" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} size="small" />
                <TextField fullWidth label="Цена за акцию *" type="number" value={form.pricePerShare}
                  onChange={e => setForm(f => ({ ...f, pricePerShare: e.target.value }))} size="small"
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }} />
              </Box>
              {totalAmount > 0 && (
                <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>Итого:</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: '#C9A84C' }}>{fmt(totalAmount)} ₽</Typography>
                </Box>
              )}
            </Box>

            <TextField fullWidth label="Примечание" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} size="small" multiline rows={2} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={handleOpSave} disabled={!form.quantity || !form.pricePerShare}>
            Провести операцию
          </Button>
        </DialogActions>
      </Dialog>

      {/* Price dialog */}
      <Dialog open={priceDialogOpen} onClose={() => setPriceDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Изменить курс акции</Typography>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 2, borderRadius: 2, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)' }}>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>Текущий курс</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C' }}>{fmt(settings.sharePrice)} ₽</Typography>
            </Box>
            <TextField
              fullWidth label="Новый курс (₽)" type="number" value={newPrice}
              onChange={e => setNewPrice(e.target.value)} size="small"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
            />
            {parseFloat(newPrice) > 0 && parseFloat(newPrice) !== settings.sharePrice && (
              <Alert severity={parseFloat(newPrice) > settings.sharePrice ? 'success' : 'warning'} sx={{ py: 0.5 }}>
                {parseFloat(newPrice) > settings.sharePrice ? '+' : ''}{(((parseFloat(newPrice) - settings.sharePrice) / settings.sharePrice) * 100).toFixed(1)}% к текущему курсу
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setPriceDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={handlePriceSave} disabled={!parseFloat(newPrice) || parseFloat(newPrice) <= 0}>
            Установить курс
          </Button>
        </DialogActions>
      </Dialog>

      {/* Изменить общее число акций */}
      <Dialog open={totalDialogOpen} onClose={() => setTotalDialogOpen(false)} maxWidth="xs" fullWidth>
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
      <Dialog open={quoteDialogOpen} onClose={() => setQuoteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Новая котировка</Typography>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2}>
            <TextField fullWidth size="small" label="Дата" type="date" value={quoteForm.date}
              onChange={e => setQuoteForm(f => ({ ...f, date: e.target.value }))}
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth size="small" label="Цена за акцию (₽)" type="number" value={quoteForm.price}
              onChange={e => setQuoteForm(f => ({ ...f, price: e.target.value }))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }} />
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
    </Box>
  );
}
