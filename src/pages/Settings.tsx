import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Divider, Paper,
  Switch, FormControlLabel, Alert, Chip, InputAdornment,
  Table, TableHead, TableRow, TableCell, TableBody, IconButton, Tooltip,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import { motion } from 'framer-motion';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import DiamondRoundedIcon from '@mui/icons-material/DiamondRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import IntegrationInstructionsRoundedIcon from '@mui/icons-material/IntegrationInstructionsRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
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

const fmt = (n: number) => n.toLocaleString('ru-RU');

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
  const [notifs, setNotifs] = useState({ newAgent: true, newDeal: true, paidDeal: false, shareOp: true });
  const [integrations, setIntegrations] = useState({ telegram: false, crm: false, email: true });
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
    ])
      .then(([s, p, a]) => {
        if (cancelled) return;
        setSettings(prev => ({ ...prev, sharePrice: s.sharePrice || prev.sharePrice, totalSharesIssued: s.totalSharesIssued || prev.totalSharesIssued, totalSharesAvailable: s.totalSharesAvailable || prev.totalSharesAvailable }));
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
        share_price: settings.sharePrice,
        total_shares: settings.totalSharesIssued,
        available_shares: settings.totalSharesAvailable,
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
          <Button size="small" variant="outlined" startIcon={<EditRoundedIcon sx={{ fontSize: 14 }} />}
            sx={{ borderColor: 'rgba(201,168,76,0.3)', color: '#C9A84C' }}>
            Добавить ачивку
          </Button>
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
              {achievements.map(a => {
                const tierColor: Record<AchievementTier, string> = {
                  bronze: '#D97706', silver: '#94A3B8', gold: '#C9A84C', platinum: '#A855F7',
                };
                const triggerLabel: Record<AchievementTriggerType, string> = {
                  first_agent_invited: 'Первый рекрут',
                  first_deal:          'Первая сделка',
                  commission_year:     'Комиссия за год',
                  level_reached:       'Уровень достигнут',
                  team_l1_size:        'Размер L1',
                  deals_year:          'Сделок за год',
                  commission_total:    'Общая комиссия',
                };
                return (
                  <TableRow key={a.id}>
                    <TableCell><Typography sx={{ fontSize: 26 }}>{a.icon}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{a.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>{a.description}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.tier.toUpperCase()} size="small" sx={{ background: `${tierColor[a.tier]}25`, color: tierColor[a.tier], fontWeight: 800, fontSize: 10 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                        {triggerLabel[a.trigger]}: <b style={{ color: '#C9A84C' }}>{a.threshold.toLocaleString('ru-RU')}</b>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Switch checked={a.active} onChange={() => toggleAchActive(a.id)} size="small" sx={{ '& .MuiSwitch-thumb': { background: a.active ? '#C9A84C' : '#64748B' } }} />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Редактировать ачивку">
                        <IconButton size="small" onClick={() => setEditAch(a)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
        {editAch && (
          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            Откроется диалог редактирования ачивки <b>{editAch.title}</b> (заглушка — клик «Сохранить» вернёт настройку из state).
            <Button size="small" sx={{ ml: 2 }} onClick={() => setEditAch(null)}>Закрыть</Button>
          </Alert>
        )}
      </Section>

      {/* Share settings */}
      <Section title="Акции компании" subtitle="Параметры акционной программы" icon={<DiamondRoundedIcon />} delay={0.16}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              fullWidth size="small" label="Текущий курс акции (₽)" type="number"
              value={settings.sharePrice}
              onChange={e => setSettings(s => ({ ...s, sharePrice: Number(e.target.value) }))}
              slotProps={{ input: { endAdornment: <InputAdornment position="end">₽</InputAdornment> } }}
            />
            <TextField
              fullWidth size="small" label="Всего акций выпущено" type="number"
              value={settings.totalSharesIssued}
              onChange={e => setSettings(s => ({ ...s, totalSharesIssued: Number(e.target.value) }))}
            />
          </Box>
          <Box sx={{ p: 2, borderRadius: 2.5, background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B' }}>Капитализация</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#22C55E' }}>
                {((settings.sharePrice * settings.totalSharesIssued) / 1e9).toFixed(2)} млрд ₽
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: '#64748B' }}>Доступно к продаже</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#F1F5F9' }}>
                {fmt(settings.totalSharesAvailable)} акций
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Section>

      {/* Notifications */}
      <Section title="Уведомления" subtitle="Настройка push-уведомлений администратора" icon={<NotificationsRoundedIcon />} delay={0.15}>
        <Stack spacing={1.5}>
          {[
            { key: 'newAgent', label: 'Новый агент зарегистрирован', desc: 'При добавлении нового агента в систему' },
            { key: 'newDeal', label: 'Новая сделка добавлена', desc: 'При создании сделки агентом' },
            { key: 'paidDeal', label: 'Сделка выплачена', desc: 'При изменении статуса на «Выплачено»' },
            { key: 'shareOp', label: 'Операция с акциями', desc: 'При эмиссии, передаче или выкупе акций' },
          ].map(n => (
            <Box key={n.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{n.label}</Typography>
                <Typography variant="caption" sx={{ color: '#64748B' }}>{n.desc}</Typography>
              </Box>
              <Switch
                checked={notifs[n.key as keyof typeof notifs]}
                onChange={e => setNotifs(prev => ({ ...prev, [n.key]: e.target.checked }))}
                size="small"
                sx={{ '& .MuiSwitch-thumb': { background: '#C9A84C' }, '& .Mui-checked + .MuiSwitch-track': { background: '#C9A84C50' } }}
              />
            </Box>
          ))}
        </Stack>
      </Section>

      {/* Integrations */}
      <Section title="Интеграции" subtitle="Подключение внешних сервисов" icon={<IntegrationInstructionsRoundedIcon />} delay={0.2}>
        <Stack spacing={2}>
          {[
            { key: 'telegram', label: 'Telegram Bot', desc: 'Уведомления в Telegram-канал администратора', color: '#2AABEE' },
            { key: 'crm', label: 'CRM Система', desc: 'Синхронизация сделок с внешней CRM', color: '#4361EE' },
            { key: 'email', label: 'Email рассылки', desc: 'Автоматические email-уведомления агентам', color: '#22C55E' },
          ].map(int => (
            <Box key={int.key} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderRadius: 2.5, border: `1px solid ${integrations[int.key as keyof typeof integrations] ? `${int.color}30` : 'rgba(255,255,255,0.06)'}`, background: integrations[int.key as keyof typeof integrations] ? `${int.color}08` : 'transparent', transition: 'all 0.2s' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, background: `${int.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: int.color }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{int.label}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>{int.desc}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Chip
                  label={integrations[int.key as keyof typeof integrations] ? 'Подключено' : 'Отключено'}
                  size="small"
                  sx={{ background: integrations[int.key as keyof typeof integrations] ? `${int.color}20` : 'rgba(100,116,139,0.12)', color: integrations[int.key as keyof typeof integrations] ? int.color : '#64748B', fontWeight: 600, fontSize: 11 }}
                />
                <Switch
                  checked={integrations[int.key as keyof typeof integrations]}
                  onChange={e => setIntegrations(prev => ({ ...prev, [int.key]: e.target.checked }))}
                  size="small"
                  sx={{ '& .MuiSwitch-thumb': { background: int.color }, '& .Mui-checked + .MuiSwitch-track': { background: `${int.color}50` } }}
                />
              </Box>
            </Box>
          ))}
        </Stack>
      </Section>

      {/* Security */}
      <Section title="Безопасность" subtitle="Параметры доступа к административной панели" icon={<SecurityRoundedIcon />} delay={0.25}>
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField fullWidth size="small" label="Email администратора" defaultValue="admin@w24.agency" />
            <TextField fullWidth size="small" label="Имя администратора" defaultValue="Администратор" />
          </Box>
          <Alert severity="info" sx={{ borderRadius: 2.5 }}>
            Смена пароля и настройки 2FA доступны через ссылку на email администратора
          </Alert>
        </Stack>
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
