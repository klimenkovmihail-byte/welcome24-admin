// Файлы заявок: приватная загрузка и открытие (админка).
// Новые файлы лежат в приватном бакете (url пустой), отдаются только через
// авторизованный прокси /api/cases/:id/attachments/:attId/download. Старые публичные
// файлы (url заполнен) открываем напрямую — обратная совместимость.
import { API_BASE_URL, getToken } from '../api/apiClient';
import type { CaseItem, CaseAttachment } from '../api/cases';

async function readUploadError(res: Response): Promise<string> {
  try { const e = await res.json(); if (e?.error) return String(e.error); } catch { /* нет JSON */ }
  return res.status === 413
    ? 'Файл больше 25 МБ — уменьшите или сожмите.'
    : `Не удалось загрузить файл (${res.status}).`;
}

// Приватная загрузка файла заявки через бэк. Возвращает обновлённую заявку.
export async function uploadCaseAttachment(
  caseId: number,
  file: File,
  opts?: { participantId?: number; category?: string },
): Promise<CaseItem> {
  const fd = new FormData();
  fd.append('file', file);
  if (opts?.participantId != null) fd.append('participantId', String(opts.participantId));
  if (opts?.category) fd.append('category', opts.category);
  const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/attachments/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) throw new Error(await readUploadError(res));
  return res.json();
}

// Чек об оплате (PDF) задачи: приватная загрузка. Возвращает обновлённую заявку.
export async function uploadCaseReceipt(taskId: number, file: File): Promise<CaseItem> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/cases/tasks/${taskId}/receipt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: fd,
  });
  if (!res.ok) throw new Error(await readUploadError(res));
  return res.json();
}

// Открыть чек об оплате (presigned PDF) — синхронно окно в клике, затем presigned-URL.
export async function openCaseReceipt(taskId: number): Promise<void> {
  const w = window.open('', '_blank');
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases/tasks/${taskId}/receipt`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Не удалось открыть чек');
    const { url } = await res.json();
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}

// Открыть файл заявки в новой вкладке. Приватные файлы отдаются presigned-ссылкой
// (клиент качает напрямую из Object Storage — масштаб/скорость); вкладку открываем
// СИНХРОННО в рамках клика (иначе попап-блокер срежет после await).
export async function openCaseAttachment(
  caseId: number,
  att: Pick<CaseAttachment, 'id' | 'url'>,
): Promise<void> {
  if (att.url) { window.open(att.url, '_blank', 'noopener'); return; }   // legacy публичный
  const w = window.open('', '_blank');
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/attachments/${att.id}/url`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Не удалось открыть файл');
    const { url } = await res.json();
    if (w) w.location.href = url; else window.open(url, '_blank', 'noopener');
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}
