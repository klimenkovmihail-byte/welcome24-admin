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

export const subscriptionAdminApi = {
  pending: () => api.get<PendingClaim[]>('/api/subscription/pending'),
  confirm: (id: number, paymentRef?: string) =>
    api.post(`/api/subscription/${id}/confirm`, paymentRef ? { payment_ref: paymentRef } : {}),
  reject:  (id: number, reason: string) =>
    api.post(`/api/subscription/${id}/reject`, { reason }),
};
