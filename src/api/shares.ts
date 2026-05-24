/**
 * api/shares — котировки и операции в админке.
 */

import { api } from './apiClient';

export interface ShareQuote {
  id: number;
  date: string;
  price: number;
  note: string;
}

export type ShareOperationType = 'issue' | 'transfer' | 'buyback';

export interface ShareOperation {
  id: number;
  type: ShareOperationType;
  fromAgentId: number | null;
  fromAgentName: string | null;
  toAgentId: number | null;
  toAgentName: string | null;
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  date: string;
  notes: string;
}

type RawQuote = { id: number; date: string; price: number; note: string };
type RawOp = {
  id: number;
  type: ShareOperationType;
  from_agent_id: number | null;
  from_agent_name: string | null;
  to_agent_id: number | null;
  to_agent_name: string | null;
  quantity: number;
  price_per_share: number;
  total_amount: number;
  date: string;
  notes: string;
};

function normalizeQuote(r: RawQuote): ShareQuote {
  return { id: r.id, date: r.date, price: r.price, note: r.note || '' };
}

function normalizeOp(r: RawOp): ShareOperation {
  return {
    id: r.id,
    type: r.type,
    fromAgentId: r.from_agent_id,
    fromAgentName: r.from_agent_name,
    toAgentId: r.to_agent_id,
    toAgentName: r.to_agent_name,
    quantity: r.quantity,
    pricePerShare: r.price_per_share,
    totalAmount: r.total_amount,
    date: r.date,
    notes: r.notes || '',
  };
}

export interface QuoteCreatePayload { date: string; price: number; note?: string }

export interface OperationCreatePayload {
  type: ShareOperationType;
  fromAgentId?: number | null;
  toAgentId?: number | null;
  quantity: number;
  pricePerShare: number;
  date?: string;
  notes?: string;
}

export const sharesApi = {
  quotes:       () => api.get<RawQuote[]>('/api/shares/quotes').then(rows => rows.map(normalizeQuote)),
  addQuote:     (p: QuoteCreatePayload) =>
    api.post<RawQuote>('/api/shares/quotes', p as unknown as Record<string, unknown>).then(normalizeQuote),
  deleteQuote:  (id: number) => api.del<{ ok: true }>(`/api/shares/quotes/${id}`),

  operations:   () => api.get<RawOp[]>('/api/shares/operations').then(rows => rows.map(normalizeOp)),
  addOperation: (p: OperationCreatePayload) =>
    api.post<{ id: number }>('/api/shares/operations', p as unknown as Record<string, unknown>),
};
