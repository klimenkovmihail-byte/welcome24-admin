import { useEffect, useState } from 'react';
import { Box, TextField, Button, Typography, Chip, CircularProgress, Alert } from '@mui/material';
import { casesAdminApi, type CaseTask } from '../api/cases';
import { formatRub } from '../utils/format';

/** Финансы legal-задачи: юрист вводит ВКД + % (с подсказкой по агенту) + дату.
 *  Если сделка уже проведена (deal_id) — показываем итог без редактирования. */
export default function CaseFinance({
  caseId, task, onSaved,
}: { caseId: number; task: CaseTask; onSaved: (updatedTaskId?: number) => void }) {
  const [vkd, setVkd] = useState(task.vkd ? String(task.vkd) : '');
  const [pct, setPct] = useState(task.commission_pct ? String(task.commission_pct) : '');
  const [date, setDate] = useState(task.deal_date || new Date().toISOString().slice(0, 10));
  const [sugg, setSugg] = useState<{ commission: number; ytdVkdBefore: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Процент комиссии — только 0..100 (клэмп на blur/перед отправкой).
  const clampPct = (s: string): string => {
    if (s === '') return '';
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    return String(Math.min(100, Math.max(0, n)));
  };
  // ВКД — запрет отрицательных.
  const clampVkd = (s: string): string => {
    if (s === '') return '';
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    return String(Math.max(0, n));
  };

  useEffect(() => {
    casesAdminApi.commissionSuggestion(caseId, date)
      .then(s => {
        if (s && typeof s.commission === 'number') {
          setSugg(s);
          if (!task.commission_pct) setPct(String(s.commission));
        }
      })
      .catch(() => { /* tolerate — без подсказки */ });
  }, [caseId, date, task.commission_pct]);

  if (task.deal_id) {
    const income = Math.round((task.vkd || 0) * (task.commission_pct || 0) / 100);
    return (
      <Box sx={{ mt: 1, p: 1.2, borderRadius: 1.5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700 }}>
          Сделка проведена: {formatRub(task.vkd || 0)} ВКД · {task.commission_pct}% · доход {formatRub(income)}
        </Typography>
      </Box>
    );
  }

  const income = vkd && pct ? Math.round(Number(vkd) * Number(pct) / 100) : 0;

  const save = () => {
    if (!vkd) return;
    const safeVkd = Math.max(0, Number(vkd));
    const safePct = pct === '' ? undefined : Math.min(100, Math.max(0, Number(pct)));
    setSaving(true);
    setError(null);
    casesAdminApi.setFinance(task.id, { vkd: safeVkd, commissionPct: safePct, dealDate: date })
      .then(() => { setError(null); onSaved(task.id); })
      .catch(() => setError('Не удалось сохранить финансы — повторите'))
      .finally(() => setSaving(false));
  };

  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)' }}>
      <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
        Финансы сделки
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="ВКД, ₽" type="number" value={vkd}
          onChange={e => setVkd(e.target.value)} onBlur={() => setVkd(clampVkd)} sx={{ width: 130 }} />
        <TextField size="small" label="%" type="number" value={pct}
          onChange={e => setPct(e.target.value)} onBlur={() => setPct(clampPct)} sx={{ width: 80 }} />
        <TextField size="small" label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 150 }} />
        <Button variant="contained" size="small" disabled={saving || !vkd} onClick={save}
          sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 800,
                '&.Mui-disabled': { background: 'rgba(201,168,76,0.3)', color: 'rgba(10,14,26,0.5)' } }}>
          {saving ? <CircularProgress size={16} sx={{ color: '#0A0E1A' }} /> : 'Сохранить'}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
        {sugg && (
          <Chip size="small" label={`Рекоменд. ${sugg.commission}% (ВКД года: ${formatRub(sugg.ytdVkdBefore)})`}
            onClick={() => setPct(String(sugg.commission))}
            sx={{ background: 'rgba(67,97,238,0.12)', color: '#60A5FA', cursor: 'pointer', fontSize: 11 }} />
        )}
        {income > 0 && (
          <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700 }}>Доход агента: {formatRub(income)}</Typography>
        )}
      </Box>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>
      )}
      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.8, fontSize: 10.5 }}>
        После ввода ВКД переведите этап в «Завершено» — сделка автоматически появится у агента в портале.
      </Typography>
    </Box>
  );
}
