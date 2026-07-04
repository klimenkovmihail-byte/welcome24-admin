/**
 * api/adRequests (админка) — Отдел рекламы: простые заявки (квота/подключение/ошибки)
 * + база подключений агентов к площадкам + метрики.
 */
import { api } from './apiClient';

export type AdKind = 'quota' | 'connect' | 'fix' | 'from_package';

// Инфо о квоте, из которой списывается заявка from_package.
export interface PkgQuota {
  entry_id: number; category_key: string; category_label: string;
  platform: string; platform_label: string; city: string;
  bought: number; used: number; remaining: number; starts_at: string; ends_at: string; active: boolean;
}
export type AdStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type AdPlatform = 'avito' | 'cian' | 'domclick' | 'yandex';
export type ConnectPlatform = 'cian' | 'avito' | 'domclick';

export interface AdAttachment {
  id: number; request_id: number; uploader_id: number | null; uploader_name: string | null;
  name: string; url: string; size: number; created_at: string;
}
export interface AdRequest {
  id: number;
  agent_id: number;
  agent_name?: string;
  kind: AdKind;
  kind_label: string;
  object_ref: string;
  region: string;
  platforms: AdPlatform[];
  comment: string;
  status: AdStatus;
  assignee_id: number | null;
  assignee_name: string | null;
  created_at: string;
  updated_at: string;
  unread?: number;
  attachments: AdAttachment[];
  pkg?: PkgQuota | null;   // только для from_package
  connect_value?: string;  // ЦИАН ID/почта или телефон (для connect)
}
export interface AdMessage {
  id: number; request_id: number; sender_id: number | null; sender_name: string | null;
  sender_role: string | null; body: string; attachment_url: string | null; attachment_name: string | null; created_at: string;
}
export interface AdEvent { id: number; kind: string; text: string; actor_name: string | null; created_at: string; }

export interface AdMeta {
  kinds: { key: AdKind; label: string; group?: string }[];
  platforms: { key: AdPlatform; label: string }[];
  connectPlatforms: ConnectPlatform[];
  statuses: { key: AdStatus; label: string }[];
}

export interface RosterAgent { id: number; name: string; city: string; platforms: Record<ConnectPlatform, boolean>; }
export interface PlatformStat { platform: ConnectPlatform; label: string; connected: number; total: number; pct: number; thisMonth: number; }
export interface PlatformStats { totalAgents: number; byPlatform: PlatformStat[]; }
export interface AdAnalytics {
  total: number; queue: number;
  byStatus: Record<AdStatus, number>;
  byKind: Record<AdKind, number>;
  byAssignee: { id: number; name: string; total: number; active: number; done: number }[];
}

export const KIND_LABEL: Record<AdKind, string> = {
  quota: 'Покупка разовой квоты',
  connect: 'Подключение к площадкам',
  fix: 'Работа с ошибками в объектах',
};
export const AD_STATUS_RU: Record<AdStatus, string> = {
  new: 'Новая', in_progress: 'В работе', done: 'Готово', cancelled: 'Отменена',
};
export const PLATFORM_LABEL: Record<string, string> = {
  avito: 'Авито', cian: 'ЦИАН', domclick: 'ДомКлик', yandex: 'Яндекс',
};

export const adRequestsApi = {
  meta: () => api.get<AdMeta>('/api/ad-requests/meta'),
  list: (kinds?: AdKind[]) => api.get<AdRequest[]>(`/api/ad-requests${kinds?.length ? `?kinds=${kinds.join(',')}` : ''}`),
  get: (id: number) => api.get<AdRequest>(`/api/ad-requests/${id}`),
  create: (body: { kind: AdKind; objectRef?: string; region?: string; platforms?: AdPlatform[]; comment?: string }) =>
    api.post<AdRequest>('/api/ad-requests', body),
  take: (id: number) => api.post<AdRequest>(`/api/ad-requests/${id}/take`, {}),
  update: (id: number, body: { status?: AdStatus; assigneeId?: number | null }) =>
    api.patch<AdRequest>(`/api/ad-requests/${id}`, body),
  remove: (id: number) => api.del<{ ok: boolean }>(`/api/ad-requests/${id}`),
  messages: (id: number, after = 0) => api.get<AdMessage[]>(`/api/ad-requests/${id}/messages?after=${after}`),
  sendMessage: (id: number, payload: { body?: string; attachmentUrl?: string; attachmentName?: string; attachmentS3Key?: string; attachmentContentType?: string }) =>
    api.post<AdMessage>(`/api/ad-requests/${id}/messages`, payload),
  markRead: (id: number, lastId?: number) => api.post<{ ok: boolean }>(`/api/ad-requests/${id}/read`, lastId ? { lastId } : {}),
  events: (id: number) => api.get<AdEvent[]>(`/api/ad-requests/${id}/events`),
  addAttachment: (id: number, body: { name: string; url: string; size?: number }) =>
    api.post<AdRequest>(`/api/ad-requests/${id}/attachments`, body),
  // База подключений
  roster: (q?: string) => api.get<RosterAgent[]>(`/api/ad-requests/platforms/agents${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  setPlatform: (agentId: number, platform: ConnectPlatform, connected: boolean) =>
    api.patch<{ ok: boolean }>(`/api/ad-requests/platforms/${agentId}`, { platform, connected }),
  platformStats: () => api.get<PlatformStats>('/api/ad-requests/platforms/stats'),
  analytics: () => api.get<AdAnalytics>('/api/ad-requests/analytics'),
};
