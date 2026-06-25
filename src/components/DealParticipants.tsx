// Ипотека: секция «Документы участников сделки» (заёмщики, до 5) — вид БРОКЕРА (админка).
// Зеркало портального компонента; бэк общий. Каждый участник: ФИО + телефоны/email
// (текст) + файлы по категориям (паспорт/снилс/дети/доходы/кредитная история).
import { useState } from 'react';
import {
  Box, Typography, Button, TextField, IconButton, Link, CircularProgress, Alert,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { casesAdminApi, type CaseItem, type DealParticipant } from '../api/cases';
import { uploadCaseAttachment, openCaseAttachment } from '../lib/attachments';

const MAX_PARTICIPANTS = 5;
const DOC_CATEGORIES = [
  { key: 'passport', label: 'Паспорт' },
  { key: 'snils', label: 'СНИЛС' },
  { key: 'children', label: 'Документы на детей' },
  { key: 'income', label: 'Доходы' },
  { key: 'credit', label: 'Кредитная история' },
];

export default function DealParticipants({ caseItem, myId, isAdmin, onChanged }: {
  caseItem: CaseItem; myId: number | null; isAdmin: boolean; onChanged: (c: CaseItem) => void;
}) {
  const participants = caseItem.dealParticipants || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<CaseItem>) => {
    setBusy(true); setErr(null);
    try { onChanged(await fn()); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setBusy(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>
          Документы участников ({participants.length}/{MAX_PARTICIPANTS})
        </Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} disabled={busy || participants.length >= MAX_PARTICIPANTS}
          onClick={() => run(() => casesAdminApi.addDealParticipant(caseItem.id))}
          sx={{ color: '#8B5CF6', textTransform: 'none' }}>
          Участник
        </Button>
      </Box>
      {err && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setErr(null)}>{err}</Alert>}
      {participants.length === 0 ? (
        <Typography variant="caption" sx={{ color: '#64748B' }}>
          Участники сделки не добавлены. Документы по каждому (заёмщик/созаёмщик) — здесь.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {participants.map((p, i) => (
            <ParticipantCard key={p.id} caseItem={caseItem} p={p} index={i} myId={myId} isAdmin={isAdmin} busy={busy}
              onPatch={(body) => run(() => casesAdminApi.updateDealParticipant(caseItem.id, p.id, body))}
              onRemove={() => { if (window.confirm('Удалить участника и все его документы?')) run(() => casesAdminApi.deleteDealParticipant(caseItem.id, p.id)); }}
              onUpload={async (category, files) => {
                if (!files.length) return;
                setBusy(true); setErr(null);
                try { let cur = caseItem; for (const f of files) cur = await uploadCaseAttachment(caseItem.id, f, { participantId: p.id, category }); onChanged(cur); }
                catch (e) { setErr(e instanceof Error ? e.message : 'Не удалось загрузить файл'); }
                finally { setBusy(false); }
              }}
              onDeleteFile={(attId) => { if (window.confirm('Удалить файл?')) run(() => casesAdminApi.deleteAttachment(caseItem.id, attId)); }} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function ParticipantCard({ caseItem, p, index, myId, isAdmin, busy, onPatch, onRemove, onUpload, onDeleteFile }: {
  caseItem: CaseItem; p: DealParticipant; index: number; myId: number | null; isAdmin: boolean; busy: boolean;
  onPatch: (body: { name?: string; phones?: string; email?: string }) => void;
  onRemove: () => void;
  onUpload: (category: string, files: File[]) => void;
  onDeleteFile: (attId: number) => void;
}) {
  const [name, setName] = useState(p.name);
  const [phones, setPhones] = useState(p.phones);
  const [email, setEmail] = useState(p.email);
  const saveName = () => { if (name !== p.name) onPatch({ name }); };
  const savePhones = () => { if (phones !== p.phones) onPatch({ phones }); };
  const saveEmail = () => { if (email !== p.email) onPatch({ email }); };

  const filesFor = (cat: string) => (caseItem.attachments || []).filter(a => a.participant_id === p.id && a.category === cat);

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(139,92,246,0.25)', background: 'rgba(139,92,246,0.04)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PersonRoundedIcon sx={{ fontSize: 18, color: '#8B5CF6' }} />
        <Typography variant="caption" sx={{ color: '#A78BFA', fontWeight: 700 }}>Участник {index + 1}</Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" disabled={busy} onClick={onRemove} sx={{ color: '#64748B', p: 0.3, '&:hover': { color: '#EF4444' } }}>
          <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <TextField size="small" label="ФИО" value={name} onChange={e => setName(e.target.value)} onBlur={saveName} sx={{ flex: '2 1 220px' }} />
        <TextField size="small" label="Телефоны" value={phones} onChange={e => setPhones(e.target.value)} onBlur={savePhones} placeholder="+7 …, +7 …" sx={{ flex: '1 1 160px' }} />
        <TextField size="small" label="Email" value={email} onChange={e => setEmail(e.target.value)} onBlur={saveEmail} sx={{ flex: '1 1 160px' }} />
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {DOC_CATEGORIES.map(cat => {
          const files = filesFor(cat.key);
          return (
            <Box key={cat.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#94A3B8', minWidth: 150, pt: 0.8 }}>{cat.label}</Typography>
              <Box sx={{ flex: 1 }}>
                {files.length === 0 ? (
                  <Typography variant="caption" sx={{ color: '#475569' }}>—</Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                    {files.map(at => (
                      <Box key={at.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <DescriptionRoundedIcon sx={{ fontSize: 15, color: '#94A3B8' }} />
                        <Link component="button" type="button"
                          onClick={() => { openCaseAttachment(caseItem.id, at).catch(() => {}); }}
                          sx={{ color: '#E2C97E', flex: 1, fontSize: 12.5, textAlign: 'left', textDecoration: 'none', background: 'none', border: 0, cursor: 'pointer', p: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>
                          {at.name}
                        </Link>
                        {(at.uploader_id === myId || isAdmin) && (
                          <IconButton size="small" disabled={busy} onClick={() => onDeleteFile(at.id)} sx={{ color: '#64748B', p: 0.2, '&:hover': { color: '#EF4444' } }}>
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
              <Button component="label" size="small" disabled={busy}
                startIcon={busy ? <CircularProgress size={12} /> : <AttachFileRoundedIcon sx={{ fontSize: 16 }} />}
                sx={{ color: '#8B5CF6', textTransform: 'none', minWidth: 0, flexShrink: 0 }}>
                Файл
                <input type="file" hidden multiple onChange={e => { onUpload(cat.key, Array.from(e.target.files || [])); e.target.value = ''; }} />
              </Button>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
