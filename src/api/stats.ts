/**
 * api/stats — агрегаты для Dashboard/Analytics админки.
 */

import { api } from './apiClient';
import type { DealStatus } from '../types';

export interface MonthBucket { m: string; month: string; vkd: number; deals: number; income: number }
export interface CityBucket  { city: string; agents: number }
export interface TopAgent    { id: number; name: string; city: string; status: string; deals: number; vkd: number; income: number }
export interface RecentDeal  { id: number; agentId: number; agentName: string; clientName: string; address: string; city: string; type: string; vkd: number; income: number; status: DealStatus; date: string }

export interface OverviewResponse {
  year: string | null;
  month: string | null;
  agents: { total: number; active: number; inactive: number; blocked: number };
  deals:  { total: number; pending: number; confirmed: number; paid: number; cancelled: number; totalVkd: number; totalIncome: number };
  monthlyDeals: MonthBucket[];
  agentsByLevel: { level: number; count: number }[];
  agentsByCity: CityBucket[];
  topAgents:    TopAgent[];
  recentDeals:  RecentDeal[];
  settings:     { sharePrice: number; totalSharesIssued: number; sharesInCirculation: number };
}

export const statsApi = {
  overview: (opts?: { year?: string; month?: string }) => {
    const p = new URLSearchParams();
    if (opts?.year)  p.set('year',  opts.year);
    if (opts?.month) p.set('month', opts.month);
    const q = p.toString();
    return api.get<OverviewResponse>(`/api/stats/overview${q ? `?${q}` : ''}`);
  },
};
