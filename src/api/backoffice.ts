import { api } from './apiClient';

export interface BackOfficeMember {
  id: number;
  name: string;
  role: string;
  description: string;
  photo: string;
  phone: string;
  email: string;
  telegram: string;
  color: string | null;
  orderIdx: number;
  active: boolean;
}

type Raw = {
  id: number; name: string; role: string; description: string;
  photo: string; phone: string; email: string; telegram: string;
  color: string | null;
  order_idx: number; active: number;
};

const norm = (r: Raw): BackOfficeMember => ({
  id: r.id, name: r.name, role: r.role, description: r.description || '',
  photo: r.photo || '', phone: r.phone || '', email: r.email || '', telegram: r.telegram || '',
  color: r.color || null,
  orderIdx: r.order_idx || 0, active: !!r.active,
});

export interface BackOfficePayload {
  name: string;
  role: string;
  description?: string;
  photo?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  color?: string | null;
  orderIdx?: number;
  active?: boolean;
}

export const backofficeApi = {
  list: () => api.get<Raw[]>('/api/backoffice/all').then(rs => rs.map(norm)),
  create: (p: BackOfficePayload) => api.post<Raw>('/api/backoffice', p as unknown as Record<string, unknown>).then(norm),
  update: (id: number, p: Partial<BackOfficePayload>) =>
    api.patch<Raw>(`/api/backoffice/${id}`, p as unknown as Record<string, unknown>).then(norm),
  remove: (id: number) => api.del<{ ok: true }>(`/api/backoffice/${id}`),
};
