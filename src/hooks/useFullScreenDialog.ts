import { useMediaQuery, useTheme } from '@mui/material';

// Мобильные диалоги штаба: на телефоне (xs) диалог раскрывается во весь экран.
// paperSafeArea докидывается в sx у Paper — убирает скругление и держит паддинги
// под iOS-«чёлку» (env(safe-area-inset-*)). На десктопе paperSafeArea пуст.
// Штаб/CEO часто с телефона, поэтому формы не должны быть тесными окошками.
export function useFullScreenDialog(): { fullScreen: boolean; paperSafeArea: object } {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const paperSafeArea = fullScreen
    ? { pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)', borderRadius: 0 }
    : {};
  return { fullScreen, paperSafeArea };
}
