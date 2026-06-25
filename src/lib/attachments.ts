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

// Открыть файл заявки в новой вкладке.
export async function openCaseAttachment(
  caseId: number,
  att: Pick<CaseAttachment, 'id' | 'url' | 'name'>,
): Promise<void> {
  // Старый публичный файл — открываем напрямую (синхронно, попап не режется).
  if (att.url) { window.open(att.url, '_blank', 'noopener'); return; }
  // Приватный: вкладку открываем СИНХРОННО в рамках клика (иначе попап-блокер
  // срежет открытие после await), blob-URL подставляем после загрузки.
  const w = window.open('', '_blank');
  try {
    const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/attachments/${att.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error('Не удалось открыть файл');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (w) {
      w.location.href = url;
    } else {
      // Попап всё же заблокирован — отдаём файлом через скачивание.
      const a = document.createElement('a');
      a.href = url; a.download = att.name || 'document';
      document.body.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    if (w) w.close();
    throw e;
  }
}
