/**
 * api/docs — база знаний (документы и регламенты).
 */

import { api } from './apiClient';

export interface DocItem {
  id: number;
  parentId: number | null;
  type: 'folder' | 'file';
  name: string;
  description: string;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  fileSize: number;
  orderIdx: number;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Breadcrumb { id: number; name: string }

export const docsApi = {
  list:        (parentId?: number | null) =>
    api.get<DocItem[]>(`/api/docs${parentId ? `?parentId=${parentId}` : ''}`),
  get:         (id: number) => api.get<DocItem>(`/api/docs/${id}`),
  breadcrumbs: (id: number) => api.get<Breadcrumb[]>(`/api/docs/breadcrumbs/${id}`),
  search:      (q: string)  => api.get<DocItem[]>(`/api/docs/search?q=${encodeURIComponent(q)}`),

  createFolder: (parentId: number | null, name: string, description?: string) =>
    api.post<DocItem>('/api/docs/folder', { parentId, name, description }),

  createFile:   (payload: {
    parentId: number | null; name: string; fileUrl: string;
    fileKey?: string; mimeType?: string; fileSize?: number; description?: string;
  }) => api.post<DocItem>('/api/docs/file', payload as unknown as Record<string, unknown>),

  rename: (id: number, name: string) => api.patch<DocItem>(`/api/docs/${id}`, { name }),
  update: (id: number, payload: { name?: string; description?: string; parentId?: number | null; orderIdx?: number }) =>
    api.patch<DocItem>(`/api/docs/${id}`, payload as unknown as Record<string, unknown>),
  remove: (id: number) => api.del<{ ok: true }>(`/api/docs/${id}`),
};
