import { Box } from '@mui/material';

interface LogoProps {
  variant?: 'full' | 'icon';
  size?: number;
  color?: string;
  /** Премиальная золотая заливка с градиентом. */
  premium?: boolean;
}

const FULL_SRC = '/logo.svg';
const ICON_SRC = '/logo-icon.png';

const FULL_ASPECT = 3760 / 1280; // ≈ 2.94

const PREMIUM_GOLD_GRADIENT =
  'linear-gradient(135deg, #FCE9A6 0%, #F0D277 28%, #E5C25A 52%, #D4AF37 78%, #C9A227 100%)';

export function LogoIcon({ size = 40, color = '#C9A84C', premium = false }: { size?: number; color?: string; premium?: boolean }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        background: premium ? PREMIUM_GOLD_GRADIENT : color,
        WebkitMaskImage: `url(${ICON_SRC})`,
        maskImage: `url(${ICON_SRC})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        flexShrink: 0,
        filter: premium ? 'drop-shadow(0 2px 8px rgba(201,168,76,0.35))' : undefined,
      }}
      aria-label="Welcome 24"
      role="img"
    />
  );
}

export default function Logo({ variant = 'full', size = 40, color = '#C9A84C', premium = false }: LogoProps) {
  if (variant === 'icon') {
    return <LogoIcon size={size} color={color} premium={premium} />;
  }
  return (
    <Box
      sx={{
        height: size,
        width: size * FULL_ASPECT,
        background: premium ? PREMIUM_GOLD_GRADIENT : color,
        WebkitMaskImage: `url(${FULL_SRC})`,
        maskImage: `url(${FULL_SRC})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        flexShrink: 0,
        filter: premium ? 'drop-shadow(0 2px 8px rgba(201,168,76,0.35))' : undefined,
      }}
      aria-label="Welcome 24"
      role="img"
    />
  );
}
