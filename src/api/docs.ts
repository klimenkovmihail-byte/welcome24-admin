/**
 * api/docs — база знаний (документы и регламенты).
 */

import { api, API_BASE_URL, getToken } from './apiClient';

export interface DocItem {
  id: number;
  parentId: number | null;
  type: 'folder' | 'file';
  name: string;
  description: string;
  fileUrl: string;        // пустой у приватных — идти за presigned через getUrl
  hasFile?: boolean;
  isPrivate?: boolean;
  mimeType: string | null;
  fileSize: number;
  minRole?: 'all' | 'staff';
  restricted?: boolean;   // есть ли у самого элемента собственный ACL (замок в списке)
  orderIdx: number;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Breadcrumb { id: number; name: string }

export interface DocAccessAgent { id: number; name: string }
export interface DocAccess {
  restricted: boolean;
  roles: string[];
  agents: DocAccessAgent[];
  // Ближайший ограниченный предок (для инфо и честного сообщения при снятии своего ACL).
  inherited?: { fromId: number; fromName: string; roles: string[]; agents: DocAccessAgent[] } | null;
  // В поддереве есть legacy-публичные файлы, доступные по прямой ссылке в обход ACL (152-ФЗ).
  hasLegacyPublic?: boolean;
}

export const docsApi = {
  list:        (parentId?: number | null) =>
    api.get<DocItem[]>(`/api/docs${parentId ? `?parentId=${parentId}` : ''}`),
  get:         (id: number) => api.get<DocItem>(`/api/docs/${id}`),
  breadcrumbs: (id: number) => api.get<Breadcrumb[]>(`/api/docs/breadcrumbs/${id}`),
  search:      (q: string)  => api.get<DocItem[]>(`/api/docs/search?q=${encodeURIComponent(q)}`),
  // Ссылка на файл: приватные — presigned, legacy-публичные — их url.
  url:         (id: number) => api.get<{ url: string }>(`/api/docs/${id}/url`),

  createFolder: (parentId: number | null, name: string, description?: string) =>
    api.post<DocItem>('/api/docs/folder', { parentId, name, description }),

  // ПРИВАТНАЯ загрузка файла (multipart) в приватный бакет.
  uploadFile: async (parentId: number | null, file: File, opts?: { name?: string; description?: string; minRole?: 'all' | 'staff' }): Promise<DocItem> => {
    const fd = new FormData();
    fd.append('file', file);
    if (parentId) fd.append('parentId', String(parentId));
    if (opts?.name) fd.append('name', opts.name);
    if (opts?.description) fd.append('description', opts.description);
    if (opts?.minRole) fd.append('minRole', opts.minRole);
    const res = await fetch(`${API_BASE_URL}/api/docs/file/upload`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    return res.json();
  },

  rename: (id: number, name: string) => api.patch<DocItem>(`/api/docs/${id}`, { name }),
  update: (id: number, payload: { name?: string; description?: string; parentId?: number | null; orderIdx?: number; minRole?: 'all' | 'staff' }) =>
    api.patch<DocItem>(`/api/docs/${id}`, payload as unknown as Record<string, unknown>),
  remove: (id: number) => api.del<{ ok: true }>(`/api/docs/${id}`),

  // Гранулярный доступ к папке (ACL): чтение и запись. Пустые списки = снять ограничение.
  getAccess: (id: number) => api.get<DocAccess>(`/api/docs/${id}/access`),
  setAccess: (id: number, payload: { roles: string[]; agentIds: number[] }) =>
    api.put<DocAccess & { ok: true }>(`/api/docs/${id}/access`, payload),
};
