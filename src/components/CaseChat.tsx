import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress, Chip, Link } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { casesAdminApi, type CaseMessage } from '../api/cases';
import { API_BASE_URL, getToken } from '../api/apiClient';

// Цвет/подпись по роли отправителя. Агент — золото справа, бэк-офис — слева.
function roleStyle(role: string | null) {
  switch (role) {
    case 'agent':       return { side: 'right' as const, name: '#C9A84C', bg: 'rgba(201,168,76,0.10)', border: 'rgba(201,168,76,0.22)' };
    case 'lawyer':      return { side: 'left' as const,  name: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.22)' };
    case 'broker':      return { side: 'left' as const,  name: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.22)' };
    default:            return { side: 'left' as const,  name: '#60A5FA', bg: 'rgba(67,97,238,0.10)',  border: 'rgba(67,97,238,0.22)' }; // admin/super_admin
  }
}

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
 *  Файл прикрепляется к сообщению и показывается вместе с текстом. */
export default function CaseChat({ caseId, myId }: { caseId: number; myId: number | null }) {
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<{ url: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const lastIdRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

  const poll = useCallback(async () => {
    try {
      const fresh = await casesAdminApi.messages(caseId, lastIdRef.current);
      if (fresh.length) {
        lastIdRef.current = fresh[fresh.length - 1].id;
        setMessages(prev => [...prev, ...fresh]);
        setTimeout(scrollDown, 50);
        casesAdminApi.markRead(caseId, lastIdRef.current).catch(() => {});
      }
    } catch { /* tolerate */ }
  }, [caseId]);

  useEffect(() => {
    setMessages([]); lastIdRef.current = 0; setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try { setPending(await uploadFile(file)); } catch { /* tolerate */ } finally { setBusy(false); e.target.value = ''; }
  };

  const send = async () => {
    const body = text.trim();
    if (!body && !pending) return;
    setBusy(true);
    try {
      const msg = await casesAdminApi.sendMessage(caseId, {
        body, attachmentUrl: pending?.url, attachmentName: pending?.name,
      });
      lastIdRef.current = msg.id;
      setMessages(prev => [...prev, msg]);
      setText(''); setPending(null);
      setTimeout(scrollDown, 50);
    } catch { /* tolerate */ } finally { setBusy(false); }
  };

  return (
    <Box>
      <Box sx={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, borderRadius: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#C9A84C' }} /></Box>
        ) : messages.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#64748B', textAlign: 'center', py: 2 }}>Сообщений пока нет.</Typography>
        ) : messages.map(m => {
          const st = roleStyle(m.sender_role);
          return (
            <Box key={m.id} sx={{ alignSelf: st.side === 'right' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
              <Box sx={{ px: 1.5, py: 0.8, borderRadius: 2, background: st.bg, border: `1px solid ${st.border}` }}>
                <Typography variant="caption" sx={{ color: st.name, fontWeight: 700, display: 'block' }}>
                  {m.sender_name || 'участник'}{m.sender_id === myId ? ' (вы)' : ''}
                </Typography>
                {m.body && m.body !== '[object Object]' && <Typography variant="body2" sx={{ color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>{m.body}</Typography>}
                {m.attachment_url && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: m.body ? 0.5 : 0 }}>
                    <DescriptionRoundedIcon sx={{ fontSize: 16, color: st.name }} />
                    <Link href={m.attachment_url} target="_blank" rel="noopener" sx={{ color: st.name, fontSize: 13, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                      {m.attachment_name || 'файл'}
                    </Link>
                  </Box>
                )}
                <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>
                  {new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Typography>
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
    </Box>
  );
}
