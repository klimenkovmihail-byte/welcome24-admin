import type { ReactNode } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, CircularProgress,
} from '@mui/material';

/**
 * Единый themed-confirm — замена системного window.confirm(), чьи белые окна ОС
 * ломали тёмную тему штаба. Мини-окно maxWidth xs. Кнопка подтверждения —
 * autoFocus; danger красит её ERROR-тоном (удаления/необратимое), иначе золото.
 * loading дизейблит кнопки и показывает спиннер, блокируя закрытие. Escape/бэкдроп = onClose.
 */
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Пояснение под заголовком (строка или произвольный контент). */
  text?: ReactNode;
  /** Подпись кнопки подтверждения (default «Подтвердить»). */
  confirmLabel?: string;
  /** Подпись кнопки отмены (default «Отмена»). */
  cancelLabel?: string;
  /** Красная кнопка подтверждения ERROR-тоном (необратимые действия). */
  danger?: boolean;
  /** Дизейбл + спиннер на кнопке подтверждения, пока идёт запрос. */
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open, title, text, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена',
  danger = false, loading = false, onConfirm, onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => { if (!loading) onClose(); void reason; }}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9', pb: text ? 1 : 2 }}>
        {title}
      </DialogTitle>
      {text && (
        <DialogContent sx={{ pb: 1 }}>
          <Typography component="div" variant="body2" sx={{ color: '#94A3B8' }}>
            {text}
          </Typography>
        </DialogContent>
      )}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={loading} sx={{ color: '#94A3B8' }}>
          {cancelLabel}
        </Button>
        <Button
          variant="contained"
          autoFocus
          disabled={loading}
          onClick={onConfirm}
          startIcon={loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : undefined}
          sx={danger ? {
            background: '#EF4444', color: '#fff', fontWeight: 700,
            '&:hover': { background: '#DC2626' },
          } : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
