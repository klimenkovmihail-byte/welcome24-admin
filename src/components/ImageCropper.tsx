/**
 * ImageCropper — модальная обрезка изображения перед загрузкой.
 *
 * Открывается с переданным File, юзер двигает/масштабирует картинку
 * через react-easy-crop, жмёт «Применить» → получаем Blob с обрезанной
 * областью. Соотношение сторон задаётся через aspect (по умолчанию 16/9
 * для обложек; 1 для аватарок).
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Slider, Button, IconButton, Stack,
} from '@mui/material';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';

interface Props {
  file: File | null;
  aspect?: number;          // 16/9 — обложки, 1 — аватары
  open: boolean;
  onClose: () => void;
  onApply: (blob: Blob, fileName: string) => void;
}

// Грузим картинку в HTMLImageElement (нужно для canvas-обрезки)
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

// Обрезка через canvas → Blob (jpeg качество 0.92, обычно 100-300КБ для cover 1600×900)
async function getCroppedBlob(imageSrc: string, area: Area, mimeType: string): Promise<Blob> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(area.width);
  canvas.height = Math.round(area.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context недоступен');
  ctx.drawImage(
    img,
    area.x, area.y, area.width, area.height,
    0, 0, area.width, area.height,
  );
  const type = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), type, 0.92);
  });
}

export default function ImageCropper({ file, aspect = 16 / 9, open, onClose, onApply }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Грузим File → ObjectURL
  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_a: Area, areaPx: Area) => {
    setAreaPixels(areaPx);
  }, []);

  const handleApply = async () => {
    if (!src || !areaPixels || !file) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, areaPixels, file.type);
      // Возвращаем как jpeg (если не было png) с тем же базовым именем
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const baseName = (file.name || 'image').replace(/\.[^.]+$/, '');
      onApply(blob, `${baseName}.${ext}`);
    } catch (e) {
      console.error('[crop] failed:', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 18, color: '#F1F5F9' }}>Настроить изображение</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: '#64748B' }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box sx={{ position: 'relative', width: '100%', height: 420, background: '#000', borderRadius: 2, overflow: 'hidden' }}>
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={true}
              objectFit="contain"
            />
          )}
        </Box>

        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2, px: 1 }}>
          <ZoomInRoundedIcon sx={{ color: '#94A3B8' }} />
          <Slider
            value={zoom}
            min={1}
            max={4}
            step={0.05}
            onChange={(_, v) => setZoom(Array.isArray(v) ? v[0] : v)}
            sx={{ color: '#C9A84C' }}
          />
          <Typography variant="caption" sx={{ color: '#94A3B8', minWidth: 36, textAlign: 'right' }}>
            {zoom.toFixed(2)}×
          </Typography>
        </Stack>

        <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 1, textAlign: 'center' }}>
          Перетаскивай картинку и крути колесо мыши для масштаба · соотношение сторон зафиксировано
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: '#64748B' }}>Отмена</Button>
        <Button variant="contained" onClick={handleApply} disabled={!areaPixels || busy}>
          {busy ? 'Обрабатываю…' : 'Применить и загрузить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
