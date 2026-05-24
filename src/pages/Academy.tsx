import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel,
  Stack, Divider, Grid, InputAdornment, Tabs, Tab, Switch, FormControlLabel,
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
  adminCourses, adminWebinars, adminEvents,
  COURSE_CATEGORIES, WEBINAR_TOPICS,
  type AdminCourse, type AdminWebinar, type AdminEvent, type AdminEventFormat, type AdminLesson,
  type AcademyCategoryName, type WebinarTopicName,
} from '../data/mockData';

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

export default function Academy() {
  const [tab, setTab] = useState<'courses' | 'webinars' | 'events'>('courses');

  // ============== COURSES STATE ==============
  const [courses, setCourses] = useState<AdminCourse[]>(adminCourses);
  const [coursesSearch, setCoursesSearch] = useState('');
  const [coursesCat, setCoursesCat] = useState<string>('all');
  const [courseDlgOpen, setCourseDlgOpen] = useState(false);
  const emptyCourse = (): AdminCourse => ({
    id: Date.now(), title: '', description: '', category: 'Базовый', level: 'Начинающий',
    coverUrl: '', duration: '', author: '', lessons: [], rating: 0, ratingCount: 0, published: false,
  });
  const [courseForm, setCourseForm] = useState<AdminCourse>(emptyCourse());

  const filteredCourses = courses.filter(c =>
    (coursesCat === 'all' || c.category === coursesCat) &&
    (!coursesSearch || c.title.toLowerCase().includes(coursesSearch.toLowerCase()))
  );

  const openCourseEdit = (c: AdminCourse) => { setCourseForm({ ...c, lessons: c.lessons.map(l => ({ ...l })) }); setCourseDlgOpen(true); };
  const openCourseNew = () => { setCourseForm(emptyCourse()); setCourseDlgOpen(true); };

  const saveCourse = () => {
    if (!courseForm.title.trim()) return;
    const existing = courses.find(c => c.id === courseForm.id);
    if (existing) {
      setCourses(prev => prev.map(c => c.id === courseForm.id ? courseForm : c));
    } else {
      setCourses(prev => [...prev, { ...courseForm, id: Date.now() }]);
    }
    setCourseDlgOpen(false);
  };
  const deleteCourse = (id: number) => setCourses(prev => prev.filter(c => c.id !== id));
  const togglePublishCourse = (id: number) => setCourses(prev => prev.map(c => c.id === id ? { ...c, published: !c.published } : c));

  const addLesson = () => setCourseForm(f => ({ ...f, lessons: [...f.lessons, { id: Date.now(), title: '', duration: '', videoUrl: '' }] }));
  const updateLesson = (i: number, patch: Partial<AdminLesson>) => setCourseForm(f => ({ ...f, lessons: f.lessons.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));
  const removeLesson = (i: number) => setCourseForm(f => ({ ...f, lessons: f.lessons.filter((_, idx) => idx !== i) }));

  // ============== WEBINARS STATE ==============
  const [webinars, setWebinars] = useState<AdminWebinar[]>(adminWebinars);
  const [webinarSearch, setWebinarSearch] = useState('');
  const [webinarTopic, setWebinarTopic] = useState<string>('all');
  const [webinarDlgOpen, setWebinarDlgOpen] = useState(false);
  const emptyWebinar = (): AdminWebinar => ({
    id: Date.now(), title: '', description: '', topic: 'Новостройки', coverUrl: '', videoUrl: '',
    duration: '', date: new Date().toISOString().slice(0, 10), speaker: '', views: 0, likes: 0, published: false, isNew: true,
  });
  const [webinarForm, setWebinarForm] = useState<AdminWebinar>(emptyWebinar());

  const filteredWebinars = webinars.filter(w =>
    (webinarTopic === 'all' || w.topic === webinarTopic) &&
    (!webinarSearch || w.title.toLowerCase().includes(webinarSearch.toLowerCase()))
  );

  const openWebinarEdit = (w: AdminWebinar) => { setWebinarForm({ ...w }); setWebinarDlgOpen(true); };
  const openWebinarNew = () => { setWebinarForm(emptyWebinar()); setWebinarDlgOpen(true); };
  const saveWebinar = () => {
    if (!webinarForm.title.trim()) return;
    if (webinars.find(w => w.id === webinarForm.id)) {
      setWebinars(prev => prev.map(w => w.id === webinarForm.id ? webinarForm : w));
    } else {
      setWebinars(prev => [...prev, { ...webinarForm, id: Date.now() }]);
    }
    setWebinarDlgOpen(false);
  };
  const deleteWebinar = (id: number) => setWebinars(prev => prev.filter(w => w.id !== id));
  const togglePublishWebinar = (id: number) => setWebinars(prev => prev.map(w => w.id === id ? { ...w, published: !w.published } : w));

  // ============== EVENTS STATE ==============
  const [events, setEvents] = useState<AdminEvent[]>(adminEvents);
  const [eventDlgOpen, setEventDlgOpen] = useState(false);
  const emptyEvent = (): AdminEvent => ({
    id: Date.now(), title: '', description: '', date: new Date().toISOString().slice(0, 10),
    startTime: '14:00', endTime: '15:30', speaker: '', format: 'webinar', topic: '',
    location: 'Онлайн', link: '', capacity: null, registered: 0, published: true,
  });
  const [eventForm, setEventForm] = useState<AdminEvent>(emptyEvent());

  const openEventEdit = (e: AdminEvent) => { setEventForm({ ...e }); setEventDlgOpen(true); };
  const openEventNew = () => { setEventForm(emptyEvent()); setEventDlgOpen(true); };
  const saveEvent = () => {
    if (!eventForm.title.trim()) return;
    if (events.find(e => e.id === eventForm.id)) {
      setEvents(prev => prev.map(e => e.id === eventForm.id ? eventForm : e));
    } else {
      setEvents(prev => [...prev, { ...eventForm, id: Date.now() }]);
    }
    setEventDlgOpen(false);
  };
  const deleteEvent = (id: number) => setEvents(prev => prev.filter(e => e.id !== id));

  // Sorted events (upcoming first)
  const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  return (
    <Box>
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
                        <Button size="small" variant="outlined" onClick={() => togglePublishCourse(c.id)}
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
                        <Button size="small" variant="outlined" onClick={() => togglePublishWebinar(w.id)}
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
            {courses.find(c => c.id === courseForm.id) ? 'Редактировать курс' : 'Новый курс'}
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
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Длительность" value={courseForm.duration} placeholder="4 часа 30 мин" onChange={e => setCourseForm(f => ({ ...f, duration: e.target.value }))} />
              <TextField fullWidth size="small" label="Автор" value={courseForm.author} onChange={e => setCourseForm(f => ({ ...f, author: e.target.value }))} />
            </Box>
            <TextField fullWidth size="small" label="Обложка (URL)" value={courseForm.coverUrl} onChange={e => setCourseForm(f => ({ ...f, coverUrl: e.target.value }))} />

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
          <Button onClick={() => setCourseDlgOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={saveCourse} disabled={!courseForm.title.trim()}>
            Сохранить курс
          </Button>
        </DialogActions>
      </Dialog>

      {/* ============== WEBINAR DIALOG ============== */}
      <Dialog open={webinarDlgOpen} onClose={() => setWebinarDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {webinars.find(w => w.id === webinarForm.id) ? 'Редактировать запись' : 'Новая запись вебинара'}
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
            <TextField fullWidth size="small" label="Ссылка на видео" value={webinarForm.videoUrl} onChange={e => setWebinarForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://youtube.com/..." />
            <TextField fullWidth size="small" label="Обложка (URL)" value={webinarForm.coverUrl} onChange={e => setWebinarForm(f => ({ ...f, coverUrl: e.target.value }))} />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel control={<Switch checked={webinarForm.published} onChange={e => setWebinarForm(f => ({ ...f, published: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Опубликован</Typography>} />
              <FormControlLabel control={<Switch checked={webinarForm.isNew} onChange={e => setWebinarForm(f => ({ ...f, isNew: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Новая запись (бейдж NEW)</Typography>} />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setWebinarDlgOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={saveWebinar} disabled={!webinarForm.title.trim()}>Сохранить</Button>
        </DialogActions>
      </Dialog>

      {/* ============== EVENT DIALOG ============== */}
      <Dialog open={eventDlgOpen} onClose={() => setEventDlgOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>
            {events.find(e => e.id === eventForm.id) ? 'Редактировать событие' : 'Новое событие'}
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
              <TextField fullWidth size="small" label="Тема" value={eventForm.topic} onChange={e => setEventForm(f => ({ ...f, topic: e.target.value }))} placeholder="например, Ипотека" />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Дата" type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField size="small" label="Начало" type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 130 }} />
              <TextField size="small" label="Конец" type="time" value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 130 }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField fullWidth size="small" label="Спикер" value={eventForm.speaker} onChange={e => setEventForm(f => ({ ...f, speaker: e.target.value }))} />
              <TextField size="small" label="Лимит" type="number" placeholder="без лимита" value={eventForm.capacity ?? ''} onChange={e => setEventForm(f => ({ ...f, capacity: e.target.value ? Number(e.target.value) : null }))} sx={{ width: 140 }} />
            </Box>
            <TextField fullWidth size="small" label="Локация" value={eventForm.location} placeholder="Онлайн / Zoom / адрес" onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} />
            <TextField fullWidth size="small" label="Ссылка на трансляцию" value={eventForm.link} placeholder="https://..." onChange={e => setEventForm(f => ({ ...f, link: e.target.value }))} />
            <FormControlLabel control={<Switch checked={eventForm.published} onChange={e => setEventForm(f => ({ ...f, published: e.target.checked }))} />} label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Опубликовано (видно агентам)</Typography>} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setEventDlgOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="contained" onClick={saveEvent} disabled={!eventForm.title.trim()}>Сохранить событие</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
