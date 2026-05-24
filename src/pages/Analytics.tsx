import type { ReactNode } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { agents, deals, shareOperations } from '../data/mockData';

const fmt = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n);
const fmtRub = (n: number) => `${(n / 1e6).toFixed(1)} млн`;

const monthlyVKD = [
  { month: 'Янв', vkd: 4.2, income: 3.9, deals: 8 },
  { month: 'Фев', vkd: 5.8, income: 5.4, deals: 11 },
  { month: 'Мар', vkd: 3.9, income: 3.6, deals: 7 },
  { month: 'Апр', vkd: 7.1, income: 6.6, deals: 14 },
  { month: 'Май', vkd: 8.4, income: 7.8, deals: 17 },
  { month: 'Июн', vkd: 6.2, income: 5.9, deals: 12 },
  { month: 'Июл', vkd: 9.5, income: 8.8, deals: 20 },
  { month: 'Авг', vkd: 11.2, income: 10.4, deals: 23 },
  { month: 'Сен', vkd: 7.8, income: 7.2, deals: 16 },
  { month: 'Окт', vkd: 10.1, income: 9.4, deals: 21 },
  { month: 'Ноя', vkd: 12.3, income: 11.5, deals: 26 },
  { month: 'Дек', vkd: 14.6, income: 13.6, deals: 31 },
];

const levelData = [
  { name: 'Уровень 1 (80%)', value: agents.filter(a => a.level === 1).length, color: '#64748B' },
  { name: 'Уровень 2 (90%)', value: agents.filter(a => a.level === 2).length, color: '#4361EE' },
  { name: 'Уровень 3 (95%)', value: agents.filter(a => a.level === 3).length, color: '#C9A84C' },
];

const cityData = Object.entries(
  agents.reduce((acc, a) => { acc[a.city] = (acc[a.city] || 0) + 1; return acc; }, {} as Record<string, number>)
).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

const topAgents = [...agents].sort((a, b) => b.vkdYear - a.vkdYear).slice(0, 5);

const shareHistory = shareOperations.map((op, i) => ({
  date: op.date, price: op.pricePerShare, label: op.notes.slice(0, 20),
})).sort((a, b) => a.date.localeCompare(b.date));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 2, p: 1.5 }}>
      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 0.5 }}>{label}</Typography>
      {payload.map((p: any) => (
        <Typography key={p.name} variant="body2" sx={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? (p.name.includes('Сделок') ? p.value : `${p.value} млн ₽`) : p.value}
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

export default function Analytics() {
  const totalVKD = agents.reduce((s, a) => s + a.vkdYear, 0);
  const totalIncome = agents.reduce((s, a) => s + a.incomeYear, 0);
  const avgDeal = deals.length > 0 ? deals.reduce((s, d) => s + d.vkd, 0) / deals.length : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* KPI row */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {[
          { label: 'Общий ВКД (год)', value: `${(totalVKD / 1e6).toFixed(1)} млн ₽`, sub: 'за 2026 год', color: '#C9A84C' },
          { label: 'Доход компании', value: `${(totalIncome / 1e6).toFixed(1)} млн ₽`, sub: 'комиссионные', color: '#22C55E' },
          { label: 'Средняя сделка', value: `${(avgDeal / 1e6).toFixed(1)} млн ₽`, sub: 'ВКД на сделку', color: '#3B82F6' },
          { label: 'Всего агентов', value: String(agents.length), sub: `${agents.filter(a => a.status === 'active').length} активных`, color: '#8B5CF6' },
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

      {/* Monthly VKD chart */}
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
                  {levelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }} />
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

      {/* City bar + top performers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {card(
          <>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2.5 }}>Агенты по городам</Typography>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="city" tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
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
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#C9A84C', fontSize: 13 }}>{(a.vkdYear / 1e6).toFixed(1)} млн</Typography>
                    </Box>
                    <Box sx={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
                      <Box sx={{ height: '100%', borderRadius: 99, background: i === 0 ? 'linear-gradient(90deg,#C9A84C,#E2C97E)' : '#4361EE', width: `${(a.vkdYear / topAgents[0].vkdYear) * 100}%`, transition: 'width 0.8s ease' }} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </>, 0.25
        )}
      </Box>

      {/* Share price trend */}
      {card(
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
                formatter={(v: any) => [`${v.toLocaleString('ru-RU')} ₽`, 'Курс']} />
              <Area type="monotone" dataKey="price" stroke="#C9A84C" fill="url(#gShare)" strokeWidth={2.5} dot={{ fill: '#C9A84C', r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </>, 0.3
      )}
    </Box>
  );
}
