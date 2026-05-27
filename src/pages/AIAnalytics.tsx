import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, Select, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, FormControl, InputLabel,
} from '@mui/material';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { aiAnalyticsApi, type AiAnalyticsResponse } from '../api/aiAnalytics';

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

const TOOL_LABELS: Record<string, string> = {
  listing: 'Описание объекта',
  social_post: 'Пост в соцсеть',
  legal_advisor: 'AI юрист',
};
const TOOL_COLORS: Record<string, string> = {
  listing: '#C9A84C',
  social_post: '#4361EE',
  legal_advisor: '#22C55E',
};

export default function AIAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AiAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    aiAnalyticsApi.get(days)
      .then(r => { if (!cancelled) setData(r); })
      .catch(e => { if (!cancelled) setError(e?.message || 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const chartData = data.byDay.map(d => ({
    day: d.day.slice(5),    // 'MM-DD'
    requests: d.requests,
    tokens: Math.round(d.tokens / 1000), // тыс токенов
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Аналитика AI</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Использование AI-инструментов агентами · период {data.from} — {data.to}
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Период</InputLabel>
          <Select value={days} label="Период" onChange={e => setDays(Number(e.target.value))}>
            <MenuItem value={7}>7 дней</MenuItem>
            <MenuItem value={30}>30 дней</MenuItem>
            <MenuItem value={90}>90 дней</MenuItem>
            <MenuItem value={180}>180 дней</MenuItem>
            <MenuItem value={365}>1 год</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* KPI cards */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, mb: 3 }}>
        <KpiCard label="Всего запросов" value={fmt(data.totals.requests)} color="#C9A84C" delay={0} />
        <KpiCard label="Активных агентов" value={fmt(data.totals.active_agents)} color="#4361EE" delay={0.05} />
        <KpiCard label="Токенов" value={fmt(data.totals.tokens)} color="#22C55E" delay={0.1} />
        <KpiCard label="Прибл. стоимость" value={`$${data.totals.cost_usd.toFixed(2)}`} color="#F59E0B" delay={0.15} />
      </Box>

      {/* График по дням */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2 }}>Запросов по дням</Typography>
        {chartData.length === 0 ? (
          <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>За выбранный период данных нет</Typography>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} />
              <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }} />
              <Area type="monotone" dataKey="requests" stroke="#C9A84C" fill="rgba(201,168,76,0.2)" name="Запросы" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mb: 3 }}>
        {/* Разбивка по инструментам */}
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2 }}>По инструментам</Typography>
          {data.byTool.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>Нет данных</Typography>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byTool.map(t => ({ name: TOOL_LABELS[t.tool] || t.tool, requests: t.requests, tool: t.tool }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis stroke="#64748B" fontSize={11} />
                  <Tooltip contentStyle={{ background: '#0F1629', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 8 }} />
                  <Bar dataKey="requests" radius={[8, 8, 0, 0]}>
                    {data.byTool.map((t, i) => (
                      <Cell key={i} fill={TOOL_COLORS[t.tool] || '#94A3B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Table size="small" sx={{ mt: 2, '& .MuiTableCell-root': { color: '#94A3B8', borderColor: 'rgba(255,255,255,0.05)' } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#64748B !important', fontSize: 11 }}>Инструмент</TableCell>
                    <TableCell align="right" sx={{ color: '#64748B !important', fontSize: 11 }}>Запросов</TableCell>
                    <TableCell align="right" sx={{ color: '#64748B !important', fontSize: 11 }}>Токенов</TableCell>
                    <TableCell align="right" sx={{ color: '#64748B !important', fontSize: 11 }}>Прибл. $</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.byTool.map(t => (
                    <TableRow key={t.tool}>
                      <TableCell sx={{ color: '#F1F5F9 !important', fontWeight: 600 }}>{TOOL_LABELS[t.tool] || t.tool}</TableCell>
                      <TableCell align="right">{fmt(t.requests)}</TableCell>
                      <TableCell align="right">{fmt(t.tokens)}</TableCell>
                      <TableCell align="right" sx={{ color: '#F59E0B !important' }}>${t.cost_usd.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </Paper>

        {/* Топ-10 агентов */}
        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 2 }}>Топ-10 агентов по AI-активности</Typography>
          {data.topAgents.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>Нет данных</Typography>
          ) : (
            <Table size="small" sx={{ '& .MuiTableCell-root': { color: '#94A3B8', borderColor: 'rgba(255,255,255,0.05)' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#64748B !important', fontSize: 11 }}>Агент</TableCell>
                  <TableCell align="right" sx={{ color: '#64748B !important', fontSize: 11 }}>Запросов</TableCell>
                  <TableCell align="right" sx={{ color: '#64748B !important', fontSize: 11 }}>Токенов</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.topAgents.map(a => (
                  <TableRow key={a.agent_id}>
                    <TableCell sx={{ color: '#F1F5F9 !important', fontWeight: 600 }}>{a.agent_name || `Агент #${a.agent_id}`}</TableCell>
                    <TableCell align="right" sx={{ color: '#C9A84C !important', fontWeight: 700 }}>{fmt(a.requests)}</TableCell>
                    <TableCell align="right">{fmt(a.tokens)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function KpiCard({ label, value, color, delay }: { label: string; value: string; color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${color}30`, background: `${color}08` }}>
        <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, display: 'block' }}>
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color, mt: 0.5 }}>{value}</Typography>
      </Paper>
    </motion.div>
  );
}
