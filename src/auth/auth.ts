// Реальный auth для админки: POST /api/auth/login → JWT + проверка role === 'admin'.
// Не-админы перенаправляются на портал агента.

import { api, setToken, getToken, ApiError } from '../api/apiClient';
import type { Role } from './roles';

// Какие роли вообще могут войти в админку (всё, кроме обычного agent).
const ADMIN_ROLES: Role[] = ['super_admin', 'admin', 'manager', 'lawyer', 'broker', 'listing_manager'];
const isStaffRole = (r: string | undefined) => !!r && (ADMIN_ROLES as string[]).includes(r);

export interface AdminUser {
  id?: number;
  email: string;
  name: string;
  role: Role;
  loginAt: string;
  [key: string]: unknown;
}

const STORAGE_KEY = 'w24_admin_user';

// URL'ы автоматически выбираются:
//  1) env-переменная (если задана на Vercel) — приоритет
//  2) если домен с "-admin" — заменяем на "-platform" (для текущего Vercel-демо)
//  3) localhost для dev
function detectPortalUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:5173';
  const fromEnv = import.meta.env.VITE_PORTAL_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5173';
  if (host.includes('welcome24-admin')) {
    return `${window.location.protocol}//${host.replace('welcome24-admin', 'welcome24-platform')}`;
  }
  if (host.includes('admin.welcome24')) {
    return `${window.location.protocol}//${host.replace('admin.welcome24', 'app.welcome24')}`;
  }
  return 'https://welcome24-platform.vercel.app';
}
function detectAdminUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:5174';
  const fromEnv = import.meta.env.VITE_ADMIN_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5174';
  return window.location.origin;
}
export const PORTAL_URL = detectPortalUrl();
export const ADMIN_URL = detectAdminUrl();

interface LoginResponse {
  token: string;
  user: Record<string, unknown> & { id: number; email: string; name: string; role: Role };
}

export async function login(
  email: string,
  password: string,
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string; redirectTo?: string }> {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false, error: 'Введите email' };
  if (!password) return { ok: false, error: 'Введите пароль' };

  try {
    const data = await api.post<LoginResponse>('/api/auth/login', { email: e, password });

    if (!isStaffRole(data.user.role)) {
      // Не сотрудник — стираем токен, отправляем на портал агента.
      setToken(null);
      return {
        ok: false,
        error: 'У этого аккаунта нет прав на админ-панель. Перенаправляем на портал агента…',
        redirectTo: `${PORTAL_URL}/login?ssoEmail=${encodeURIComponent(e)}`,
      };
    }

    setToken(data.token);
    const user: AdminUser = {
      ...data.user,
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return { ok: true, user };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: err.message };
    }
    return { ok: false, error: 'Не удалось войти. Попробуйте ещё раз.' };
  }
}

export function logout() {
  api.post('/api/auth/logout').catch(() => { /* ignore */ });
  setToken(null);
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Синхронная проверка для PrivateRoute: токен + сохранённый user. */
export function isAuthenticated(): boolean {
  return !!getToken() && !!getCurrentUser();
}

/** Индивидуальный список разделов текущего юзера (null = доступ по умолчанию роли). */
export function currentSectionAccess(): string[] | null {
  const raw = getCurrentUser()?.section_access;
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw as string[];
  try { const a = JSON.parse(raw as string); return Array.isArray(a) ? a : null; } catch { return null; }
}

/** Подтверждает токен на бэке и обновляет user в localStorage. Если 401 или не админ — стираем. */
export async function fetchMe(): Promise<AdminUser | null> {
  if (!getToken()) return null;
  try {
    const fresh = await api.get<Record<string, unknown> & { id: number; email: string; name: string; role: Role }>('/api/auth/me');
    if (!isStaffRole(fresh.role)) {
      // Кто-то подсунул токен агента в админку — гонимся.
      logout();
      return null;
    }
    const user: AdminUser = { ...fresh, loginAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return getCurrentUser();
  }
}

/** Open the agent portal as a specific agent (impersonation).
 *  Получает временный JWT агента и передаёт его на портал через URL. */
export async function impersonate(agentId: number, agentName: string) {
  const returnUrl = `${ADMIN_URL}/agents`;
  try {
    const { token } = await api.post<{ token: string }>('/api/auth/impersonate', { agentId });
    const url = `${PORTAL_URL}/dashboard?impersonateToken=${encodeURIComponent(token)}&impersonate=${agentId}&agentName=${encodeURIComponent(agentName)}&returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = url;
  } catch (e) {
    console.error('Impersonation failed', e);
    alert('Не удалось войти как агент: ' + (e instanceof Error ? e.message : 'ошибка'));
  }
}

/** SSO из URL: префиллим email (пароль вводит пользователь). */
export function trySsoFromUrl(): { ssoEmail: string } | null {
  const params = new URLSearchParams(window.location.search);
  const ssoEmail = params.get('ssoEmail');
  if (!ssoEmail) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('ssoEmail');
  window.history.replaceState({}, '', url.pathname + url.search);
  return { ssoEmail };
}
