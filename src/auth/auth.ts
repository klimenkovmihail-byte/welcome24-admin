// Demo auth (no real backend). In production: JWT cookie on .welcome24.ru domain.

export interface AdminUser {
  email: string;
  name: string;
  role: 'admin';
  loginAt: string;
}

const STORAGE_KEY = 'w24_admin_user';
const ADMIN_EMAILS = ['admin@w24.agency', 'mk@w24.agency'];

// URL'ы автоматически переключаются между local dev и production
const isProd = typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
export const PORTAL_URL = isProd
  ? (import.meta.env.VITE_PORTAL_URL || 'https://app.welcome24.ru')
  : 'http://localhost:5173';
export const ADMIN_URL = isProd
  ? (import.meta.env.VITE_ADMIN_URL || 'https://admin.welcome24.ru')
  : 'http://localhost:5174';

export function login(email: string): { ok: true; user: AdminUser } | { ok: false; error: string; redirectTo?: string } {
  const e = email.trim().toLowerCase();
  if (!e) return { ok: false, error: 'Введите email' };

  if (ADMIN_EMAILS.includes(e)) {
    const user: AdminUser = {
      email: e,
      name: e === 'admin@w24.agency' ? 'Администратор' : 'Михаил Клименков',
      role: 'admin',
      loginAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    return { ok: true, user };
  }

  // Not an admin — bounce to agent portal
  return { ok: false, error: 'У этого email нет прав администратора. Перенаправляем на портал агента…', redirectTo: `${PORTAL_URL}/login?ssoEmail=${encodeURIComponent(e)}` };
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getCurrentUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function isAuthenticated(): boolean {
  return !!getCurrentUser();
}

/** Open the agent portal as a specific agent (impersonation). */
export function impersonate(agentId: number, agentName: string) {
  const returnUrl = `${ADMIN_URL}/agents`;
  const url = `${PORTAL_URL}/dashboard?impersonate=${agentId}&agentName=${encodeURIComponent(agentName)}&returnUrl=${encodeURIComponent(returnUrl)}`;
  window.location.href = url;
}

/** Bounce SSO request to admin? Called from Login page when ?ssoEmail= present. */
export function trySsoFromUrl(): AdminUser | null {
  const params = new URLSearchParams(window.location.search);
  const ssoEmail = params.get('ssoEmail');
  if (!ssoEmail) return null;
  const result = login(ssoEmail);
  if (result.ok) {
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
    return result.user;
  }
  return null;
}
