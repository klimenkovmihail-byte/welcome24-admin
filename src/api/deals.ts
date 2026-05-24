/**
 * api/deals — управление сделками в админке.
 * Бэк возвращает agent_name через JOIN — используем его без отдельного запроса.
 */

import { api } from './apiClient';
import type { Deal, DealStatus } from '../types';

type RawDeal = {
  id: number;
  agent_id: number;
  agent_name?: string | null;
  client_name: string;
  address: string;
  city: string;
  type: Deal['type'];
  vkd: number;
  income: number;
  commission: number;
  status: DealStatus;
  date: string;
  notes: string;
  created_at?: string;
};

export function normalizeDeal(raw: RawDeal): Deal {
  return {
    id: raw.id,
    agentId: raw.agent_id,
    agentName: raw.agent_name || '',
    clientName: raw.client_name,
    address: raw.address || '',
    city: raw.city || '',
    type: raw.type,
    vkd: raw.vkd,
    income: raw.income,
    commission: raw.commission,
    status: raw.status,
    date: raw.date,
    notes: raw.notes || '',
  };
}

export interface DealCreatePayload {
  agentId: number;
  clientName: string;
  address?: string;
  city?: string;
  type: Deal['type'];
  vkd: number;
  commission: 80 | 90 | 95;
  income?: number; // если не передавать — бэк посчитает vkd * commission / 100
  status?: DealStatus;
  date?: string;
  notes?: string;
}

export interface DealUpdatePayload {
  clientName?: string;
  address?: string;
  city?: string;
  type?: Deal['type'];
  vkd?: number;
  income?: number;
  commission?: number;
  status?: DealStatus;
  date?: string;
  notes?: string;
}

export const dealsApi = {
  list:    () => api.get<RawDeal[]>('/api/deals').then(rows => rows.map(normalizeDeal)),
  create:  (payload: DealCreatePayload) =>
    api.post<RawDeal>('/api/deals', payload as unknown as Record<string, unknown>).then(normalizeDeal),
  update:  (id: number, payload: DealUpdatePayload) =>
    api.patch<RawDeal>(`/api/deals/${id}`, payload as unknown as Record<string, unknown>).then(normalizeDeal),
  confirm: (id: number) => api.post<{ ok: true }>(`/api/deals/${id}/confirm`),
  pay:     (id: number) => api.post<{ ok: true }>(`/api/deals/${id}/pay`),
  cancel:  (id: number) => api.post<{ ok: true }>(`/api/deals/${id}/cancel`),
  remove:  (id: number) => api.del<{ ok: true }>(`/api/deals/${id}`),
};
