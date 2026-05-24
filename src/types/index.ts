export type AgentLevel = 1 | 2 | 3;
export type AgentStatus = 'active' | 'inactive' | 'blocked';
export type DealStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
export type ShareOperationType = 'issue' | 'transfer' | 'buyback';
export type ReviewModeration = 'pending' | 'approved' | 'rejected';

export interface AgentSocials {
  telegram?: string;
  telegramChannel?: string;
  instagram?: string;
  vk?: string;
  max?: string;
}

export interface AgentReview {
  id: number;
  agentId: number;
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  createdAt: string;
  moderation: ReviewModeration;
}

export interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  level: AgentLevel;
  commission: 80 | 90 | 95;
  status: AgentStatus;
  parentId: number | null; // null = Welcome 24 directly
  parentName: string | null;
  joinDate: string;
  specialization: string[];
  vkdYear: number;
  incomeYear: number;
  dealsYear: number;
  shares: number;
  teamSize: number;
  // Public profile fields (synced with portal Agent base)
  photo: string | null;
  bio: string;
  socials: AgentSocials;
  rating: number;        // avg 1.0–5.0
  reviewsCount: number;
  terminatedAt: string | null;  // ISO дата увольнения, null если работает
}

export interface Deal {
  id: number;
  agentId: number;
  agentName: string;
  clientName: string;
  address: string;
  vkd: number;
  income: number;
  commission: number;
  status: DealStatus;
  date: string;
  city: string;
  type: 'primary' | 'secondary' | 'commercial' | 'suburban' | 'rent';
  notes: string;
}

export interface ShareOperation {
  id: number;
  type: ShareOperationType;
  fromAgentId: number | null; // null = company
  fromAgentName: string | null;
  toAgentId: number | null;
  toAgentName: string | null;
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  date: string;
  notes: string;
}

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
