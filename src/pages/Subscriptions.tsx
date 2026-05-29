/**
 * Subscriptions — обзор АП всех агентов с фильтрами.
 *
 * Stats: всего / навсегда отменено / заблокированы / просрочки / актуально.
 * Filter: status (all / lifetime / blocked / overdue / current).
 * Поиск по ФИО/email/городу.
 * Клик по строке → диалог с полной таблицей по месяцам этого агента.
 */

import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Chip, Alert, InputAdornment, TextField,
  Table, TableHead, TableBody, TableCell, TableRow, TableContainer, Paper,
  Select, MenuItem, FormControl, InputLabel, Avatar, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button,
  LinearProgress, Divider, TablePagination, Stack,
} from '@mui/material';
import { motion } from 'framer-motion';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { subscriptionAdminApi, type AgentSubOverview, type AgentSubFull } from '../api/subscription';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';

const fmt = (n: number) => n.toLocaleString('ru-RU');
const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const formatPeriod = (p: string) => {
  const [y, m] = p.split('-').map(Number);
  return `${RU_MONTHS[m - 1]} ${y}`;
};

type FilterKey = 'all' | 'lifetime' | 'blocked' | 'overdue' | 'current';

const filterLabels: Record<FilterKey, string> = {
  all:      'Все агенты',
  lifetime: 'Навсегда отменено (1 млн ВКД)',
  blocked:  'Заблокированы (2+ просрочки)',
  overdue:  'Есть просрочки',
  current:  'АП в порядке',
};

interface RowStatusCfg { label: string; color: string; bg: string; icon: React.ReactNode }

function statusFor(a: AgentSubOverview): RowStatusCfg {
  if (a.exempt === 'lifetime') return { label: 'Отменено навсегда', color: '#C9A84C', bg: 'rgba(201,168,76,0.15)', icon: <EmojiEventsRoundedIcon sx={{ fontSize: 14 }} /> };
  if (a.blocked)               return { label: 'Заблокирован',     color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  icon: <LockRoundedIcon sx={{ fontSize: 14 }} /> };
  if (a.overdueCount > 0)      return { label: 'Просрочка',         color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: <ErrorRoundedIcon sx={{ fontSize: 14 }} /> };
  if (a.unpaidCount > 0)       return { label: 'Ожидает оплаты',   color: '#94A3B8', bg: 'rgba(148,163,184,0.12)', icon: <ErrorRoundedIcon sx={{ fontSize: 14 }} /> };
  return                              { label: 'АП в порядке',     color: '#22C55E', bg: 'rgba(34,197,94,0.12)',  icon: <CheckCircleRoundedIcon sx={{ fontSize: 14 }} /> };
}

const periodStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paid:            { label: 'Оплачено',           color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  pending_review:  { label: 'На подтверждении',   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  unpaid:          { label: 'Ожидает',             color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' },
  overdue:         { label: 'Просрочено',          color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  exempt_quarter:  { label: 'ВКД ≥ 200к',         color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  exempt_lifetime: { label: 'Отменено навсегда',  color: '#C9A84C', bg: 'rgba(201,168,76,0.12)' },
  refunded:        { label: 'Возвращено',         color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
  rejected:        { label: 'Отклонено',           color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

export default function Subscriptions() {
  const [list, setList] = useState<AgentSubOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [drillFor, setDrillFor] = useState<AgentSubOverview | null>(null);
  const [drillData, setDrillData] = useState<AgentSubFull | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [markBusy, setMarkBusy] = useState<string | null>(null);

  // Отметить период оплаченным вручную / снять отметку (прямая оплата в компанию).
  const handleMarkPaid = async (period: string, paid: boolean) => {
    if (!drillFor) return;
    setMarkBusy(period);
    try {
      await subscriptionAdminApi.markPaid(drillFor.id, period, paid);
      const fresh = await subscriptionAdminApi.agent(drillFor.id);
      setDrillData(fresh);
      subscriptionAdminApi.overview().then(setList).catch(() => { /* tolerate */ });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось обновить период');
    } finally {
      setMarkBusy(null);
    }
  };

  useEffect(() => {
    setLoading(true);
    subscriptionAdminApi.overview()
      .then(setList)
      .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!drillFor) { setDrillData(null); return; }
    let cancelled = false;
    setDrillLoading(true);
    subscriptionAdminApi.agent(drillFor.id)
      .then(d => { if (!cancelled) setDrillData(d); })
      .catch(() => { if (!cancelled) setDrillData(null); })
      .finally(() => { if (!cancelled) setDrillLoading(false); });
    return () => { cancelled = true; };
  }, [drillFor]);

  const stats = useMemo(() => ({
    total:    list.length,
    lifetime: list.filter(a => a.exempt === 'lifetime').length,
    blocked:  list.filter(a => a.blocked && a.exempt !== 'lifetime').length,
    overdue:  list.filter(a => !a.blocked && a.overdueCount > 0 && a.exempt !== 'lifetime').length,
    current:  list.filter(a => !a.blocked && a.overdueCount === 0 && a.exempt !== 'lifetime').length,
    totalDue: list.reduce((s, a) => s + a.totalDue, 0),
  }), [list]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return list.filter(a => {
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.city || '').toLowerCase().includes(q);
      const matchFilter =
        filter === 'all'      ? true
      : filter === 'lifetime' ? a.exempt === 'lifetime'
      : filter === 'blocked'  ? (a.blocked && a.exempt !== 'lifetime')
      : filter === 'overdue'  ? (!a.blocked && a.overdueCount > 0 && a.exempt !== 'lifetime')
      : filter === 'current'  ? (!a.blocked && a.overdueCount === 0 && a.exempt !== 'lifetime')
      : true;
      return matchQ && matchFilter;
    });
  }, [list, search, filter]);

  const paged = filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Абонентская плата — обзор</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Сводка по всем агентам: кто на ВКД-освобождении, у кого долг, кто заблокирован
        </Typography>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Всего агентов', value: stats.total, icon: <PeopleRoundedIcon />, color: '#4361EE', filterTo: 'all' as FilterKey },
          { label: 'Отменено навсегда', value: stats.lifetime, icon: <EmojiEventsRoundedIcon />, color: '#C9A84C', filterTo: 'lifetime' as FilterKey },
          { label: 'Заблокированы',  value: stats.blocked, icon: <LockRoundedIcon />, color: '#EF4444', filterTo: 'blocked' as FilterKey },
          { label: 'Просрочки',       value: stats.overdue, icon: <ErrorRoundedIcon />, color: '#F59E0B', filterTo: 'overdue' as FilterKey },
          { label: 'АП в порядке',   value: stats.current, icon: <CheckCircleRoundedIcon />, color: '#22C55E', filterTo: 'current' as FilterKey },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ flex: '1 1 160px' }}>
            <Box
              onClick={() => { setFilter(s.filterTo); setPage(0); }}
              sx={{
                p: 2.5, borderRadius: 3, cursor: 'pointer',
                background: filter === s.filterTo
                  ? `linear-gradient(135deg, ${s.color}25, ${s.color}10)`
                  : 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))',
                border: `1px solid ${filter === s.filterTo ? `${s.color}50` : 'rgba(201,168,76,0.1)'}`,
                display: 'flex', alignItems: 'center', gap: 2,
                transition: 'all 0.2s',
                '&:hover': { borderColor: `${s.color}50` },
              }}
            >
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

      {/* К оплате (сумма всех долгов) */}
      {stats.totalDue > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Всего к получению: <b>{fmt(stats.totalDue)} ₽</b> от агентов с просрочками
        </Alert>
      )}

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          placeholder="Поиск по имени, email, городу…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          size="small" sx={{ flex: '1 1 260px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
        />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Статус АП</InputLabel>
          <Select value={filter} label="Статус АП" onChange={e => { setFilter(e.target.value as FilterKey); setPage(0); }}>
            {(Object.keys(filterLabels) as FilterKey[]).map(k => (
              <MenuItem key={k} value={k}>{filterLabels[k]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Агент</TableCell>
                <TableCell>Дата присоединения</TableCell>
                <TableCell align="right">Lifetime ВКД</TableCell>
                <TableCell>Статус АП</TableCell>
                <TableCell align="right">Неоплачено</TableCell>
                <TableCell align="right">К оплате</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paged.map(a => {
                const sc = statusFor(a);
                const progressPct = a.exempt === 'lifetime' ? 100 : Math.min(100, (a.lifetimeVkd / a.lifetimeThreshold) * 100);
                return (
                  <TableRow key={a.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDrillFor(a)}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: 12, background: `${sc.color}20`, color: sc.color, fontWeight: 700 }}>
                          {a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{a.name}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>
                            {a.email.endsWith('@w24.local') ? 'архивная (без логина)' : a.email}{a.city ? ` · ${a.city}` : ''}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#94A3B8' }}>{a.joinDate}</Typography>
                      {a.firstBillingMonth && (
                        <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>
                          АП с {formatPeriod(a.firstBillingMonth)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 180 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: a.exempt === 'lifetime' ? '#C9A84C' : '#F1F5F9' }}>
                        {fmt(a.lifetimeVkd)} ₽
                      </Typography>
                      <LinearProgress
                        variant="determinate" value={progressPct}
                        sx={{ mt: 0.5, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)',
                          '& .MuiLinearProgress-bar': { background: a.exempt === 'lifetime' ? '#C9A84C' : '#4361EE', borderRadius: 2 } }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={sc.icon as React.ReactElement}
                        label={sc.label} size="small"
                        sx={{ background: sc.bg, color: sc.color, fontWeight: 700, fontSize: 11, '& .MuiChip-icon': { color: sc.color } }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ color: a.overdueCount > 0 ? '#EF4444' : '#94A3B8', fontWeight: a.overdueCount > 0 ? 700 : 400 }}>
                        {a.unpaidCount > 0 ? `${a.unpaidCount} мес` : '—'}
                      </Typography>
                      {a.overdueCount > 0 && (
                        <Typography variant="caption" sx={{ color: '#EF4444', fontSize: 10 }}>
                          {a.overdueCount} просрочено
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: 700, color: a.totalDue > 0 ? '#F59E0B' : '#64748B' }}>
                        {a.totalDue > 0 ? `${fmt(a.totalDue)} ₽` : '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ textAlign: 'center', color: '#64748B', py: 4 }}>
                    Нет агентов с такими параметрами
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100, 200]}
            labelRowsPerPage="Строк на странице:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
          />
        </TableContainer>
      )}

      {/* Drill-in dialog */}
      <Dialog open={!!drillFor} onClose={() => setDrillFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>{drillFor?.name}</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>
              {drillFor?.email} · присоединился {drillFor?.joinDate}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setDrillFor(null)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          {drillLoading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>}
          {drillData && (
            <>
              {drillData.exempt === 'lifetime' && (
                <Alert severity="success" sx={{ mb: 2 }} icon={<EmojiEventsRoundedIcon />}>
                  Общий ВКД {fmt(drillData.lifetimeVkd)} ₽ ≥ 1 млн — АП отменена навсегда.
                </Alert>
              )}
              {drillData.exempt === 'manual_forever' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  АП отключена админом навсегда{drillData.override?.note ? ` · «${drillData.override.note}»` : ''}.
                </Alert>
              )}
              {drillData.exempt === 'paused' && drillData.override?.until && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  АП на паузе до {new Date(drillData.override.until).toLocaleDateString('ru-RU')}{drillData.override.note ? ` · «${drillData.override.note}»` : ''}.
                </Alert>
              )}
              {drillData.exempt === 'inactive' && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Агент не активен (уволен / заблокирован) — АП не начисляется.
                </Alert>
              )}
              {drillData.blocked && (
                <Alert severity="error" sx={{ mb: 2 }} icon={<LockRoundedIcon />}>
                  Портал агента заблокирован: {drillData.overdueCount} просроченных периода, к оплате {fmt(drillData.totalDue)} ₽.
                </Alert>
              )}

              {/* Управление АП — только для активных агентов */}
              {drillData.exempt !== 'inactive' && drillFor && (
                <OverrideControls
                  agentId={drillFor.id}
                  current={drillData}
                  onChange={(updated) => setDrillData(updated)}
                />
              )}
              {drillData.periods.length === 0 ? (
                <Alert severity="info">
                  Период оплаты ещё не начался. Первый платёж: {drillData.firstBillingMonth ? formatPeriod(drillData.firstBillingMonth) : '—'}.
                </Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Месяц</TableCell>
                      <TableCell>Квартал · ВКД</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell align="right">Дата оплаты</TableCell>
                      <TableCell align="right">Действие</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drillData.periods.map(p => {
                      const cfg = periodStatusConfig[p.status] || { label: p.status, color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
                      return (
                        <TableRow key={p.period}>
                          <TableCell><Typography variant="body2" sx={{ color: '#F1F5F9' }}>{formatPeriod(p.period)}</Typography></TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                              Q{p.quarter} · {fmt(p.quarterVkd)} ₽
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={cfg.label} size="small" sx={{ background: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: 11 }} />
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" sx={{ color: '#64748B' }}>
                              {p.paidAt ? new Date(p.paidAt.replace(' ', 'T') + 'Z').toLocaleDateString('ru-RU') : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {p.status === 'paid' ? (
                              <Button size="small" disabled={markBusy === p.period}
                                onClick={() => handleMarkPaid(p.period, false)}
                                sx={{ color: '#64748B', fontSize: 11, minWidth: 0, '&:hover': { color: '#EF4444' } }}>
                                Снять
                              </Button>
                            ) : (p.status === 'unpaid' || p.status === 'overdue' || p.status === 'pending_review') ? (
                              <Button size="small" variant="outlined" disabled={markBusy === p.period}
                                onClick={() => handleMarkPaid(p.period, true)}
                                sx={{ fontSize: 11, py: 0.2, px: 1, borderColor: 'rgba(34,197,94,0.4)', color: '#22C55E', '&:hover': { borderColor: '#22C55E', background: 'rgba(34,197,94,0.08)' } }}>
                                Оплачено
                              </Button>
                            ) : <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDrillFor(null)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---- Override controls (admin) ----

function OverrideControls({
  agentId, current, onChange,
}: { agentId: number; current: AgentSubFull; onChange: (next: AgentSubFull) => void }) {
  const [busy, setBusy] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseMonths, setPauseMonths] = useState<1 | 2 | 3>(1);
  const [note, setNote] = useState('');
  const [forceOpen, setForceOpen] = useState(false);

  const apply = async (payload: { type: 'force_exempt' | 'pause' | null; months?: 1 | 2 | 3; note?: string }) => {
    setBusy(true);
    try {
      const updated = await subscriptionAdminApi.setOverride(agentId, payload);
      onChange(updated);
      setPauseOpen(false); setForceOpen(false); setNote('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Не удалось применить');
    } finally {
      setBusy(false);
    }
  };

  const hasOverride = current.exempt === 'manual_forever' || current.exempt === 'paused';

  return (
    <Box sx={{ mt: 2, mb: 3, p: 2, borderRadius: 2, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
        Управление АП
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button size="small" variant="outlined" startIcon={<BlockRoundedIcon />}
          disabled={busy || current.exempt === 'manual_forever'}
          onClick={() => setForceOpen(true)}
        >
          Отменить навсегда
        </Button>
        <Button size="small" variant="outlined" startIcon={<PauseRoundedIcon />}
          disabled={busy}
          onClick={() => { setPauseMonths(1); setNote(''); setPauseOpen(true); }}
        >
          Поставить на паузу
        </Button>
        {hasOverride && (
          <Button size="small" variant="outlined" color="warning" startIcon={<RestartAltRoundedIcon />}
            disabled={busy}
            onClick={() => apply({ type: null })}
          >
            Сбросить override
          </Button>
        )}
      </Stack>

      {/* Pause dialog */}
      <Dialog open={pauseOpen} onClose={() => setPauseOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Поставить АП на паузу</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>На сколько</InputLabel>
              <Select value={pauseMonths} label="На сколько" onChange={e => setPauseMonths(Number(e.target.value) as 1 | 2 | 3)}>
                <MenuItem value={1}>1 месяц</MenuItem>
                <MenuItem value={2}>2 месяца</MenuItem>
                <MenuItem value={3}>3 месяца</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Причина (видна в карточке)"
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="например: декрет / отпуск / спецпредложение"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPauseOpen(false)} disabled={busy}>Отмена</Button>
          <Button variant="contained" disabled={busy}
            onClick={() => apply({ type: 'pause', months: pauseMonths, note })}
          >
            Поставить на паузу
          </Button>
        </DialogActions>
      </Dialog>

      {/* Force exempt dialog */}
      <Dialog open={forceOpen} onClose={() => setForceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Отключить АП навсегда</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">Используй когда нужно освободить агента от АП по индивидуальному решению, минуя автоматическое правило 1 млн ВКД.</Alert>
            <TextField
              fullWidth size="small" multiline rows={2}
              label="Причина"
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="например: основатель / партнёр / спецсоглашение"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForceOpen(false)} disabled={busy}>Отмена</Button>
          <Button variant="contained" color="warning" disabled={busy}
            onClick={() => apply({ type: 'force_exempt', note })}
          >
            Отключить навсегда
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
