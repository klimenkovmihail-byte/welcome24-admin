import { api } from './apiClient';

export type DealsByAgentRow = {
  agentId: number;
  agentName: string;
  dealsCount: number;
  totalVkd: number;
  agentIncome: number;
  companyIncome: number;
  currentCommission: number;
};

export type DealsByAgentResponse = {
  from: string;
  to: string;
  rows: DealsByAgentRow[];
  totals: { dealsCount: number; totalVkd: number; agentIncome: number; companyIncome: number };
};

export type PropertyTypesRow = {
  category: 'primary' | 'secondary' | 'rent';
  label: string;
  dealsCount: number;
  totalVkd: number;
  percent: number;
};

export type PropertyTypesResponse = {
  from: string;
  to: string;
  rows: PropertyTypesRow[];
  totals: { dealsCount: number; totalVkd: number; percent: number };
};

export type MlmPayoutsRow = {
  mentorId: number;
  mentorName: string;
  byLevel: number[]; // 7 элементов, индекс 0 = уровень 1
  total: number;
};

export type MlmPayoutsResponse = {
  from: string;
  to: string;
  rows: MlmPayoutsRow[];
  totals: { byLevel: number[]; total: number };
};

const qs = (p: { from: string; to: string }) => `?from=${p.from}&to=${p.to}`;

export const reportsApi = {
  dealsByAgent: (p: { from: string; to: string }) =>
    api.get<DealsByAgentResponse>(`/api/reports/deals-by-agent${qs(p)}`),
  propertyTypes: (p: { from: string; to: string }) =>
    api.get<PropertyTypesResponse>(`/api/reports/property-types${qs(p)}`),
  mlmPayouts: (p: { from: string; to: string }) =>
    api.get<MlmPayoutsResponse>(`/api/reports/mlm-payouts${qs(p)}`),
};
