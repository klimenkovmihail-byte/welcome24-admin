import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Divider, Paper,
  Switch, FormControlLabel, Alert, Chip, InputAdornment,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
  Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { motion } from 'framer-motion';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloudSyncRoundedIcon from '@mui/icons-material/CloudSyncRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import {
  companySettings as initialSettings,
  marketingPlan as initialPlan,
  achievementDefs as initialAchievements,
  type MarketingPlanRow,
  type AchievementDef,
  type AchievementTier,
  type AchievementTriggerType,
} from '../data/mockData';
import { settingsApi } from '../api/settings';
import { statsApi } from '../api/stats';
import { backupApi, type BackupItem } from '../api/backup';
import { CircularProgress } from '@mui/material';
import { getCurrentUser } from '../auth/auth';

const fmt = (n: number) => n.toLocaleString('ru-RU');

const TIER_COLOR: Record<AchievementTier, string> = {
  bronze: '#D97706', silver: '#94A3B8', gold: '#C9A84C', platinum: '#A855F7',
};
const TRIGGER_LABEL: Record<AchievementTriggerType, string> = {
  first_agent_invited: 'Первый рекрут',
  first_deal:          'Первая сделка',
  commission_year:     'Комиссия за год',
  level_reached:       'Уровень достигнут',
  team_l1_size:        'Размер L1',
  deals_year:          'Сделок за год',
  commission_total:    'Общая комиссия',
};

// Bytes → "12.3 МБ"
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function BackupsBlock() {
  const [items, setItems] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      setErr(null);
      const list = await backupApi.list();
      setItems(list);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки списка');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    setErr(null);
    setOkMsg(null);
    try {
      const r = await backupApi.run();
      setOkMsg(`Готово: ${r.key.split('/').pop()} · ${fmtBytes(r.sizeCompressed)} (${(r.durationMs / 1000).toFixed(1)}с)${r.prunedOld ? `, удалено старых: ${r.prunedOld}` : ''}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сделать бэкап');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" sx={{ color: '#94A3B8' }}>
          Авто-бэкап каждые 6 часов · хранение 30 дней · Yandex Object Storage
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={running ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <PlayArrowRoundedIcon />}
          onClick={runNow}
          disabled={running}
        >
          {running ? 'Создаётся…' : 'Сделать бэкап сейчас'}
        </Button>
      </Box>

      {err && <Alert severity="error" onClose={() => setErr(null)}>{err}</Alert>}
      {okMsg && <Alert severity="success" onClose={() => setOkMsg(null)}>{okMsg}</Alert>}

      {loading ? (
        <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box>
      ) : items.length === 0 ? (
        <Alert severity="info">Бэкапов пока нет. Жми «Сделать бэкап сейчас» либо подожди ближайшего слота cron (00/06/12/18 UTC).</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: 12 }}>Файл</TableCell>
              <TableCell sx={{ color: '#94A3B8', fontWeight: 700, fontSize: 12 }}>Создан</TableCell>
              <TableCell align="right" sx={{ color: '#94A3B8', fontWeight: 700, fontSize: 12 }}>Размер</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.slice(0, 20).map(b => {
              const name = b.key.split('/').pop() || b.key;
              return (
                <TableRow key={b.key}>
                  <TableCell sx={{ color: '#F1F5F9', fontFamily: 'monospace', fontSize: 12 }}>{name}</TableCell>
                  <TableCell sx={{ color: '#94A3B8', fontSize: 12 }}>{fmtDate(b.modified)}</TableCell>
                  <TableCell align="right" sx={{ color: '#94A3B8', fontSize: 12 }}>{fmtBytes(b.size)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Stack>
  );
}

interface SectionProps { title: string; subtitle: string; icon: ReactNode; children: ReactNode; delay?: number; }
function Section({ title, subtitle, icon, children, delay = 0 }: SectionProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Paper sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)', overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C9A84C' }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#F1F5F9', lineHeight: 1.2 }}>{title}</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>{subtitle}</Typography>
          </Box>
        </Box>
        <Box sx={{ p: 3 }}>{children}</Box>
      </Paper>
    </motion.div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState(initialSettings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Кол-во акций в обращении — для live-расчёта «Доступно к продаже».
  const [sharesInCirculation, setSharesInCirculation] = useState<number>(0);
  const [plan, setPlan] = useState<MarketingPlanRow[]>(initialPlan);
  const [achievements, setAchievements] = useState<AchievementDef[]>(initialAchievements);
  const [editAch, setEditAch] = useState<AchievementDef | null>(null);

  // Загрузка с бэка на старте.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      settingsApi.get(),
      settingsApi.marketingPlan(),
      settingsApi.achievements(),
      statsApi.overview({}).catch(() => null),
    ])
      .then(([s, p, a, stats]) => {
        if (cancelled) return;
        setSettings(prev => ({ ...prev, sharePrice: s.sharePrice || prev.sharePrice, totalSharesIssued: s.totalSharesIssued || prev.totalSharesIssued, totalSharesAvailable: s.totalSharesAvailable || prev.totalSharesAvailable }));
        if (stats?.settings?.sharesInCirculation != null) setSharesInCirculation(stats.settings.sharesInCirculation);
        setPlan(p.map(r => ({
          level: r.level,
          protected: r.protectedPct,
          growing: r.growingPct,
          required: r.requiredL1,
          capPerAgent: r.capPerAgent,
        }) as MarketingPlanRow));
        setAchievements(a.map(x => ({
          id: x.id,
          title: x.title,
          description: x.description,
          icon: x.icon,
          tier: x.tier as AchievementTier,
          trigger: x.triggerType as AchievementTriggerType,
          threshold: x.threshold,
          active: x.active,
        }) as AchievementDef));
      })
      .catch(err => { if (!cancelled) setError(err?.message || 'Ошибка загрузки настроек'); });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async () => {
    setError(null);
    try {
      await settingsApi.update({
        // share_price и total_shares здесь НЕ сохраняем: курс = последняя котировка,
        // а потолок эмиссии редактируется ТОЛЬКО в разделе «Акции» (единый источник —
        // иначе сохранение Settings затирало бы потолок устаревшим значением формы).
        // available_shares больше не хранится в settings — считается live из stats.
        level1_threshold: settings.level1Threshold,
        level2_threshold: settings.level2Threshold,
      });
      // Сохраняем план уровней (по каждому уровню).
      await Promise.all(plan.map(r => settingsApi.updatePlan(r.level, {
        protected: r.protected,
        growing: r.growing,
        required: r.required,
        capPerAgent: r.capPerAgent,
      })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    }
  };

  const updatePlanCell = (level: number, field: keyof MarketingPlanRow, value: number | null) =>
    setPlan(prev => prev.map(r => r.level === level ? { ...r, [field]: value } : r));

  const toggleAchActive = (id: string) => {
    const cur = achievements.find(a => a.id === id);
    const next = !(cur?.active ?? true);
    setAchievements(prev => prev.map(a => a.id === id ? { ...a, active: next } : a));
    settingsApi.updateAch(id, { active: next }).catch(() => { /* tolerate */ });
  };

  // Редактор достижения (раньше — заглушка «появится позже», хотя бэк умел всё).
  const [achForm, setAchForm] = useState<{ title: string; description: string; icon: string; tier: AchievementTier; trigger: AchievementTriggerType; threshold: string }>({
    title: '', description: '', icon: '', tier: 'bronze', trigger: 'first_deal', threshold: '0',
  });
  const [achSaving, setAchSaving] = useState(false);
  const openAchEditor = (a: AchievementDef) => {
    setAchForm({ title: a.title, description: a.description, icon: a.icon, tier: a.tier, trigger: a.trigger, threshold: String(a.threshold) });
    setEditAch(a);
  };
  const handleAchSave = async () => {
    if (!editAch) return;
    setAchSaving(true); setError(null);
    const threshold = Math.max(0, Math.round(Number(achForm.threshold) || 0));
    try {
      // Ключ строго `trigger` — бэк маппит его в trigger_type (triggerType игнорирует).
      await settingsApi.updateAch(editAch.id, {
        title: achForm.title.trim(), description: achForm.description.trim(),
        icon: achForm.icon.trim() || '🏆', tier: achForm.tier, trigger: achForm.trigger, threshold,
      });
      setAchievements(prev => prev.map(x => x.id === editAch.id
        ? { ...x, title: achForm.title.trim(), description: achForm.description.trim(), icon: achForm.icon.trim() || '🏆', tier: achForm.tier, trigger: achForm.trigger, threshold }
        : x));
      setEditAch(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить достижение');
    } finally {
      setAchSaving(false);
    }
  };

  const commissionProgress = [
    { label: 'Уровень 1 → Уровень 2', threshold: settings.level1Threshold, commission: settings.level2Commission, from: settings.level1Commission, color: '#4361EE' },
    { label: 'Уровень 2 → Уровень 3', threshold: settings.level2Threshold, commission: settings.level3Commission, from: settings.level2Commission, color: '#C9A84C' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800 }}>
      {saved && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <Alert severity="success" icon={<CheckCircleRoundedIcon />} sx={{ borderRadius: 2.5 }}>
            Настройки успешно сохранены
          </Alert>
        </motion.div>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2.5 }}>
          {error}
        </Alert>
      )}

      {/* Commission levels */}
      <Section title="Уровни комиссии" subtitle="Пороги ВКД для повышения уровня агента" icon={<DiamondRoundedIcon />} delay={0.05}>
        <Stack spacing={3}>
          {commissionProgress.map((cp, i) => (
            <Box key={i}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{cp.label}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    {cp.from}% → <span style={{ color: cp.color, fontWeight: 700 }}>{cp.commission}%</span>
                  </Typography>
                </Box>
                <Chip label={`${cp.commission}% комиссия`} size="small" sx={{ background: `${cp.color}20`, color: cp.color, fontWeight: 700 }} />
              </Box>
              <TextField
                fullWidth size="small"
                label={`Порог ВКД для ${cp.commission}% (₽)`}
                type="number"
                value={i === 0 ? settings.level1Threshold : settings.level2Threshold}
                onChange={e => setSettings(s => ({
                  ...s,
                  [i === 0 ? 'level1Threshold' : 'level2Threshold']: Number(e.target.value),
                }))}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
                helperText={`Текущий порог: ${fmt(i === 0 ? settings.level1Threshold : settings.level2Threshold)} ₽ годового ВКД`}
              />
            </Box>
          ))}

          {/* Visual illustration */}
          <Box sx={{ p: 2, borderRadius: 2.5, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)' }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, display: 'block', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Шкала прогрессии
            </Typography>
            <Box sx={{ position: 'relative', height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.06)', mb: 1 }}>
              <Box sx={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, #64748B, #4361EE, #C9A84C)', width: '100%' }} />
              <Box sx={{ position: 'absolute', left: `${(settings.level1Threshold / settings.level2Threshold) * 80}%`, top: -3, width: 14, height: 14, borderRadius: '50%', background: '#4361EE', border: '2px solid #080C18', boxShadow: '0 0 8px #4361EE' }} />
              <Box sx={{ position: 'absolute', right: '10%', top: -3, width: 14, height: 14, borderRadius: '50%', background: '#C9A84C', border: '2px solid #080C18', boxShadow: '0 0 8px #C9A84C' }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ color: '#64748B' }}>0 — L1 (80%)</Typography>
              <Typography variant="caption" sx={{ color: '#4361EE', fontWeight: 600 }}>{fmt(settings.level1Threshold)} ₽ — L2 (90%)</Typography>
              <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 600 }}>{fmt(settings.level2Threshold)} ₽ — L3 (95%)</Typography>
            </Box>
          </Box>
        </Stack>
      </Section>

      {/* Marketing plan */}
      <Section title="Маркетинговый план (7 уровней)" subtitle="Защищённый/растущий процент и кап с агента в год" icon={<AccountTreeRoundedIcon />} delay={0.08}>
        <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
          Эта таблица определяет пассивный доход агентов команды. Изменения отразятся в портале на странице «Команда».
        </Alert>
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 90, fontWeight: 700, color: '#94A3B8' }}>Уровень</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Защищённый %</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Растущий %</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Требование агентов на L1</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Кап с агента в год (₽)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plan.map(row => (
                <TableRow key={row.level}>
                  <TableCell>
                    <Chip label={`У${row.level}`} size="small" sx={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', fontWeight: 800, width: 36 }} />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      size="small" type="number" sx={{ width: 110 }}
                      value={row.protected}
                      onChange={e => updatePlanCell(row.level, 'protected', Number(e.target.value))}
                      slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {row.growing === null ? (
                      <Typography variant="caption" sx={{ color: '#64748B' }}>—</Typography>
                    ) : (
                      <TextField
                        size="small" type="number" sx={{ width: 110 }}
                        value={row.growing}
                        onChange={e => updatePlanCell(row.level, 'growing', Number(e.target.value))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    {row.required === null ? (
                      <Typography variant="caption" sx={{ color: '#64748B' }}>всегда активен</Typography>
                    ) : (
                      <TextField
                        size="small" type="number" sx={{ width: 110 }}
                        value={row.required}
                        onChange={e => updatePlanCell(row.level, 'required', Number(e.target.value))}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ py: 1 }}>
                    <TextField
                      size="small" type="number" sx={{ width: 160 }}
                      value={row.capPerAgent}
                      onChange={e => updatePlanCell(row.level, 'capPerAgent', Number(e.target.value))}
                      slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Section>

      {/* Achievements */}
      <Section title="Достижения" subtitle="Список ачивок которые получают агенты" icon={<EmojiEventsRoundedIcon />} delay={0.12}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>
            {achievements.filter(a => a.active).length} активны · {achievements.length} всего
          </Typography>
        </Box>
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60, fontWeight: 700, color: '#94A3B8' }}>Иконка</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Название</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Tier</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Условие</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#94A3B8' }}>Активна</TableCell>
                <TableCell align="center" sx={{ width: 100, fontWeight: 700, color: '#94A3B8' }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {achievements.map(a => (
                  <TableRow key={a.id}>
                    <TableCell><Typography sx={{ fontSize: 26 }}>{a.icon}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{a.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{a.description}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.tier.toUpperCase()} size="small" sx={{ background: `${TIER_COLOR[a.tier]}25`, color: TIER_COLOR[a.tier], fontWeight: 800, fontSize: 10 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                        {TRIGGER_LABEL[a.trigger] ?? a.trigger}: <b style={{ color: '#C9A84C' }}>{a.threshold.toLocaleString('ru-RU')}</b>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Switch checked={a.active} onChange={() => toggleAchActive(a.id)} size="small" sx={{ '& .MuiSwitch-thumb': { background: a.active ? '#C9A84C' : '#64748B' } }} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Редактировать ачивку">
                        <IconButton size="small" onClick={() => openAchEditor(a)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Dialog open={!!editAch} onClose={() => !achSaving && setEditAch(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Редактировать достижение</Typography>
            <Typography variant="caption" sx={{ color: '#64748B' }}>id: {editAch?.id}</Typography>
          </DialogTitle>
          <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
          <DialogContent sx={{ pt: 3 }}>
            <Stack spacing={2}>
              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>{error}</Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField label="Иконка (эмодзи)" size="small" value={achForm.icon}
                  onChange={e => setAchForm(f => ({ ...f, icon: e.target.value }))} sx={{ width: 140 }} />
                <TextField fullWidth label="Название" size="small" value={achForm.title}
                  onChange={e => setAchForm(f => ({ ...f, title: e.target.value }))} />
              </Box>
              <TextField fullWidth multiline minRows={2} label="Описание" size="small" value={achForm.description}
                onChange={e => setAchForm(f => ({ ...f, description: e.target.value }))} />
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Tier</InputLabel>
                  <Select label="Tier" value={achForm.tier} onChange={e => setAchForm(f => ({ ...f, tier: e.target.value as AchievementTier }))}>
                    {(Object.keys(TIER_COLOR) as AchievementTier[]).map(t => (
                      <MenuItem key={t} value={t}><span style={{ color: TIER_COLOR[t], fontWeight: 700 }}>{t.toUpperCase()}</span></MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                  <InputLabel>Условие (триггер)</InputLabel>
                  <Select label="Условие (триггер)" value={achForm.trigger} onChange={e => setAchForm(f => ({ ...f, trigger: e.target.value as AchievementTriggerType }))}>
                    {(Object.entries(TRIGGER_LABEL) as [AchievementTriggerType, string][]).map(([k, label]) => (
                      <MenuItem key={k} value={k}>{label}</MenuItem>
                    ))}
                    {/* Нестандартный триггер из БД (бэк принимает произвольную строку) —
                        показываем как есть, чтобы Select не «пустел» и значение не терялось. */}
                    {!TRIGGER_LABEL[achForm.trigger] && (
                      <MenuItem value={achForm.trigger}>{achForm.trigger}</MenuItem>
                    )}
                  </Select>
                </FormControl>
                <TextField label="Порог" size="small" type="number" value={achForm.threshold}
                  onChange={e => setAchForm(f => ({ ...f, threshold: e.target.value }))} sx={{ width: 160 }} />
              </Box>
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Порог и триггер применяются сразу: бейджи агентов пересчитываются живьём.
                Повышение порога может убрать уже показанные достижения у агентов.
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={() => setEditAch(null)} disabled={achSaving} sx={{ color: '#64748B' }}>Отмена</Button>
            <Button variant="contained" onClick={handleAchSave}
              disabled={achSaving || !achForm.title.trim() || achForm.threshold.trim() === '' || Number.isNaN(Number(achForm.threshold))}>
              {achSaving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </DialogActions>
        </Dialog>
      </Section>

      {/* Share settings */}
      <Section title="Акции компании" subtitle="Параметры акционной программы" icon={<DiamondRoundedIcon />} delay={0.16}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              fullWidth size="small" label="Текущий курс акции (₽)" type="number"
              value={settings.sharePrice}
              disabled
              helperText="Курс = последняя котировка. Менять в разделе «Акции» → «Добавить котировку»."
              slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
            />
            <TextField
              fullWidth size="small" label="Всего акций выпущено" type="number"
              value={settings.totalSharesIssued}
              disabled
              helperText="Потолок эмиссии. Менять в разделе «Акции» (единый источник правды)."
            />
          </Box>
          <Box sx={{ p: 2, borderRadius: 2.5, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B' }}>Капитализация</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#22C55E' }}>
                {((settings.sharePrice * settings.totalSharesIssued) / 1e6).toFixed(0)} млн ₽
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B' }}>В обращении</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>
                {fmt(sharesInCirculation)} акций
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B' }}>Доступно к продаже</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>
                {fmt(Math.max(0, settings.totalSharesIssued - sharesInCirculation))} акций
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Section>

      {/* Backups */}
      <Section title="Резервные копии БД" subtitle="История бэкапов и ручной запуск" icon={<CloudSyncRoundedIcon />} delay={0.22}>
        <BackupsBlock />
      </Section>

      {/* Security — честная карточка текущего аккаунта. Раньше тут были поля
          «email/имя администратора», которые никуда не сохранялись (обманка),
          и Alert про несуществующую 2FA. Имя/email админ-аккаунта правятся в
          карточке сотрудника (Агенты ↔ Сотрудники), пароль — через сброс там же. */}
      <Section title="Безопасность" subtitle="Текущий аккаунт административной панели" icon={<SecurityRoundedIcon />} delay={0.25}>
        {(() => {
          const me = getCurrentUser();
          const roleLabel: Record<string, string> = {
            super_admin: 'Супер-админ', admin: 'Администратор', manager: 'Менеджер',
          };
          return (
            <Box sx={{ p: 2, borderRadius: 2.5, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Вы вошли как</Typography>
                <Typography variant="body1" sx={{ fontWeight: 800, color: '#F1F5F9' }}>{me?.name || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Email</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#94A3B8' }}>{me?.email || '—'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>Роль</Typography>
                <Chip label={roleLabel[me?.role || ''] || me?.role || '—'} size="small"
                  sx={{ background: 'rgba(201,168,76,0.12)', color: '#C9A84C', fontWeight: 700 }} />
              </Box>
            </Box>
          );
        })()}
      </Section>

      {/* Save button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', pb: 2 }}>
        <Button variant="contained" size="large" startIcon={<SaveRoundedIcon />} onClick={handleSave} sx={{ px: 4 }}>
          Сохранить все настройки
        </Button>
      </Box>
    </Box>
  );
}
