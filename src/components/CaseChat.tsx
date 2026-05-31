import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, Typography, TextField, IconButton, CircularProgress } from '@mui/material';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import { casesAdminApi, type CaseMessage } from '../api/cases';

/** Чат заявки с поллингом (~5с). Используется в детальном диалоге заявки. */
export default function CaseChat({ caseId, myId }: { caseId: number; myId: number | null }) {
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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
      }
    } catch { /* tolerate */ }
  }, [caseId]);

  useEffect(() => {
    setMessages([]);
    lastIdRef.current = 0;
    setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const msg = await casesAdminApi.sendMessage(caseId, body);
      lastIdRef.current = msg.id;
      setMessages(prev => [...prev, msg]);
      setText('');
      setTimeout(scrollDown, 50);
    } catch { /* tolerate */ } finally { setSending(false); }
  };

  return (
    <Box>
      <Box sx={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, p: 1, borderRadius: 2, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(201,168,76,0.08)' }}>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={20} sx={{ color: '#C9A84C' }} /></Box>
        ) : messages.length === 0 ? (
          <Typography variant="caption" sx={{ color: '#64748B', textAlign: 'center', py: 2 }}>Сообщений пока нет. Напишите первым.</Typography>
        ) : messages.map(m => {
          const mine = m.sender_id === myId;
          return (
            <Box key={m.id} sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <Box sx={{ px: 1.5, py: 0.8, borderRadius: 2, background: mine ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.05)', border: `1px solid ${mine ? 'rgba(201,168,76,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
                {!mine && <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 700, display: 'block' }}>{m.sender_name || 'участник'}</Typography>}
                <Typography variant="body2" sx={{ color: '#E2E8F0', whiteSpace: 'pre-wrap' }}>{m.body}</Typography>
                <Typography variant="caption" sx={{ color: '#475569', fontSize: 10 }}>
                  {new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </Box>
          );
        })}
        <div ref={bottomRef} />
      </Box>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <TextField
          size="small" fullWidth placeholder="Написать сообщение…" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <IconButton onClick={send} disabled={sending || !text.trim()} sx={{ color: '#C9A84C' }}>
          {sending ? <CircularProgress size={18} /> : <SendRoundedIcon />}
        </IconButton>
      </Box>
    </Box>
  );
}
