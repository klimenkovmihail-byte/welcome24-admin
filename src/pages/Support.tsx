import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Chip, Stack, Divider,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress,
  Avatar,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useRef } from 'react';
import { supportApi, type SupportTicketSummary, type SupportTicketFull } from '../api/support';
import { API_BASE_URL, getToken } from '../api/apiClient';

// ПРИВАТНАЯ загрузка вложения тикета (152-ФЗ) — в приватный бакет, вернуть s3Key.
async function uploadAttachment(file: File): Promise<{ s3Key: string; name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/api/support/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return { s3Key: data.s3Key, name: data.name };
}
const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

const STATUS_CFG: Record<SupportTicketSummary['status'], { label: string; color: string; bg: string }> = {
  open:    { label: 'Открыт',    color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  replied: { label: 'Отвечен',   color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  closed:  { label: 'Закрыт',    color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
};

const fmtDate = (s?: string | null) => s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('ru-RU') : '—';

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<SupportTicketFull | null>(null);
  const [openLoading, setOpenLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyAtts, setReplyAtts] = useState<{ s3Key: string; name: string }[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const [sending, setSending] = useState(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);

  const handleAttachPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAtt(true);
    try {
      const att = await uploadAttachment(file);
      setReplyAtts(prev => [...prev, att]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
    } finally {
      setUploadingAtt(false);
    }
  };

  const load = () => {
    setLoading(true);
    supportApi.list()
      .then(setTickets)
      .catch(e => setError(e?.message || 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openTicket = async (id: number) => {
    setOpenLoading(true);
    try { setOpen(await supportApi.get(id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setOpenLoading(false); }
  };

  const send = async () => {
    if (!open) return;
    if (!reply.trim() && replyAtts.length === 0) return;
    setSending(true);
    try {
      const updated = await supportApi.reply(open.id, reply.trim(), replyAtts.map(a => a.s3Key));
      setOpen(updated);
      setReply('');
      setReplyAtts([]);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const close = async () => {
    if (!open) return;
    await supportApi.setStatus(open.id, 'closed');
    setOpen({ ...open, status: 'closed' });
    load();
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#94A3B8', mb: 2.5, display: 'block' }}>
        Запросы агентов в техподдержку. Сначала открытые, потом отвеченные, в конце закрытые.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid rgba(201,168,76,0.1)' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Тема / последнее сообщение</TableCell>
              <TableCell>Агент</TableCell>
              <TableCell align="center">Сообщений</TableCell>
              <TableCell align="center">Статус</TableCell>
              <TableCell>Обновлён</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.map(t => {
              const cfg = STATUS_CFG[t.status];
              return (
                <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => openTicket(t.id)}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#F1F5F9' }}>{t.subject}</Typography>
                    {t.last_message && (
                      <Typography variant="caption" sx={{ color: '#64748B', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {t.last_message}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ color: '#94A3B8' }}>{t.agent_name}</Typography></TableCell>
                  <TableCell align="center"><Typography variant="body2" sx={{ color: '#F1F5F9', fontWeight: 700 }}>{t.messages_count}</Typography></TableCell>
                  <TableCell align="center">
                    <Chip label={cfg.label} size="small" sx={{ background: cfg.bg, color: cfg.color, fontWeight: 700 }} />
                  </TableCell>
                  <TableCell><Typography variant="caption" sx={{ color: '#94A3B8' }}>{fmtDate(t.updated_at)}</Typography></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {tickets.length === 0 && (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#64748B' }}>Запросов в поддержку пока нет</Typography>
          </Box>
        )}
      </TableContainer>

      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>{open?.subject}</Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8' }}>
              {open?.agent_name} · {open && fmtDate(open.created_at)} ·{' '}
              {open && <Chip label={STATUS_CFG[open.status].label} size="small" sx={{ height: 18, background: STATUS_CFG[open.status].bg, color: STATUS_CFG[open.status].color, fontWeight: 700 }} />}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setOpen(null)} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.1)' }} />
        <DialogContent sx={{ pt: 2 }}>
          {openLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : open && (
            <Stack spacing={1.5}>
              {open.messages.map(m => {
                const isAdmin = m.author_role === 'admin';
                return (
                  <Box key={m.id} sx={{
                    p: 2, borderRadius: 2,
                    background: isAdmin ? 'rgba(201,168,76,0.06)' : 'rgba(255,255,255,0.025)',
                    border: isAdmin ? '1px solid rgba(201,168,76,0.2)' : '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 1.5, alignItems: 'flex-start',
                  }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 11, fontWeight: 700,
                      background: isAdmin ? 'linear-gradient(135deg, #C9A84C, #E2C97E)' : 'rgba(100,116,139,0.4)',
                      color: isAdmin ? '#0A0E1A' : '#F1F5F9',
                    }}>
                      {m.author_name?.split(' ').map(n => n[0]).slice(0, 2).join('') || '?'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 0.3 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#F1F5F9' }}>{m.author_name}</Typography>
                        {isAdmin && <Chip label="Админ" size="small" sx={{ height: 16, fontSize: 9, background: 'rgba(201,168,76,0.2)', color: '#C9A84C', fontWeight: 700 }} />}
                        <Typography variant="caption" sx={{ color: '#64748B', fontSize: 11 }}>{fmtDate(m.created_at)}</Typography>
                      </Box>
                      {m.text && <Typography variant="body2" sx={{ color: '#CBD5E1', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</Typography>}
                      {m.attachments && m.attachments.length > 0 && (
                        <Box sx={{ mt: m.text ? 1 : 0, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {m.attachments.map((url, i) => (
                            isImage(url) ? (
                              <Box key={i} component="a" href={url} target="_blank" rel="noopener">
                                <Box component="img" src={url}
                                  sx={{ maxWidth: 160, maxHeight: 120, borderRadius: 1.5, border: '1px solid rgba(201,168,76,0.2)', cursor: 'zoom-in', '&:hover': { border: '1px solid #C9A84C' } }}
                                />
                              </Box>
                            ) : (
                              <Box key={i} component="a" href={url} target="_blank" rel="noopener"
                                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 1, background: 'rgba(67,97,238,0.12)', color: '#60A5FA', textDecoration: 'none', fontSize: 12 }}>
                                <AttachFileRoundedIcon sx={{ fontSize: 14 }} />
                                Файл {i + 1}
                              </Box>
                            )
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, flexDirection: 'column', gap: 1.5, alignItems: 'stretch' }}>
          {open && open.status !== 'closed' && (
            <Box sx={{ width: '100%' }}>
              {replyAtts.length > 0 && (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {replyAtts.map((att, i) => (
                    <Box key={i} sx={{ position: 'relative', display: 'inline-block' }}>
                      <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, background: 'rgba(67,97,238,0.12)', color: '#60A5FA', fontSize: 11, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</Box>
                      <IconButton size="small" onClick={() => setReplyAtts(prev => prev.filter((_, idx) => idx !== i))}
                        sx={{ position: 'absolute', top: -8, right: -8, background: 'rgba(0,0,0,0.7)', color: '#fff', width: 18, height: 18, '&:hover': { background: '#EF4444' } }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <input ref={attachInputRef} type="file" accept="image/*,.pdf"
                  onChange={handleAttachPick} style={{ display: 'none' }} />
                <IconButton onClick={() => attachInputRef.current?.click()} disabled={uploadingAtt}
                  sx={{ color: '#94A3B8', '&:hover': { color: '#C9A84C' } }}>
                  <AttachFileRoundedIcon />
                </IconButton>
                <TextField
                  fullWidth size="small" multiline maxRows={6} placeholder="Ответить…"
                  value={reply} onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }}
                />
                <Button variant="contained" onClick={send} disabled={(!reply.trim() && replyAtts.length === 0) || sending} sx={{ minWidth: 0, px: 1.5 }}>
                  <SendRoundedIcon fontSize="small" />
                </Button>
              </Box>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <Button onClick={() => setOpen(null)} sx={{ color: '#64748B' }}>Закрыть окно</Button>
            {open && open.status !== 'closed' && (
              <Button onClick={close} sx={{ color: '#94A3B8' }}>Пометить «Закрыт»</Button>
            )}
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
