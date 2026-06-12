import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Chip, Link, Menu, MenuItem, ListItemIcon } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import { api, API_BASE_URL, getToken } from '../api/apiClient';
import { sseSubscribe, sseConnected } from '../lib/sse';

// Единый чат заявки (Фазы Б–Г): один компонент вместо копий CaseChat + инлайн-чатов
// рекламы. Параметризуется доменным путём apiBase ('/cases/14' | '/ad-requests/31') —
// оба домена отдают одинаковый формат messages/read/typing.
// Свои сообщения справа, чужие слева; цвет имени/рамки — по роли отправителя.
// Фаза Г: ответы (reply), правка/удаление своих, копирование, галочки прочтения
// ✓/✓✓ (по thread_reads собеседников), «печатает…» через SSE.

export interface ThreadMessage {
  id: number;
  sender_id: number | null;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  reply_to_id?: number | null;
  reply_body?: string | null;
  reply_attachment_name?: string | null;
  reply_sender_name?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  read_by_others?: number;
}
type Msg = ThreadMessage & { _status?: 'sending' | 'failed' };

interface Props {
  apiBase: string;            // доменный путь заявки, напр. '/cases/14'
  myId: number | null;
  myRole?: string;
  fillHeight?: boolean;       // растянуть на высоту контейнера (вместо maxHeight)
  maxHeight?: number;
  pollMs?: number;
  emptyText?: string;
}

// Цвет участника по роли (агент золото, юрист зелёный, брокер фиолет,
// листинг-менеджер циан, админ синий, прочее серо-голубой).
const ROLE_COLOR: Record<string, string> = {
  agent: '#C9A84C', lawyer: '#22C55E', broker: '#8B5CF6',
  listing_manager: '#06B6D4', admin: '#60A5FA', super_admin: '#60A5FA', manager: '#60A5FA',
};
const roleColor = (r?: string | null) => ROLE_COLOR[r || ''] || '#94A3B8';

// Картинка → превью + лайтбокс; прочие файлы — ссылкой.
const isImage = (url?: string | null) => !!url && /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(url);
// Локальная метка времени в формате сервера ('YYYY-MM-DD HH:MM:SS', UTC).
const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const fmtTime = (s: string) =>
  new Date(s.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function uploadFile(file: File): Promise<{ url: string; name: string }> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('type', 'doc');
  const res = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
  });
  if (!res.ok) throw new Error('Не удалось загрузить файл');
  const data = await res.json();
  return { url: data.url, name: file.name };
}

export default function Thread({ apiBase, myId, myRole = 'agent', fillHeight, maxHeight = 260, pollMs = 5000, emptyText = 'Сообщений пока нет.' }: Props) {
  // api-клиент ждёт путь С префиксом /api (как все api-модули) — apiBase доменный ('/cases/14').
  const base = `/api${apiBase}`;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [live, setLive] = useState(sseConnected()); // живой SSE → редкий фолбэк-поллинг
  const [readUpTo, setReadUpTo] = useState(0);      // мои сообщения с id ≤ — прочитаны собеседником (✓✓)
  const [typingBy, setTypingBy] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<Msg | null>(null);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; msg: Msg } | null>(null);
  const tmpRef = useRef(-1); // отрицательные id для временных сообщений
  const lastIdRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  // Актуальный apiBase: при смене заявки без размонтирования (deep-link ?open=N)
  // поздний ответ старого чата не должен дописываться в новый.
  const baseRef = useRef(apiBase);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Дедупликация по id: перекрывающиеся ответы поллинга (медленная сеть)
  // и гонка poll↔send давали задвоенные сообщения.
  const appendUnique = (fresh: ThreadMessage[]) => {
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      const add = fresh.filter(m => !seen.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  };

  const bumpReadUpTo = (fresh: ThreadMessage[]) => {
    const mx = fresh.reduce((x, m) => (m.read_by_others ? Math.max(x, m.id) : x), 0);
    if (mx) setReadUpTo(prev => Math.max(prev, mx));
  };

  const poll = useCallback(async () => {
    try {
      const fresh = await api.get<ThreadMessage[]>(`${base}/messages?after=${lastIdRef.current}`);
      if (baseRef.current !== apiBase) return; // переключились на другую заявку
      if (fresh.length) {
        lastIdRef.current = Math.max(lastIdRef.current, fresh[fresh.length - 1].id);
        appendUnique(fresh);
        bumpReadUpTo(fresh);
        setTimeout(scrollDown, 50);
        api.post(`${base}/read`, { lastId: lastIdRef.current }).catch(() => {});
      }
    } catch { /* tolerate */ }
  }, [apiBase]);

  // Полная перезагрузка треда — для правок/удалений (курсорный poll старое не вернёт).
  const reload = useCallback(async () => {
    try {
      const fresh = await api.get<ThreadMessage[]>(`${base}/messages?after=0`);
      if (baseRef.current !== apiBase) return;
      lastIdRef.current = fresh.length ? fresh[fresh.length - 1].id : 0;
      setMessages(fresh);
      bumpReadUpTo(fresh);
    } catch { /* tolerate */ }
  }, [apiBase]);

  useEffect(() => {
    baseRef.current = apiBase;
    setMessages([]); lastIdRef.current = 0; setLoading(true);
    setReadUpTo(0); setTypingBy(null); setReplyTo(null); setEditing(null);
    poll().finally(() => setLoading(false));
  }, [poll, apiBase]);

  // Фоллбэк-поллинг отдельным эффектом: смена частоты (live) не сбрасывает чат.
  useEffect(() => {
    const t = setInterval(poll, live ? 30_000 : pollMs);
    return () => clearInterval(t);
  }, [poll, pollMs, live]);

  // SSE: события ЭТОГО треда → мгновенная реакция; $status управляет частотой фоллбэка.
  useEffect(() => {
    const offThread = sseSubscribe('thread', d => {
      const path = d.subjectType === 'case' ? `/cases/${d.subjectId}` : `/ad-requests/${d.subjectId}`;
      if (path !== apiBase) return;
      if (d.event === 'read') {
        if (d.byAgentId !== myId) setReadUpTo(prev => Math.max(prev, Number(d.lastReadId) || 0));
      } else if (d.event === 'typing') {
        if (d.byAgentId !== myId) {
          setTypingBy(String(d.byName || 'участник'));
          if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
          typingTimerRef.current = setTimeout(() => setTypingBy(null), 4000);
        }
      } else if (d.event === 'refresh') {
        reload();
      } else {
        setTypingBy(null); // сообщение пришло — индикатор печати гасим
        poll();
      }
    });
    const offStatus = sseSubscribe('$status', s => setLive(!!s.connected));
    return () => {
      offThread(); offStatus();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [apiBase, poll, reload, myId]);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setAttachError(null);
    try { setPending(await uploadFile(file)); }
    catch { setAttachError('Не удалось загрузить файл — попробуйте ещё раз.'); }
    finally { setBusy(false); e.target.value = ''; }
  };

  // Доставка с повтором: меняет временное сообщение на настоящее либо метит «не доставлено».
  const deliver = async (tmpId: number, body: string, att: { url: string; name: string } | null, replyToId: number | null) => {
    setBusy(true);
    try {
      const msg = await api.post<ThreadMessage>(`${base}/messages`,
        { body, attachmentUrl: att?.url, attachmentName: att?.name, replyToId });
      lastIdRef.current = Math.max(lastIdRef.current, msg.id);
      setMessages(prev => {
        const rest = prev.filter(m => m.id !== tmpId);
        return rest.some(m => m.id === msg.id) ? rest : [...rest, msg]; // poll мог опередить
      });
    } catch {
      setMessages(prev => prev.map(m => (m.id === tmpId ? { ...m, _status: 'failed' } : m)));
    } finally { setBusy(false); }
  };

  // Оптимистичная отправка: сообщение появляется мгновенно со статусом «отправка…».
  const send = () => {
    const body = text.trim();
    // busy в guard'е: Enter не проверяет disabled кнопки → без него дубли при автоповторе клавиши.
    if ((!body && !pending) || busy) return;
    const att = pending;
    const rep = replyTo;
    const tmpId = tmpRef.current--;
    const optimistic: Msg = {
      id: tmpId, sender_id: myId, sender_name: 'Вы', sender_role: myRole,
      body, attachment_url: att?.url ?? null, attachment_name: att?.name ?? null,
      created_at: nowStamp(), _status: 'sending',
      reply_to_id: rep?.id ?? null, reply_body: rep ? (rep.body || null) : null,
      reply_attachment_name: rep?.attachment_name ?? null, reply_sender_name: rep?.sender_name ?? null,
    };
    setMessages(prev => [...prev, optimistic]);
    setText(''); setPending(null); setReplyTo(null);
    setTimeout(scrollDown, 50);
    deliver(tmpId, body, att, rep?.id ?? null);
  };

  const retry = (m: Msg) => {
    setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, _status: 'sending' } : x)));
    deliver(m.id, m.body, m.attachment_url ? { url: m.attachment_url, name: m.attachment_name || 'файл' } : null, m.reply_to_id ?? null);
  };

  // Сохранение правки своего сообщения (режим редактирования занимает поле ввода).
  const saveEdit = async () => {
    if (!editing) return;
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const updated = await api.patch<ThreadMessage>(`${base}/messages/${editing.id}`, { body });
      setMessages(prev => prev.map(m => (m.id === editing.id ? { ...m, ...updated } : m)));
      setEditing(null); setText('');
    } catch {
      setAttachError('Не удалось сохранить правку — попробуйте ещё раз.');
    } finally { setBusy(false); }
  };

  const removeMsg = async (m: Msg) => {
    if (!window.confirm('Удалить сообщение? Текст и вложение будут стёрты у всех.')) return;
    try {
      const updated = await api.del<ThreadMessage>(`${base}/messages/${m.id}`);
      setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, ...updated } : x)));
    } catch { /* tolerate */ }
  };

  const copyMsg = (m: Msg) => { navigator.clipboard?.writeText(m.body || '').catch(() => {}); };

  // «Печатает…»: сигналим собеседникам не чаще раза в 2.5с (и не в режиме правки).
  const onType = (v: string) => {
    setText(v);
    const now = Date.now();
    if (!editing && v && now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      api.post(`${base}/typing`).catch(() => {});
    }
  };

  const startEdit = (m: Msg) => { setEditing(m); setReplyTo(null); setText(m.body); };
  const cancelEdit = () => { setEditing(null); setText(''); };

  const openMenu = (e: React.MouseEvent<HTMLElement>, msg: Msg) => { e.stopPropagation(); setMenu({ anchor: e.currentTarget as HTMLElement, msg }); };

  return (
    <Box sx={fillHeight ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>
      <Box sx={{ ...(fillHeight ? { flex: 1, minHeight: 0 } : { maxHeight }), overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, borderRadius: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#C9A84C' }} /></Box>
        ) : messages.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#64748B', textAlign: 'center', py: 2 }}>{emptyText}</Typography>
        ) : messages.map(m => {
          const mine = m.sender_id != null && m.sender_id === myId;
          const c = roleColor(m.sender_role);
          const img = isImage(m.attachment_url);
          const deleted = !!m.deleted_at;
          return (
            <Box key={m.id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <Box sx={{ position: 'relative', px: 1.5, py: 0.8, borderRadius: 2, background: `${c}1A`, border: `1px solid ${c}38`, opacity: m._status === 'sending' ? 0.65 : 1, '&:hover .msg-menu': { opacity: 1 } }}>
                {!deleted && !m._status && (
                  <IconButton className="msg-menu" size="small" onClick={e => openMenu(e, m)}
                    sx={{ position: 'absolute', top: 2, right: 2, p: 0.2, color: '#64748B', opacity: { xs: 0.5, md: 0 }, transition: 'opacity .15s' }}>
                    <MoreHorizRoundedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
                <Typography variant="caption" sx={{ color: c, fontWeight: 700, display: 'block', pr: 2.5 }}>
                  {m.sender_name || 'участник'}{mine && !m._status ? ' (вы)' : ''}
                </Typography>
                {m.reply_to_id != null && !deleted && (
                  <Box sx={{ borderLeft: `2px solid ${c}88`, pl: 1, my: 0.4, opacity: 0.85 }}>
                    <Typography variant="caption" sx={{ color: c, fontWeight: 700, display: 'block', fontSize: 10.5 }}>
                      {m.reply_sender_name || 'участник'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320 }}>
                      {m.reply_body || (m.reply_attachment_name ? `📎 ${m.reply_attachment_name}` : 'Сообщение удалено')}
                    </Typography>
                  </Box>
                )}
                {deleted ? (
                  <Typography variant="body2" sx={{ color: '#64748B', fontStyle: 'italic' }}>Сообщение удалено</Typography>
                ) : (
                  <>
                    {m.body && m.body !== '[object Object]' && <Typography variant="body2" sx={{ color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>{m.body}</Typography>}
                    {m.attachment_url && (img ? (
                      <Box component="img" src={m.attachment_url} alt={m.attachment_name || ''} loading="lazy"
                        onClick={() => setLightbox(m.attachment_url!)}
                        sx={{ mt: m.body ? 0.5 : 0, display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 1.5, cursor: 'zoom-in', objectFit: 'cover' }} />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: m.body ? 0.5 : 0 }}>
                        <DescriptionRoundedIcon sx={{ fontSize: 16, color: c }} />
                        <Link href={m.attachment_url} target="_blank" rel="noopener" sx={{ color: c, fontSize: 13, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                          {m.attachment_name || 'файл'}
                        </Link>
                      </Box>
                    ))}
                  </>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>{fmtTime(m.created_at)}</Typography>
                  {m.edited_at && !deleted && <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>· изменено</Typography>}
                  {m._status === 'sending' && <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10 }}>· отправка…</Typography>}
                  {m._status === 'failed' && (
                    <Box component="span" onClick={() => retry(m)} sx={{ cursor: 'pointer', color: '#EF4444', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                      · не доставлено <ReplayRoundedIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                  {mine && !m._status && !deleted && (
                    m.id <= readUpTo
                      ? <DoneAllRoundedIcon sx={{ fontSize: 13, color: '#C9A84C' }} titleAccess="Прочитано" />
                      : <DoneRoundedIcon sx={{ fontSize: 13, color: '#64748B' }} titleAccess="Доставлено" />
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
        {typingBy && (
          <Typography variant="caption" sx={{ color: '#64748B', fontStyle: 'italic', pl: 0.5 }}>
            {typingBy} печатает…
          </Typography>
        )}
        <div ref={bottomRef} />
      </Box>

      {replyTo && !editing && (
        <Box sx={{ mt: 1, px: 1.2, py: 0.6, borderRadius: 1.5, background: 'rgba(201,168,76,0.08)', borderLeft: '2px solid #C9A84C', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReplyRoundedIcon sx={{ fontSize: 16, color: '#C9A84C' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 700, display: 'block' }}>{replyTo.sender_name || 'участник'}</Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {replyTo.body || (replyTo.attachment_name ? `📎 ${replyTo.attachment_name}` : '')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setReplyTo(null)} sx={{ color: '#64748B' }}><CloseRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
        </Box>
      )}
      {editing && (
        <Box sx={{ mt: 1, px: 1.2, py: 0.6, borderRadius: 1.5, background: 'rgba(96,165,250,0.08)', borderLeft: '2px solid #60A5FA', display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditRoundedIcon sx={{ fontSize: 16, color: '#60A5FA' }} />
          <Typography variant="caption" sx={{ flex: 1, color: '#94A3B8' }}>Редактирование сообщения</Typography>
          <IconButton size="small" onClick={cancelEdit} sx={{ color: '#64748B' }}><CloseRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
        </Box>
      )}
      {pending && (
        <Chip icon={<DescriptionRoundedIcon />} label={pending.name} onDelete={() => setPending(null)} deleteIcon={<CloseRoundedIcon />}
          sx={{ mt: 1, maxWidth: '100%', background: 'rgba(201,168,76,0.12)', color: '#E2C97E', '& .MuiChip-icon': { color: '#C9A84C' } }} />
      )}
      {attachError && (
        <Typography variant="caption" sx={{ color: '#EF4444', mt: 1, display: 'block' }}>{attachError}</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
        <IconButton component="label" disabled={busy || !!editing} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
          <AttachFileRoundedIcon />
          <input type="file" hidden onChange={handleAttach} />
        </IconButton>
        <TextField size="small" fullWidth placeholder={editing ? 'Исправьте текст…' : 'Написать сообщение…'} value={text}
          onChange={e => onType(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editing ? saveEdit() : send(); }
            if (e.key === 'Escape' && editing) cancelEdit();
          }} />
        <IconButton onClick={editing ? saveEdit : send} disabled={busy || (!text.trim() && !pending)} sx={{ color: editing ? '#60A5FA' : '#C9A84C' }}>
          {busy ? <CircularProgress size={18} /> : editing ? <DoneRoundedIcon /> : <SendRoundedIcon />}
        </IconButton>
      </Box>

      <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { background: '#0F172A', border: '1px solid rgba(201,168,76,0.2)' } } }}>
        <MenuItem onClick={() => { if (menu) { setReplyTo(menu.msg); setEditing(null); } setMenu(null); }}>
          <ListItemIcon><ReplyRoundedIcon sx={{ fontSize: 18, color: '#94A3B8' }} /></ListItemIcon>Ответить
        </MenuItem>
        {!!menu?.msg.body && (
          <MenuItem onClick={() => { if (menu) copyMsg(menu.msg); setMenu(null); }}>
            <ListItemIcon><ContentCopyRoundedIcon sx={{ fontSize: 18, color: '#94A3B8' }} /></ListItemIcon>Копировать
          </MenuItem>
        )}
        {menu && menu.msg.sender_id === myId && !!menu.msg.body && (
          <MenuItem onClick={() => { startEdit(menu.msg); setMenu(null); }}>
            <ListItemIcon><EditRoundedIcon sx={{ fontSize: 18, color: '#94A3B8' }} /></ListItemIcon>Изменить
          </MenuItem>
        )}
        {menu && menu.msg.sender_id === myId && (
          <MenuItem onClick={() => { removeMsg(menu.msg); setMenu(null); }} sx={{ color: '#EF4444' }}>
            <ListItemIcon><DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: '#EF4444' }} /></ListItemIcon>Удалить
          </MenuItem>
        )}
      </Menu>

      {lightbox && (
        <Box onClick={() => setLightbox(null)} sx={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, cursor: 'zoom-out' }}>
          <Box component="img" src={lightbox} sx={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 2, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
          <IconButton onClick={() => setLightbox(null)} sx={{ position: 'absolute', top: 16, right: 16, color: '#fff', background: 'rgba(0,0,0,0.4)', '&:hover': { background: 'rgba(0,0,0,0.6)' } }}>
            <CloseRoundedIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
