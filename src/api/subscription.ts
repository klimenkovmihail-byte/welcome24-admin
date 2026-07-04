/**
 * api/subscription — управление АП в админке.
 */

import { api } from './apiClient';

export interface PendingClaim {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_email: string;
  agent_city: string;
  period: string;
  amount: number;
  status: string;
  claimed_at: string;
  notes: string;
}

export interface AgentSubOverview {
  id: number;
  name: string;
  email: string;
  city: string;
  status: string;
  joinDate: string;
  lifetimeVkd: number;
  lifetimeThreshold: number;
  exempt: 'lifetime' | 'staff' | null;
  blocked: boolean;
  unpaidCount: number;
  overdueCount: number;
  totalDue: number;
  firstBillingMonth: string | null;
  periodsCount: number;
}

export interface AgentSubFull {
  fee: number;
  exempt: 'lifetime' | 'staff' | 'inactive' | 'manual_forever' | 'paused' | null;
  lifetimeVkd: number;
  lifetimeThreshold: number;
  quarterThreshold: number;
  firstBillingMonth: string | null;
  today: string;
  periods: Array<{
    period: string;
    year: number;
    quarter: number;
    quarterVkd: number;
    status: string;
    paymentId: number | null;
    paidAt: string | null;
  }>;
  unpaidCount: number;
  overdueCount: number;
  totalDue: number;
  blocked: boolean;
  override?: { type: 'force_exempt' | 'pause'; until?: string; note?: string };
}

export interface OverridePayload {
  type: 'force_exempt' | 'pause' | null;
  months?: 1 | 2 | 3;
  note?: string;
}

export interface PaymentRow {
  id: number;
  agent_id: number;
  agent_name: string;
  agent_email: string;
  agent_city: string | null;
  period: string;
  amount: number;
  paid_at: string;
  payment_ref: string | null;
  method: 'auto' | 'manual' | 'direct';
}
export interface PaymentsPage {
  total: number;
  totalAmount: number;
  limit: number;
  offset: number;
  items: PaymentRow[];
}

export const subscriptionAdminApi = {
  pending: () => api.get<PendingClaim[]>('/api/subscription/pending'),
  confirm: (id: number, paymentRef?: string) =>
    api.post(`/api/subscription/${id}/confirm`, paymentRef ? { payment_ref: paymentRef } : {}),
  reject:  (id: number, reason: string) =>
    api.post(`/api/subscription/${id}/reject`, { reason }),
  overview: (includeInactive = false) =>
    api.get<AgentSubOverview[]>(`/api/subscription/admin/overview${includeInactive ? '?includeInactive=1' : ''}`),
  agent:    (id: number) => api.get<AgentSubFull>(`/api/subscription/agent/${id}`),
  setOverride: (agentId: number, payload: OverridePayload) =>
    api.patch<AgentSubFull>(`/api/subscription/agent/${agentId}/override`, payload as unknown as Record<string, unknown>),
  // Отметить период оплаченным вручную (прямая оплата) или снять отметку.
  markPaid: (agentId: number, period: string, paid: boolean) =>
    api.post<{ ok: boolean; period: string; paid: boolean }>(`/api/subscription/manual-claim/${agentId}`, { period, paid }),
  // Лента подтверждённых оплат АП: кто/когда/за какой период. Фильтр q (ФИО) + period.
  payments: (params: { q?: string; period?: string; limit?: number; offset?: number } = {}) => {
    const p = new URLSearchParams();
    if (params.q) p.set('q', params.q);
    if (params.period) p.set('period', params.period);
    if (params.limit != null) p.set('limit', String(params.limit));
    if (params.offset != null) p.set('offset', String(params.offset));
    const qs = p.toString();
    return api.get<PaymentsPage>(`/api/subscription/payments${qs ? '?' + qs : ''}`);
  },
};
