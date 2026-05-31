import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { casesAdminApi, type CaseEvent } from '../api/cases';

const KIND: Record<string, { icon: React.ReactNode; color: string }> = {
  created:      { icon: <AddCircleRoundedIcon sx={{ fontSize: 16 }} />, color: '#60A5FA' },
  task_added:   { icon: <AddCircleRoundedIcon sx={{ fontSize: 16 }} />, color: '#60A5FA' },
  taken:        { icon: <PlayArrowRoundedIcon sx={{ fontSize: 16 }} />, color: '#C9A84C' },
  reassigned:   { icon: <SwapHorizRoundedIcon sx={{ fontSize: 16 }} />, color: '#8B5CF6' },
  status:       { icon: <SwapHorizRoundedIcon sx={{ fontSize: 16 }} />, color: '#F59E0B' },
  file:         { icon: <DescriptionRoundedIcon sx={{ fontSize: 16 }} />, color: '#94A3B8' },
  finance:      { icon: <PaidRoundedIcon sx={{ fontSize: 16 }} />, color: '#22C55E' },
  deal_created: { icon: <CheckCircleRoundedIcon sx={{ fontSize: 16 }} />, color: '#22C55E' },
};

function fmt(s: string) {
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? '' : d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CaseTimeline({ caseId, refreshKey }: { caseId: number; refreshKey?: number }) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    casesAdminApi.events(caseId).then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  }, [caseId, refreshKey]);

  if (loading) return <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={18} sx={{ color: '#C9A84C' }} /></Box>;
  if (events.length === 0) return <Typography variant="caption" sx={{ color: '#64748B' }}>Событий пока нет.</Typography>;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((e, i) => {
        const cfg = KIND[e.kind] || { icon: <SwapHorizRoundedIcon sx={{ fontSize: 16 }} />, color: '#64748B' };
        const last = i === events.length - 1;
        return (
          <Box key={e.id} sx={{ display: 'flex', gap: 1.2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box sx={{ color: cfg.color, display: 'flex' }}>{cfg.icon}</Box>
              {!last && <Box sx={{ flex: 1, width: 2, background: 'rgba(255,255,255,0.08)', my: 0.3 }} />}
            </Box>
            <Box sx={{ pb: last ? 0 : 1.5, minWidth: 0 }}>
              <Typography variant="body2" sx={{ color: '#E2E8F0', lineHeight: 1.3 }}>{e.text}</Typography>
              <Typography variant="caption" sx={{ color: '#475569', fontSize: 10.5 }}>
                {e.actor_name ? `${e.actor_name} · ` : ''}{fmt(e.created_at)}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
