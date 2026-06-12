import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Chip, Link } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { casesAdminApi, type CaseMessage } from '../api/cases';
import { API_BASE_URL, getToken } from '../api/apiClient';

// Локальный статус доставки для оптимистичных (ещё не подтверждённых) сообщений.
type Msg = CaseMessage & { _status?: 'sending' | 'failed' };

// Цвет/подпись по роли отправителя. Агент — золото справа, бэк-офис — слева.
function roleStyle(role: string | null) {
  switch (role) {
    case 'agent':       return { side: 'right' as const, name: '#C9A84C', bg: 'rgba(201,168,76,0.10)', border: 'rgba(201,168,76,0.22)' };
    case 'lawyer':      return { side: 'left' as const,  name: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.22)' };
    case 'broker':      return { side: 'left' as const,  name: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.22)' };
    default:            return { side: 'left' as const,  name: '#60A5FA', bg: 'rgba(67,97,238,0.10)',  border: 'rgba(67,97,238,0.22)' }; // admin/super_admin
  }
}

// Картинка → показываем превью + лайтбокс; прочие файлы — ссылкой.
const isImage = (url?: string | null) => !!url && /\.(jpe?g|png|gif|webp|avif|bmp)(\?|$)/i.test(url);
// Локальная метка времени в формате сервера ('YYYY-MM-DD HH:MM:SS', UTC).
const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

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

/** Чат заявки: агент справа (золото), бэк-офис слева (цвет по роли).
 *  Файл прикрепляется к сообщению; картинки показываются превью с лайтбоксом. */
export default function CaseChat({ caseId, myId, myRole, fillHeight }: { caseId: number; myId: number | null; myRole?: string; fillHeight?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const lastIdRef = useRef(0);
  // Актуальный caseId: при смене заявки без размонтирования (deep-link ?open=N)
  // поздний ответ старого чата не должен дописываться в новый.
  const caseIdRef = useRef(caseId);
  const tmpRef = useRef(-1); // отрицательные id для временных сообщений
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  // Дедупликация по id: перекрывающиеся ответы поллинга (медленная сеть,
  // интервал 5с) и гонка poll↔send давали задвоенные сообщения.
  const appendUnique = (fresh: CaseMessage[]) => {
    setMessages(prev => {
      const seen = new Set(prev.map(m => m.id));
      const add = fresh.filter(m => !seen.has(m.id));
      return add.length ? [...prev, ...add] : prev;
    });
  };

  const poll = useCallback(async () => {
    try {
      const fresh = await casesAdminApi.messages(caseId, lastIdRef.current);
      if (caseIdRef.current !== caseId) return; // переключились на другую заявку
      if (fresh.length) {
        lastIdRef.current = Math.max(lastIdRef.current, fresh[fresh.length - 1].id);
        appendUnique(fresh);
        setTimeout(scrollDown, 50);
        casesAdminApi.markRead(caseId, lastIdRef.current).catch(() => {});
      }
    } catch { /* tolerate */ }
  }, [caseId]);

  useEffect(() => {
    caseIdRef.current = caseId;
    setMessages([]); lastIdRef.current = 0; setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll, caseId]);

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
      const msg = await casesAdminApi.sendMessage(caseId, { body, attachmentUrl: att?.url, attachmentName: att?.name });
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
    if ((!body && !pending) || busy) return;
    const att = pending;
    const tmpId = tmpRef.current--;
    const optimistic: Msg = {
      id: tmpId, case_id: caseId, sender_id: myId, sender_name: 'Вы', sender_role: myRole ?? null,
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
      <Box sx={{ ...(fillHeight ? { flex: 1, minHeight: 0 } : { maxHeight: 280 }), overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, borderRadius: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#C9A84C' }} /></Box>
        ) : messages.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#64748B', textAlign: 'center', py: 2 }}>Сообщений пока нет.</Typography>
        ) : messages.map(m => {
          const st = roleStyle(m.sender_role);
          const img = isImage(m.attachment_url);
          return (
            <Box key={m.id} sx={{ alignSelf: st.side === 'right' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <Box sx={{ px: 1.5, py: 0.8, borderRadius: 2, background: st.bg, border: `1px solid ${st.border}`, opacity: m._status === 'sending' ? 0.65 : 1 }}>
                <Typography variant="caption" sx={{ color: st.name, fontWeight: 700, display: 'block' }}>
                  {m.sender_name || 'участник'}{m.sender_id === myId && !m._status ? ' (вы)' : ''}
                </Typography>
                {m.body && m.body !== '[object Object]' && <Typography variant="body2" sx={{ color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>{m.body}</Typography>}
                {m.attachment_url && (img ? (
                  <Box component="img" src={m.attachment_url} alt={m.attachment_name || ''} loading="lazy"
                    onClick={() => setLightbox(m.attachment_url!)}
                    sx={{ mt: m.body ? 0.5 : 0, display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 1.5, cursor: 'zoom-in', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: m.body ? 0.5 : 0 }}>
                    <DescriptionRoundedIcon sx={{ fontSize: 16, color: st.name }} />
                    <Link href={m.attachment_url} target="_blank" rel="noopener" sx={{ color: st.name, fontSize: 13, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {m.attachment_name || 'файл'}
                    </Link>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>
                    {new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
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
