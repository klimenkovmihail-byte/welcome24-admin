import { Box, Card, CardContent, Typography, Grid, Chip, alpha } from '@mui/material';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { agents, deals, companySettings, shareOperations } from '../data/mockData';

const fmt = (n: number) => n >= 1000000 ? `${(n / 1000000).toFixed(1)} млн` : n >= 1000 ? `${(n / 1000).toFixed(0)} тыс` : String(n);
const fmtFull = (n: number) => n.toLocaleString('ru-RU');

const monthlyDeals = [
  { m: 'Янв', vkd: 12000000, deals: 8 }, { m: 'Фев', vkd: 9500000, deals: 6 },
  { m: 'Мар', vkd: 15000000, deals: 11 }, { m: 'Апр', vkd: 11200000, deals: 9 },
  { m: 'Май', vkd: 18500000, deals: 13 }, { m: 'Июн', vkd: 0, deals: 0 },
];

const cityData = [
  { city: 'Москва', agents: 7, color: '#C9A84C' }, { city: 'Краснодар', agents: 2, color: '#4361EE' },
  { city: 'СПб', agents: 1, color: '#22C55E' }, { city: 'Другие', agents: 3, color: '#7B2FBE' },
];

const CustomTip = ({ active, payload, label }: any) => active && payload?.length ? (
  <Box sx={{ background: '#1A2340', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 2, p: 1.5 }}>
    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>{label}</Typography>
    {payload.map((p: any) => <Typography key={p.name} variant="caption" sx={{ color: p.color, display: 'block', fontWeight: 700 }}>{p.name}: {fmtFull(p.value)}</Typography>)}
  </Box>
) : null;

const StatCard = ({ icon, label, value, sub, color, trend, delay }: any) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: alpha(color, 0.07) }} />
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{label}</Typography>
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#F1F5F9', mt: 0.5, lineHeight: 1 }}>{value}</Typography>
            {sub && <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5, display: 'block' }}>{sub}</Typography>}
            {trend && <Chip label={trend} size="small" sx={{ mt: 0.5, height: 18, fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.12)', color: '#22C55E', '& .MuiChip-label': { px: 1 } }} />}
          </Box>
          <Box sx={{ width: 48, height: 48, borderRadius: 3, background: alpha(color, 0.15), border: `1px solid ${alpha(color, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  </motion.div>
);

export default function Dashboard() {
  const totalVkd = deals.filter(d => d.status !== 'cancelled').reduce((s, d) => s + d.vkd, 0);
  const pendingDeals = deals.filter(d => d.status === 'pending').length;
  const totalShares = agents.reduce((s, a) => s + a.shares, 0);
  const sharesValue = totalShares * companySettings.sharePrice;

  return (
    <Box>
      {/* Alert banner */}
      {pendingDeals > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Box sx={{ mb: 3, p: 2, borderRadius: 3, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', flexShrink: 0, boxShadow: '0 0 8px #F59E0B' }} />
            <Typography variant="body2" sx={{ color: '#F1F5F9' }}>
              <b style={{ color: '#F59E0B' }}>{pendingDeals} сделки</b> ожидают верификации
            </Typography>
            <Chip label="Просмотреть" size="small" onClick={() => {}} sx={{ ml: 'auto', background: 'rgba(245,158,11,0.2)', color: '#F59E0B', cursor: 'pointer', fontWeight: 700 }} />
          </Box>
        </motion.div>
      )}

      {/* Stats */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard delay={0.05} icon={<PeopleRoundedIcon />} label="Всего агентов" value={agents.length} sub={`${agents.filter(a => a.status === 'active').length} активных`} trend="+3 за месяц" color="#4361EE" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard delay={0.1} icon={<HandshakeRoundedIcon />} label="Сделки 2026" value={deals.length} sub={`ВКД: ${fmt(totalVkd)} ₽`} trend={`${pendingDeals} на верификации`} color="#C9A84C" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard delay={0.15} icon={<DiamondRoundedIcon />} label="Акции выпущено" value={fmtFull(companySettings.totalSharesIssued)} sub={`В обращении: ${fmtFull(totalShares)} шт`} color="#7B2FBE" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard delay={0.2} icon={<TrendingUpRoundedIcon />} label="Курс 1 акции" value={`${fmtFull(companySettings.sharePrice)} ₽`} sub={`Капитализация: ${fmt(sharesValue)} ₽`} trend="+28% с начала года" color="#22C55E" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* VKD Chart */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#F1F5F9' }}>ВКД по месяцам</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B' }}>2026 год — объём сделок платформы</Typography>
                  </Box>
                  <Chip label={`Всего: ${fmt(totalVkd)} ₽`} size="small" sx={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', fontWeight: 700 }} />
                </Box>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyDeals}>
                    <defs>
                      <linearGradient id="vkdGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="m" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                    <Tooltip content={<CustomTip />} />
                    <Area type="monotone" dataKey="vkd" name="ВКД" stroke="#C9A84C" strokeWidth={2.5} fill="url(#vkdGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Agents by city */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 3 }}>Агенты по городам</Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <PieChart width={180} height={180}>
                    <Pie data={cityData} cx={85} cy={85} innerRadius={50} outerRadius={80} dataKey="agents" paddingAngle={3}>
                      {cityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                  {cityData.map(d => (
                    <Box key={d.city} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                        <Typography variant="caption" sx={{ color: '#94A3B8' }}>{d.city}</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{d.agents}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Recent deals */}
        <Grid size={{ xs: 12 }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Последние сделки</Typography>
                  <Chip label="Все сделки →" size="small" onClick={() => {}} sx={{ background: 'rgba(201,168,76,0.1)', color: '#C9A84C', cursor: 'pointer', fontWeight: 700 }} />
                </Box>
                {deals.slice(0, 4).map((deal, i) => {
                  const statusMap = { pending: { label: 'На верификации', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' }, confirmed: { label: 'Подтверждена', color: '#4361EE', bg: 'rgba(67,97,238,0.12)' }, paid: { label: 'Выплачено', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' }, cancelled: { label: 'Отменена', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' } };
                  const s = statusMap[deal.status];
                  return (
                    <Box key={deal.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <HandshakeRoundedIcon sx={{ color: '#C9A84C', fontSize: 18 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.agentName.split(' ')[0]} {deal.agentName.split(' ')[1]}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.address}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#22C55E' }}>{fmt(deal.vkd)} ₽</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{deal.date}</Typography>
                      </Box>
                      <Chip label={s.label} size="small" sx={{ background: s.bg, color: s.color, fontWeight: 700, minWidth: 120, '& .MuiChip-label': { fontSize: 11 } }} />
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}
