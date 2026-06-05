/**
 * api/adPackages (админка) — Отдел рекламы: прайс-лист, сборы пакета, сводка, оплата, экспорт.
 */
import { api } from './apiClient';
import { API_BASE_URL, getToken } from './apiClient';

export type Platform = 'cian' | 'avito' | 'domclick';
export const PKG_PLATFORM_LABEL: Record<Platform, string> = { cian: 'ЦИАН', avito: 'Авито', domclick: 'ДомКлик' };
export const PLATFORMS: Platform[] = ['cian', 'avito', 'domclick'];

export interface AdCategory { id: number; platform: string; key: string; label: string; deal_type: 'sale' | 'rent'; sort_idx: number; active: number; }

export interface PriceMatrix {
  platform: Platform;
  categories: AdCategory[];
  cities: string[];
  prices: Record<string, Record<string, number>>; // city -> catKey -> price
}

export type DriveStatus = 'open' | 'closed' | 'paid';
export interface Drive {
  id: number; platform: Platform; platform_label: string; title: string; note: string;
  deadline: string | null; status: DriveStatus; opened_by_name?: string; created_at: string; updated_at: string;
  starts_at: string | null; // дата активации пакета (30-дневное окно), null = не активирован
  totals?: { qty: number; cost: number; entries: number; paid: number };
  mine?: { qty: number; cost: number; entries: number };
}

export interface SummaryLine { category_key: string; qty: number; unit_price: number; line_cost: number; }
export interface SummaryEntry {
  id: number; agent_id: number; agent_name: string; city: string;
  total_qty: number; total_cost: number; paid: boolean; paid_at: string | null; lines: SummaryLine[];
}
export interface DriveSummary {
  categories: AdCategory[];
  entries: SummaryEntry[];
  byCategory: Record<string, { qty: number; cost: number }>;
  byCity: Record<string, { qty: number; cost: number }>;
  totals: { qty: number; cost: number; paidCost: number; paidCount: number; entriesCount: number };
}
export interface DriveDetailManage extends Drive { scope: 'manage'; summary: DriveSummary; }

export const adPackagesApi = {
  categories: (platform: Platform, all = true) =>
    api.get<AdCategory[]>(`/api/ad-packages/categories?platform=${platform}${all ? '&all=1' : ''}`),
  createCategory: (body: { platform: Platform; label: string; dealType?: 'sale' | 'rent' }) =>
    api.post<AdCategory>('/api/ad-packages/categories', body),
  updateCategory: (id: number, body: { label?: string; dealType?: 'sale' | 'rent'; sortIdx?: number; active?: boolean }) =>
    api.patch<AdCategory>(`/api/ad-packages/categories/${id}`, body),
  deleteCategory: (id: number) => api.del<{ ok: boolean }>(`/api/ad-packages/categories/${id}`),

  prices: (platform: Platform) => api.get<PriceMatrix>(`/api/ad-packages/prices?platform=${platform}`),
  setCityPrices: (platform: Platform, city: string, values: Record<string, number>) =>
    api.put<{ ok: boolean }>('/api/ad-packages/prices', { platform, city, values }),
  deleteCity: (platform: Platform, city: string) =>
    api.del<{ ok: boolean }>(`/api/ad-packages/prices?platform=${platform}&city=${encodeURIComponent(city)}`),

  drives: () => api.get<Drive[]>('/api/ad-packages/drives'),
  createDrive: (body: { platform: Platform; title: string; note?: string; deadline?: string }) =>
    api.post<Drive>('/api/ad-packages/drives', body),
  drive: (id: number) => api.get<DriveDetailManage>(`/api/ad-packages/drives/${id}`),
  updateDrive: (id: number, body: { status?: DriveStatus; title?: string; note?: string; deadline?: string | null }) =>
    api.patch<Drive>(`/api/ad-packages/drives/${id}`, body),
  removeDrive: (id: number) => api.del<{ ok: boolean }>(`/api/ad-packages/drives/${id}`),
  // Активация пакета: дата старта 30-дневного окна (пустая строка — снять активацию).
  activateDrive: (id: number, startDate: string) =>
    api.post<Drive>(`/api/ad-packages/drives/${id}/activate`, { startDate }),
  summary: (id: number) => api.get<DriveSummary>(`/api/ad-packages/drives/${id}/summary`),
  payEntry: (entryId: number, paid: boolean) =>
    api.patch<{ ok: boolean }>(`/api/ad-packages/entries/${entryId}/pay`, { paid }),
  removeEntry: (driveId: number, entryId: number) =>
    api.del<{ ok: boolean }>(`/api/ad-packages/drives/${driveId}/entries/${entryId}`),
};

// Скачивание xlsx с авторизацией (api-обёртка не умеет blob).
export async function downloadDriveXlsx(driveId: number, filename: string) {
  const res = await fetch(`${API_BASE_URL}/api/ad-packages/drives/${driveId}/export`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Не удалось сформировать файл');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
