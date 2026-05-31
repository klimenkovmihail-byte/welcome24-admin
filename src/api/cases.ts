/**
 * api/cases (админка) — Заявки специалистам. Юрист/брокер: очередь + мои задачи + статусы.
 */
import { api } from './apiClient';

export type TaskTrack = 'legal' | 'mortgage';
export type TaskType = 'doc_check' | 'contract' | 'deposit' | 'mortgage';

export interface CaseTask {
  id: number;
  case_id: number;
  type: TaskType;
  track: TaskTrack;
  assignee_id: number | null;
  assignee_name: string | null;
  status: string;
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
  created_at?: string;
}

export const TYPE_LABEL: Record<TaskType, string> = {
  doc_check: 'Проверка документов',
  contract: 'Договор',
  deposit: 'Задаток / аванс',
  mortgage: 'Ипотека',
};

export const STATUS_RU: Record<string, string> = {
  new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена',
  consultation: 'Консультация', approval: 'Заявка на одобрение',
  approved: 'Одобрено', rejected: 'Отказ', issued: 'Ипотека выдана',
};

// Статусы по дорожке — для кнопок смены статуса исполнителем.
export const TRACK_STATUSES: Record<TaskTrack, string[]> = {
  legal: ['new', 'in_progress', 'done', 'cancelled'],
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
  addAttachment: (caseId: number, body: { name: string; url: string; size?: number }) =>
    api.post<CaseItem>(`/api/cases/${caseId}/attachments`, body),
  deleteAttachment: (caseId: number, attId: number) =>
    api.del<CaseItem>(`/api/cases/${caseId}/attachments/${attId}`),
  messages: (caseId: number, after = 0) =>
    api.get<CaseMessage[]>(`/api/cases/${caseId}/messages?after=${after}`),
  sendMessage: (caseId: number, body: string) =>
    api.post<CaseMessage>(`/api/cases/${caseId}/messages`, { body }),
};

export interface CaseMessage {
  id: number;
  case_id: number;
  sender_id: number | null;
  sender_name: string | null;
  body: string;
  created_at: string;
}
