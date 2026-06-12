import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Chip, Link } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { api, API_BASE_URL, getToken } from '../api/apiClient';

// Единый чат заявки (Фаза Б): один компонент вместо копий CaseChat + инлайн-чатов
// рекламы. Параметризуется доменным путём apiBase ('/cases/14' | '/ad-requests/31') —
// после Фазы А оба домена отдают одинаковый формат messages/read.
// Свои сообщения справа, чужие слева; цвет имени/рамки — по роли отправителя.

export interface ThreadMessage {
  id: number;
  sender_id: number | null;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
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
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const tmpRef = useRef(-1); // отрицательные id для временных сообщений
  const lastIdRef = useRef(0);
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

  const poll = useCallback(async () => {
    try {
      const fresh = await api.get<ThreadMessage[]>(`${apiBase}/messages?after=${lastIdRef.current}`);
      if (baseRef.current !== apiBase) return; // переключились на другую заявку
      if (fresh.length) {
        lastIdRef.current = Math.max(lastIdRef.current, fresh[fresh.length - 1].id);
        appendUnique(fresh);
        setTimeout(scrollDown, 50);
        api.post(`${apiBase}/read`, { lastId: lastIdRef.current }).catch(() => {});
      }
    } catch { /* tolerate */ }
  }, [apiBase]);

  useEffect(() => {
    baseRef.current = apiBase;
    setMessages([]); lastIdRef.current = 0; setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, pollMs);
    return () => clearInterval(t);
  }, [poll, apiBase, pollMs]);

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
  const deliver = async (tmpId: number, body: string, att: { url: string; name: string } | null) => {
    setBusy(true);
    try {
      const msg = await api.post<ThreadMessage>(`${apiBase}/messages`, { body, attachmentUrl: att?.url, attachmentName: att?.name });
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
    const tmpId = tmpRef.current--;
    const optimistic: Msg = {
      id: tmpId, sender_id: myId, sender_name: 'Вы', sender_role: myRole,
      body, attachment_url: att?.url ?? null, attachment_name: att?.name ?? null,
      created_at: nowStamp(), _status: 'sending',
    };
    setMessages(prev => [...prev, optimistic]);
    setText(''); setPending(null);
    setTimeout(scrollDown, 50);
    deliver(tmpId, body, att);
  };

  const retry = (m: Msg) => {
    setMessages(prev => prev.map(x => (x.id === m.id ? { ...x, _status: 'sending' } : x)));
    deliver(m.id, m.body, m.attachment_url ? { url: m.attachment_url, name: m.attachment_name || 'файл' } : null);
  };

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
          return (
            <Box key={m.id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <Box sx={{ px: 1.5, py: 0.8, borderRadius: 2, background: `${c}1A`, border: `1px solid ${c}38`, opacity: m._status === 'sending' ? 0.65 : 1 }}>
                <Typography variant="caption" sx={{ color: c, fontWeight: 700, display: 'block' }}>
                  {m.sender_name || 'участник'}{mine && !m._status ? ' (вы)' : ''}
                </Typography>
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>{fmtTime(m.created_at)}</Typography>
                  {m._status === 'sending' && <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10 }}>· отправка…</Typography>}
                  {m._status === 'failed' && (
                    <Box component="span" onClick={() => retry(m)} sx={{ cursor: 'pointer', color: '#EF4444', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 0.3 }}>
                      · не доставлено <ReplayRoundedIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>

      {pending && (
        <Chip icon={<DescriptionRoundedIcon />} label={pending.name} onDelete={() => setPending(null)} deleteIcon={<CloseRoundedIcon />}
          sx={{ mt: 1, maxWidth: '100%', background: 'rgba(201,168,76,0.12)', color: '#E2C97E', '& .MuiChip-icon': { color: '#C9A84C' } }} />
      )}
      {attachError && (
        <Typography variant="caption" sx={{ color: '#EF4444', mt: 1, display: 'block' }}>{attachError}</Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
        <IconButton component="label" disabled={busy} sx={{ color: '#64748B', '&:hover': { color: '#C9A84C' } }}>
          <AttachFileRoundedIcon />
          <input type="file" hidden onChange={handleAttach} />
        </IconButton>
        <TextField size="small" fullWidth placeholder="Написать сообщение…" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <IconButton onClick={send} disabled={busy || (!text.trim() && !pending)} sx={{ color: '#C9A84C' }}>
          {busy ? <CircularProgress size={18} /> : <SendRoundedIcon />}
        </IconButton>
      </Box>

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
