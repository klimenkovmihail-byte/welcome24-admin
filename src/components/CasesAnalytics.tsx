import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Chip } from '@mui/material';
import { casesAdminApi, type CaseAnalytics, STATUS_RU } from '../api/cases';
import { getCurrentUser } from '../auth/auth';

const fmt = (n: number) => n.toLocaleString('ru-RU');

// Порядок этапов для воронки.
const LEGAL = ['check', 'contract', 'deposit', 'dkp', 'deal', 'act', 'done'];
const MORT = ['consultation', 'approval', 'approved', 'issued'];

function Stat({ label, value, color = '#F1F5F9' }: { label: string; value: string | number; color?: string }) {
  return (
    <Card sx={{ flex: '1 1 160px', minWidth: 150 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, fontSize: 11 }}>{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color, mt: 0.5 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function Funnel({ stages, order, title }: { stages: Record<string, number>; order: string[]; title: string }) {
  const max = Math.max(1, ...order.map(s => stages[s] || 0));
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 1.5 }}>{title}</Typography>
        <Stack order={order} stages={stages} max={max} />
      </CardContent>
    </Card>
  );
}

function Stack({ order, stages, max }: { order: string[]; stages: Record<string, number>; max: number }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
      {order.map(s => {
        const n = stages[s] || 0;
        return (
          <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', width: 150, flexShrink: 0 }}>{STATUS_RU[s] || s}</Typography>
            <Box sx={{ flex: 1, height: 22, borderRadius: 1, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
              <Box sx={{ width: `${(n / max) * 100}%`, height: '100%', minWidth: n ? 24 : 0, background: 'linear-gradient(90deg, #C9A84C, #E2C97E)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 0.8 }}>
                {n > 0 && <Typography variant="caption" sx={{ color: '#0A0E1A', fontWeight: 800, fontSize: 11 }}>{n}</Typography>}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default function CasesAnalytics() {
  const [data, setData] = useState<CaseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const role = getCurrentUser()?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';

  useEffect(() => {
    casesAdminApi.analytics().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>;
  if (!data) return <Typography sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>Нет данных</Typography>;

  const t = data.totals;

  return (
    <Box>
      {/* KPI */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Stat label="Всего задач" value={t.total} />
        <Stat label="В работе" value={t.active} color="#F59E0B" />
        <Stat label="Закрыто за месяц" value={t.closedThisMonth} color="#22C55E" />
        <Stat label="Проведено сделок" value={t.provenDeals} color="#60A5FA" />
        <Stat label="ВКД проведённых" value={`${fmt(t.provenVkd)} ₽`} color="#C9A84C" />
        {isAdmin && data.stuck != null && <Stat label="Зависшие >7 дн" value={data.stuck} color={data.stuck ? '#EF4444' : '#64748B'} />}
      </Box>

      {/* Воронки */}
      <Funnel title="Воронка по этапам (юр-задачи)" stages={data.stages} order={LEGAL} />
      <Funnel title="Воронка ипотеки (брокер)" stages={data.stages} order={MORT} />

      {/* Разбивка по специалистам (только админ) */}
      {isAdmin && data.bySpecialist && (
        <Card sx={{ mt: 2 }}>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Работа специалистов</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>По каждому юристу/брокеру: загрузка, завершено, проведённый ВКД</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Специалист</TableCell>
                  <TableCell>Дорожка</TableCell>
                  <TableCell align="right">Всего</TableCell>
                  <TableCell align="right">В работе</TableCell>
                  <TableCell align="right">Завершено</TableCell>
                  <TableCell align="right">ВКД</TableCell>
                  <TableCell align="right">Доход</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.bySpecialist.length === 0 ? (
                  <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', color: '#64748B', py: 3 }}>Нет назначенных задач</TableCell></TableRow>
                ) : data.bySpecialist.map(s => (
                  <TableRow key={s.id} hover>
                    <TableCell sx={{ color: '#F1F5F9', fontWeight: 600 }}>{s.name}</TableCell>
                    <TableCell>
                      <Chip size="small" label={s.track === 'mortgage' ? 'Ипотека' : 'Юрист'}
                        sx={{ background: s.track === 'mortgage' ? 'rgba(139,92,246,0.15)' : 'rgba(34,197,94,0.15)', color: s.track === 'mortgage' ? '#8B5CF6' : '#22C55E', fontWeight: 700, fontSize: 11 }} />
                    </TableCell>
                    <TableCell align="right" sx={{ color: '#F1F5F9' }}>{s.total}</TableCell>
                    <TableCell align="right" sx={{ color: '#F59E0B' }}>{s.active}</TableCell>
                    <TableCell align="right" sx={{ color: '#22C55E' }}>{s.done}</TableCell>
                    <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 700 }}>{fmt(s.vkd)} ₽</TableCell>
                    <TableCell align="right" sx={{ color: '#94A3B8' }}>{fmt(s.income)} ₽</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
