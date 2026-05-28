/**
 * api/aiPrompts — модерация AI-промптов в админке.
 */

import { api } from './apiClient';

export interface PromptConfig {
  toolKey: string;
  label: string;
  systemPrompt: string;
  extraInstructions: string;
  defaultSystem: string;
  isCustomized: boolean;
  updatedAt: string | null;
  updatedBy: number | null;
}

export interface PreviewResult {
  system: string;
  userPrompt: string;
  output: string;
  stub: boolean;
  tokens: { input_tokens: number; output_tokens: number };
}

export interface KnowledgeBlock {
  id: number;
  tool_key: string;
  title: string;
  content: string;
  order_idx: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export const aiPromptsApi = {
  list:  () => api.get<PromptConfig[]>('/api/ai/prompts'),
  save:  (toolKey: string, payload: { system_prompt: string; extra_instructions: string }) =>
    api.put<PromptConfig>(`/api/ai/prompts/${toolKey}`, payload as unknown as Record<string, unknown>),
  reset: (toolKey: string) =>
    api.post<PromptConfig>(`/api/ai/prompts/${toolKey}/reset`),
  preview: (payload: { tool: string; input: Record<string, unknown>; system_prompt?: string; extra_instructions?: string }) =>
    api.post<PreviewResult>('/api/ai/preview', payload as unknown as Record<string, unknown>),

  // База знаний — блоки которые автоматически инжектятся в system-prompt
  listKnowledge: (tool: string) =>
    api.get<KnowledgeBlock[]>(`/api/ai/knowledge?tool=${encodeURIComponent(tool)}`),
  createKnowledge: (payload: { tool: string; title: string; content: string; orderIdx?: number; active?: boolean }) =>
    api.post<KnowledgeBlock>('/api/ai/knowledge', payload as unknown as Record<string, unknown>),
  updateKnowledge: (id: number, payload: { title?: string; content?: string; orderIdx?: number; active?: boolean }) =>
    api.patch<KnowledgeBlock>(`/api/ai/knowledge/${id}`, payload as unknown as Record<string, unknown>),
  deleteKnowledge: (id: number) =>
    api.del<{ ok: true }>(`/api/ai/knowledge/${id}`),
};
