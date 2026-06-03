import { useState } from 'react';
import { Avatar, Box, type SxProps, type Theme } from '@mui/material';
import { thumbUrl } from '../utils/thumb';

// Аватар: инициалы сразу + лёгкое превью (lazy) с плавным проявлением.
// При 404 превью → откат на оригинал, затем на инициалы.
export default function SmartAvatar({
  src, name, size = 48, fontSize, sx,
}: {
  src?: string | null;
  name?: string;
  size?: number;
  fontSize?: number;
  sx?: SxProps<Theme>;
}) {
  const initials = (name || '').trim().split(/\s+/).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const thumb = thumbUrl(src);
  const [phase, setPhase] = useState<'thumb' | 'full' | 'none'>(thumb ? 'thumb' : 'none');
  const [loaded, setLoaded] = useState(false);
  const url = phase === 'thumb' ? thumb : phase === 'full' ? src : null;

  return (
    <Avatar sx={{ width: size, height: size, fontWeight: 800, fontSize: fontSize ?? Math.round(size * 0.36), position: 'relative', overflow: 'hidden', ...sx }}>
      {initials || '—'}
      {url && (
        <Box
          component="img"
          src={url}
          alt={name || ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            if (phase === 'thumb') { setPhase('full'); setLoaded(false); }
            else setPhase('none');
          }}
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.35s ease',
          }}
        />
      )}
    </Avatar>
  );
}
