import { api } from './apiClient';

export interface SupportTicketSummary {
  id: number;
  agent_id: number;
  agent_name: string;
  subject: string;
  status: 'open' | 'replied' | 'closed';
  created_at: string;
  updated_at: string;
  messages_count: number;
  last_message: string | null;
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  author_id: number;
  author_role: 'agent' | 'admin' | 'super_admin';
  author_name: string;
  text: string;
  attachments: string[];
  created_at: string;
}

export interface SupportTicketFull extends SupportTicketSummary {
  messages: SupportMessage[];
}

export const supportApi = {
  list: () => api.get<SupportTicketSummary[]>('/api/support'),
  get: (id: number) => api.get<SupportTicketFull>(`/api/support/${id}`),
  reply: (id: number, text: string, attachmentKeys: string[] = []) =>
    api.post<SupportTicketFull>(`/api/support/${id}/messages`, { text, attachmentKeys }),
  setStatus: (id: number, status: 'open' | 'replied' | 'closed') =>
    api.patch<{ ok: true }>(`/api/support/${id}/status`, { status }),
};
