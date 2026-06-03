/**
 * api/stats — агрегаты для Dashboard/Analytics админки.
 */

import { api } from './apiClient';
import type { DealStatus } from '../types';

export interface MonthBucket { m: string; month: string; vkd: number; deals: number; income: number }
export interface CityBucket  { city: string; agents: number }
export interface TopAgent    { id: number; name: string; city: string; status: string; deals: number; vkd: number; income: number }
export interface RecentDeal  { id: number; agentId: number; agentName: string; clientName: string; address: string; city: string; type: string; vkd: number; income: number; status: DealStatus; date: string }

export interface TopShareholder { id: number; name: string; city: string; shares: number }
export interface NewAgentsBucket { m: string; month: string; newAgents: number }
export interface SharesMonthBucket { m: string; month: string; qty: number; ops: number }

export interface OverviewResponse {
  year: string | null;
  month: string | null;
  agents: { total: number; active: number; inactive: number; blocked: number };
  deals:  { total: number; pending: number; confirmed: number; paid: number; cancelled: number; totalVkd: number; totalIncome: number; companyIncome: number };
  monthlyDeals: MonthBucket[];
  agentsByLevel: { level: number; count: number }[];
  agentsByCity: CityBucket[];
  topAgents:    TopAgent[];
  recentDeals:  RecentDeal[];
  settings:     { sharePrice: number; totalSharesIssued: number; sharesInCirculation: number };
  shareholders: { count: number; top: TopShareholder[] };
  metrics:      { agentLtvDays: number; dealsPerAgentPerMonth: number; monthsInPeriod: number };
  monthlyNewAgents: NewAgentsBucket[];
  monthlyShares:    SharesMonthBucket[];
}

// Активность портала агентов (DAU/WAU/MAU + детализация).
export interface PortalActivity {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;          // % DAU/MAU
  totalActiveAgents: number;
  active7: number;
  active30: number;
  sleeping: number;
  reachability: { telegram: number; max: number; push: number; any: number };
  dailySeries: { day: string; active: number }[];
  weeklySeries: { weekStart: string; active: number }[];
  trackingSince: string;
}
export interface PortalActivityAgent {
  id: number;
  name: string;
  city: string;
  joinDate: string | null;
  lastLoginAt: string | null;
  activeDays30: number;
  aiReq30: number;
  hasTelegram: boolean;
  hasMax: boolean;
  hasPush: boolean;
}

export const statsApi = {
  overview: (opts?: { year?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts?.year)  p.set('year',  opts.year);
    if (opts?.month) p.set('month', opts.month);
    const q = p.toString();
    return api.get<OverviewResponse>(`/api/stats/overview${q ? `?${q}` : ''}`);
  },
  portalActivity:       () => api.get<PortalActivity>('/api/stats/portal-activity'),
  portalActivityAgents: () => api.get<PortalActivityAgent[]>('/api/stats/portal-activity/agents'),
};
