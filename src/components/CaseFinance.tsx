import { useEffect, useRef, useState } from 'react';
import { Box, TextField, Button, Typography, Chip, CircularProgress, Alert, MenuItem } from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { casesAdminApi, DEAL_TYPE_OPTIONS, type CaseTask } from '../api/cases';
import { uploadCaseReceipt, openCaseReceipt } from '../lib/attachments';
import { formatRub } from '../utils/format';

/** Финансы legal-задачи: юрист вводит ВКД + % + дату + ГОРОД + ТИП и прикладывает ЧЕК (PDF).
 *  После «Завершено» сделка уходит на СОГЛАСОВАНИЕ админу (в систему — только после одобрения). */
export default function CaseFinance({
  caseId, task, caseCity, onSaved,
}: { caseId: number; task: CaseTask; caseCity?: string; onSaved: (updatedTaskId?: number) => void }) {
  const [vkd, setVkd] = useState(task.vkd ? String(task.vkd) : '');
  const [pct, setPct] = useState(task.commission_pct ? String(task.commission_pct) : '');
  const [date, setDate] = useState(task.deal_date || new Date().toISOString().slice(0, 10));
  const [city, setCity] = useState(task.deal_city || caseCity || '');
  const [dealType, setDealType] = useState<string>(task.deal_type || 'secondary');
  const [sugg, setSugg] = useState<{ commission: number; ytdVkdBefore: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const clampPct = (s: string): string => { if (s === '') return ''; const n = Number(s); return Number.isFinite(n) ? String(Math.min(100, Math.max(0, n))) : ''; };
  const clampVkd = (s: string): string => { if (s === '') return ''; const n = Number(s); return Number.isFinite(n) ? String(Math.max(0, n)) : ''; };

  useEffect(() => {
    casesAdminApi.commissionSuggestion(caseId, date)
      .then(s => { if (s && typeof s.commission === 'number') { setSugg(s); if (!task.commission_pct) setPct(String(s.commission)); } })
      .catch(() => { /* без подсказки */ });
  }, [caseId, date, task.commission_pct]);

  // Сделка уже проведена (после согласования) — итог без правок.
  if (task.deal_id) {
    const income = Math.round((task.vkd || 0) * (task.commission_pct || 0) / 100);
    const typeLbl = DEAL_TYPE_OPTIONS.find(o => o.value === task.deal_type)?.label;
    return (
      <Box sx={{ mt: 1, p: 1.2, borderRadius: 1.5, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700 }}>
          Сделка проведена: {formatRub(task.vkd || 0)} ВКД · {task.commission_pct}% · доход {formatRub(income)}
          {typeLbl && ` · ${typeLbl}`}{task.deal_city && ` · ${task.deal_city}`}
        </Typography>
      </Box>
    );
  }

  // На согласовании у администратора — правки заблокированы (правит админ).
  if (task.approval_status === 'pending') {
    return (
      <Box sx={{ mt: 1, p: 1.2, borderRadius: 1.5, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 700, display: 'block' }}>
          Сделка на согласовании у администратора: {formatRub(task.vkd || 0)} ВКД
          {task.deal_type && ` · ${DEAL_TYPE_OPTIONS.find(o => o.value === task.deal_type)?.label}`}{task.deal_city && ` · ${task.deal_city}`}
        </Typography>
        {task.hasReceipt && (
          <Button size="small" startIcon={<DescriptionRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => openCaseReceipt(task.id).catch(() => setError('Не удалось открыть чек'))}
            sx={{ mt: 0.5, color: '#60A5FA', textTransform: 'none', fontSize: 12 }}>Открыть чек</Button>
        )}
        {error && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>{error}</Alert>}
      </Box>
    );
  }

  const income = vkd && pct ? Math.round(Number(vkd) * Number(pct) / 100) : 0;
  const rejected = task.approval_status === 'rejected';

  const save = () => {
    if (!vkd) return;
    setSaving(true); setError(null);
    casesAdminApi.setFinance(task.id, {
      vkd: Math.max(0, Number(vkd)),
      commissionPct: pct === '' ? undefined : Math.min(100, Math.max(0, Number(pct))),
      dealDate: date, city: city.trim(), dealType,
    })
      .then(() => onSaved(task.id))
      .catch(() => setError('Не удалось сохранить финансы — повторите'))
      .finally(() => setSaving(false));
  };

  const pickReceipt = () => fileRef.current?.click();
  const onReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/pdf$/i.test(f.type) && !/\.pdf$/i.test(f.name)) { setError('Чек об оплате нужен в формате PDF (как из банка).'); return; }
    setUploading(true); setError(null);
    uploadCaseReceipt(task.id, f)
      .then(() => onSaved(task.id))
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить чек'))
      .finally(() => setUploading(false));
  };

  return (
    <Box sx={{ mt: 1, p: 1.5, borderRadius: 1.5, background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.18)' }}>
      <Typography variant="caption" sx={{ color: '#C9A84C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1 }}>
        Финансы сделки
      </Typography>
      {rejected && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          Сделка возвращена администратором на доработку{task.reject_reason ? `: ${task.reject_reason}` : ''}. Исправьте данные и завершите заново.
        </Alert>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="ВКД, ₽" type="number" value={vkd}
          onChange={e => setVkd(e.target.value)} onBlur={() => setVkd(clampVkd)} sx={{ width: 120 }} />
        <TextField size="small" label="%" type="number" value={pct}
          onChange={e => setPct(e.target.value)} onBlur={() => setPct(clampPct)} sx={{ width: 72 }} />
        <TextField size="small" label="Дата" type="date" value={date} onChange={e => setDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 145 }} />
        <TextField size="small" label="Город" value={city} onChange={e => setCity(e.target.value)} sx={{ width: 160 }} />
        <TextField size="small" label="Тип" select value={dealType} onChange={e => setDealType(e.target.value)} sx={{ width: 130 }}>
          {DEAL_TYPE_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
        </TextField>
        <Button variant="contained" size="small" disabled={saving || !vkd} onClick={save}
          sx={{ background: 'linear-gradient(135deg, #C9A84C, #E2C97E)', color: '#0A0E1A', fontWeight: 800,
                '&.Mui-disabled': { background: 'rgba(201,168,76,0.3)', color: 'rgba(10,14,26,0.5)' } }}>
          {saving ? <CircularProgress size={16} sx={{ color: '#0A0E1A' }} /> : 'Сохранить'}
        </Button>
      </Box>
      {/* Чек об оплате (обязателен для завершения) */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1, flexWrap: 'wrap' }}>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onReceipt} />
        {task.hasReceipt ? (
          <>
            <Chip size="small" icon={<DescriptionRoundedIcon sx={{ fontSize: 15 }} />} label="Чек приложен"
              onClick={() => openCaseReceipt(task.id).catch(() => setError('Не удалось открыть чек'))}
              sx={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E', cursor: 'pointer', fontWeight: 700 }} />
            <Button size="small" onClick={pickReceipt} disabled={uploading} sx={{ color: '#94A3B8', textTransform: 'none', fontSize: 12 }}>
              {uploading ? 'Загрузка…' : 'Заменить'}
            </Button>
          </>
        ) : (
          <Button size="small" variant="outlined" startIcon={uploading ? <CircularProgress size={14} /> : <UploadFileRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={pickReceipt} disabled={uploading}
            sx={{ color: '#C9A84C', borderColor: 'rgba(201,168,76,0.4)', textTransform: 'none', fontWeight: 700 }}>
            Приложить чек (PDF)
          </Button>
        )}
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
        Заполните ВКД, город, тип и приложите чек (PDF). Затем переведите этап в «Завершено» — сделка уйдёт на согласование администратору и появится у агента после одобрения.
      </Typography>
    </Box>
  );
}
