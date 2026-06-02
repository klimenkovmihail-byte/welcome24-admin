/**
 * Welcome 24 — обёртка над fetch (admin).
 *
 * Базовый URL берётся из VITE_API_URL (см. .env.local).
 * Для прода — VITE_API_URL должен быть проставлен в Vercel.
 * JWT хранится в localStorage ('w24_token') и автоматически
 * добавляется в Authorization-заголовок ко всем запросам.
 */

const TOKEN_KEY = 'w24_token';

function detectApiUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:4000';
  }
  return 'http://localhost:4000';
}

export const API_BASE_URL = detectApiUrl();

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown> | unknown[] | null;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function request<T>(method: string, path: string, body?: Json): Promise<T> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // Авто-ретрай только для GET (повтор POST/PATCH мог бы создать дубль). Render при
  // деплое/просыпании на ~30-60с отдаёт сетевую ошибку или 502/503/504 — тихо повторяем.
  const canRetry = method === 'GET';
  const maxAttempts = canRetry ? 3 : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e: unknown) {
      if (attempt < maxAttempts) { await sleep(700 * attempt); continue; }
      throw new ApiError(
        'Не удаётся подключиться к серверу. Проверь что бэкенд запущен на ' + API_BASE_URL,
        0,
        e,
      );
    }

    if (canRetry && [502, 503, 504].includes(res.status) && attempt < maxAttempts) {
      await sleep(700 * attempt);
      continue;
    }

    const text = await res.text();
    const json = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

    if (!res.ok) {
      if (res.status === 401) setToken(null);
      const message = (json && typeof json === 'object' && 'error' in json && typeof (json as { error: unknown }).error === 'string')
        ? (json as { error: string }).error
        : `HTTP ${res.status}`;
      throw new ApiError(message, res.status, json);
    }

    return json as T;
  }
  throw new ApiError('Не удаётся подключиться к серверу', 0, null);
}

export const api = {
  get:  <T>(path: string)              => request<T>('GET',    path),
  post: <T>(path: string, body?: Json) => request<T>('POST',   path, body ?? {}),
  patch:<T>(path: string, body?: Json) => request<T>('PATCH',  path, body ?? {}),
  put:  <T>(path: string, body?: Json) => request<T>('PUT',    path, body ?? {}),
  del:  <T>(path: string)              => request<T>('DELETE', path),
};
