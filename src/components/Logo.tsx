import { Box } from '@mui/material';

interface LogoProps {
  variant?: 'full' | 'icon';
  /** Height in px. For icon: side of the square. For full: height of the lockup. */
  size?: number;
  /** Any CSS color. The logo will be tinted to this color via CSS mask. */
  color?: string;
}

const ICON_SRC = '/logo-icon.png';
const FULL_SRC = '/logo-full.png';

/** Renders the sokraschyonny (icon-only) mark — diamond + 3 towers. */
export function LogoIcon({ size = 40, color = '#C9A84C' }: { size?: number; color?: string }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url(${ICON_SRC})`,
        maskImage: `url(${ICON_SRC})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        flexShrink: 0,
      }}
      aria-label="Welcome 24"
      role="img"
    />
  );
}

/** Renders the full lockup (icon + WELCOME 24 text). */
export default function Logo({ variant = 'full', size = 40, color = '#C9A84C' }: LogoProps) {
  const src = variant === 'full' ? FULL_SRC : ICON_SRC;
  // Original asset aspect ratios:
  //  - icon  ≈ 1:1 (square-ish)
  //  - full  ≈ 4:1 (wider than tall)
  const width = variant === 'full' ? size * 4 : size;
  return (
    <Box
      sx={{
        width,
        height: size,
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'left center',
        maskPosition: 'left center',
        flexShrink: 0,
      }}
      aria-label="Welcome 24"
      role="img"
    />
  );
}
