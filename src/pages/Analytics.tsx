import { useEffect, useState, type ReactNode } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { statsApi, type OverviewResponse } from '../api/stats';
import { sharesApi, type ShareQuote } from '../api/shares';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 2, p: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 0.5 }}>{label}</Typography>
      {payload.map(p => (
        <Typography key={p.name} variant="body2" sx={{ color: p.color || '#94A3B8', fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? (p.name.includes('Сделок') ? p.value : `${p.value.toFixed(1)} млн ₽`) : p.value}
        </Typography>
      ))}
    </Box>
  );
};

const card = (content: ReactNode, delay = 0) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} style={{ height: '100%' }}>
    <Paper sx={{ p: 3, height: '100%', borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
      {content}
    </Paper>
  </motion.div>
);

const LEVEL_COLORS: Record<number, string> = { 1: '#64748B', 2: '#4361EE', 3: '#C9A84C' };
const LEVEL_LABEL: Record<number, string> = { 1: 'Уровень 1 (80%)', 2: 'Уровень 2 (90%)', 3: 'Уровень 3 (95%)' };

export default function Analytics() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [quotes, setQuotes] = useState<ShareQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentYear = String(new Date().getFullYear());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      statsApi.overview({ year: currentYear }),
      sharesApi.quotes(),
    ])
      .then(([s, q]) => { if (!cancelled) { setData(s); setQuotes(q); } })
      .catch(err => { if (!cancelled) setError(err?.message || 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;
  if (error)   return <Alert severity="error">{error}</Alert>;
  if (!data)   return null;

  const totalVKD = data.deals.totalVkd;
  const totalIncome = data.deals.totalIncome;
  const avgDeal = data.deals.total > 0 ? totalVKD / data.deals.total : 0;

  // Преобразуем для графиков
  const monthlyVKD = data.monthlyDeals.map(b => ({
    month: b.m,
    vkd: b.vkd / 1e6,
    income: b.income / 1e6,
    deals: b.deals,
  }));
  const levelData = data.agentsByLevel.map(d => ({
    name: LEVEL_LABEL[d.level] || `Уровень ${d.level}`,
    value: d.count,
    color: LEVEL_COLORS[d.level] || '#94A3B8',
  }));
  const cityData = data.agentsByCity.map(c => ({ city: c.city, count: c.agents }));
  const topAgents = data.topAgents.slice(0, 5);
  const maxTop = topAgents[0]?.vkd || 1;

  const shareHistory = quotes
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(q => ({ date: q.date, price: q.price }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* KPI row */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {[
          { label: 'Общий ВКД (год)', value: `${(totalVKD / 1e6).toFixed(1)} млн ₽`, sub: `за ${currentYear} год`, color: '#C9A84C' },
          { label: 'Доход компании', value: `${(totalIncome / 1e6).toFixed(1)} млн ₽`, sub: 'комиссионные', color: '#22C55E' },
          { label: 'Средняя сделка', value: `${(avgDeal / 1000).toFixed(0)} тыс ₽`, sub: 'ВКД на сделку', color: '#3B82F6' },
          { label: 'Всего агентов', value: String(data.agents.total), sub: `${data.agents.active} активных · ${data.agents.blocked + data.agents.inactive} заблокированных`, color: '#8B5CF6' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} style={{ flex: '1 1 180px' }}>
            <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: `1px solid ${s.color}20` }}>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mb: 0.5 }}>{s.label}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#475569', fontSize: 11 }}>{s.sub}</Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Monthly VKD + Levels */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 3 }}>
        {card(
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2.5 }}>ВКД и доход по месяцам (млн ₽)</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyVKD}>
                <defs>
                  <linearGradient id="gVKD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94A3B8' }} />
                <Area type="monotone" dataKey="vkd" name="ВКД" stroke="#C9A84C" fill="url(#gVKD)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="income" name="Доход" stroke="#22C55E" fill="url(#gInc)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </>, 0.1
        )}

        {card(
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2.5 }}>Агенты по уровням</Typography>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={levelData} cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3} dataKey="value">
                  {levelData.map((entry, i) => <Cell key={i} fill={entry.color || '#94A3B8'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mt: 1 }}>
              {levelData.map(d => (
                <Box key={d.name} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    <Typography variant="caption" sx={{ color: '#94A3B8' }}>{d.name}</Typography>
                  </Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: d.color }}>{d.value}</Typography>
                </Box>
              ))}
            </Box>
          </>, 0.15
        )}
      </Box>

      {/* City bar + Top-5 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {card(
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2.5 }}>Агенты по городам</Typography>
            <ResponsiveContainer width="100%" height={Math.max(220, cityData.length * 28)}>
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="city" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }} />
                <Bar dataKey="count" name="Агентов" fill="#4361EE" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>, 0.2
        )}

        {card(
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2 }}>Топ-5 агентов по ВКД</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {topAgents.map((a, i) => (
                <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900, color: i === 0 ? '#C9A84C' : '#475569', width: 20, textAlign: 'center' }}>
                    {i + 1}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9', fontSize: 13 }}>{a.name.split(' ').slice(0, 2).join(' ')}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C', fontSize: 13 }}>{(a.vkd / 1e6).toFixed(1)} млн</Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                      <Box sx={{ height: '100%', borderRadius: 99, background: i === 0 ? 'linear-gradient(90deg,#C9A84C,#E2C97E)' : '#4361EE', width: `${(a.vkd / maxTop) * 100}%`, transition: 'width 0.8s ease' }} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </>, 0.25
        )}
      </Box>

      {/* Share price */}
      {shareHistory.length > 0 && card(
        <>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2.5 }}>История курса акции (₽)</Typography>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={shareHistory}>
              <defs>
                <linearGradient id="gShare" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }}
                formatter={(v: number) => [`${v.toLocaleString('ru-RU')} ₽`, 'Курс']} />
              <Area type="monotone" dataKey="price" stroke="#C9A84C" fill="url(#gShare)" strokeWidth={2.5} dot={{ fill: '#C9A84C', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </>, 0.3
      )}
    </Box>
  );
}
