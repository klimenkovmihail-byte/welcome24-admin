import { useEffect, useState } from 'react';
import {
  Box, Typography, Paper, CircularProgress, Alert, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, TextField, Chip,
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  reportsApi,
  type DealsByAgentResponse,
  type PropertyTypesResponse,
  type MlmPayoutsResponse,
} from '../api/reports';

const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');

// По умолчанию — текущий месяц.
function defaultRange() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const last = new Date(y, today.getMonth() + 1, 0).getDate();
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(last).padStart(2, '0')}` };
}

const COMMISSION_COLOR: Record<number, string> = {
  80: '#64748B',
  90: '#4361EE',
  95: '#C9A84C',
};

const LEVEL_COLORS = ['#C9A84C', '#4361EE', '#22C55E', '#F59E0B', '#A855F7', '#EC4899', '#06B6D4'];

export default function Reports() {
  const [tab, setTab] = useState(0);
  const [range, setRange] = useState(defaultRange());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dealsByAgent, setDealsByAgent] = useState<DealsByAgentResponse | null>(null);
  const [mlmPayouts, setMlmPayouts] = useState<MlmPayoutsResponse | null>(null);
  const [propTypes, setPropTypes] = useState<PropertyTypesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      reportsApi.dealsByAgent(range),
      reportsApi.mlmPayouts(range),
      reportsApi.propertyTypes(range),
    ])
      .then(([d, m, p]) => {
        if (cancelled) return;
        setDealsByAgent(d);
        setMlmPayouts(m);
        setPropTypes(p);
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Ошибка загрузки'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to]);

  const dateInputSx = {
    '& input': { color: '#F1F5F9', colorScheme: 'dark' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.25)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(201,168,76,0.4)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#C9A84C' },
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9' }}>Отчёты</Typography>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Произвольный период · сортировка по убыванию · итоги внизу
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            type="date" size="small" label="С" value={range.from}
            onChange={e => setRange(r => ({ ...r, from: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true, sx: { color: '#94A3B8' } } }}
            sx={dateInputSx}
          />
          <TextField
            type="date" size="small" label="По" value={range.to}
            onChange={e => setRange(r => ({ ...r, to: e.target.value }))}
            slotProps={{ inputLabel: { shrink: true, sx: { color: '#94A3B8' } } }}
            sx={dateInputSx}
          />
        </Box>
      </Box>

      <Paper sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', overflow: 'hidden' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: '1px solid rgba(201,168,76,0.08)',
            '& .MuiTabs-indicator': { background: '#C9A84C', height: 3 },
            '& .MuiTab-root': { color: '#64748B', textTransform: 'none', fontWeight: 600, fontSize: 14 },
            '& .Mui-selected': { color: '#C9A84C !important' },
          }}
        >
          <Tab label="Сделки по агентам" />
          <Tab label="МЛМ-выплаты" />
          <Tab label="Типы недвижимости" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#C9A84C' }} />
            </Box>
          )}
          {error && !loading && <Alert severity="error">{error}</Alert>}

          {!loading && !error && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              {tab === 0 && dealsByAgent && <DealsByAgentTable data={dealsByAgent} />}
              {tab === 1 && mlmPayouts && <MlmPayoutsTable data={mlmPayouts} />}
              {tab === 2 && propTypes && <PropertyTypesTable data={propTypes} />}
            </motion.div>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

// ===========================================================================
// Таблица 1 — Сделки по агентам
// ===========================================================================
function DealsByAgentTable({ data }: { data: DealsByAgentResponse }) {
  if (data.rows.length === 0) {
    return <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>За выбранный период сделок не было.</Typography>;
  }
  return (
    <Table size="small" sx={tableSx}>
      <TableHead>
        <TableRow>
          <TableCell>Агент</TableCell>
          <TableCell align="right">Сделок</TableCell>
          <TableCell align="right">ВКД, ₽</TableCell>
          <TableCell align="right">Доход агента, ₽</TableCell>
          <TableCell align="right">Доход компании, ₽</TableCell>
          <TableCell align="center">Уровень</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map(r => (
          <TableRow key={r.agentId} hover>
            <TableCell sx={{ color: '#F1F5F9', fontWeight: 600 }}>{r.agentName}</TableCell>
            <TableCell align="right">{fmt(r.dealsCount)}</TableCell>
            <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 700 }}>{fmt(r.totalVkd)}</TableCell>
            <TableCell align="right">{fmt(r.agentIncome)}</TableCell>
            <TableCell align="right">{fmt(r.companyIncome)}</TableCell>
            <TableCell align="center">
              <Chip
                size="small"
                label={`${r.currentCommission}%`}
                sx={{
                  background: `${COMMISSION_COLOR[r.currentCommission] || '#64748B'}22`,
                  color: COMMISSION_COLOR[r.currentCommission] || '#94A3B8',
                  fontWeight: 700, border: `1px solid ${COMMISSION_COLOR[r.currentCommission] || '#64748B'}44`,
                }}
              />
            </TableCell>
          </TableRow>
        ))}
        <TableRow sx={totalRowSx}>
          <TableCell sx={{ color: '#F1F5F9', fontWeight: 800 }}>ИТОГО</TableCell>
          <TableCell align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>{fmt(data.totals.dealsCount)}</TableCell>
          <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 800 }}>{fmt(data.totals.totalVkd)}</TableCell>
          <TableCell align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>{fmt(data.totals.agentIncome)}</TableCell>
          <TableCell align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>{fmt(data.totals.companyIncome)}</TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ===========================================================================
// Таблица 2 — МЛМ-выплаты (7 уровней + итого)
// ===========================================================================
function MlmPayoutsTable({ data }: { data: MlmPayoutsResponse }) {
  if (data.rows.length === 0) {
    return <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>За выбранный период МЛМ-выплат не было.</Typography>;
  }
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={tableSx}>
        <TableHead>
          <TableRow>
            <TableCell>Ментор</TableCell>
            {Array.from({ length: 7 }, (_, i) => (
              <TableCell key={i} align="right" sx={{ color: LEVEL_COLORS[i] + ' !important' }}>{`У${i + 1}, ₽`}</TableCell>
            ))}
            <TableCell align="right">Итого, ₽</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.rows.map(r => (
            <TableRow key={r.mentorId} hover>
              <TableCell sx={{ color: '#F1F5F9', fontWeight: 600 }}>{r.mentorName}</TableCell>
              {r.byLevel.map((v, i) => (
                <TableCell key={i} align="right" sx={{ color: v > 0 ? '#F1F5F9' : '#334155' }}>
                  {v > 0 ? fmt(v) : '—'}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 700 }}>{fmt(r.total)}</TableCell>
            </TableRow>
          ))}
          <TableRow sx={totalRowSx}>
            <TableCell sx={{ color: '#F1F5F9', fontWeight: 800 }}>ИТОГО</TableCell>
            {data.totals.byLevel.map((v, i) => (
              <TableCell key={i} align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>
                {v > 0 ? fmt(v) : '—'}
              </TableCell>
            ))}
            <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 800 }}>{fmt(data.totals.total)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

// ===========================================================================
// Таблица 3 — Типы недвижимости
// ===========================================================================
function PropertyTypesTable({ data }: { data: PropertyTypesResponse }) {
  if (data.totals.dealsCount === 0) {
    return <Typography variant="body2" sx={{ color: '#64748B', textAlign: 'center', py: 4 }}>За выбранный период сделок не было.</Typography>;
  }
  return (
    <Table size="small" sx={tableSx}>
      <TableHead>
        <TableRow>
          <TableCell>Категория</TableCell>
          <TableCell align="right">Сделок</TableCell>
          <TableCell align="right">Сумма ВКД, ₽</TableCell>
          <TableCell align="right">Доля</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.rows.map(r => (
          <TableRow key={r.category} hover>
            <TableCell sx={{ color: '#F1F5F9', fontWeight: 600 }}>{r.label}</TableCell>
            <TableCell align="right">{fmt(r.dealsCount)}</TableCell>
            <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 700 }}>{fmt(r.totalVkd)}</TableCell>
            <TableCell align="right">{r.percent}%</TableCell>
          </TableRow>
        ))}
        <TableRow sx={totalRowSx}>
          <TableCell sx={{ color: '#F1F5F9', fontWeight: 800 }}>ИТОГО</TableCell>
          <TableCell align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>{fmt(data.totals.dealsCount)}</TableCell>
          <TableCell align="right" sx={{ color: '#C9A84C', fontWeight: 800 }}>{fmt(data.totals.totalVkd)}</TableCell>
          <TableCell align="right" sx={{ color: '#F1F5F9', fontWeight: 800 }}>100%</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// ===========================================================================
// Стили общие для таблиц
// ===========================================================================
const tableSx = {
  '& .MuiTableCell-root': { color: '#94A3B8', borderColor: 'rgba(201,168,76,0.06)', whiteSpace: 'nowrap' },
  '& .MuiTableCell-head': { color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', borderColor: 'rgba(201,168,76,0.12)' },
  '& .MuiTableRow-root:hover': { background: 'rgba(201,168,76,0.04)' },
};

const totalRowSx = {
  background: 'rgba(201,168,76,0.08)',
  '& .MuiTableCell-root': { borderTop: '2px solid rgba(201,168,76,0.3)', borderBottom: 'none' },
};
