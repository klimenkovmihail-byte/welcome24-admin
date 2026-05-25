/**
 * api/backup — список бэкапов и ручной запуск.
 * Только для админов (проверка идёт на бэке через requireAdmin).
 */

import { api } from './apiClient';

export interface BackupItem {
  key: string;
  size: number;
  modified: string | null;
}

export interface BackupRunResult {
  key: string;
  sizeOriginal: number;
  sizeCompressed: number;
  durationMs: number;
  prunedOld: number;
}

export const backupApi = {
  list: () => api.get<BackupItem[]>('/api/backup'),
  run:  () => api.post<BackupRunResult>('/api/backup/run'),
};
