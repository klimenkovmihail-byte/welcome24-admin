import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, TextField, InputAdornment,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TableSortLabel, Chip,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';
import { statsApi, type PortalActivity as Summary, type PortalActivityAgent } from '../api/stats';

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDay = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}.${m}`; };
const daysSince = (iso: string | null) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
const loginColor = (iso: string | null) => {
  const d = daysSince(iso);
  if (d === null) return '#EF4444';
  if (d <= 7) return '#22C55E';
  if (d <= 30) return '#C9A84C';
  return '#EF4444';
};

const pct = (n: number, total: number) => total > 0 ? Math.round((n / total) * 100) : 0;
const mln = (v: number) => `${(v / 1e6).toFixed(1)} млн`;

function Kpi({ label, value, sub, color = '#F1F5F9' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', minWidth: 150, flex: '1 1 150px' }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 28, color, lineHeight: 1.2, mt: 0.5 }}>{value}</Typography>
      {sub && <Typography variant="caption" sx={{ color: '#64748B' }}>{sub}</Typography>}
    </Paper>
  );
}

type SortKey = 'name' | 'lastLoginAt' | 'activeDays30' | 'aiReq30' | 'deals90' | 'vkd90';

export default function PortalActivity() {
  const [sum, setSum] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<PortalActivityAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('lastLoginAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([statsApi.portalActivity(), statsApi.portalActivityAgents()])
      .then(([s, a]) => { if (!cancelled) { setSum(s); setAgents(a); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'Ошибка загрузки активности'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sortHandler = (key: SortKey) => () => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = agents;
    if (term) list = list.filter(a => a.name.toLowerCase().includes(term) || a.city.toLowerCase().includes(term));
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'lastLoginAt') {
        const av = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0;
        const bv = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0;
        return (av - bv) * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [agents, q, sortKey, sortDir]);

  // Связка «активность ↔ продажи»: квадрант active × producer + scatter.
  const link = useMemo(() => {
    const isActive = (a: PortalActivityAgent) => a.activeDays30 > 0;
    const isProducer = (a: PortalActivityAgent) => a.deals90 > 0;
    const b = { ap: [] as PortalActivityAgent[], anp: [] as PortalActivityAgent[], ip: [] as PortalActivityAgent[], inp: [] as PortalActivityAgent[] };
    for (const a of agents) {
      const key = isActive(a) ? (isProducer(a) ? 'ap' : 'anp') : (isProducer(a) ? 'ip' : 'inp');
      b[key as keyof typeof b].push(a);
    }
    const avgVkd = (arr: PortalActivityAgent[]) => arr.length ? arr.reduce((s, a) => s + a.vkd90, 0) / arr.length : 0;
    const producers = agents.filter(isProducer);
    const activeProducers = producers.filter(isActive);
    return {
      b,
      producersCount: producers.length,
      pctProducersActive: producers.length ? Math.round((activeProducers.length / producers.length) * 100) : 0,
      avgVkdActive: avgVkd(agents.filter(isActive)),
      avgVkdInactive: avgVkd(agents.filter(a => !isActive(a))),
      scatter: agents.map(a => ({ x: a.activeDays30, y: a.vkd90 / 1e6, name: a.name, kind: isProducer(a) ? (isActive(a) ? 'ap' : 'ip') : 'np' })),
    };
  }, [agents]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!sum) return null;

  const trackingSinceLabel = new Date(sum.trackingSince).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Активность портала агентов</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Данные собираются с {trackingSinceLabel}. DAU/WAU/MAU — уникальные агенты, заходившие в портал за день / 7 / 30 дней.
        </Typography>
      </Box>

      {/* KPI */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Kpi label="DAU (сегодня)"   value={sum.dau} color="#C9A84C" />
        <Kpi label="WAU (7 дней)"    value={sum.wau} />
        <Kpi label="MAU (30 дней)"   value={sum.mau} />
        <Kpi label="Stickiness"      value={`${sum.stickiness}%`} sub="DAU / MAU" color="#4361EE" />
        <Kpi label="Активны 30 дней" value={`${pct(sum.active30, sum.totalActiveAgents)}%`} sub={`${sum.active30} из ${sum.totalActiveAgents}`} color="#22C55E" />
        <Kpi label="Спящие 30д+"     value={sum.sleeping} sub="не заходили месяц" color="#EF4444" />
        <Kpi label="Достижимы"       value={`${pct(sum.reachability.any, sum.totalActiveAgents)}%`} sub={`TG ${sum.reachability.telegram} · MAX ${sum.reachability.max} · Push ${sum.reachability.push}`} color="#06B6D4" />
      </Box>

      {/* Тренд DAU по дням */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2 }}>Активные агенты в день (30 дней)</Typography>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={sum.dailySeries.map(d => ({ day: fmtDay(d.day), active: d.active }))}>
            <defs>
              <linearGradient id="gAct" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}
              formatter={(v: number) => [v, 'Агентов']} />
            <Area type="monotone" dataKey="active" stroke="#C9A84C" fill="url(#gAct)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      {/* Связка активность ↔ продажи */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 0.5 }}>Активность портала ↔ Продажи</Typography>
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Заходят ли в портал те, кто реально закрывает сделки. «Активный» = заходил за 30 дней; «продаёт» = есть сделки за 90 дней.
        </Typography>

        {/* Ключевые выводы */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <Kpi label="Продающих в портале" value={`${link.pctProducersActive}%`} sub={`из ${link.producersCount} закрывавших сделки`} color="#22C55E" />
          <Kpi label="Ср. ВКД активных (90д)" value={mln(link.avgVkdActive)} sub="кто заходит в портал" color="#C9A84C" />
          <Kpi label="Ср. ВКД неактивных (90д)" value={mln(link.avgVkdInactive)} sub="кто не заходит" color="#94A3B8" />
        </Box>

        {/* Квадрант */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 2.5 }}>
          {[
            { k: 'ap', title: 'Заходят и продают', note: 'ядро — то, как должно быть', color: '#22C55E' },
            { k: 'ip', title: 'Продают, но НЕ заходят', note: 'игнорируют портал — разобраться почему', color: '#EF4444' },
            { k: 'anp', title: 'Заходят, но не продают', note: 'есть вовлечённость — нужна помощь со сделками', color: '#C9A84C' },
            { k: 'inp', title: 'Не заходят и не продают', note: 'спящие / кандидаты на отток', color: '#64748B' },
          ].map(q => {
            const arr = link.b[q.k as 'ap' | 'ip' | 'anp' | 'inp'];
            const sumVkd = arr.reduce((s, a) => s + a.vkd90, 0);
            return (
              <Box key={q.k} sx={{ p: 2, borderRadius: 2, border: `1px solid ${q.color}33`, background: `${q.color}0D` }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontWeight: 700, color: q.color, fontSize: 14 }}>{q.title}</Typography>
                  <Typography sx={{ fontWeight: 800, color: '#F1F5F9', fontSize: 22 }}>{arr.length}</Typography>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>{q.note}</Typography>
                <Typography variant="caption" sx={{ color: '#94A3B8' }}>ВКД за 90д: {mln(sumVkd)} ₽</Typography>
              </Box>
            );
          })}
        </Box>

        {/* Scatter: дни активности × ВКД */}
        <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mt: 2.5, mb: 1 }}>
          Каждая точка — агент. По горизонтали: дней активности за 30 дней. По вертикали: ВКД за 90 дней (млн ₽).
          <span style={{ color: '#EF4444' }}> Красные точки наверху слева</span> — продают, но не заходят.
        </Typography>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis type="number" dataKey="x" name="Дней активности" domain={[0, 30]} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false}
              label={{ value: 'дней активности / 30', position: 'insideBottom', offset: -10, fill: '#64748B', fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="ВКД, млн" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <ZAxis range={[50, 50]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}
              formatter={(v: number, n: string) => [n === 'ВКД, млн' ? `${v.toFixed(1)} млн ₽` : v, n]}
              labelFormatter={() => ''}
              content={({ payload }) => {
                const p = payload?.[0]?.payload as { name: string; x: number; y: number } | undefined;
                if (!p) return null;
                return (
                  <Box sx={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 2, p: 1.2 }}>
                    <Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 600 }}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>Активность: {p.x} дн / 30</Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>ВКД 90д: {p.y.toFixed(1)} млн ₽</Typography>
                  </Box>
                );
              }} />
            <Scatter data={link.scatter}>
              {link.scatter.map((p, i) => (
                <Cell key={i} fill={p.kind === 'ap' ? '#22C55E' : p.kind === 'ip' ? '#EF4444' : '#475569'} fillOpacity={p.kind === 'np' ? 0.4 : 0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </Paper>

      {/* Детализация по агентам */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
            Агенты ({rows.length})
          </Typography>
          <TextField
            size="small" placeholder="Поиск по имени или городу" value={q} onChange={e => setQ(e.target.value)}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18, color: '#64748B' }} /></InputAdornment> } }}
            sx={{ minWidth: 260 }}
          />
        </Box>
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow sx={{ '& th': { background: '#0F1629', color: '#94A3B8', fontWeight: 600, borderColor: 'rgba(255,255,255,0.06)' } }}>
                <TableCell sortDirection={sortKey === 'name' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'name'} direction={sortKey === 'name' ? sortDir : 'asc'} onClick={sortHandler('name')}>Агент</TableSortLabel>
                </TableCell>
                <TableCell>Город</TableCell>
                <TableCell sortDirection={sortKey === 'lastLoginAt' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'lastLoginAt'} direction={sortKey === 'lastLoginAt' ? sortDir : 'desc'} onClick={sortHandler('lastLoginAt')}>Последний вход</TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortKey === 'activeDays30' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'activeDays30'} direction={sortKey === 'activeDays30' ? sortDir : 'desc'} onClick={sortHandler('activeDays30')}>Дней актив. / 30</TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortKey === 'aiReq30' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'aiReq30'} direction={sortKey === 'aiReq30' ? sortDir : 'desc'} onClick={sortHandler('aiReq30')}>AI / 30д</TableSortLabel>
                </TableCell>
                <TableCell align="center" sortDirection={sortKey === 'deals90' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'deals90'} direction={sortKey === 'deals90' ? sortDir : 'desc'} onClick={sortHandler('deals90')}>Сделок 90д</TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={sortKey === 'vkd90' ? sortDir : false}>
                  <TableSortLabel active={sortKey === 'vkd90'} direction={sortKey === 'vkd90' ? sortDir : 'desc'} onClick={sortHandler('vkd90')}>ВКД 90д</TableSortLabel>
                </TableCell>
                <TableCell align="center">Каналы</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(a => (
                <TableRow key={a.id} hover sx={{ '& td': { color: '#CBD5E1', borderColor: 'rgba(255,255,255,0.04)' } }}>
                  <TableCell sx={{ fontWeight: 600, color: '#F1F5F9' }}>{a.name}</TableCell>
                  <TableCell>{a.city || '—'}</TableCell>
                  <TableCell sx={{ color: loginColor(a.lastLoginAt), fontWeight: 600 }}>{fmtDateTime(a.lastLoginAt)}</TableCell>
                  <TableCell align="center">{a.activeDays30}</TableCell>
                  <TableCell align="center">{a.aiReq30}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: a.deals90 > 0 ? 700 : 400, color: a.deals90 > 0 ? '#22C55E' : '#475569' }}>{a.deals90}</TableCell>
                  <TableCell align="right" sx={{ color: a.vkd90 > 0 ? '#F1F5F9' : '#475569' }}>{a.vkd90 > 0 ? mln(a.vkd90) : '—'}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      {a.hasTelegram && <Chip size="small" label="TG" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(34,197,94,0.15)', color: '#22C55E' }} />}
                      {a.hasMax && <Chip size="small" label="MAX" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(67,97,238,0.15)', color: '#7B92FF' }} />}
                      {a.hasPush && <Chip size="small" label="Push" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(6,182,212,0.15)', color: '#06B6D4' }} />}
                      {!a.hasTelegram && !a.hasMax && !a.hasPush && <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ color: '#64748B', py: 4, border: 0 }}>Ничего не найдено</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
