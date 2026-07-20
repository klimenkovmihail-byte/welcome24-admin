import { useEffect, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Chip, Button, TextField, IconButton, Collapse,
  CircularProgress, Alert, Divider, Table, TableHead, TableRow, TableCell, TableBody,
} from '@mui/material';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import { sharesApi, type ShareEntitlement, type ShareParams, type SharePurchaseRow } from '../api/shares';
import { formatRub } from '../utils/format';

/** Этап 2: очередь «к начислению» (бонусы за первую сделку/рекрута) + право на покупку (5% ВКД). */
export default function SharesStage2({ onGranted }: { onGranted?: () => void }) {
  const [params, setParams] = useState<ShareParams | null>(null);
  const [ents, setEnts] = useState<ShareEntitlement[] | null>(null);
  const [purchase, setPurchase] = useState<{ from: string; to: string; price: number; rows: SharePurchaseRow[] } | null>(null);
  const [openEnt, setOpenEnt] = useState(true);
  const [openBuy, setOpenBuy] = useState(false);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadEnts = useCallback(() => {
    sharesApi.entitlements().then(list => {
      setEnts(list);
      sharesApi.params().then(p => {
        setParams(p);
        const defQty = Math.max(1, Math.round(p.bonusRub / (p.price || 1)));
        setQty(q => { const n = { ...q }; for (const e of list) if (n[e.id] == null) n[e.id] = String(defQty); return n; });
      }).catch(() => {});
    }).catch(() => setError('Не удалось загрузить очередь начислений'));
  }, []);
  const loadPurchase = useCallback((f?: string, t?: string) => {
    sharesApi.purchaseEligibility(f, t).then(d => { setPurchase(d); setFrom(d.from); setTo(d.to); }).catch(() => {});
  }, []);
  useEffect(() => { loadEnts(); loadPurchase(); }, [loadEnts, loadPurchase]);

  const grant = (e: ShareEntitlement) => {
    const q = Math.max(1, Math.round(Number(qty[e.id]) || 0));
    if (!q) { setError('Укажите количество акций'); return; }
    setBusyId(e.id); setError(null);
    sharesApi.grantEntitlement(e.id, { quantity: q })
      .then(() => { loadEnts(); onGranted?.(); })
      .catch(err => setError(err instanceof Error ? err.message : 'Не удалось начислить'))
      .finally(() => setBusyId(null));
  };
  const skip = (e: ShareEntitlement) => {
    setBusyId(e.id); setError(null);
    sharesApi.skipEntitlement(e.id).then(() => loadEnts()).catch(() => {}).finally(() => setBusyId(null));
  };

  const kindLabel = (k: string) => k === 'recruit' ? 'за рекрута' : 'за первую сделку';

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* === К НАЧИСЛЕНИЮ === */}
      {ents && ents.length > 0 && (
        <Card sx={{ border: '1px solid rgba(201,168,76,0.3)', background: 'rgba(201,168,76,0.05)' }}>
          <Box onClick={() => setOpenEnt(o => !o)} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
            <CardGiftcardRoundedIcon sx={{ color: '#C9A84C' }} />
            <Chip label={ents.length} sx={{ background: '#C9A84C', color: '#0A0E1A', fontWeight: 900, height: 24 }} />
            <Typography sx={{ fontWeight: 800, color: '#E2C97E' }}>Акции к начислению</Typography>
            <Typography variant="caption" sx={{ color: '#94A3B8', ml: 0.5 }}>бонус {params ? formatRub(params.bonusRub) : ''} за первую сделку — агенту и пригласившему</Typography>
            <Box sx={{ flex: 1 }} />
            <IconButton size="small" sx={{ color: '#94A3B8' }}><KeyboardArrowDownRoundedIcon sx={{ transform: openEnt ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /></IconButton>
          </Box>
          <Collapse in={openEnt}>
            <Divider sx={{ borderColor: 'rgba(201,168,76,0.15)' }} />
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {ents.map(e => {
                const busy = busyId === e.id;
                return (
                  <Box key={e.id} sx={{ p: 1.5, borderRadius: 1.5, background: 'rgba(15,22,41,0.6)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <Typography sx={{ fontWeight: 700, color: '#F1F5F9' }}>
                        {e.agent_name || 'Агент'}
                        <Chip size="small" label={kindLabel(e.kind)} sx={{ ml: 1, height: 18, fontSize: 10, background: e.kind === 'recruit' ? 'rgba(67,97,238,0.15)' : 'rgba(34,197,94,0.15)', color: e.kind === 'recruit' ? '#60A5FA' : '#22C55E', fontWeight: 700 }} />
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#94A3B8' }}>
                        {e.kind === 'recruit' ? `рекрут: ${e.source_name || '—'} · ` : ''}первая сделка {e.deal_date || ''} · ВКД {e.deal_vkd ? formatRub(e.deal_vkd) : '—'} → бонус {formatRub(e.amount_rub)}
                      </Typography>
                    </Box>
                    <TextField size="small" label="Акций" type="number" value={qty[e.id] ?? ''} onChange={ev => setQty(q => ({ ...q, [e.id]: ev.target.value }))} sx={{ width: 90 }} />
                    <Button size="small" variant="contained" disabled={busy} onClick={() => grant(e)}
                      sx={{ background: 'linear-gradient(135deg,#C9A84C,#E2C97E)', color: '#0A0E1A', fontWeight: 800 }}>
                      {busy ? <CircularProgress size={14} sx={{ color: '#0A0E1A' }} /> : 'Начислить'}
                    </Button>
                    <Button size="small" color="inherit" disabled={busy} onClick={() => skip(e)} sx={{ color: '#64748B', textTransform: 'none' }}>Пропустить</Button>
                  </Box>
                );
              })}
              <Typography variant="caption" sx={{ color: '#64748B', mt: 0.5 }}>
                Кол-во акций — по курсу {params ? formatRub(params.price) : ''} (правьте вручную). Начисление = перевод от основателя агенту.
              </Typography>
            </Box>
          </Collapse>
        </Card>
      )}

      {/* === ПРАВО НА ПОКУПКУ === */}
      <Card>
        <Box onClick={() => setOpenBuy(o => !o)} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
          <Typography sx={{ fontWeight: 800, color: '#F1F5F9' }}>Право на покупку акций</Typography>
          <Typography variant="caption" sx={{ color: '#94A3B8' }}>{params?.purchasePct ?? 5}% от ВКД периода · скидка {params?.discountPct ?? 10}% · курс {formatRub(purchase?.price || params?.price || 0)}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" sx={{ color: '#94A3B8' }}><KeyboardArrowDownRoundedIcon sx={{ transform: openBuy ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} /></IconButton>
        </Box>
        <Collapse in={openBuy}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ color: '#94A3B8' }}>Период ВКД:</Typography>
              <TextField size="small" type="date" value={from} onChange={e => setFrom(e.target.value)} sx={{ width: 150 }} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField size="small" type="date" value={to} onChange={e => setTo(e.target.value)} sx={{ width: 150 }} slotProps={{ inputLabel: { shrink: true } }} />
              <Button size="small" variant="outlined" onClick={() => loadPurchase(from, to)} sx={{ color: '#C9A84C', borderColor: 'rgba(201,168,76,0.4)' }}>Пересчитать</Button>
            </Box>
            {purchase && purchase.rows.length > 0 ? (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Агент', 'ВКД периода', `Доступно (${params?.purchasePct ?? 5}%)`, 'Цена со скидкой', 'Макс. акций'].map(h => (
                      <TableCell key={h} sx={{ color: '#64748B', fontWeight: 700, fontSize: 11 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchase.rows.map(r => (
                    <TableRow key={r.agentId}>
                      <TableCell sx={{ color: '#F1F5F9' }}>{r.name}{r.city ? <Typography component="span" variant="caption" sx={{ color: '#64748B', ml: 0.5 }}>· {r.city}</Typography> : ''}</TableCell>
                      <TableCell sx={{ color: '#C9A84C', fontWeight: 700 }}>{formatRub(r.vkd)}</TableCell>
                      <TableCell sx={{ color: '#F1F5F9' }}>{formatRub(r.amountRub)}</TableCell>
                      <TableCell sx={{ color: '#94A3B8' }}>{formatRub(Math.round(r.discountedPrice))}</TableCell>
                      <TableCell><Chip label={`${r.maxShares} шт`} size="small" sx={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 800 }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Typography variant="caption" sx={{ color: '#64748B' }}>За период нет агентов с правом на покупку.</Typography>
            )}
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
}
