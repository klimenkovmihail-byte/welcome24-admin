/**
 * api/cases (админка) — Заявки специалистам. Юрист/брокер: очередь + мои задачи + статусы.
 */
import { api } from './apiClient';

export type TaskTrack = 'legal' | 'mortgage';
export type TaskType = 'doc_check' | 'contract' | 'deposit' | 'dkp' | 'mortgage';

export interface CaseTask {
  id: number;
  case_id: number;
  type: TaskType;
  track: TaskTrack;
  assignee_id: number | null;
  assignee_name: string | null;
  status: string;
  vkd: number | null;
  commission_pct: number | null;
  deal_date: string | null;
  deal_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CaseAttachment {
  id: number;
  case_id: number;
  uploader_id: number | null;
  uploader_name: string | null;
  name: string;
  url: string;
  size: number;
  created_at: string;
}

export interface CaseItem {
  id: number;
  agent_id: number;
  agent_name?: string;
  client_name: string;
  object_address: string;
  city: string;
  note: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  tasks: CaseTask[];
  attachments: CaseAttachment[];
}

export interface QueueTask {
  task_id: number;
  case_id: number;
  type: TaskType;
  track: TaskTrack;
  status: string;
  client_name: string;
  object_address: string;
  city: string;
  agent_id?: number;
  agent_name?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  vkd?: number | null;
  commission_pct?: number | null;
  deal_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export const TYPE_LABEL: Record<TaskType, string> = {
  doc_check: 'Проверка документов',
  contract: 'Договор',
  deposit: 'Задаток / аванс',
  dkp: 'ДКП',
  mortgage: 'Ипотека',
};

export const STATUS_RU: Record<string, string> = {
  // legal — полная воронка
  check: 'Проверка документов', contract: 'Договор', deposit: 'Задаток / аванс',
  dkp: 'ДКП', deal: 'Сделка', act: 'Акт', done: 'Завершено',
  new: 'Новая', in_progress: 'В работе', cancelled: 'Отменена',
  // mortgage
  consultation: 'Консультация', approval: 'Заявка на одобрение',
  approved: 'Одобрено', rejected: 'Отказ', issued: 'Ипотека выдана',
};

// Статусы по дорожке — для кнопок смены статуса исполнителем.
export const TRACK_STATUSES: Record<TaskTrack, string[]> = {
  legal: ['check', 'contract', 'deposit', 'dkp', 'deal', 'act', 'done', 'cancelled'],
  mortgage: ['consultation', 'approval', 'approved', 'rejected', 'issued', 'cancelled'],
};

export const casesAdminApi = {
  queue: (track?: TaskTrack) =>
    api.get<QueueTask[]>(`/api/cases/queue/list${track ? `?track=${track}` : ''}`),
  assigned: () => api.get<QueueTask[]>('/api/cases/assigned/list'),
  get: (id: number) => api.get<CaseItem>(`/api/cases/${id}`),
  take: (taskId: number) => api.post<CaseItem>(`/api/cases/tasks/${taskId}/take`, {}),
  updateTask: (taskId: number, body: { status?: string; assigneeId?: number | null }) =>
    api.patch<CaseItem>(`/api/cases/tasks/${taskId}`, body),
  setFinance: (taskId: number, body: { vkd: number; commissionPct?: number; dealDate?: string }) =>
    api.patch<CaseItem>(`/api/cases/tasks/${taskId}/finance`, body),
  commissionSuggestion: (caseId: number, date?: string) =>
    api.get<{ ytdVkdBefore: number; commission: number; level: number }>(`/api/cases/${caseId}/commission-suggestion${date ? `?date=${date}` : ''}`),
  analytics: () => api.get<CaseAnalytics>('/api/cases/analytics'),
  addAttachment: (caseId: number, body: { name: string; url: string; size?: number }) =>
    api.post<CaseItem>(`/api/cases/${caseId}/attachments`, body),
  deleteAttachment: (caseId: number, attId: number) =>
    api.del<CaseItem>(`/api/cases/${caseId}/attachments/${attId}`),
  messages: (caseId: number, after = 0) =>
    api.get<CaseMessage[]>(`/api/cases/${caseId}/messages?after=${after}`),
  sendMessage: (caseId: number, payload: { body?: string; attachmentUrl?: string; attachmentName?: string }) =>
    api.post<CaseMessage>(`/api/cases/${caseId}/messages`, payload),
};

export interface CaseMessage {
  id: number;
  case_id: number;
  sender_id: number | null;
  sender_name: string | null;
  sender_role: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export interface CaseSpecialistRow {
  id: number; name: string; track: TaskTrack;
  total: number; active: number; done: number; vkd: number; income: number;
}
export interface CaseAnalytics {
  scope: 'admin' | 'specialist';
  totals: { total: number; active: number; closedThisMonth: number; provenDeals: number; provenVkd: number; provenIncome: number };
  stages: Record<string, number>;
  bySpecialist?: CaseSpecialistRow[];
  company?: { queue: number; stages: Record<string, number> };
  stuck?: number;
}
