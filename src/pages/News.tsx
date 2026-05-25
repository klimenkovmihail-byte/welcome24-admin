import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Select, MenuItem,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Stack, Divider, Paper, Grid,
  InputAdornment, Switch, FormControlLabel, Alert, CircularProgress,
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
import { newsApi, type Article, type ArticleComment, type ArticlePayload } from '../api/news';

const CATEGORIES = ['Компания', 'Рынок', 'Обучение', 'Итоги', 'Партнёры', 'Объявления'];

const catColor: Record<string, { bg: string; color: string }> = {
  'Компания': { bg: 'rgba(201,168,76,0.12)', color: '#C9A84C' },
  'Рынок': { bg: 'rgba(34,197,94,0.12)', color: '#22C55E' },
  'Обучение': { bg: 'rgba(139,92,246,0.12)', color: '#A78BFA' },
  'Итоги': { bg: 'rgba(59,130,246,0.12)', color: '#60A5FA' },
  'Партнёры': { bg: 'rgba(20,184,166,0.12)', color: '#2DD4BF' },
  'Объявления': { bg: 'rgba(239,68,68,0.12)', color: '#F87171' },
};

type FormState = Omit<Article, 'id' | 'likes'> & { id: number | null };

const emptyForm = (): FormState => ({
  id: null,
  title: '',
  category: 'Компания',
  summary: '',
  content: '',
  coverUrl: '',
  author: 'Администратор',
  date: new Date().toISOString().slice(0, 10),
  readTime: '3 мин',
  pinned: false,
  published: false,
});

function toPayload(f: FormState, override?: { published?: boolean }): ArticlePayload {
  return {
    title: f.title.trim(),
    summary: f.summary,
    content: f.content,
    category: f.category,
    coverUrl: f.coverUrl,
    authorName: f.author,
    date: f.date,
    readTime: f.readTime,
    isFeatured: f.pinned,
    published: override?.published ?? f.published,
  };
}

export default function News() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<ArticleComment[]>([]);
  const [commentsCount, setCommentsCount] = useState<Record<number, number>>({});
  const [commentsDlgFor, setCommentsDlgFor] = useState<Article | null>(null);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [preview, setPreview] = useState(false);

  const loadArticles = async () => {
    try {
      setError(null);
      const rows = await newsApi.list();
      setArticles(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить статьи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadArticles(); }, []);

  // Подгружаем счётчики комментариев лениво на каждую статью один раз
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const need = articles.filter(a => commentsCount[a.id] === undefined);
      if (need.length === 0) return;
      const results = await Promise.all(need.map(async a => {
        try {
          const list = await newsApi.comments(a.id);
          return [a.id, list.length] as const;
        } catch {
          return [a.id, 0] as const;
        }
      }));
      if (cancelled) return;
      setCommentsCount(prev => {
        const next = { ...prev };
        for (const [id, n] of results) next[id] = n;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [articles, commentsCount]);

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchQ = !q || a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q);
    const matchCat = filterCat === 'all' || a.category === filterCat;
    return matchQ && matchCat;
  });

  const openCreate = () => { setForm(emptyForm()); setPreview(false); setDialogOpen(true); };
  const openEdit = (a: Article) => {
    setForm({
      id: a.id, title: a.title, category: a.category, summary: a.summary, content: a.content,
      coverUrl: a.coverUrl, author: a.author, date: a.date, readTime: a.readTime,
      pinned: a.pinned, published: a.published,
    });
    setPreview(false);
    setDialogOpen(true);
  };

  const handleSave = async (publishOverride?: boolean) => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = toPayload(form, publishOverride !== undefined ? { published: publishOverride } : undefined);
      if (form.id != null) {
        await newsApi.update(form.id, payload);
      } else {
        await newsApi.create(payload);
      }
      setDialogOpen(false);
      await loadArticles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const deleteArticle = async (id: number) => {
    if (!confirm('Удалить статью?')) return;
    try {
      await newsApi.remove(id);
      setArticles(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления');
    }
  };

  const togglePublish = async (a: Article) => {
    try {
      await newsApi.update(a.id, { published: !a.published });
      setArticles(prev => prev.map(x => x.id === a.id ? { ...x, published: !x.published } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка обновления');
    }
  };

  const openComments = async (a: Article) => {
    setCommentsDlgFor(a);
    try {
      const list = await newsApi.comments(a.id);
      setComments(list);
      setCommentsCount(prev => ({ ...prev, [a.id]: list.length }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки комментариев');
    }
  };

  const deleteComment = async (id: number) => {
    try {
      await newsApi.deleteComment(id);
      setComments(prev => prev.filter(c => c.id !== id));
      if (commentsDlgFor) {
        setCommentsCount(prev => ({ ...prev, [commentsDlgFor.id]: Math.max(0, (prev[commentsDlgFor.id] || 1) - 1) }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка удаления комментария');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

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
                          <Typography variant="caption" fontSize={11}>{commentsCount[article.id] ?? '…'}</Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => togglePublish(article)} sx={{ flex: 1, fontSize: 12,
                        borderColor: article.published ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)',
                        color: article.published ? '#F59E0B' : '#22C55E',
                        '&:hover': { borderColor: article.published ? '#F59E0B' : '#22C55E', background: article.published ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' } }}>
                        {article.published ? 'Скрыть' : 'Опубликовать'}
                      </Button>
                      <IconButton size="small" onClick={() => openComments(article)} sx={{ color: '#64748B', '&:hover': { color: '#4361EE' } }}>
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
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>{form.id != null ? 'Редактировать статью' : 'Новая статья'}</Typography>
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
          <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748B' }} disabled={saving}>Отмена</Button>
          <Button variant="outlined" onClick={() => handleSave(false)} disabled={saving} sx={{ borderColor: 'rgba(245,158,11,0.3)', color: '#F59E0B' }}>
            Сохранить черновик
          </Button>
          <Button variant="contained" onClick={() => handleSave(true)} disabled={!form.title.trim() || saving}>
            {form.id != null ? 'Сохранить' : 'Опубликовать'}
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
            const list = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            if (list.length === 0) {
              return (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: '#64748B' }}>Под этой статьёй ещё нет комментариев</Typography>
                </Box>
              );
            }
            return (
              <Stack spacing={1.5}>
                {list.map(c => {
                  const initials = c.authorName.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase() || '?';
                  return (
                    <Box key={c.id} sx={{
                      p: 2, borderRadius: 2,
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex', gap: 1.5, alignItems: 'flex-start',
                    }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(100,116,139,0.4)', color: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{c.authorName}</Typography>
                          <Typography variant="caption" sx={{ color: '#64748B' }}>{c.createdAt.slice(0, 10)}</Typography>
                        </Box>
                        <Typography variant="body2" sx={{ color: '#CBD5E1', mb: 1, lineHeight: 1.5 }}>{c.text}</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => deleteComment(c.id)} sx={{ color: '#64748B', '&:hover': { color: '#EF4444' } }}>
                        <DeleteRoundedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Stack>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
