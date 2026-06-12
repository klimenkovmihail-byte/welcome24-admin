import { QueryClient } from '@tanstack/react-query';

// Слой данных админки. apiClient уже сам ретраит GET, поэтому retry: 0 —
// иначе попытки перемножаются. Общий кэш убирает повторные тяжёлые фетчи
// (список ~800 агентов тянулся заново на каждом экране).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // «свежесть» 1 мин → возврат на экран без рефетча
      gcTime: 5 * 60_000,          // держим в кэше 5 мин после ухода
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
});
