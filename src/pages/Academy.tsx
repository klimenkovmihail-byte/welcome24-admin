import { useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Stack, Divider, Grid, InputAdornment, Tabs, Tab, Switch, FormControlLabel,
  Alert, CircularProgress,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import OndemandVideoRoundedIcon from '@mui/icons-material/OndemandVideoRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import {
  COURSE_CATEGORIES, WEBINAR_TOPICS,
  type AdminCourse, type AdminWebinar, type AdminEvent, type AdminEventFormat, type AdminLesson,
  type AcademyCategoryName, type WebinarTopicName,
  type CourseAttachment,
} from '../data/mockData';
import { academyApi } from '../api/academy';
import FileUploader from '../components/FileUploader';
import { API_BASE_URL, getToken } from '../api/apiClient';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

const LEVELS = ['Начинающий', 'Средний', 'Продвинутый'] as const;
const FORMATS: { value: AdminEventFormat; label: string; color: string }[] = [
  { value: 'webinar',     label: 'Вебинар',      color: '#4361EE' },
  { value: 'masterclass', label: 'Мастер-класс', color: '#C9A84C' },
  { value: 'meeting',     label: 'Встреча',      color: '#22C55E' },
  { value: 'training',    label: 'Тренинг',      color: '#EC4899' },
];

const cardSx = {
  p: 2.5,
  borderRadius: 3,
  background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))',
  border: '1px solid rgba(201,168,76,0.1)',
};

// Загружает PDF в Yandex Storage через /api/upload?type=doc и возвращает {url, key, size}.
async function uploadDoc(file: File): Promise<CourseAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', 'doc');
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return { name: file.name, url: data.url, key: data.key, size: file.size };
}

function fmtSize(n?: number) {
  if (!n) return '';
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

// Список PDF-приложений курса с возможностью добавлять/удалять.
function CourseAttachmentsEditor({
  attachments, onChange,
}: { attachments: CourseAttachment[]; onChange: (a: CourseAttachment[]) => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';
    setErr(null);
    setUploading(true);
    try {
      const uploaded: CourseAttachment[] = [];
      for (const f of files) uploaded.push(await uploadDoc(f));
      onChange([...attachments, ...uploaded]);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>
          Приложения курса (PDF и др.)
        </Typography>
        <Button
          size="small" startIcon={<UploadFileRoundedIcon />}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          sx={{ color: '#C9A84C' }}
        >
          {uploading ? 'Загрузка…' : 'Добавить файл'}
        </Button>
        <input
          ref={fileRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          style={{ display: 'none' }}
          onChange={onPick}
        />
      </Box>
      {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr(null)}>{err}</Alert>}
      {attachments.length === 0 ? (
        <Box sx={{ py: 2, textAlign: 'center', borderRadius: 2, border: '1px dashed rgba(201,168,76,0.2)' }}>
          <Typography variant="caption" sx={{ color: '#64748B' }}>Файлы не прикреплены</Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {attachments.map((a, i) => (
            <Box key={`${a.url}-${i}`} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.2,
              borderRadius: 2, border: '1px solid rgba(201,168,76,0.1)',
              background: 'rgba(201,168,76,0.03)',
            }}>
              <PictureAsPdfRoundedIcon sx={{ color: '#EF4444', fontSize: 22 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ color: '#F1F5F9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>
                  {fmtSize(a.size)}
                </Typography>
              </Box>
              <IconButton size="small" component="a" href={a.url} target="_blank" sx={{ color: '#94A3B8', '&:hover': { color: '#C9A84C' } }}>
                <PlayCircleRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => onChange(attachments.filter((_, j) => j !== i))} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                <DeleteRoundedIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function Academy() {
  const [tab, setTab] = useState<'courses' | 'webinars' | 'events'>('courses');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ============== COURSES STATE ==============
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [coursesSearch, setCoursesSearch] = useState('');
  const [coursesCat, setCoursesCat] = useState<string>('all');
  const [courseDlgOpen, setCourseDlgOpen] = useState(false);
  const emptyCourse = (): AdminCourse => ({
    id: 0, title: '', description: '', orderIdx: 0,
    category: 'Базовый', level: 'Начинающий',
    coverUrl: '', duration: '', author: '', lessons: [], rating: 0, ratingCount: 0, published: false,
  });
  const [courseForm, setCourseForm] = useState<AdminCourse>(emptyCourse());

  const filteredCourses = courses.filter(c =>
    (coursesCat === 'all' || c.category === coursesCat) &&
    (!coursesSearch || c.title.toLowerCase().includes(coursesSearch.toLowerCase()))
  );

  const openCourseEdit = (c: AdminCourse) => { setCourseForm({ ...c, lessons: c.lessons.map(l => ({ ...l })) }); setCourseDlgOpen(true); };
  const openCourseNew = () => { setCourseForm(emptyCourse()); setCourseDlgOpen(true); };

  const saveCourse = async () => {
    if (!courseForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: courseForm.title,
        description: courseForm.description,
        orderIdx: courseForm.orderIdx || 0,
        category: courseForm.category,
        level: courseForm.level,
        coverUrl: courseForm.coverUrl,
        duration: courseForm.duration,
        authorName: courseForm.author,
        published: courseForm.published,
        lessons: courseForm.lessons.map(l => ({
          title: l.title,
          duration: l.duration,
          videoUrl: l.videoUrl,
          content: l.content || '',
          attachments: l.attachments || [],
        })),
      };
      if (courseForm.id > 0) {
        await academyApi.updateCourse(courseForm.id, payload);
      } else {
        await academyApi.createCourse(payload);
      }
      setCourseDlgOpen(false);
      await loadCourses();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения курса');
    } finally {
      setSaving(false);
    }
  };
  const deleteCourse = async (id: number) => {
    if (!confirm('Удалить курс?')) return;
    try {
      await academyApi.removeCourse(id);
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };
  const togglePublishCourse = async (c: AdminCourse) => {
    try {
      await academyApi.updateCourse(c.id, { published: !c.published });
      setCourses(prev => prev.map(x => x.id === c.id ? { ...x, published: !x.published } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления');
    }
  };

  const addLesson = () => setCourseForm(f => ({ ...f, lessons: [...f.lessons, { id: Date.now(), title: '', duration: '', videoUrl: '' }] }));
  const updateLesson = (i: number, patch: Partial<AdminLesson>) => setCourseForm(f => ({ ...f, lessons: f.lessons.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLesson = (i: number) => setCourseForm(f => ({ ...f, lessons: f.lessons.filter((_, idx) => idx !== i) }));

  // ============== WEBINARS STATE ==============
  const [webinars, setWebinars] = useState<AdminWebinar[]>([]);
  const [webinarSearch, setWebinarSearch] = useState('');
  const [webinarTopic, setWebinarTopic] = useState<string>('all');
  const [webinarDlgOpen, setWebinarDlgOpen] = useState(false);
  const emptyWebinar = (): AdminWebinar => ({
    id: 0, title: '', description: '', topic: 'Новостройки', coverUrl: '', videoUrl: '',
    duration: '', date: new Date().toISOString().slice(0, 10), speaker: '', views: 0, likes: 0, published: false, isNew: true,
  });
  const [webinarForm, setWebinarForm] = useState<AdminWebinar>(emptyWebinar());

  const filteredWebinars = webinars.filter(w =>
    (webinarTopic === 'all' || w.topic === webinarTopic) &&
    (!webinarSearch || w.title.toLowerCase().includes(webinarSearch.toLowerCase()))
  );

  const openWebinarEdit = (w: AdminWebinar) => { setWebinarForm({ ...w }); setWebinarDlgOpen(true); };
  const openWebinarNew = () => { setWebinarForm(emptyWebinar()); setWebinarDlgOpen(true); };
  const saveWebinar = async () => {
    if (!webinarForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: webinarForm.title,
        description: webinarForm.description,
        topic: webinarForm.topic,
        videoUrl: webinarForm.videoUrl,
        coverUrl: webinarForm.coverUrl,
        duration: webinarForm.duration,
        date: webinarForm.date,
        speakerName: webinarForm.speaker,
        isNew: webinarForm.isNew,
        published: webinarForm.published,
      };
      if (webinarForm.id > 0) {
        await academyApi.updateWebinar(webinarForm.id, payload);
      } else {
        await academyApi.createWebinar(payload);
      }
      setWebinarDlgOpen(false);
      await loadWebinars();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения вебинара');
    } finally {
      setSaving(false);
    }
  };
  const deleteWebinar = async (id: number) => {
    if (!confirm('Удалить запись вебинара?')) return;
    try {
      await academyApi.removeWebinar(id);
      setWebinars(prev => prev.filter(w => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };
  const togglePublishWebinar = async (w: AdminWebinar) => {
    try {
      await academyApi.updateWebinar(w.id, { published: !w.published });
      setWebinars(prev => prev.map(x => x.id === w.id ? { ...x, published: !x.published } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления');
    }
  };

  // ============== EVENTS STATE ==============
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventDlgOpen, setEventDlgOpen] = useState(false);
  const emptyEvent = (): AdminEvent => ({
    id: 0, title: '', description: '', date: new Date().toISOString().slice(0, 10),
    startTime: '14:00', endTime: '15:30', speaker: '', format: 'webinar', topic: '',
    location: 'Онлайн', link: '', capacity: null, registered: 0, published: true,
  });
  const [eventForm, setEventForm] = useState<AdminEvent>(emptyEvent());

  const openEventEdit = (e: AdminEvent) => { setEventForm({ ...e }); setEventDlgOpen(true); };
  const openEventNew = () => { setEventForm(emptyEvent()); setEventDlgOpen(true); };
  const saveEvent = async () => {
    if (!eventForm.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        date: eventForm.date,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        speakerName: eventForm.speaker,
        format: eventForm.format,
        topic: eventForm.topic,
        location: eventForm.location,
        link: eventForm.link,
        capacity: eventForm.capacity,
        published: eventForm.published,
      };
      if (eventForm.id > 0) {
        await academyApi.updateEvent(eventForm.id, payload);
      } else {
        await academyApi.createEvent(payload);
      }
      setEventDlgOpen(false);
      await loadEvents();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения события');
    } finally {
      setSaving(false);
    }
  };
  const deleteEvent = async (id: number) => {
    if (!confirm('Удалить событие?')) return;
    try {
      await academyApi.removeEvent(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  // ============== LOADERS ==============
  const loadCourses = async () => {
    try { setCourses(await academyApi.listCourses()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки курсов'); }
  };
  const loadWebinars = async () => {
    try { setWebinars(await academyApi.listWebinars()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки вебинаров'); }
  };
  const loadEvents = async () => {
    try { setEvents(await academyApi.listEvents()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка загрузки событий'); }
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadCourses(), loadWebinars(), loadEvents()]);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Stats row */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          { label: 'Курсов', value: courses.length, sub: `${courses.filter(c => c.published).length} опубликовано`, color: '#C9A84C', icon: <SchoolRoundedIcon /> },
          { label: 'Записей вебинаров', value: webinars.length, sub: `${webinars.filter(w => w.published).length} опубликовано`, color: '#4361EE', icon: <OndemandVideoRoundedIcon /> },
          { label: 'Событий', value: events.length, sub: `${events.filter(e => new Date(`${e.date}T${e.endTime}`).getTime() > Date.now()).length} предстоящих`, color: '#22C55E', icon: <EventAvailableRoundedIcon /> },
          { label: 'Всего просмотров', value: webinars.reduce((s, w) => s + w.views, 0).toLocaleString('ru-RU'), sub: 'у вебинаров', color: '#EC4899', icon: <VisibilityRoundedIcon /> },
        ].map((s, i) => (
          <Grid size={{ xs: 6, md: 3 }} key={s.label}>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Box sx={cardSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, background: `${s.color}20`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.icon}
                  </Box>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block' }}>{s.label}</Typography>
                    <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10 }}>{s.sub}</Typography>
                  </Box>
                </Box>
              </Box>
            </motion.div>
          </Grid>
        ))}
      </Grid>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTabs-indicator': { background: '#C9A84C', height: 3, borderRadius: 99 }, '& .MuiTab-root': { color: '#64748B', fontWeight: 700, textTransform: 'none', '&.Mui-selected': { color: '#F1F5F9' } } }}>
        <Tab value="courses"  label="Курсы"             icon={<SchoolRoundedIcon />}          iconPosition="start" />
        <Tab value="webinars" label="Записи вебинаров" icon={<OndemandVideoRoundedIcon />}    iconPosition="start" />
        <Tab value="events"   label="Расписание"        icon={<EventAvailableRoundedIcon />} iconPosition="start" />
      </Tabs>

      {/* ============== COURSES ============== */}
      {tab === 'courses' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Поиск курсов…" size="small" value={coursesSearch} onChange={e => setCoursesSearch(e.target.value)}
              sx={{ flex: '1 1 260px' }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Категория</InputLabel>
              <Select value={coursesCat} label="Категория" onChange={e => setCoursesCat(e.target.value)}>
                <MenuItem value="all">Все категории</MenuItem>
                {COURSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCourseNew} sx={{ ml: 'auto' }}>
              Добавить курс
            </Button>
          </Box>

          <Grid container spacing={2.5}>
            <AnimatePresence>
              {filteredCourses.map((c, i) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={c.id}>
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                    <Box sx={{ ...cardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={c.category} size="small" sx={{ background: 'rgba(67,97,238,0.15)', color: '#60A5FA', fontWeight: 700, fontSize: 11 }} />
                        <Chip label={c.level} size="small" sx={{ background: 'rgba(100,116,139,0.15)', color: '#94A3B8', fontSize: 11 }} />
                        <Chip
                          label={c.published ? 'Опубликован' : 'Черновик'}
                          size="small"
                          sx={{ background: c.published ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: c.published ? '#22C55E' : '#F59E0B', fontWeight: 700, fontSize: 11, ml: 'auto' }}
                        />
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F1F5F9', mb: 0.5, lineHeight: 1.3 }}>{c.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', mb: 2, display: 'block', flex: 1 }}>{c.description}</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', color: '#94A3B8', fontSize: 12 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PlayCircleRoundedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontSize={11}>{c.lessons.length} уроков</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeRoundedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontSize={11}>{c.duration || '—'}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StarRoundedIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
                          <Typography variant="caption" fontSize={11}>{c.rating.toFixed(1)} ({c.ratingCount})</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', mb: 1.5 }}>Автор: <b style={{ color: '#94A3B8' }}>{c.author}</b></Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => togglePublishCourse(c)}
                          sx={{ flex: 1, borderColor: c.published ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)', color: c.published ? '#F59E0B' : '#22C55E', fontSize: 12,
                            '&:hover': { borderColor: c.published ? '#F59E0B' : '#22C55E', background: c.published ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' } }}>
                          {c.published ? 'Снять' : 'Опубликовать'}
                        </Button>
                        <IconButton size="small" onClick={() => openCourseEdit(c)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => deleteCourse(c.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </Box>
      )}

      {/* ============== WEBINARS ============== */}
      {tab === 'webinars' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              placeholder="Поиск записей…" size="small" value={webinarSearch} onChange={e => setWebinarSearch(e.target.value)}
              sx={{ flex: '1 1 260px' }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }}
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Тема</InputLabel>
              <Select value={webinarTopic} label="Тема" onChange={e => setWebinarTopic(e.target.value)}>
                <MenuItem value="all">Все темы</MenuItem>
                {WEBINAR_TOPICS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openWebinarNew} sx={{ ml: 'auto' }}>
              Добавить запись
            </Button>
          </Box>

          <Grid container spacing={2.5}>
            <AnimatePresence>
              {filteredWebinars.map((w, i) => (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={w.id}>
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                    <Box sx={{ ...cardSx, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={w.topic} size="small" sx={{ background: 'rgba(67,97,238,0.15)', color: '#60A5FA', fontWeight: 700, fontSize: 11 }} />
                        {w.isNew && <Chip label="NEW" size="small" sx={{ background: '#EF4444', color: '#fff', fontWeight: 800, fontSize: 10 }} />}
                        <Chip
                          label={w.published ? 'Опубликован' : 'Черновик'}
                          size="small"
                          sx={{ background: w.published ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)', color: w.published ? '#22C55E' : '#F59E0B', fontWeight: 700, fontSize: 11, ml: 'auto' }}
                        />
                      </Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#F1F5F9', mb: 0.5, lineHeight: 1.3 }}>{w.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', mb: 1.5, display: 'block', flex: 1 }}>{w.description}</Typography>
                      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap', color: '#94A3B8' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <AccessTimeRoundedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontSize={11}>{w.duration}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
                          <Typography variant="caption" fontSize={11}>{w.views.toLocaleString('ru-RU')}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <FavoriteRoundedIcon sx={{ fontSize: 14, color: '#EF4444' }} />
                          <Typography variant="caption" fontSize={11}>{w.likes}</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#64748B', mb: 1.5 }}>
                        Спикер: <b style={{ color: '#94A3B8' }}>{w.speaker}</b> · {new Date(w.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" onClick={() => togglePublishWebinar(w)}
                          sx={{ flex: 1, borderColor: w.published ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)', color: w.published ? '#F59E0B' : '#22C55E', fontSize: 12,
                            '&:hover': { borderColor: w.published ? '#F59E0B' : '#22C55E', background: w.published ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' } }}>
                          {w.published ? 'Снять' : 'Опубликовать'}
                        </Button>
                        <IconButton size="small" onClick={() => openWebinarEdit(w)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => deleteWebinar(w.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </Box>
      )}

      {/* ============== EVENTS ============== */}
      {tab === 'events' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Расписание мероприятий</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>
                {events.length} событий · {events.filter(e => new Date(`${e.date}T${e.endTime}`).getTime() > Date.now()).length} впереди
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openEventNew}>
              Запланировать событие
            </Button>
          </Box>

          <Stack spacing={1.5}>
            <AnimatePresence>
              {sortedEvents.map((e, i) => {
                const cfg = FORMATS.find(f => f.value === e.format)!;
                const isPast = new Date(`${e.date}T${e.endTime}`).getTime() < Date.now();
                return (
                  <motion.div key={e.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}>
                    <Box sx={{ ...cardSx, opacity: isPast ? 0.5 : 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '80px 1fr auto auto' }, gap: 2, alignItems: 'center' }}>
                      {/* Date column */}
                      <Box sx={{ textAlign: 'center', borderRight: { md: '1px solid rgba(201,168,76,0.1)' }, pr: { md: 2 } }}>
                        <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontSize: 10, fontWeight: 700 }}>
                          {new Date(e.date).toLocaleDateString('ru-RU', { month: 'short' })}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#F1F5F9', lineHeight: 1 }}>
                          {new Date(e.date).getDate()}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: 11 }}>
                          {e.startTime}
                        </Typography>
                      </Box>

                      {/* Main */}
                      <Box sx={{ minWidth: 0 }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                          <Chip label={cfg.label} size="small" sx={{ background: `${cfg.color}20`, color: cfg.color, fontWeight: 700, fontSize: 11 }} />
                          {e.topic && <Chip label={e.topic} size="small" sx={{ background: 'rgba(255,255,255,0.05)', color: '#94A3B8', fontSize: 11 }} />}
                          {!e.published && <Chip label="Черновик" size="small" sx={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', fontWeight: 700, fontSize: 11 }} />}
                          {isPast && <Chip label="прошло" size="small" sx={{ background: 'rgba(100,116,139,0.15)', color: '#64748B', fontSize: 11 }} />}
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 0.5 }}>{e.title}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block' }}>{e.description}</Typography>
                        <Box sx={{ display: 'flex', gap: 2, mt: 0.8, color: '#94A3B8', flexWrap: 'wrap' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                            <AccessTimeRoundedIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption">{e.startTime}–{e.endTime}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                            <LocationOnRoundedIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption">{e.location}</Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                            <PeopleRoundedIcon sx={{ fontSize: 13 }} />
                            <Typography variant="caption">
                              {e.registered}{e.capacity ? ` / ${e.capacity}` : ''} участников
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5, fontSize: 11 }}>
                          🎤 {e.speaker || '—'}
                        </Typography>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <IconButton size="small" onClick={() => openEventEdit(e)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => deleteEvent(e.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                          <DeleteRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Stack>
        </Box>
      )}

      {/* ============== COURSE DIALOG ============== */}
      <Dialog open={courseDlgOpen} onClose={() => setCourseDlgOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {courseForm.id > 0 ? 'Редактировать курс' : 'Новый курс'}
          </Typography>
          <IconButton size="small" onClick={() => setCourseDlgOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField fullWidth size="small" label="Название курса *" value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} />
            <TextField fullWidth size="small" label="Описание" value={courseForm.description} multiline rows={2} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Категория</InputLabel>
                <Select value={courseForm.category} label="Категория" onChange={e => setCourseForm(f => ({ ...f, category: e.target.value as AcademyCategoryName }))}>
                  {COURSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Уровень</InputLabel>
                <Select value={courseForm.level} label="Уровень" onChange={e => setCourseForm(f => ({ ...f, level: e.target.value as typeof LEVELS[number] }))}>
                  {LEVELS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField
                size="small" type="number" label="Порядок"
                value={courseForm.orderIdx ?? 0}
                onChange={e => setCourseForm(f => ({ ...f, orderIdx: Number(e.target.value) || 0 }))}
                sx={{ width: 110 }}
                helperText="внутри категории"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Длительность" value={courseForm.duration} placeholder="4 часа 30 мин" onChange={e => setCourseForm(f => ({ ...f, duration: e.target.value }))} />
              <TextField fullWidth size="small" label="Автор" value={courseForm.author} onChange={e => setCourseForm(f => ({ ...f, author: e.target.value }))} />
            </Box>
            <FileUploader
              value={courseForm.coverUrl}
              onChange={(url) => setCourseForm(f => ({ ...f, coverUrl: url }))}
              type="cover"
              label="Обложка курса"
            />

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>Уроки ({courseForm.lessons.length})</Typography>
                <Button size="small" startIcon={<AddRoundedIcon />} onClick={addLesson} sx={{ color: '#C9A84C' }}>Добавить урок</Button>
              </Box>
              <Stack spacing={1.5}>
                {courseForm.lessons.map((l, i) => (
                  <Box key={l.id} sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(201,168,76,0.1)', background: 'rgba(201,168,76,0.03)' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PlayCircleRoundedIcon sx={{ fontSize: 16, color: '#4361EE' }} />
                      <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 700 }}>Урок {i + 1}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <IconButton size="small" onClick={() => removeLesson(i)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      <TextField fullWidth size="small" label="Название урока" value={l.title} onChange={e => updateLesson(i, { title: e.target.value })} />
                      <TextField label="Длительность" value={l.duration} onChange={e => updateLesson(i, { duration: e.target.value })} size="small" sx={{ width: 120 }} placeholder="15 мин" />
                    </Box>
                    <TextField fullWidth size="small" label="Ссылка на видео" value={l.videoUrl} onChange={e => updateLesson(i, { videoUrl: e.target.value })} sx={{ mt: 1 }} />
                    <TextField
                      fullWidth size="small" label="Описание урока"
                      value={l.content || ''}
                      onChange={e => updateLesson(i, { content: e.target.value })}
                      multiline rows={4} sx={{ mt: 1 }}
                      placeholder="Что узнает агент в этом уроке. Можно с абзацами через пустую строку."
                    />
                    <Box sx={{ mt: 1.5 }}>
                      <CourseAttachmentsEditor
                        attachments={l.attachments || []}
                        onChange={att => updateLesson(i, { attachments: att })}
                      />
                    </Box>
                  </Box>
                ))}
                {courseForm.lessons.length === 0 && (
                  <Box sx={{ py: 3, textAlign: 'center', borderRadius: 2, border: '1px dashed rgba(201,168,76,0.2)' }}>
                    <Typography variant="body2" sx={{ color: '#475569' }}>Нажмите «Добавить урок» для начала</Typography>
                  </Box>
                )}
              </Stack>
            </Box>

            <FormControlLabel
              control={<Switch checked={courseForm.published} onChange={e => setCourseForm(f => ({ ...f, published: e.target.checked }))} />}
              label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Опубликован (видно агентам)</Typography>}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setCourseDlgOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={saveCourse} disabled={!courseForm.title.trim() || saving}>
            Сохранить курс
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============== WEBINAR DIALOG ============== */}
      <Dialog open={webinarDlgOpen} onClose={() => setWebinarDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {webinarForm.id > 0 ? 'Редактировать запись' : 'Новая запись вебинара'}
          </Typography>
          <IconButton size="small" onClick={() => setWebinarDlgOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField fullWidth size="small" label="Название *" value={webinarForm.title} onChange={e => setWebinarForm(f => ({ ...f, title: e.target.value }))} />
            <TextField fullWidth size="small" label="Описание" multiline rows={2} value={webinarForm.description} onChange={e => setWebinarForm(f => ({ ...f, description: e.target.value }))} />
            <FormControl size="small" fullWidth>
              <InputLabel>Тема</InputLabel>
              <Select value={webinarForm.topic} label="Тема" onChange={e => setWebinarForm(f => ({ ...f, topic: e.target.value as WebinarTopicName }))}>
                {WEBINAR_TOPICS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Спикер" value={webinarForm.speaker} onChange={e => setWebinarForm(f => ({ ...f, speaker: e.target.value }))} />
              <TextField fullWidth size="small" label="Длительность" placeholder="1ч 24мин" value={webinarForm.duration} onChange={e => setWebinarForm(f => ({ ...f, duration: e.target.value }))} />
            </Box>
            <TextField fullWidth size="small" label="Дата проведения" type="date" value={webinarForm.date} onChange={e => setWebinarForm(f => ({ ...f, date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth size="small" label="Ссылка на видео" value={webinarForm.videoUrl} onChange={e => setWebinarForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://kinescope.io/..." />
            <FileUploader
              value={webinarForm.coverUrl}
              onChange={(url) => setWebinarForm(f => ({ ...f, coverUrl: url }))}
              type="cover"
              label="Обложка вебинара"
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel control={<Switch checked={webinarForm.published} onChange={e => setWebinarForm(f => ({ ...f, published: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Опубликован</Typography>} />
              <FormControlLabel control={<Switch checked={webinarForm.isNew} onChange={e => setWebinarForm(f => ({ ...f, isNew: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Новая запись (бейдж NEW)</Typography>} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setWebinarDlgOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={saveWebinar} disabled={!webinarForm.title.trim() || saving}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* ============== EVENT DIALOG ============== */}
      <Dialog open={eventDlgOpen} onClose={() => setEventDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {eventForm.id > 0 ? 'Редактировать событие' : 'Новое событие'}
          </Typography>
          <IconButton size="small" onClick={() => setEventDlgOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          <Stack spacing={2.5}>
            <TextField fullWidth size="small" label="Название *" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} />
            <TextField fullWidth size="small" label="Описание" multiline rows={2} value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Формат</InputLabel>
                <Select value={eventForm.format} label="Формат" onChange={e => setEventForm(f => ({ ...f, format: e.target.value as AdminEventFormat }))}>
                  {FORMATS.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Тема</InputLabel>
                <Select value={eventForm.topic} label="Тема" onChange={e => setEventForm(f => ({ ...f, topic: e.target.value }))}>
                  <MenuItem value=""><em>не указана</em></MenuItem>
                  {COURSE_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField size="small" label="Дата" type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
              <TextField size="small" label="Начало" type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 140px', minWidth: 140 }} />
              <TextField size="small" label="Конец" type="time" value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 140px', minWidth: 140 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Спикер" value={eventForm.speaker} onChange={e => setEventForm(f => ({ ...f, speaker: e.target.value }))} />
              <TextField size="small" label="Лимит мест" type="number" placeholder="без лимита" helperText="Макс. участников" value={eventForm.capacity ?? ''} onChange={e => setEventForm(f => ({ ...f, capacity: e.target.value ? Number(e.target.value) : null }))} sx={{ width: 160 }} />
            </Box>
            <TextField fullWidth size="small" label="Локация" value={eventForm.location} placeholder="Онлайн / Zoom / адрес" onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} />
            <TextField fullWidth size="small" label="Ссылка на трансляцию" value={eventForm.link} placeholder="https://..." onChange={e => setEventForm(f => ({ ...f, link: e.target.value }))} />
            <FormControlLabel control={<Switch checked={eventForm.published} onChange={e => setEventForm(f => ({ ...f, published: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Опубликовано (видно агентам)</Typography>} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEventDlgOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="contained" onClick={saveEvent} disabled={!eventForm.title.trim() || saving}>Сохранить событие</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
