/**
 * SubscriptionClaims — список заявок «я оплатил» от агентов.
 * Админ подтверждает или отклоняет, agent получает уведомление.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Alert,
  Table, TableHead, TableBody, TableCell, TableRow, TableContainer, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Avatar,
  CircularProgress, Tooltip, Tabs, Tab, InputAdornment, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { motion } from 'framer-motion';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import { subscriptionAdminApi, type PendingClaim, type PaymentRow } from '../api/subscription';

const fmt = (n: number) => n.toLocaleString('ru-RU');
const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const formatPeriod = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${RU_MONTHS[m - 1]} ${y}`;
};
const METHOD_CFG: Record<PaymentRow['method'], { label: string; color: string; bg: string }> = {
  auto:   { label: 'Автоматически',  color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  manual: { label: 'Подтверждено',   color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  direct: { label: 'Прямая оплата',  color: '#4361EE', bg: 'rgba(67,97,238,0.12)' },
};

// Лента подтверждённых оплат АП с фильтром по ФИО и периоду. Способ оплаты — чипом
// (авто через ЮKassa / подтверждено вручную / прямая оплата). Пагинация «показать ещё».
function PaymentsHistory() {
  const [q, setQ] = useState('');
  const [qDeb, setQDeb] = useState('');
  const [period, setPeriod] = useState('');
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const LIMIT = 50;

  const periodOptions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
  }, []);

  useEffect(() => { const t = setTimeout(() => setQDeb(q), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setOffset(0); }, [qDeb, period]);
  useEffect(() => {
    setLoading(true); setErr(null);
    subscriptionAdminApi.payments({ q: qDeb || undefined, period: period || undefined, limit: LIMIT, offset })
      .then(p => {
        setTotal(p.total); setTotalAmount(p.totalAmount);
        setRows(prev => offset === 0 ? p.items : [...prev, ...p.items]);
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Не удалось загрузить оплаты'))
      .finally(() => setLoading(false));
  }, [qDeb, period, offset]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small" placeholder="Поиск по ФИО, email, городу" value={q} onChange={e => setQ(e.target.value)}
          sx={{ flex: '1 1 260px' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel>Период</InputLabel>
          <Select value={period} label="Период" onChange={e => setPeriod(e.target.value)}>
            <MenuItem value="">Все периоды</MenuItem>
            {periodOptions.map(p => <MenuItem key={p} value={p}>{formatPeriod(p)}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Chip label={`${fmt(total)} оплат · ${fmt(totalAmount)} ₽`} sx={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontWeight: 700 }} />
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr(null)}>{err}</Alert>}

      {loading && rows.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : rows.length === 0 ? (
        <Alert severity="info">Оплат не найдено{period || qDeb ? ' по этому фильтру' : ''}. Как только агент оплатит АП — строка появится здесь автоматически.</Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Агент</TableCell>
                <TableCell>Город</TableCell>
                <TableCell>Период</TableCell>
                <TableCell align="right">Сумма</TableCell>
                <TableCell>Оплачено</TableCell>
                <TableCell>Способ</TableCell>
                <TableCell>№ транзакции</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(r => {
                const mc = METHOD_CFG[r.method];
                return (
                  <TableRow key={r.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700 }}>
                          {r.agent_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{r.agent_name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>{r.agent_email}</Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Typography variant="body2" sx={{ color: '#94A3B8' }}>{r.agent_city || '—'}</Typography></TableCell>
                    <TableCell><Chip label={formatPeriod(r.period)} size="small" sx={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE', fontWeight: 700, fontSize: 11 }} /></TableCell>
                    <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{fmt(r.amount)} ₽</Typography></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: '#94A3B8' }}>{r.paid_at ? new Date(r.paid_at.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</Typography></TableCell>
                    <TableCell><Chip icon={r.method === 'auto' ? <BoltRoundedIcon sx={{ fontSize: 13 }} /> : undefined} label={mc.label} size="small" sx={{ background: mc.bg, color: mc.color, fontWeight: 700, fontSize: 11, '& .MuiChip-icon': { color: mc.color } }} /></TableCell>
                    <TableCell><Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>{r.payment_ref && r.payment_ref !== 'MANUAL' && r.payment_ref !== 'DIRECT' ? r.payment_ref : '—'}</Typography></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length < total && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Button variant="outlined" disabled={loading} onClick={() => setOffset(o => o + LIMIT)}
                sx={{ borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C' }}>
                Показать ещё (показано {rows.length} из {total})
              </Button>
            </Box>
          )}
        </TableContainer>
      )}
    </Box>
  );
}

export default function SubscriptionClaims() {
  const [tab, setTab] = useState(0);
  const [claims, setClaims] = useState<PendingClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const [rejectFor, setRejectFor] = useState<PendingClaim | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentRefFor, setPaymentRefFor] = useState<PendingClaim | null>(null);
  const [paymentRef, setPaymentRef] = useState('');

  const reload = () => {
    setLoading(true);
    subscriptionAdminApi.pending()
      .then(setClaims)
      .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const handleConfirm = async (claim: PendingClaim, ref?: string) => {
    setBusy(claim.id); setError(null);
    try {
      await subscriptionAdminApi.confirm(claim.id, ref);
      setClaims(prev => prev.filter(c => c.id !== claim.id));
      setPaymentRefFor(null); setPaymentRef('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка подтверждения');
    } finally { setBusy(null); }
  };

  const handleReject = async () => {
    if (!rejectFor) return;
    setBusy(rejectFor.id); setError(null);
    try {
      await subscriptionAdminApi.reject(rejectFor.id, rejectReason);
      setClaims(prev => prev.filter(c => c.id !== rejectFor.id));
      setRejectFor(null); setRejectReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отклонения');
    } finally { setBusy(null); }
  };

  const totalAmount = claims.reduce((s, c) => s + c.amount, 0);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2.5, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ReceiptLongRoundedIcon sx={{ color: '#F59E0B' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Заявки на подтверждение АП</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Агенты, нажавшие «Я оплатил» — проверь поступление и подтверди или отклони
          </Typography>
        </Box>
        <Chip label={`${claims.length} заявок · ${fmt(totalAmount)} ₽`} sx={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontWeight: 700 }} />
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid rgba(201,168,76,0.12)', '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, color: '#94A3B8' }, '& .Mui-selected': { color: '#C9A84C !important' }, '& .MuiTabs-indicator': { background: '#C9A84C' } }}>
        <Tab label={`Ждут подтверждения${claims.length ? ` · ${claims.length}` : ''}`} />
        <Tab label="История оплат" />
      </Tabs>

      {tab === 1 ? <PaymentsHistory /> : (
      <>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : claims.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleRoundedIcon />}>
          Нет заявок на подтверждение. Когда агент нажмёт «Я оплатил» — заявка появится здесь.
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Агент</TableCell>
                <TableCell>Город</TableCell>
                <TableCell>Период</TableCell>
                <TableCell align="right">Сумма</TableCell>
                <TableCell>Заявка отправлена</TableCell>
                <TableCell align="center">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {claims.map((c, i) => (
                <motion.tr key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} style={{ display: 'table-row' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 12, background: 'rgba(245,158,11,0.18)', color: '#F59E0B', fontWeight: 700 }}>
                        {c.agent_name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{c.agent_name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{c.agent_email}</Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#94A3B8' }}>{c.agent_city || '—'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={formatPeriod(c.period)} size="small" sx={{ background: 'rgba(67,97,238,0.10)', color: '#4361EE', fontWeight: 700, fontSize: 11 }} />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{fmt(c.amount)} ₽</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>
                      {c.claimed_at ? new Date(c.claimed_at.replace(' ', 'T') + 'Z').toLocaleString('ru-RU') : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title="Подтвердить с указанием номера транзакции">
                        <span>
                          <IconButton size="small" disabled={busy === c.id}
                            onClick={() => { setPaymentRefFor(c); setPaymentRef(''); }}
                            sx={{ color: '#22C55E', '&:hover': { background: 'rgba(34,197,94,0.10)' } }}
                          >
                            <CheckCircleRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Отклонить с причиной">
                        <span>
                          <IconButton size="small" disabled={busy === c.id}
                            onClick={() => { setRejectFor(c); setRejectReason(''); }}
                            sx={{ color: '#EF4444', '&:hover': { background: 'rgba(239,68,68,0.10)' } }}
                          >
                            <CancelRoundedIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Alert severity="info" sx={{ mt: 3 }} icon={false}>
        <b>Авто-режим:</b> подключи в личном кабинете YooKassa HTTP-уведомления на URL{' '}
        <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4 }}>{import.meta.env.VITE_API_URL || ''}/api/subscription/yookassa-webhook</code>
        {' '}— тогда оплаты с правильной меткой будут закрываться автоматически без этой страницы, а строка появится во вкладке «История оплат».
      </Alert>
      </>
      )}

      {/* Confirm dialog (с опциональным номером транзакции) */}
      <Dialog open={!!paymentRefFor} onClose={() => setPaymentRefFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Подтвердить оплату</DialogTitle>
        <DialogContent>
          {paymentRefFor && (
            <>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
                <b style={{ color: '#F1F5F9' }}>{paymentRefFor.agent_name}</b> · период{' '}
                <b style={{ color: '#F1F5F9' }}>{formatPeriod(paymentRefFor.period)}</b> · {fmt(paymentRefFor.amount)} ₽
              </Typography>
              <TextField
                fullWidth size="small"
                label="Номер транзакции (необязательно)"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="напр. 2eb78b58-000f-..."
                helperText="Если оплачено через YooKassa — вставь ID платежа из кабинета. Иначе можно пропустить."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentRefFor(null)}>Отмена</Button>
          <Button variant="contained" color="success"
            onClick={() => paymentRefFor && handleConfirm(paymentRefFor, paymentRef || undefined)}
            disabled={!paymentRefFor || busy === paymentRefFor.id}
          >
            {paymentRefFor && busy === paymentRefFor.id ? '...' : 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject dialog (с причиной) */}
      <Dialog open={!!rejectFor} onClose={() => setRejectFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Отклонить заявку</DialogTitle>
        <DialogContent>
          {rejectFor && (
            <>
              <Typography variant="body2" sx={{ color: '#94A3B8', mb: 2 }}>
                <b style={{ color: '#F1F5F9' }}>{rejectFor.agent_name}</b> · период{' '}
                <b style={{ color: '#F1F5F9' }}>{formatPeriod(rejectFor.period)}</b>
              </Typography>
              <TextField
                fullWidth size="small" multiline rows={3}
                label="Причина отказа"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="напр. «не нашёл оплату — пришли скриншот»"
                helperText="Агент получит уведомление с этой причиной"
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectFor(null)}>Отмена</Button>
          <Button variant="contained" color="error"
            onClick={handleReject}
            disabled={!rejectFor || busy === rejectFor.id || !rejectReason.trim()}
          >
            {rejectFor && busy === rejectFor.id ? '...' : 'Отклонить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
