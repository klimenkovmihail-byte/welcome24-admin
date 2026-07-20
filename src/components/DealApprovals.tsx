import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Chip, Button, TextField, MenuItem, IconButton,
  Collapse, CircularProgress, Alert, Divider, Stack,
} from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import { casesAdminApi, DEAL_TYPE_OPTIONS, type DealApproval } from '../api/cases';
import { openCaseReceipt } from '../lib/attachments';
import { formatRub } from '../utils/format';

/** Очередь сделок юристов на согласование (admin/super_admin). Админ проверяет чек и данные,
 *  может поправить ВКД/город/тип/% и «Согласовать» (сделка идёт в учёт) или «Отклонить». */
export default function DealApprovals({ onChanged }: { onChanged?: () => void }) {
  const [rows, setRows] = useState<DealApproval[] | null>(null);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // локальные правки по задаче: { [taskId]: {vkd, city, dealType, pct} }
  const [edits, setEdits] = useState<Record<number, { vkd: string; city: string; dealType: string; pct: string }>>({});
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    casesAdminApi.approvals()
      .then(list => {
        setRows(list);
        const e: Record<number, { vkd: string; city: string; dealType: string; pct: string }> = {};
        for (const r of list) e[r.taskId] = { vkd: r.vkd ? String(r.vkd) : '', city: r.city || '', dealType: r.dealType || 'secondary', pct: r.commissionPct ? String(r.commissionPct) : '' };
        setEdits(e);
      })
      .catch(() => setError('Не удалось загрузить очередь согласования'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = (taskId: number, field: 'vkd' | 'city' | 'dealType' | 'pct', value: string) =>
    setEdits(prev => ({ ...prev, [taskId]: { ...prev[taskId], [field]: value } }));

  const approve = (r: DealApproval) => {
    const e = edits[r.taskId];
    if (!e?.vkd || Number(e.vkd) <= 0) { setError('Укажите ВКД'); return; }
    setBusyId(r.taskId); setError(null);
    casesAdminApi.approveDeal(r.taskId, {
      vkd: Math.max(0, Number(e.vkd)),
      city: e.city.trim(),
      dealType: e.dealType,
      commissionPct: e.pct === '' ? undefined : Math.min(100, Math.max(0, Number(e.pct))),
    })
      .then(() => { load(); onChanged?.(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось согласовать'))
      .finally(() => setBusyId(null));
  };

  const reject = (taskId: number) => {
    setBusyId(taskId); setError(null);
    casesAdminApi.rejectDeal(taskId, rejectReason.trim())
      .then(() => { setRejecting(null); setRejectReason(''); load(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось отклонить'))
      .finally(() => setBusyId(null));
  };

  if (!rows || rows.length === 0) return null; // ничего на согласовании — панель скрыта

  return (
    <Card sx={{ mb: 2, border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.05)' }}>
      <Box onClick={() => setOpen(o => !o)}
        sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
        <Chip label={rows.length} sx={{ background: '#C9A84C', color: '#0A0E1A', fontWeight: 900, height: 26 }} />
        <Typography sx={{ fontWeight: 800, color: '#E2C97E' }}>Сделки на согласовании</Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8', ml: 0.5 }}>проверьте чек и данные — затем согласуйте</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" sx={{ color: '#94A3B8' }}>
          <KeyboardArrowDownRoundedIcon sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Divider sx={{ borderColor: 'rgba(201,168,76,0.15)' }} />
        {error && <Alert severity="error" sx={{ m: 2, mb: 0 }} onClose={() => setError(null)}>{error}</Alert>}
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {rows.map(r => {
            const e = edits[r.taskId] || { vkd: '', city: '', dealType: 'secondary', pct: '' };
            const busy = busyId === r.taskId;
            // Показываем доход КОМПАНИИ (ВКД − доход агента); доход агента — мелкой подписью для сверки.
            const agentIncome = e.vkd && e.pct ? Math.round(Number(e.vkd) * Number(e.pct) / 100) : 0;
            const companyIncome = e.vkd ? Math.max(0, Math.round(Number(e.vkd)) - agentIncome) : 0;
            return (
              <Box key={r.taskId} sx={{ p: 1.5, borderRadius: 1.5, background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: '#F1F5F9' }}>{r.agentName || 'Агент'}</Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                    {r.clientName || 'клиент —'}{r.address ? ` · ${r.address}` : ''}
                    {r.lawyerName ? ` · юрист: ${r.lawyerName}` : ''}
                  </Typography>
                  {r.participants.length > 0 && (
                    <Chip size="small" label={`совместная: ${r.participants.map(p => `${p.name || '#' + p.agentId} ${p.sharePct}%`).join(', ')}`}
                      sx={{ background: 'rgba(67,97,238,0.12)', color: '#60A5FA', fontSize: 10.5, height: 20 }} />
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField size="small" label="ВКД, ₽" type="number" value={e.vkd} onChange={ev => patch(r.taskId, 'vkd', ev.target.value)} sx={{ width: 120 }} />
                  <TextField size="small" label="%" type="number" value={e.pct} onChange={ev => patch(r.taskId, 'pct', ev.target.value)} sx={{ width: 70 }} />
                  <TextField size="small" label="Город" value={e.city} onChange={ev => patch(r.taskId, 'city', ev.target.value)} sx={{ width: 150 }} />
                  <TextField size="small" label="Тип" select value={e.dealType} onChange={ev => patch(r.taskId, 'dealType', ev.target.value)} sx={{ width: 125 }}>
                    {DEAL_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </TextField>
                  {companyIncome > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 800, display: 'block', lineHeight: 1.2 }}>
                        доход компании {formatRub(companyIncome)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748B', fontSize: 10.5 }}>
                        агенту {formatRub(agentIncome)}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.2, flexWrap: 'wrap' }}>
                  {r.hasReceipt ? (
                    <Button size="small" startIcon={<DescriptionRoundedIcon sx={{ fontSize: 16 }} />}
                      onClick={() => openCaseReceipt(r.taskId).catch(() => setError('Не удалось открыть чек'))}
                      sx={{ color: '#60A5FA', textTransform: 'none', fontWeight: 700 }}>Открыть чек (PDF)</Button>
                  ) : (
                    <Chip size="small" label="Чек не приложен" sx={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontWeight: 700 }} />
                  )}
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={14} sx={{ color: '#0A0E1A' }} /> : <CheckCircleRoundedIcon />}
                    onClick={() => approve(r)}
                    sx={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#04120A', fontWeight: 800 }}>Согласовать</Button>
                  <Button size="small" variant="outlined" color="error" disabled={busy} startIcon={<CancelRoundedIcon />}
                    onClick={() => { setRejecting(rejecting === r.taskId ? null : r.taskId); setRejectReason(''); }}>Отклонить</Button>
                </Box>
                <Collapse in={rejecting === r.taskId}>
                  <Stack direction="row" spacing={1} sx={{ mt: 1.2, alignItems: 'center' }}>
                    <TextField size="small" fullWidth placeholder="Причина возврата юристу (необязательно)" value={rejectReason} onChange={ev => setRejectReason(ev.target.value)} />
                    <Button size="small" color="error" variant="contained" disabled={busy} onClick={() => reject(r.taskId)}>Вернуть</Button>
                  </Stack>
                </Collapse>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Card>
  );
}
