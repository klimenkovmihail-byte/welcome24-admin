/**
 * AgentFormDialog — отдельный компонент с собственным state.
 * Вынесен из Agents.tsx чтобы не ре-рендерить таблицу из 800 строк на каждом
 * нажатии клавиши в форме. Та же стратегия, что у DealFormDialog.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  InputAdornment, Chip, Avatar, Stack, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, FormControl, InputLabel,
  Radio, RadioGroup, FormControlLabel, FormLabel, Autocomplete,
  ToggleButtonGroup, ToggleButton, Alert, Tooltip, Snackbar,
} from '@mui/material';
import SmartAvatar from '../components/SmartAvatar';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import TelegramIcon from '@mui/icons-material/Telegram';
import InstagramIcon from '@mui/icons-material/Instagram';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ChatRoundedIcon from '@mui/icons-material/ChatRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import { companySettings } from '../data/mockData';
import type { Agent, AgentLevel, AgentStatus, AgentSocials } from '../types';
import { agentsApi } from '../api/agents';
import { getCurrentUser } from '../auth/auth';
import { ROLE_LABEL, ROLE_COLOR, type Role } from '../auth/roles';
import { useFullScreenDialog } from '../hooks/useFullScreenDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const SPECIALIZATIONS = ['Вторичная', 'Первичная', 'Аренда', 'Коммерческая', 'Загородная'];

const levelColor = (level: AgentLevel) => ({
  1: { bg: 'rgba(100,116,139,0.15)', color: '#94A3B8', label: 'Уровень 1' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60A5FA', label: 'Уровень 2' },
  3: { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Уровень 3' },
}[level]);

const fmt = (n: number) => n.toLocaleString('ru-RU');

type FormState = {
  // Тип записи: 'agent' (по умолчанию, отображается в базе агентов)
  // или 'staff' (сотрудник бэк-офиса — НЕ показывается в дефолтном фильтре).
  kind: 'agent' | 'staff';
  // Конкретная роль сотрудника при kind='staff' (для kind='agent' игнорируется).
  staffRole: 'manager' | 'admin' | 'super_admin' | 'lawyer' | 'broker' | 'listing_manager' | 'employee' | 'referral_partner';
  name: string; email: string; phone: string; city: string;
  password: string;
  joinDate: string; // дата присоединения YYYY-MM-DD
  birthDate: string; // дата рождения YYYY-MM-DD
  level: AgentLevel; commission: 80 | 90 | 95;
  status: AgentStatus;
  parentType: 'company' | 'agent';
  parentId: number | null; parentName: string | null;
  parentChangeDate: string; // дата закрепления нового ментора (при редактировании)
  specialization: string[];
  referralLink: string;
  photo: string;
  bio: string;
  socials: AgentSocials;
};

const emptyForm: FormState = {
  kind: 'agent', staffRole: 'manager',
  name: '', email: '', phone: '', city: '',
  password: '',
  joinDate: new Date().toISOString().slice(0, 10),
  birthDate: '',
  level: 1, commission: 80,
  status: 'active',
  parentType: 'company', parentId: null, parentName: null,
  parentChangeDate: '',
  specialization: [],
  referralLink: '',
  photo: '', bio: '', socials: {},
};

interface Props {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
  editTarget: Agent | null;
  canManageRoles: boolean; // только super_admin видит выбор «Агент / Сотрудник»
  canManagePassword?: boolean; // super_admin + admin могут менять пароль агенту
  defaultKind?: 'agent' | 'staff'; // дефолт при создании — зависит от текущей вкладки
  onSaved: () => void;
}

export default function AgentFormDialog({ open, onClose, agents, editTarget, canManageRoles, canManagePassword = false, defaultKind = 'agent', onSaved }: Props) {
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Снимок исходной формы — чтобы понять, есть ли несохранённые правки (dirty).
  const [initialForm, setInitialForm] = useState<FormState>(emptyForm);
  // Показывать предупреждение createIssue только после первой попытки сохранить.
  const [touched, setTouched] = useState(false);
  // Подтверждение закрытия при несохранённых правках (клик по фону / крестику).
  const [confirmClose, setConfirmClose] = useState(false);
  // Снэк «Скопировано» при копировании сгенерированного пароля.
  const [copied, setCopied] = useState(false);

  // Инициализация при открытии (create или edit).
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      const r = ((editTarget as Agent & { role?: Role }).role || 'agent') as Role;
      // Любая не-агентская роль = тип «Сотрудник» (employee/referral_partner тоже).
      const isStaff = r !== 'agent';
      const next: FormState = {
        kind: isStaff ? 'staff' : 'agent',
        staffRole: isStaff ? (r as 'manager' | 'admin' | 'super_admin' | 'lawyer' | 'broker' | 'listing_manager' | 'employee' | 'referral_partner') : 'manager',
        name: editTarget.name, email: editTarget.email, phone: editTarget.phone, city: editTarget.city,
        password: '',
        joinDate: editTarget.joinDate || new Date().toISOString().slice(0, 10),
        birthDate: (editTarget as Agent & { birthDate?: string }).birthDate || '',
        level: editTarget.level, commission: editTarget.commission, status: editTarget.status,
        parentType: editTarget.parentId ? 'agent' : 'company',
        parentId: editTarget.parentId, parentName: editTarget.parentName,
        parentChangeDate: '',
        specialization: editTarget.specialization,
        referralLink: (editTarget as Agent & { referralLink?: string }).referralLink || '',
        photo: editTarget.photo || '',
        bio: editTarget.bio || '',
        socials: { ...(editTarget.socials || {}) },
      };
      setForm(next);
      setInitialForm(next);
    } else {
      const next = { ...emptyForm, kind: defaultKind };
      setForm(next);
      setInitialForm(next);
    }
    setTouched(false);
    setConfirmClose(false);
    setError(null);
  }, [open, editTarget, defaultKind]);

  const handleLevelChange = (level: AgentLevel) => {
    const commMap: Record<AgentLevel, 80 | 90 | 95> = { 1: 80, 2: 90, 3: 95 };
    setForm(f => ({ ...f, level, commission: commMap[level] }));
  };

  const handleParentAgentChange = (agent: Agent | null) => {
    setForm(f => ({ ...f, parentId: agent ? agent.id : null, parentName: agent ? agent.name : null }));
  };

  // Валидация ТОЛЬКО при создании: обязательные поля, отчество (3 слова ФИО),
  // и защита от дублей (то же ФИО / почта). Возвращает текст ошибки или null.
  const createIssue = useMemo<string | null>(() => {
    if (editTarget) return null; // правки существующих не ограничиваем
    const name = form.name.trim().replace(/\s+/g, ' ');
    if (!name) return 'Введите ФИО';
    if (name.split(' ').filter(Boolean).length < 3) return 'Укажите полное ФИО: Фамилия, Имя и Отчество';
    if (!form.phone.trim()) return 'Введите телефон';
    if (!form.birthDate) return 'Укажите дату рождения';
    // Email и пароль агент задаёт сам при «первом входе» (самоактивация по телефону) — не требуем.
    const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const digits = (s: string) => (s || '').replace(/\D/g, '').replace(/^8/, '7');
    const dupName = agents.find(x => norm(x.name) === norm(name));
    if (dupName) return `Уже есть «${dupName.name}» — отличите отчеством или это дубль`;
    const np = digits(form.phone);
    const dupPhone = agents.find(x => { const xp = digits((x as { phone?: string }).phone || ''); return xp && xp === np; });
    if (dupPhone) return `Телефон уже занят: ${dupPhone.name}`;
    return null;
  }, [editTarget, form.name, form.phone, form.birthDate, agents]);

  // Есть ли несохранённые правки (для подтверждения закрытия по фону/крестику).
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  // Закрытие с проверкой dirty: при несохранённых правках — спросить подтверждение.
  const requestClose = () => {
    if (saving) return;
    if (dirty) { setConfirmClose(true); return; }
    onClose();
  };

  // Копирование сгенерированного пароля в буфер + снэк «Скопировано».
  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(form.password);
      setCopied(true);
    } catch {
      /* буфер недоступен (нет https/разрешения) — тихо игнорируем */
    }
  };

  const handleSave = async () => {
    setTouched(true);
    if (!form.name.trim()) return;
    if (createIssue) { setError(createIssue); return; }
    const parentId = form.parentType === 'company' ? null : form.parentId;
    // Если тип — «Сотрудник», MLM-привязки нет.
    const finalParentId = form.kind === 'staff' ? null : parentId;
    setSaving(true); setError(null);
    try {
      if (editTarget) {
        const updatePayload: Record<string, unknown> = {
          name: form.name, email: form.email, phone: form.phone, city: form.city,
          joinDate: form.joinDate, birthDate: form.birthDate || null,
          level: form.level, commission: form.commission, status: form.status,
          parentId: finalParentId, specialization: form.specialization,
          parentChangeDate: form.parentChangeDate || undefined,
          referralLink: form.referralLink,
          photo: form.photo || null, bio: form.bio, socials: form.socials,
        };
        // Передаём пароль только если super_admin/admin установил его при редактировании
        if (canManagePassword && form.password.trim()) {
          updatePayload.password = form.password.trim();
        }
        await agentsApi.update(editTarget.id, updatePayload);
        // Если super_admin поменял тип через форму — отдельным запросом обновим роль.
        if (canManageRoles) {
          const targetRole: Role = form.kind === 'staff' ? form.staffRole : 'agent';
          const currentRole = ((editTarget as Agent & { role?: Role }).role || 'agent') as Role;
          if (targetRole !== currentRole) {
            await agentsApi.setRole(editTarget.id, targetRole);
          }
        }
      } else {
        await agentsApi.create({
          name: form.name, email: form.email, password: form.password,
          phone: form.phone, city: form.city,
          joinDate: form.joinDate || undefined, birthDate: form.birthDate || undefined,
          level: form.level, commission: form.commission, status: form.status,
          parentId: finalParentId, specialization: form.specialization,
          referralLink: form.referralLink,
          photo: form.photo || null, bio: form.bio, socials: form.socials,
          role: canManageRoles && form.kind === 'staff' ? form.staffRole : 'agent',
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const isStaff = form.kind === 'staff';

  // Защита UI: только super_admin может трогать супер-админ-цель.
  // (Бэк уже это запрещает — здесь прячем элементы, чтобы не вводить в заблуждение.)
  const currentUserRole = (getCurrentUser()?.role || 'agent') as Role;
  const isSuperAdmin = currentUserRole === 'super_admin';
  const targetRoleNow = ((editTarget as (Agent & { role?: Role }) | null)?.role || 'agent') as Role;
  const targetIsSuperAdmin = !!editTarget && targetRoleNow === 'super_admin';
  // Блок «Сброс пароля» скрываем, если не-super_admin редактирует супер-админа.
  const showPasswordBlock = canManagePassword && !(targetIsSuperAdmin && !isSuperAdmin);
  // Роль super_admin в выпадающем списке доступна только самому super_admin.
  const canAssignSuperAdmin = isSuperAdmin;

  return (
    <Dialog open={open} onClose={requestClose} maxWidth="sm" fullWidth
      fullScreen={fullScreen} slotProps={{ paper: { sx: { ...paperSafeArea } } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
          {editTarget ? (isStaff ? 'Редактировать сотрудника' : 'Редактировать агента') : (isStaff ? 'Добавить сотрудника' : 'Добавить агента')}
        </Typography>
        <IconButton size="small" onClick={requestClose} sx={{ color: '#64748B' }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={2.5}>
          {/* Тип записи: Агент / Сотрудник — виден только super_admin */}
          {canManageRoles && (
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <FormLabel sx={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Тип записи
              </FormLabel>
              <RadioGroup row value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value as 'agent' | 'staff' }))}>
                <FormControlLabel
                  value="agent"
                  control={<Radio size="small" sx={{ color: ROLE_COLOR.agent, '&.Mui-checked': { color: ROLE_COLOR.agent } }} />}
                  label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Агент (видим в базе)</Typography>}
                />
                <FormControlLabel
                  value="staff"
                  control={<Radio size="small" sx={{ color: ROLE_COLOR.admin, '&.Mui-checked': { color: ROLE_COLOR.admin } }} />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <BadgeRoundedIcon sx={{ fontSize: 16, color: ROLE_COLOR.admin }} />
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>Сотрудник (бэк-офис)</Typography>
                    </Box>
                  }
                />
              </RadioGroup>
              {isStaff && (
                <FormControl size="small" fullWidth sx={{ mt: 1.5 }}>
                  <InputLabel>Роль сотрудника</InputLabel>
                  <Select
                    value={form.staffRole}
                    label="Роль сотрудника"
                    onChange={e => setForm(f => ({ ...f, staffRole: e.target.value as 'manager' | 'admin' | 'super_admin' | 'lawyer' | 'broker' | 'listing_manager' | 'employee' | 'referral_partner' }))}
                  >
                    <MenuItem value="manager"     sx={{ color: ROLE_COLOR.manager,     fontWeight: 600 }}>{ROLE_LABEL.manager} — только Академия и Новости</MenuItem>
                    <MenuItem value="lawyer"      sx={{ color: ROLE_COLOR.lawyer,      fontWeight: 600 }}>{ROLE_LABEL.lawyer} — Заявки (юридические)</MenuItem>
                    <MenuItem value="broker"      sx={{ color: ROLE_COLOR.broker,      fontWeight: 600 }}>{ROLE_LABEL.broker} — Заявки (ипотека)</MenuItem>
                    <MenuItem value="listing_manager" sx={{ color: ROLE_COLOR.listing_manager, fontWeight: 600 }}>{ROLE_LABEL.listing_manager} — Отдел рекламы</MenuItem>
                    <MenuItem value="employee"    sx={{ color: ROLE_COLOR.employee,    fontWeight: 600 }}>{ROLE_LABEL.employee} — портал как у агента, без админки</MenuItem>
                    <MenuItem value="referral_partner" sx={{ color: ROLE_COLOR.referral_partner, fontWeight: 600 }}>{ROLE_LABEL.referral_partner} — портал: MLM, Акции, Профиль</MenuItem>
                    <MenuItem value="admin"       sx={{ color: ROLE_COLOR.admin,       fontWeight: 600 }}>{ROLE_LABEL.admin} — Агенты/Сделки/Акции/Поддержка/Новости</MenuItem>
                    {canAssignSuperAdmin && (
                      <MenuItem value="super_admin" sx={{ color: ROLE_COLOR.super_admin, fontWeight: 600 }}>{ROLE_LABEL.super_admin} — полный доступ</MenuItem>
                    )}
                  </Select>
                </FormControl>
              )}
            </Box>
          )}

          <TextField fullWidth label="ФИО" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" />
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            {editTarget && <TextField fullWidth label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" />}
            <TextField fullWidth label="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} size="small" />
          </Box>
          {!editTarget && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Email и пароль агент задаст сам при первом входе — подтверждение звонком на телефон. Выдавать пароль вручную не нужно.
            </Alert>
          )}
          {editTarget && showPasswordBlock && (
            <Box sx={{
              p: 2, borderRadius: 2, background: 'rgba(67,97,238,0.04)',
              border: '1px solid rgba(67,97,238,0.15)',
            }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Сброс пароля
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth size="small" type="text"
                  label="Новый пароль (или сгенерируйте)"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="оставьте пустым — пароль не изменится"
                />
                {form.password && (
                  <Tooltip title="Скопировать пароль">
                    <IconButton size="small" onClick={copyPassword} sx={{ flexShrink: 0, color: '#64748B', '&:hover': { color: '#4361EE' } }}>
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    // Генерация 10-символьного пароля (буквы + цифры, без неоднозначных символов)
                    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
                    const pwd = Array.from({ length: 10 },
                      () => chars[Math.floor(Math.random() * chars.length)]
                    ).join('');
                    setForm(f => ({ ...f, password: pwd }));
                  }}
                  sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Сгенерировать
                </Button>
              </Stack>
              {form.password && (
                <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
                  Скопируйте пароль и отправьте агенту вручную (через Telegram/WhatsApp).
                  После «Сохранить» пароль будет применён.
                </Alert>
              )}
            </Box>
          )}
          {editTarget && <TextField fullWidth label="Город" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} size="small" />}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField fullWidth label="Дата присоединения" type="date" value={form.joinDate}
              onChange={e => setForm(f => ({ ...f, joinDate: e.target.value }))} size="small"
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth label="Дата рождения" type="date" value={form.birthDate}
              onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))} size="small"
              slotProps={{ inputLabel: { shrink: true } }} />
          </Box>

          {/* MLM binding — только для агентов */}
          {!isStaff && (
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid rgba(201,168,76,0.15)', background: 'rgba(201,168,76,0.04)' }}>
              <FormLabel sx={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                Источник агента (MLM)
              </FormLabel>
              <RadioGroup row value={form.parentType} onChange={e => setForm(f => ({ ...f, parentType: e.target.value as 'company' | 'agent', parentId: null, parentName: null }))}>
                <FormControlLabel value="company" control={<Radio size="small" sx={{ color: '#C9A84C', '&.Mui-checked': { color: '#C9A84C' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><BusinessRoundedIcon sx={{ fontSize: 16, color: '#C9A84C' }} /><Typography variant="body2" sx={{ fontWeight: 600 }}>Welcome 24</Typography></Box>} />
                <FormControlLabel value="agent" control={<Radio size="small" sx={{ color: '#4361EE', '&.Mui-checked': { color: '#4361EE' } }} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><AccountTreeRoundedIcon sx={{ fontSize: 16, color: '#4361EE' }} /><Typography variant="body2" sx={{ fontWeight: 600 }}>От агента</Typography></Box>} />
              </RadioGroup>
              {form.parentType === 'agent' && (
                <Autocomplete
                  sx={{ mt: 1.5 }}
                  options={agents.filter(a => !editTarget || a.id !== editTarget.id)}
                  getOptionLabel={a => a.name}
                  value={agents.find(a => a.id === form.parentId) || null}
                  onChange={(_, v) => handleParentAgentChange(v)}
                  renderInput={params => <TextField {...params} label="Выберите ментора" size="small" />}
                  renderOption={(props, a) => (
                    <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 11, background: `${levelColor(a.level).color}30`, color: levelColor(a.level).color }}>
                        {a.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{a.name}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{a.city} · {a.commission}%</Typography>
                      </Box>
                    </Box>
                  )}
                />
              )}
              {editTarget && (
                <TextField
                  sx={{ mt: 1.5 }}
                  fullWidth size="small" type="date"
                  label="Дата закрепления ментора"
                  value={form.parentChangeDate}
                  onChange={e => setForm(f => ({ ...f, parentChangeDate: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="При смене ментора — с этой даты ему идут ВКД и MLM-выплаты с подопечного (пусто = с сегодня)"
                />
              )}
            </Box>
          )}

          {/* Level / specialization — только для агентов (у сотрудников не имеет смысла) */}
          {!isStaff && (
            <>
              <Box>
                <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                  Уровень комиссии
                </Typography>
                <ToggleButtonGroup exclusive value={form.level} onChange={(_, v) => v && handleLevelChange(v as AgentLevel)} size="small" sx={{ width: '100%' }}>
                  {([1, 2, 3] as AgentLevel[]).map(l => {
                    const lc = levelColor(l);
                    const commMap: Record<AgentLevel, 80 | 90 | 95> = { 1: 80, 2: 90, 3: 95 };
                    return (
                      <ToggleButton key={l} value={l} sx={{ flex: 1, borderColor: 'rgba(201,168,76,0.15)', '&.Mui-selected': { background: lc.bg, color: lc.color, borderColor: `${lc.color}40` } }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>L{l} · {commMap[l]}%</Typography>
                      </ToggleButton>
                    );
                  })}
                </ToggleButtonGroup>
                <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.1)' }}>
                  <Typography variant="caption" sx={{ color: '#64748B' }}>
                    L2 порог: {fmt(companySettings.level1Threshold)} ₽ ВКД · L3 порог: {fmt(companySettings.level2Threshold)} ₽ ВКД
                  </Typography>
                </Box>
              </Box>

              <Autocomplete
                multiple
                options={SPECIALIZATIONS}
                value={form.specialization}
                onChange={(_, v) => setForm(f => ({ ...f, specialization: v }))}
                renderInput={params => <TextField {...params} label="Специализация" size="small" />}
                renderTags={(val, getTagProps) => val.map((opt, i) => (
                  <Chip label={opt} size="small" {...getTagProps({ index: i })} sx={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }} />
                ))}
              />
            </>
          )}

          <FormControl size="small" fullWidth>
            <InputLabel>Статус</InputLabel>
            <Select value={form.status} label="Статус" onChange={e => setForm(f => ({ ...f, status: e.target.value as AgentStatus }))}>
              <MenuItem value="active">Активен</MenuItem>
              <MenuItem value="blocked">Заблокирован</MenuItem>
            </Select>
          </FormControl>

          {!isStaff && (
            <TextField
              fullWidth size="small" label="Реферальная ссылка"
              value={form.referralLink}
              onChange={e => setForm(f => ({ ...f, referralLink: e.target.value }))}
              placeholder="https://welcome24.ru/r/..."
              helperText="Персональная ссылка для приглашения новых агентов"
            />
          )}

          {/* Public profile */}
          <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, letterSpacing: '0.05em' }}>ПУБЛИЧНЫЙ ПРОФИЛЬ</Typography>
          </Divider>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SmartAvatar
              src={form.photo}
              name={form.name}
              size={64}
              fontSize={18}
              sx={{ background: 'rgba(201,168,76,0.18)', color: '#C9A84C', border: '2px solid rgba(201,168,76,0.3)' }}
            />
            <TextField
              fullWidth size="small" label="Фото (URL)"
              value={form.photo} onChange={e => setForm(f => ({ ...f, photo: e.target.value }))}
              placeholder="https://… или оставьте пустым"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><PhotoCameraRoundedIcon sx={{ color: '#64748B', fontSize: 18 }} /></InputAdornment> } }}
            />
          </Box>
          <TextField
            fullWidth size="small" label="Биография" multiline rows={2}
            value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Короткое описание для публичной карточки"
          />

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField size="small" label="Telegram" value={form.socials.telegram || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, telegram: e.target.value.replace(/^@/, '') } }))}
              placeholder="username"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><TelegramIcon sx={{ color: '#229ED9', fontSize: 18 }} /></InputAdornment> } }}
            />
            <TextField size="small" label="TG-канал" value={form.socials.telegramChannel || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, telegramChannel: e.target.value } }))}
              placeholder="@channel"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><CampaignRoundedIcon sx={{ color: '#229ED9', fontSize: 18 }} /></InputAdornment> } }}
            />
            <TextField size="small" label="Instagram" value={form.socials.instagram || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, instagram: e.target.value.replace(/^@/, '') } }))}
              placeholder="username"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><InstagramIcon sx={{ color: '#E4405F', fontSize: 18 }} /></InputAdornment> } }}
            />
            <TextField size="small" label="ВКонтакте" value={form.socials.vk || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, vk: e.target.value } }))}
              placeholder="username или id"
            />
            <TextField size="small" label="MAX мессенджер" value={form.socials.max || ''}
              onChange={e => setForm(f => ({ ...f, socials: { ...f.socials, max: e.target.value.replace(/^@/, '') } }))}
              placeholder="username"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><ChatRoundedIcon sx={{ color: '#7C3AED', fontSize: 18 }} /></InputAdornment> } }}
            />
          </Box>

          {error && <Alert severity="error" sx={{ py: 0.5 }} onClose={() => setError(null)}>{error}</Alert>}
          {!error && touched && createIssue && <Alert severity="warning" sx={{ py: 0.5 }}>{createIssue}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={requestClose} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || (!!editTarget && !form.email.trim())}>
          {saving ? 'Сохранение…' : editTarget ? 'Сохранить' : (isStaff ? 'Создать сотрудника' : 'Создать агента')}
        </Button>
      </DialogActions>

      {/* Подтверждение закрытия при несохранённых правках */}
      <ConfirmDialog
        open={confirmClose}
        title="Закрыть без сохранения?"
        text="Несохранённые изменения будут потеряны."
        confirmLabel="Закрыть"
        cancelLabel="Остаться"
        danger
        onConfirm={() => { setConfirmClose(false); onClose(); }}
        onClose={() => setConfirmClose(false)}
      />

      {/* Снэк после копирования пароля */}
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setCopied(false)} sx={{ borderRadius: 2.5 }}>
          Скопировано
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
