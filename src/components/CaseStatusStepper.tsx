import { Box, Typography, Tooltip } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { STATUS_RU, type TaskTrack } from '../api/cases';

// Линейные «дорожки» этапов (как колонки Trello). Терминальные «отказные»
// статусы вынесены отдельной кнопкой, чтобы не ломать линейность.
const FLOW: Record<TaskTrack, string[]> = {
  legal: ['check', 'contract', 'deposit', 'dkp', 'deal', 'act', 'done'],
  mortgage: ['consultation', 'approval', 'approved', 'issued'],
};
const CANCEL_STATUS: Record<TaskTrack, string> = {
  legal: 'cancelled',
  mortgage: 'rejected',
};

/** Горизонтальный stepper этапов сделки: клик по этапу двигает задачу.
 *  Пройденные — зелёные, текущий — золотой, будущие — серые. */
export default function CaseStatusStepper({
  track, status, onChange,
}: { track: TaskTrack; status: string; onChange: (s: string) => void }) {
  const flow = FLOW[track];
  const cancelStatus = CANCEL_STATUS[track];
  const isCancelled = status === cancelStatus || status === 'cancelled';
  const currentIdx = flow.indexOf(status);

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5, flexWrap: 'wrap' }}>
      {flow.map((s, i) => {
        const done = !isCancelled && currentIdx > i;
        const active = !isCancelled && currentIdx === i;
        const color = done ? '#22C55E' : active ? '#C9A84C' : '#475569';
        const bg = done ? 'rgba(34,197,94,0.12)' : active ? 'rgba(201,168,76,0.18)' : 'rgba(255,255,255,0.03)';
        // «Завершено» (legal) проводит сделку в систему — требуем подтверждение.
        const handleClick = () => {
          if (s === 'done' && track === 'legal') {
            const ok = window.confirm(
              'Перевести в «Завершено»?\n\n' +
              'Сделка будет проведена в систему: запись появится у агента в портале, ' +
              'учтётся в его комиссии и MLM-доходе. Делайте это только после полного ' +
              'расчёта клиента (продавца/покупателя) с компанией.\n\n' +
              'Действие необратимо из заявки (отменить сделку можно только в разделе «Сделки»).'
            );
            if (!ok) return;
          }
          onChange(s);
        };
        return (
          <Tooltip key={s} title={`Перевести: ${STATUS_RU[s] || s}`}>
            <Box
              onClick={handleClick}
              sx={{
                flex: '1 1 100px', minWidth: 96, maxWidth: 200, cursor: 'pointer',
                px: 1, py: 0.8, borderRadius: 1.5,
                background: bg, border: `1px solid ${color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
                transition: 'all 0.15s',
                '&:hover': { borderColor: color, background: active ? bg : 'rgba(201,168,76,0.08)' },
              }}
            >
              {done && <CheckRoundedIcon sx={{ fontSize: 14, color, flexShrink: 0 }} />}
              <Typography sx={{ color, fontWeight: active ? 800 : 600, fontSize: 11, lineHeight: 1.2, textAlign: 'center' }}>
                {STATUS_RU[s] || s}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
      <Tooltip title={isCancelled ? STATUS_RU[status] : `Отметить: ${STATUS_RU[cancelStatus]}`}>
        <Box
          onClick={() => onChange(cancelStatus)}
          sx={{
            px: 1, py: 0.8, borderRadius: 1.5, cursor: 'pointer',
            background: isCancelled ? 'rgba(239,68,68,0.18)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${isCancelled ? '#EF4444' : '#475569'}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
            '&:hover': { borderColor: '#EF4444' },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 14, color: isCancelled ? '#EF4444' : '#64748B' }} />
          <Typography variant="caption" sx={{ color: isCancelled ? '#EF4444' : '#64748B', fontWeight: isCancelled ? 800 : 600, fontSize: 11 }}>
            {STATUS_RU[cancelStatus]}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
