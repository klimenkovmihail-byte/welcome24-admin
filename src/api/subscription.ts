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
  exempt: 'lifetime' | 'staff' | null;
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
}

export const subscriptionAdminApi = {
  pending: () => api.get<PendingClaim[]>('/api/subscription/pending'),
  confirm: (id: number, paymentRef?: string) =>
    api.post(`/api/subscription/${id}/confirm`, paymentRef ? { payment_ref: paymentRef } : {}),
  reject:  (id: number, reason: string) =>
    api.post(`/api/subscription/${id}/reject`, { reason }),
  overview: () => api.get<AgentSubOverview[]>('/api/subscription/admin/overview'),
  agent:    (id: number) => api.get<AgentSubFull>(`/api/subscription/agent/${id}`),
};
