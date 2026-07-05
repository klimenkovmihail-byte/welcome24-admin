import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Chip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Stack, Divider,
  Alert, CircularProgress, FormControlLabel, Switch,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { backofficeApi, type BackOfficeMember, type BackOfficePayload } from '../api/backoffice';
import { settingsApi } from '../api/settings';
import FileUploader from '../components/FileUploader';
import ConfirmDialog from '../components/ConfirmDialog';
import { useFullScreenDialog } from '../hooks/useFullScreenDialog';
import EditRoundedIcon2 from '@mui/icons-material/EditNoteRounded';

const DEFAULT_INTRO = 'К этим людям ты можешь обращаться по специальным вопросам — бухгалтерия, юристы, HR, маркетинг, IT.';

const emptyForm: BackOfficePayload & { active: boolean } = {
  name: '', role: '', description: '',
  photo: '', phone: '', email: '', telegram: '',
  color: null,
  orderIdx: 0, active: true,
};

// Палитра предустановленных цветов для карточек.
const COLOR_PRESETS: { value: string; label: string }[] = [
  { value: '#C9A84C', label: 'Золотой' },
  { value: '#EF4444', label: 'Красный' },
  { value: '#F59E0B', label: 'Оранжевый' },
  { value: '#22C55E', label: 'Зелёный' },
  { value: '#06B6D4', label: 'Бирюзовый' },
  { value: '#4361EE', label: 'Синий' },
  { value: '#7B2FBE', label: 'Фиолетовый' },
  { value: '#EC4899', label: 'Розовый' },
  { value: '#A855F7', label: 'Сиреневый' },
  { value: '#14B8A6', label: 'Морской' },
  { value: '#64748B', label: 'Графит' },
];

export default function BackofficeTeam() {
  const { fullScreen, paperSafeArea } = useFullScreenDialog();
  const [list, setList] = useState<BackOfficeMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<BackOfficeMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Вступительный текст над карточками (хранится в settings.backoffice_intro)
  const [intro, setIntro] = useState(DEFAULT_INTRO);
  const [introDraft, setIntroDraft] = useState(DEFAULT_INTRO);
  const [introSaving, setIntroSaving] = useState(false);
  const [introSaved, setIntroSaved] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      backofficeApi.list(),
      settingsApi.getRaw().catch(() => ({} as Record<string, string | number>)),
    ])
      .then(([items, settings]) => {
        setList(items);
        const v = (settings.backoffice_intro as string) || DEFAULT_INTRO;
        setIntro(v);
        setIntroDraft(v);
      })
      .catch(e => setError(e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const saveIntro = async () => {
    setIntroSaving(true);
    try {
      await settingsApi.update({ backoffice_intro: introDraft });
      setIntro(introDraft);
      setIntroSaved(true);
      setTimeout(() => setIntroSaved(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить текст');
    } finally {
      setIntroSaving(false);
    }
  };

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); setSaveError(null); setDialogOpen(true); };
  const openEdit = (m: BackOfficeMember) => {
    setEditId(m.id);
    setForm({
      name: m.name, role: m.role, description: m.description,
      photo: m.photo, phone: m.phone, email: m.email, telegram: m.telegram,
      color: m.color,
      orderIdx: m.orderIdx, active: m.active,
    });
    setSaveError(null);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name?.trim() || !form.role?.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editId) await backofficeApi.update(editId, form);
      else await backofficeApi.create(form);
      setDialogOpen(false);
      load();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!deleteFor) return;
    setDeleting(true);
    try {
      await backofficeApi.remove(deleteFor.id);
      setList(prev => prev.filter(x => x.id !== deleteFor.id));
      setDeleteFor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setDeleting(false);
    }
  };

  // Перемещение карточки вверх/вниз: меняем orderIdx местами с соседом
  // в текущем визуальном порядке. Оптимистично обновляем список и шлём два PATCH.
  const move = async (id: number, dir: -1 | 1) => {
    const idx = list.findIndex(x => x.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    const next = [...list];
    next[idx] = { ...b, orderIdx: a.orderIdx };
    next[swapIdx] = { ...a, orderIdx: b.orderIdx };
    // Разворачиваем визуальный порядок вслед за orderIdx (меньше — выше).
    next.sort((x, y) => x.orderIdx - y.orderIdx);
    setList(next);
    try {
      await Promise.all([
        backofficeApi.update(a.id, { orderIdx: b.orderIdx }),
        backofficeApi.update(b.id, { orderIdx: a.orderIdx }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить порядок');
      load();
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      {/* Вступительный текст над карточками — редактируется здесь */}
      <Box sx={{ mb: 2.5, p: 2, borderRadius: 2.5, border: '1px solid rgba(67,97,238,0.2)', background: 'rgba(67,97,238,0.04)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <EditRoundedIcon2 sx={{ color: '#60A5FA', fontSize: 18 }} />
          <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Вступительный текст для агентов
          </Typography>
        </Box>
        <TextField
          fullWidth multiline rows={2} size="small"
          value={introDraft}
          onChange={e => setIntroDraft(e.target.value)}
          placeholder={DEFAULT_INTRO}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.2 }}>
          <Typography variant="caption" sx={{ color: '#64748B' }}>
            Этот текст агенты увидят над карточками сотрудников
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {introSaved && <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700 }}>✓ Сохранено</Typography>}
            <Button
              size="small" variant="contained"
              disabled={introSaving || introDraft.trim() === intro.trim()}
              onClick={saveIntro}
            >
              {introSaving ? 'Сохранение…' : 'Сохранить текст'}
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#94A3B8', flex: '1 1 240px' }}>
          Сотрудники бэк-офиса (HR, юристы, бухгалтеры и т.п.) — будут видны агентам в разделе «Команда» на платформе
        </Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          Добавить сотрудника
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Сотрудник</TableCell>
              <TableCell>Должность</TableCell>
              <TableCell>Контакты</TableCell>
              <TableCell align="center">Активен</TableCell>
              <TableCell align="center">Порядок</TableCell>
              <TableCell align="center">Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map(m => (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{
                      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                      background: m.color || 'rgba(255,255,255,0.10)',
                      border: m.color ? 'none' : '1px dashed rgba(255,255,255,0.25)',
                    }} title={m.color ? `Цвет: ${m.color}` : 'Авто-цвет по должности'} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{m.name}</Typography>
                      {m.description && (
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.description}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={m.role} size="small" sx={{ background: 'rgba(201,168,76,0.15)', color: '#C9A84C', fontWeight: 700 }} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>{m.phone || '—'}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>{m.email || ''}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={m.active ? 'Да' : 'Нет'} size="small" sx={{ background: m.active ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)', color: m.active ? '#22C55E' : '#94A3B8' }} />
                </TableCell>
                <TableCell align="center" sx={{ color: '#94A3B8' }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      disabled={list.indexOf(m) === 0}
                      onClick={() => move(m.id, -1)}
                      sx={{ color: '#64748B', p: { xs: 0.75, sm: 0.25 }, m: { xs: -0.5, sm: 0 }, '&:hover': { color: '#C9A84C' } }}
                    >
                      <KeyboardArrowUpRoundedIcon fontSize="small" />
                    </IconButton>
                    <Box component="span" sx={{ minWidth: 18, textAlign: 'center' }}>{m.orderIdx}</Box>
                    <IconButton
                      size="small"
                      disabled={list.indexOf(m) === list.length - 1}
                      onClick={() => move(m.id, 1)}
                      sx={{ color: '#64748B', p: { xs: 0.75, sm: 0.25 }, m: { xs: -0.5, sm: 0 }, '&:hover': { color: '#C9A84C' } }}
                    >
                      <KeyboardArrowDownRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <IconButton size="small" onClick={() => openEdit(m)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteFor(m)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {list.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B' }}>Никого нет — добавьте первого сотрудника</Typography>
          </Box>
        )}
      </TableContainer>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { ...paperSafeArea } } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {editId ? 'Редактировать сотрудника' : 'Новый сотрудник бэк-офиса'}
          </Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            {saveError && <Alert severity="error" onClose={() => setSaveError(null)}>{saveError}</Alert>}
            <FileUploader
              value={form.photo || ''}
              onChange={url => setForm(f => ({ ...f, photo: url }))}
              type="avatar"
              aspect={1}
              label="Фотография"
            />
            <TextField fullWidth size="small" label="ФИО *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <TextField fullWidth size="small" label="Должность *" placeholder="HR, Юрист, Бухгалтер, Маркетинг, IT…"
              value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
            <TextField fullWidth size="small" multiline rows={2} label="По каким вопросам обращаться"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <TextField fullWidth size="small" label="Телефон" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <TextField fullWidth size="small" label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <TextField fullWidth size="small" label="Telegram (без @)" value={form.telegram} onChange={e => setForm(f => ({ ...f, telegram: e.target.value.replace(/^@/, '') }))} />

            {/* Color picker */}
            <Box>
              <Typography variant="caption" sx={{ color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
                Цвет карточки
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Box
                  onClick={() => setForm(f => ({ ...f, color: null }))}
                  sx={{
                    width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)',
                    border: `2px solid ${!form.color ? '#F1F5F9' : 'rgba(255,255,255,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#94A3B8', fontSize: 16,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: '#F1F5F9' },
                  }}
                  title="Авто (по должности)"
                >
                  ⌀
                </Box>
                {COLOR_PRESETS.map(p => (
                  <Box
                    key={p.value}
                    onClick={() => setForm(f => ({ ...f, color: p.value }))}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                      background: p.value,
                      border: `2px solid ${form.color === p.value ? '#F1F5F9' : 'transparent'}`,
                      transform: form.color === p.value ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.15s',
                      '&:hover': { transform: 'scale(1.1)' },
                    }}
                    title={p.label}
                  />
                ))}
              </Box>
              <TextField
                size="small" fullWidth
                label="Свой HEX (опционально)"
                placeholder="#A855F7"
                value={form.color && !COLOR_PRESETS.some(p => p.value === form.color) ? form.color : ''}
                onChange={e => {
                  const v = e.target.value.trim();
                  if (!v) { setForm(f => ({ ...f, color: null })); return; }
                  // Принимаем только валидный hex (3 или 6 символов)
                  if (/^#?[0-9a-f]{3,6}$/i.test(v)) {
                    setForm(f => ({ ...f, color: v.startsWith('#') ? v : `#${v}` }));
                  }
                }}
                helperText="Если оставить пусто и не выбрать пресет — цвет подставится автоматически по должности"
              />
            </Box>

            <TextField fullWidth size="small" label="Порядок отображения" type="number"
              value={form.orderIdx} onChange={e => setForm(f => ({ ...f, orderIdx: Number(e.target.value) }))}
              helperText="Чем меньше число, тем выше карточка" />
            <FormControlLabel
              control={<Switch checked={!!form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />}
              label="Активен (видим агентам)"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={save} disabled={saving || !form.name?.trim() || !form.role?.trim()}>
            {saving ? 'Сохранение…' : (editId ? 'Сохранить' : 'Создать')}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleteFor}
        title="Удалить сотрудника?"
        text={deleteFor ? <>Удалить {deleteFor.name} ({deleteFor.role})? Карточка исчезнет у всех агентов.</> : ''}
        confirmLabel="Удалить"
        danger
        loading={deleting}
        onConfirm={confirmRemove}
        onClose={() => { if (!deleting) setDeleteFor(null); }}
      />
    </Box>
  );
}
