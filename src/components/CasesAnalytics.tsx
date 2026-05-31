import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Chip, FormControl, Select, MenuItem } from '@mui/material';
import { casesAdminApi, type CaseAnalytics, STATUS_RU } from '../api/cases';
import { getCurrentUser } from '../auth/auth';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const LEGAL = ['check', 'contract', 'deposit', 'dkp', 'deal', 'act', 'done'];
const MORT = ['consultation', 'approval', 'approved', 'issued'];

const PERIODS = [
  { key: 'all', label: 'За всё время' },
  { key: 'month', label: 'Этот месяц' },
  { key: 'quarter', label: 'Этот квартал' },
  { key: 'year', label: 'Этот год' },
];

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

// Накопительная воронка: бар = доля прошедших через этап от первого этапа.
function Funnel({ funnel, order, title, cancelled }: { funnel: Record<string, number>; order: string[]; title: string; cancelled: number }) {
  const max = Math.max(1, funnel[order[0]] || 0);
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{title}</Typography>
          {cancelled > 0 && <Chip size="small" label={`Отменено: ${cancelled}`} sx={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 700, fontSize: 11 }} />}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
          {order.map((s, i) => {
            const n = funnel[s] || 0;
            const prev = i === 0 ? n : (funnel[order[i - 1]] || 0);
            const conv = prev > 0 ? Math.round((n / prev) * 100) : 0;
            return (
              <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="caption" sx={{ color: '#94A3B8', width: 160, flexShrink: 0 }}>{STATUS_RU[s] || s}</Typography>
                <Box sx={{ flex: 1, height: 22, borderRadius: 1, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <Box sx={{ width: `${(n / max) * 100}%`, height: '100%', minWidth: n ? 26 : 0, background: 'linear-gradient(90deg, #C9A84C, #E2C97E)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 0.8 }}>
                    {n > 0 && <Typography variant="caption" sx={{ color: '#0A0E1A', fontWeight: 800, fontSize: 11 }}>{n}</Typography>}
                  </Box>
                </Box>
                <Typography variant="caption" sx={{ color: '#64748B', width: 44, textAlign: 'right', flexShrink: 0 }}>
                  {i > 0 ? `${conv}%` : ''}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function CasesAnalytics() {
  const [data, setData] = useState<CaseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const role = getCurrentUser()?.role;
  const isAdmin = role === 'super_admin' || role === 'admin';

  useEffect(() => {
    setLoading(true);
    casesAdminApi.analytics(period).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [period]);

  const t = data?.totals;

  return (
    <Box>
      {/* Фильтр периода */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 170 }}>
          <Select value={period} onChange={e => setPeriod(e.target.value)}>
            {PERIODS.map(p => <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: '#C9A84C' }} /></Box>
      ) : !data || !t ? (
        <Typography sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>Нет данных</Typography>
      ) : (
        <>
          {/* KPI */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Stat label="Всего задач" value={t.total} />
            <Stat label="В работе" value={t.active} color="#F59E0B" />
            <Stat label="Закрыто" value={t.closedThisMonth} color="#22C55E" />
            <Stat label="Проведено сделок" value={t.provenDeals} color="#60A5FA" />
            <Stat label="ВКД проведённых" value={`${fmt(t.provenVkd)} ₽`} color="#C9A84C" />
            {isAdmin && data.stuck != null && <Stat label="Зависшие >7 дн" value={data.stuck} color={data.stuck ? '#EF4444' : '#64748B'} />}
          </Box>

          {/* Воронки — только непустые дорожки */}
          {data.hasLegal && <Funnel title="Воронка юр-задач" funnel={data.funnels.legal} order={LEGAL} cancelled={data.cancelled.legal} />}
          {data.hasMortgage && <Funnel title="Воронка ипотеки" funnel={data.funnels.mortgage} order={MORT} cancelled={data.cancelled.mortgage} />}
          {!data.hasLegal && !data.hasMortgage && (
            <Card sx={{ mt: 2 }}><CardContent sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#64748B' }}>За выбранный период задач нет.</Typography>
            </CardContent></Card>
          )}

          {/* Разбивка по специалистам (только админ) */}
          {isAdmin && data.bySpecialist && (
            <Card sx={{ mt: 2 }}>
              <CardContent sx={{ p: 0 }}>
                <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Работа специалистов</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>По каждому юристу/брокеру: загрузка, завершено, проведённый ВКД</Typography>
                </Box>
                <Box sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 640 }}>
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
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
