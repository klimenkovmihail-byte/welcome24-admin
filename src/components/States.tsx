import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

// Единый экран ошибки загрузки: приглушённо-красная иконка, текст и опц.
// кнопка «Повторить» — вместо тихого проглатывания ошибки.
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Box sx={{ py: 6, px: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, textAlign: 'center' }}>
      <ErrorOutlineRoundedIcon sx={{ fontSize: 48, color: 'rgba(239,68,68,0.7)' }} />
      <Typography sx={{ color: '#94A3B8', fontWeight: 600, fontSize: 15, maxWidth: 420 }}>
        {message || 'Не удалось загрузить данные'}
      </Typography>
      {onRetry && (
        <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={onRetry} sx={{ mt: 1 }}>
          Повторить
        </Button>
      )}
    </Box>
  );
}

// Единое «пустое состояние»: иконка + заголовок + подсказка + опц. действие.
// Заменяет ручные сборки Box+Typography с разными оттенками и отступами.
export function EmptyState({ icon, title, hint, action }: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
      <Box sx={{ color: '#64748B', mb: 1, '& svg': { fontSize: 48 } }}>
        {icon || <InboxRoundedIcon />}
      </Box>
      <Typography sx={{ color: '#94A3B8', fontWeight: 600, fontSize: 15 }}>
        {title}
      </Typography>
      {hint && (
        <Typography sx={{ color: '#64748B', fontSize: 13, mt: 0.5, maxWidth: 480, mx: 'auto' }}>
          {hint}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
