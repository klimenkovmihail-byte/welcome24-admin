/**
 * api/agents — обёртка над /api/agents/* для админки.
 *
 * Бэк отдаёт snake_case (parent_id, team_level, reviews_count, ...).
 * Нормализуем в camelCase к фронтовому типу Agent. Вычисляемые поля
 * (vkdYear/incomeYear/dealsYear/shares/teamSize/parentName) ставим в 0
 * — они дополнятся когда подключим Deals/Shares и постфактум считаются
 * из массива агентов (для teamSize/parentName).
 */

import { api } from './apiClient';
import type { Agent, AgentReview, AgentSocials, AgentLevel, AgentStatus, ReviewModeration } from '../types';
import type { Role } from '../auth/roles';

type RawAgent = {
  id: number;
  email: string;
  name: string;
  phone: string;
  city: string;
  photo: string | null;
  bio: string;
  role: Role;
  status: AgentStatus;
  level: number;
  commission: number;
  parent_id: number | null;
  team_level: number;
  join_date: string;
  experience_years: number;
  specialization: string[];
  socials: AgentSocials;
  rating: number;
  reviews_count: number;
  referral_link?: string;
  terminated_at: string | null;
  section_access?: string | null;   // JSON-массив путей или null (дефолт роли)
  // Поля приходят из агрегаций /api/agents (SUM по deals + share_packets).
  year_vkd?: number;
  year_deals?: number;
  year_income?: number;
  total_deals?: number;
  total_vkd?: number;
  total_income?: number;
};

type RawReview = {
  id: number;
  agent_id: number;
  author_id: number | null;
  author_name: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  moderation: ReviewModeration;
  created_at: string;
};

export function normalizeAgent(raw: RawAgent): Agent {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    phone: raw.phone || '',
    city: raw.city || '',
    level: (raw.level || 1) as AgentLevel,
    commission: (raw.commission || 80) as 80 | 90 | 95,
    status: raw.status,
    parentId: raw.parent_id,
    parentName: null, // обогащается на странице из списка по parentId
    joinDate: raw.join_date,
    specialization: raw.specialization || [],
    vkdYear: raw.year_vkd || 0,
    incomeYear: raw.year_income || 0,
    dealsYear: raw.year_deals || 0,
    shares: 0,       // обогатим отдельным запросом /api/shares/holders
    teamSize: 0,     // считается на странице из списка
    photo: raw.photo,
    bio: raw.bio || '',
    socials: raw.socials || {},
    rating: raw.rating || 0,
    reviewsCount: raw.reviews_count || 0,
    referralLink: raw.referral_link || '',
    terminatedAt: raw.terminated_at || null,
    role: raw.role || 'agent',
    sectionAccess: ((): string[] | null => {
      const r = raw.section_access;
      if (r == null) return null;
      try { const a = JSON.parse(r); return Array.isArray(a) ? a : null; } catch { return null; }
    })(),
  } as Agent & { referralLink: string; role: Role; sectionAccess: string[] | null };
}

export function normalizeReview(raw: RawReview): AgentReview {
  return {
    id: raw.id,
    agentId: raw.agent_id,
    authorName: raw.author_name,
    rating: raw.rating,
    text: raw.text,
    createdAt: raw.created_at,
    moderation: raw.moderation,
  };
}

/** Дополняет parentName и teamSize по списку. Вызывать после загрузки.
 *  shares можно докинуть отдельно через enrichSharesFromHolders. */
export function enrichAgents(list: Agent[]): Agent[] {
  const byId = new Map(list.map(a => [a.id, a]));
  const teamCounts = new Map<number, number>();
  for (const a of list) {
    if (a.parentId != null) teamCounts.set(a.parentId, (teamCounts.get(a.parentId) || 0) + 1);
  }
  return list.map(a => ({
    ...a,
    parentName: a.parentId != null ? (byId.get(a.parentId)?.name ?? null) : null,
    teamSize: teamCounts.get(a.id) || 0,
  }));
}

/** Заполняет поле shares у каждого агента из ответа /api/shares/holders. */
export function enrichSharesFromHolders(list: Agent[], holders: { id: number; shares: number }[]): Agent[] {
  const sharesById = new Map<number, number>();
  for (const h of holders) sharesById.set(h.id, h.shares);
  return list.map(a => ({ ...a, shares: sharesById.get(a.id) || 0 }));
}

export interface AgentCreatePayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  city?: string;
  joinDate?: string;
  level?: AgentLevel;
  commission?: 80 | 90 | 95;
  status?: AgentStatus;
  parentId?: number | null;
  specialization?: string[];
  socials?: AgentSocials;
  photo?: string | null;
  bio?: string;
  referralLink?: string;
  role?: Role; // если указана — бэк проставит роль сразу при создании
}

export interface AgentUpdatePayload {
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  photo?: string | null;
  bio?: string;
  status?: AgentStatus;
  level?: AgentLevel;
  commission?: 80 | 90 | 95;
  parentId?: number | null;
  specialization?: string[];
  socials?: AgentSocials;
  password?: string;
  referralLink?: string;
}

export const agentsApi = {
  list:    () => api.get<RawAgent[]>('/api/agents').then(rows => enrichAgents(rows.map(normalizeAgent))),
  get:     (id: number) => api.get<RawAgent>(`/api/agents/${id}`).then(normalizeAgent),
  create:  (payload: AgentCreatePayload) =>
    api.post<RawAgent>('/api/agents', payload as unknown as Record<string, unknown>).then(normalizeAgent),
  update:  (id: number, payload: AgentUpdatePayload) =>
    api.patch<RawAgent>(`/api/agents/${id}`, payload as unknown as Record<string, unknown>).then(normalizeAgent),
  remove:  (id: number) => api.del<{ ok: true }>(`/api/agents/${id}`),
  // Web Push для специалистов/админов (тот же бэк, что и в портале).
  pushKey: () => api.get<{ enabled: boolean; publicKey: string }>('/api/agents/me/push-key'),
  pushSubscribe: (sub: { endpoint: string; keys: { p256dh: string; auth: string }; userAgent?: string }) =>
    api.post<{ ok: boolean }>('/api/agents/me/push-subscribe', sub),
  pushUnsubscribe: (endpoint: string) =>
    api.post<{ ok: boolean }>('/api/agents/me/push-unsubscribe', { endpoint }),
  setRole: (id: number, role: Role) =>
    api.patch<RawAgent>(`/api/agents/${id}/role`, { role }).then(normalizeAgent),
  // Индивидуальные права сотрудника на разделы админки (null = дефолт роли).
  setSections: (id: number, sections: string[] | null) =>
    api.patch<{ ok: true; sectionAccess: string[] | null }>(`/api/agents/${id}/sections`, { sections }),
  // Объединить дубликат (sourceId) с основной карточкой (targetId).
  // Все сделки/акции/etc переносятся к targetId, sourceId удаляется.
  mergeInto: (targetId: number, sourceId: number) =>
    api.post<{ ok: true; target: string; source: string; moved: Record<string, number> }>(
      `/api/agents/${targetId}/merge-from/${sourceId}`,
    ),
  mentorHistory: (id: number) => api.get<MentorHistoryEntry[]>(`/api/agents/${id}/mentor-history`),

  reviews: (id: number, opts?: { all?: boolean }) =>
    api.get<RawReview[]>(`/api/agents/${id}/reviews${opts?.all ? '?all=1' : ''}`).then(rows => rows.map(normalizeReview)),
  pendingReviews: () =>
    api.get<RawReview[]>('/api/agents/_all/pending').then(rows => rows.map(normalizeReview)),
  setReviewModeration: (reviewId: number, moderation: ReviewModeration) =>
    api.patch<{ ok: true }>(`/api/agents/_review/${reviewId}`, { moderation }),
  deleteReview: (reviewId: number) =>
    api.del<{ ok: true }>(`/api/agents/_review/${reviewId}`),
};

export interface MentorHistoryEntry {
  id: number;
  agentId: number;
  parentId: number | null;
  parentName: string | null;
  effectiveFrom: string;
  effectiveUntil: string | null;
  changedBy: number | null;
  changedByName: string | null;
  reason: string;
  createdAt: string;
  periodDeals: number;
  periodVkd: number;
  periodIncome: number;
}
