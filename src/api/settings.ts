/**
 * api/settings — глобальные настройки + marketing plan + achievements.
 */

import { api } from './apiClient';

export interface CompanySettings {
  sharePrice: number;
  totalSharesIssued: number;
  totalSharesAvailable: number;
  level1Threshold: number;
  level2Threshold: number;
  level1Commission: 80;
  level2Commission: 90;
  level3Commission: 95;
}

export interface MarketingPlanLevel {
  level: number;
  protectedPct: number;
  growingPct: number | null;
  requiredL1: number | null;
  capPerAgent: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  triggerType: string;
  threshold: number;
  active: boolean;
}

type RawSettings = Record<string, string | number>;
type RawPlan = { level: number; protected_pct: number; growing_pct: number | null; required_l1: number | null; cap_per_agent: number };
type RawAch = { id: string; title: string; description: string; icon: string; tier: AchievementDef['tier']; trigger_type: string; threshold: number; active: number };

function normalizeSettings(raw: RawSettings): CompanySettings {
  const n = (k: string, def = 0) => {
    const v = raw[k];
    return typeof v === 'number' ? v : Number(v ?? def) || def;
  };
  return {
    sharePrice: n('share_price', 0),
    totalSharesIssued: n('total_shares', 0),
    totalSharesAvailable: n('available_shares', 0),
    level1Threshold: n('level1_threshold', 2_000_000),
    level2Threshold: n('level2_threshold', 5_000_000),
    level1Commission: 80,
    level2Commission: 90,
    level3Commission: 95,
  };
}

function normalizePlan(r: RawPlan): MarketingPlanLevel {
  return {
    level: r.level,
    protectedPct: r.protected_pct,
    growingPct: r.growing_pct,
    requiredL1: r.required_l1,
    capPerAgent: r.cap_per_agent,
  };
}

function normalizeAch(r: RawAch): AchievementDef {
  return {
    id: r.id,
    title: r.title,
    description: r.description || '',
    icon: r.icon || '🏆',
    tier: r.tier,
    triggerType: r.trigger_type,
    threshold: r.threshold,
    active: !!r.active,
  };
}

export const settingsApi = {
  get:           () => api.get<RawSettings>('/api/settings').then(normalizeSettings),
  update:        (patch: Record<string, string | number>) =>
    api.patch<{ ok: true }>('/api/settings', patch as unknown as Record<string, unknown>),

  marketingPlan: () => api.get<RawPlan[]>('/api/marketing-plan').then(rows => rows.map(normalizePlan)),
  updatePlan:    (level: number, p: { protected?: number; growing?: number | null; required?: number | null; capPerAgent?: number }) =>
    api.put<{ ok: true }>(`/api/marketing-plan/${level}`, p as unknown as Record<string, unknown>),

  achievements:  () => api.get<RawAch[]>('/api/achievements').then(rows => rows.map(normalizeAch)),
  updateAch:     (id: string, p: Partial<AchievementDef>) =>
    api.patch<{ ok: true }>(`/api/achievements/${id}`, p as unknown as Record<string, unknown>),
};
