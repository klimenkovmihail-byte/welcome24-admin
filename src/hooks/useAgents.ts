import { useQuery } from '@tanstack/react-query';
import { agentsApi } from '../api/agents';
import type { Agent } from '../types';

// Ключ общего кэша списка агентов. После мутаций агента инвалидировать:
//   queryClient.invalidateQueries({ queryKey: AGENTS_QUERY_KEY })
export const AGENTS_QUERY_KEY = ['agents'] as const;

// Один фетч списка агентов на все экраны (Cases/Deals/Shares и др.) вместо
// повторной загрузки ~800 агентов на каждом. Кэш живёт 5 мин (см. queryClient).
export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: () => agentsApi.list(),
  });
}
