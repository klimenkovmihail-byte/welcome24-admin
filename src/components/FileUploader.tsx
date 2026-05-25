/**
 * FileUploader — загрузка файла в Yandex Object Storage через /api/upload.
 *
 * Принимает текущий URL (value), при загрузке файла шлёт multipart на бэк
 * и через onChange возвращает новый URL. Поле для ручного ввода URL
 * оставлено как fallback (если хочется вставить картинку с другого CDN).
 *
 * Использование:
 *   <FileUploader value={form.coverUrl} onChange={url => setForm(f => ({...f, coverUrl: url}))} type="cover" />
 */

import { useRef, useState } from 'react';
import { Box, Button, TextField, IconButton, Typography, CircularProgress, Alert } from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { API_BASE_URL, getToken, ApiError } from '../api/apiClient';

type UploadType = 'cover' | 'avatar' | 'doc' | 'other';

interface Props {
  value: string;
  onChange: (url: string) => void;
  type?: UploadType;
  /** MIME-маска для <input accept="..."> */
  accept?: string;
  label?: string;
  /** Скрыть ручной ввод URL */
  hideUrlField?: boolean;
}

export default function FileUploader({
  value, onChange, type = 'cover',
  accept = 'image/*', label = 'Обложка',
  hideUrlField = false,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // api.post не годится — нужен multipart, используем raw fetch
  const uploadFile = async (file: File) => {
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ApiError(data?.error || `HTTP ${res.status}`, res.status, data);
      }
      onChange(data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) uploadFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) uploadFile(f);
  };

  return (
    <Box>
      <Typography variant="caption" sx={{ color: '#94A3B8', display: 'block', mb: 1, fontWeight: 600 }}>
        {label}
      </Typography>

      {value ? (
        <Box sx={{
          position: 'relative', borderRadius: 2, overflow: 'hidden',
          border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(255,255,255,0.02)',
          mb: 1.5,
        }}>
          <Box
            component="img"
            src={value}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
          />
          <IconButton
            size="small"
            onClick={() => onChange('')}
            sx={{
              position: 'absolute', top: 6, right: 6,
              background: 'rgba(0,0,0,0.6)', color: '#fff',
              '&:hover': { background: 'rgba(239,68,68,0.8)' },
            }}
          >
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        <Box
          onClick={() => fileRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          sx={{
            cursor: uploading ? 'wait' : 'pointer',
            p: 3, mb: 1.5, borderRadius: 2,
            border: '1px dashed rgba(201,168,76,0.3)',
            background: 'rgba(201,168,76,0.03)',
            textAlign: 'center',
            transition: 'all 0.15s',
            '&:hover': { borderColor: '#C9A84C', background: 'rgba(201,168,76,0.08)' },
          }}
        >
          {uploading ? (
            <CircularProgress size={24} sx={{ color: '#C9A84C' }} />
          ) : (
            <>
              <CloudUploadRoundedIcon sx={{ fontSize: 32, color: '#C9A84C', opacity: 0.7, mb: 0.5 }} />
              <Typography variant="body2" sx={{ color: '#94A3B8', fontWeight: 600 }}>
                Перетащи файл или нажми для выбора
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                JPG, PNG, WebP, GIF — до 15 МБ
              </Typography>
            </>
          )}
        </Box>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        onChange={onPick}
        style={{ display: 'none' }}
      />

      {!hideUrlField && (
        <TextField
          fullWidth size="small"
          label="…или вставь URL картинки"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
        />
      )}

      {err && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setErr(null)}>{err}</Alert>}

      {value && !uploading && (
        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
          <Button size="small" onClick={() => fileRef.current?.click()} sx={{ color: '#C9A84C', fontSize: 12 }}>
            Заменить
          </Button>
        </Box>
      )}
    </Box>
  );
}
