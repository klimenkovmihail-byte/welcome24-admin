import { useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Stack, Divider, Paper, Grid,
  InputAdornment, Switch, FormControlLabel,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';

interface Article {
  id: number;
  title: string;
  category: string;
  summary: string;
  content: string;
  coverUrl: string;
  author: string;
  date: string;
  published: boolean;
  pinned: boolean;
  likes: number;
}

interface ArticleComment {
  id: number;
  articleId: number;
  author: string;
  initials: string;
  text: string;
  createdAt: string;
}

const initialComments: ArticleComment[] = [
  { id: 1, articleId: 1, author: 'Кулаков Степан',    initials: 'КС', text: 'Подтверждаю — у меня на этой неделе 4 показа, все ушли в задаток. Год назад такого темпа не было.', createdAt: '2026-05-22' },
  { id: 2, articleId: 1, author: 'Радченко Дмитрий', initials: 'РД', text: 'В Краснодаре та же картина. Особенно по 1-2-комнатным до 8 млн.',                                createdAt: '2026-05-23' },
  { id: 3, articleId: 2, author: 'Мухин Вячеслав',   initials: 'МВ', text: 'Долгожданное изменение! Уже подсчитал, что мой пассивный доход вырастет почти на 15%.',          createdAt: '2026-05-20' },
  { id: 4, articleId: 4, author: 'Бондарь Светлана', initials: 'БС', text: 'Пункт 5 про follow-up — мой главный инсайт за последний год. Конверсия выросла в 2 раза.',         createdAt: '2026-05-17' },
  { id: 5, articleId: 4, author: 'Аноним',           initials: '?',  text: 'Спам спам спам — купите наш курс на нашсайт.ру',                                                  createdAt: '2026-05-24' },
];

const CATEGORIES = ['Компания', 'Рынок', 'Обучение', 'Итоги', 'Партнёры', 'Объявления'];

const catColor: Record<string, { bg: string; color: string }> = {
  'Компания': { bg: 'rgba(201,168,76,0.12)', color: '#C9A84C' },
  'Рынок': { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  'Обучение': { bg: 'rgba(139,92,246,0.12)', color: '#A78BFA' },
  'Итоги': { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  'Партнёры': { bg: 'rgba(20,184,166,0.12)', color: '#2DD4BF' },
  'Объявления': { bg: 'rgba(239,68,68,0.12)', color: '#F87171' },
};

const initArticles: Article[] = [
  { id: 1, title: 'Welcome 24 вошли в ТОП-10 агентств Москвы', category: 'Итоги', summary: 'По итогам мая 2026 года агентство Welcome 24 заняло 7-е место в рейтинге московских риелторских компаний.', content: '', coverUrl: '', author: 'Михаил Клименков', date: '2026-05-20', published: true, pinned: true, likes: 87 },
  { id: 2, title: 'Новые условия ипотеки — что важно знать', category: 'Рынок', summary: 'ЦБ снизил ключевую ставку. Рассказываем, как изменились программы ипотечного кредитования.', content: '', coverUrl: '', author: 'Редакция', date: '2026-05-18', published: true, pinned: false, likes: 142 },
  { id: 3, title: 'Открытие офиса в Краснодаре', category: 'Компания', summary: 'С 1 июня начинает работу наш новый офис в Краснодаре. Приглашаем агентов присоединиться к команде.', content: '', coverUrl: '', author: 'Михаил Клименков', date: '2026-05-15', published: true, pinned: false, likes: 94 },
  { id: 4, title: 'Вебинар: Работа с VIP-клиентами', category: 'Обучение', summary: 'Приглашаем на онлайн-вебинар 28 мая. Спикер — Кулаков Степан, топ-агент по загородной недвижимости.', content: '', coverUrl: '', author: 'Академия W24', date: '2026-05-10', published: false, pinned: false, likes: 56 },
];

const emptyArticle = (): Article => ({
  id: Date.now(), title: '', category: 'Компания', summary: '', content: '',
  coverUrl: '', author: 'Администратор', date: new Date().toISOString().slice(0, 10),
  likes: 0,
  published: false, pinned: false,
});

export default function News() {
  const [articles, setArticles] = useState<Article[]>(initArticles);
  const [comments, setComments] = useState<ArticleComment[]>(initialComments);
  const [commentsDlgFor, setCommentsDlgFor] = useState<Article | null>(null);

  const deleteComment = (id: number) => setComments(prev => prev.filter(c => c.id !== id));
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [form, setForm] = useState<Article>(emptyArticle());
  const [preview, setPreview] = useState(false);

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
    const matchCat = filterCat === 'all' || a.category === filterCat;
    return matchQ && matchCat;
  });

  const openCreate = () => { setEditArticle(null); setForm(emptyArticle()); setPreview(false); setDialogOpen(true); };
  const openEdit = (a: Article) => { setEditArticle(a); setForm({ ...a }); setPreview(false); setDialogOpen(true); };

  const handleSave = (publish?: boolean) => {
    const finalForm = publish !== undefined ? { ...form, published: publish } : form;
    if (!finalForm.title.trim()) return;
    if (editArticle) {
      setArticles(prev => prev.map(a => a.id === editArticle.id ? finalForm : a));
    } else {
      setArticles(prev => [finalForm, ...prev]);
    }
    setDialogOpen(false);
  };

  const deleteArticle = (id: number) => setArticles(prev => prev.filter(a => a.id !== id));
  const togglePublish = (id: number) => setArticles(prev => prev.map(a => a.id === id ? { ...a, published: !a.published } : a));
  const togglePin = (id: number) => setArticles(prev => prev.map(a => a.id === id ? { ...a, pinned: !a.pinned } : a));

  return (
    <Box>
      {/* Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        {[
          { label: 'Всего статей', value: articles.length, color: '#4361EE' },
          { label: 'Опубликовано', value: articles.filter(a => a.published).length, color: '#22C55E' },
          { label: 'Черновики', value: articles.filter(a => !a.published).length, color: '#F59E0B' },
          { label: 'Закреплено', value: articles.filter(a => a.pinned).length, color: '#C9A84C' },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} style={{ flex: '1 1 150px' }}>
            <Box sx={{ p: 2.5, borderRadius: 3, background: 'linear-gradient(135deg, rgba(15,22,41,0.95), rgba(12,18,35,0.98))', border: '1px solid rgba(201,168,76,0.1)' }}>
              <Typography variant="h4" sx={{ fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</Typography>
              <Typography variant="caption" sx={{ color: '#64748B' }}>{s.label}</Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField placeholder="Поиск новостей…" value={search} onChange={e => setSearch(e.target.value)} size="small" sx={{ flex: '1 1 240px' }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }} />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Категория</InputLabel>
          <Select value={filterCat} label="Категория" onChange={e => setFilterCat(e.target.value)}>
            <MenuItem value="all">Все категории</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate} sx={{ ml: 'auto' }}>
          Написать статью
        </Button>
      </Box>

      {/* News grid */}
      <Grid container spacing={2.5}>
        <AnimatePresence>
          {filtered.map((article, i) => {
            const cc = catColor[article.category] || { bg: 'rgba(100,116,139,0.12)', color: '#94A3B8' };
            return (
              <Grid key={article.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.07 }}>
                  <Paper sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${article.pinned ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.1)'}`, position: 'relative', overflow: 'hidden' }}>
                    {article.pinned && (
                      <Box sx={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 32px 32px 0', borderColor: `transparent #C9A84C transparent transparent` }} />
                    )}

                    {/* Cover */}
                    <Box sx={{ height: 80, borderRadius: 2, mb: 2, background: `linear-gradient(135deg, ${cc.color}15, ${cc.color}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${cc.color}15` }}>
                      <ArticleRoundedIcon sx={{ fontSize: 32, color: cc.color, opacity: 0.5 }} />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                      <Chip label={article.category} size="small" sx={{ background: cc.bg, color: cc.color, fontWeight: 600, fontSize: 11 }} />
                      <Chip label={article.published ? 'Опубликовано' : 'Черновик'} size="small"
                        sx={{ background: article.published ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)', color: article.published ? '#22C55E' : '#F59E0B', fontSize: 11, fontWeight: 600 }} />
                    </Box>

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#F1F5F9', mb: 0.5, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748B', fontSize: 12, mb: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {article.summary}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="caption" sx={{ color: '#475569' }}>{article.author} · {article.date}</Typography>
                      <Box sx={{ display: 'flex', gap: 1.5, color: '#64748B' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <FavoriteRoundedIcon sx={{ fontSize: 13, color: '#EF4444' }} />
                          <Typography variant="caption" fontSize={11}>{article.likes}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />
                          <Typography variant="caption" fontSize={11}>{comments.filter(c => c.articleId === article.id).length}</Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => togglePublish(article.id)} sx={{ flex: 1, fontSize: 12,
                        borderColor: article.published ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)',
                        color: article.published ? '#F59E0B' : '#22C55E',
                        '&:hover': { borderColor: article.published ? '#F59E0B' : '#22C55E', background: article.published ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' } }}>
                        {article.published ? 'Скрыть' : 'Опубликовать'}
                      </Button>
                      <IconButton size="small" onClick={() => setCommentsDlgFor(article)} sx={{ color: '#64748B', '&:hover': { color: '#4361EE' } }}>
                        <ChatBubbleOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEdit(article)} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
                        <EditRoundedIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => deleteArticle(article.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Paper>
                </motion.div>
              </Grid>
            );
          })}
        </AnimatePresence>
      </Grid>

      {filtered.length === 0 && (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <ArticleRoundedIcon sx={{ fontSize: 48, color: '#1E2A45', mb: 2 }} />
          <Typography sx={{ color: '#64748B' }}>Статьи не найдены</Typography>
        </Box>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>{editArticle ? 'Редактировать статью' : 'Новая статья'}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<VisibilityRoundedIcon />} onClick={() => setPreview(!preview)}
              sx={{ color: preview ? '#C9A84C' : '#64748B', fontSize: 12 }}>
              {preview ? 'Редактор' : 'Превью'}
            </Button>
            <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
          </Box>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 3 }}>
          {preview ? (
            <Box>
              <Typography variant="caption" sx={{ color: catColor[form.category]?.color || '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{form.category}</Typography>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#F1F5F9', mt: 1, mb: 1.5 }}>{form.title || 'Заголовок статьи'}</Typography>
              <Typography variant="body1" sx={{ color: '#94A3B8', mb: 2 }}>{form.summary || 'Краткое описание…'}</Typography>
              <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)', my: 2 }} />
              <Typography variant="body2" sx={{ color: '#CBD5E1', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{form.content || 'Текст статьи появится здесь…'}</Typography>
              <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 2 }}>{form.author} · {form.date}</Typography>
            </Box>
          ) : (
            <Stack spacing={2.5}>
              <TextField fullWidth label="Заголовок статьи *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} size="small" />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel>Категория</InputLabel>
                  <Select value={form.category} label="Категория" onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField fullWidth label="Автор" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} size="small" />
                <TextField label="Дата" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} size="small" sx={{ width: 160 }}
                  slotProps={{ inputLabel: { shrink: true } }} />
              </Box>
              <TextField fullWidth label="Краткое описание (анонс)" value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} size="small" multiline rows={2} />
              <TextField fullWidth label="Обложка (URL изображения)" value={form.coverUrl} onChange={e => setForm(f => ({ ...f, coverUrl: e.target.value }))} size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><ImageRoundedIcon sx={{ color: '#64748B', fontSize: 20 }} /></InputAdornment> } }} />
              <TextField fullWidth label="Текст статьи" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} multiline rows={8}
                placeholder="Введите полный текст статьи…" />
              <Box sx={{ display: 'flex', gap: 3 }}>
                <FormControlLabel control={<Switch checked={form.pinned} onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))} sx={{ '& .MuiSwitch-thumb': { background: '#C9A84C' }, '& .Mui-checked + .MuiSwitch-track': { background: '#C9A84C50' } }} />}
                  label={<Typography variant="body2" sx={{ color: '#94A3B8' }}>Закрепить в ленте</Typography>} />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }}>Отмена</Button>
          <Button variant="outlined" onClick={() => handleSave(false)} sx={{ borderColor: 'rgba(245,158,11,0.3)', color: '#F59E0B' }}>
            Сохранить черновик
          </Button>
          <Button variant="contained" onClick={() => handleSave(true)} disabled={!form.title.trim()}>
            {editArticle ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Comments moderation dialog ===== */}
      <Dialog open={!!commentsDlgFor} onClose={() => setCommentsDlgFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Комментарии к статье</Typography>
            {commentsDlgFor && (
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>{commentsDlgFor.title}</Typography>
            )}
          </Box>
          <IconButton size="small" onClick={() => setCommentsDlgFor(null)} sx={{ color: '#64748B' }}>
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 2 }}>
          {commentsDlgFor && (() => {
            const list = comments.filter(c => c.articleId === commentsDlgFor.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            if (list.length === 0) {
              return (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#64748B' }}>Под этой статьёй ещё нет комментариев</Typography>
                </Box>
              );
            }
            return (
              <Stack spacing={1.5}>
                {list.map(c => (
                  <Box key={c.id} sx={{
                    p: 2, borderRadius: 2,
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 1.5, alignItems: 'flex-start',
                  }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(100,116,139,0.4)', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {c.initials}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{c.author}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748B' }}>{c.createdAt}</Typography>
                      </Box>
                      <Typography variant="body2" sx={{ color: '#CBD5E1', mb: 1, lineHeight: 1.5 }}>{c.text}</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => deleteComment(c.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                      <DeleteRoundedIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
