import { api } from './apiClient';

export interface AiAnalyticsByTool {
  tool: string;
  requests: number;
  tokens: number;
  cost_usd: number;
}

export interface AiAnalyticsByDay {
  day: string;     // 'YYYY-MM-DD'
  requests: number;
  tokens: number;
}

export interface AiAnalyticsTopAgent {
  agent_id: number;
  agent_name: string | null;
  requests: number;
  tokens: number;
}

export interface AiAnalyticsResponse {
  from: string;
  to: string;
  days: number;
  totals: { requests: number; tokens: number; active_agents: number; cost_usd: number };
  byTool: AiAnalyticsByTool[];
  byDay: AiAnalyticsByDay[];
  topAgents: AiAnalyticsTopAgent[];
}

export const aiAnalyticsApi = {
  get: (days = 30) => api.get<AiAnalyticsResponse>(`/api/ai/analytics?days=${days}`),
};
