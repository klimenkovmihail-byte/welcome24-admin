// Роли + матрица доступа админ-панели.
// Бэк уже сам блокирует мутации (requireSuperAdmin / requireStaff / requireAdmin),
// фронт делает то же самое для UX: прячет пункты сайдбара и блокирует роуты.

export type Role = 'super_admin' | 'admin' | 'manager' | 'agent';

// Какие разделы видны каждой роли.
// Ключ — путь в App router; значение — список ролей с доступом.
export const ROLE_ACCESS: Record<string, Role[]> = {
  '/dashboard':  ['super_admin', 'admin'],
  '/agents':     ['super_admin', 'admin'],
  '/deals':      ['super_admin', 'admin'],
  '/shares':     ['super_admin', 'admin'],
  '/academy':    ['super_admin', 'admin', 'manager'],
  '/news':       ['super_admin', 'admin', 'manager'],
  '/docs':       ['super_admin', 'admin', 'manager'],
  '/ai-prompts': ['super_admin', 'admin'],
  '/ai-analytics': ['super_admin'],
  '/backoffice': ['super_admin'],
  '/support':    ['super_admin', 'admin'],
  '/subscription-claims': ['super_admin', 'admin'],
  '/subscriptions': ['super_admin', 'admin'],
  '/analytics':  ['super_admin'],
  '/reports':    ['super_admin', 'admin'],
  '/settings':   ['super_admin'],
};

export function canAccess(role: Role | string | undefined, path: string): boolean {
  if (!role) return false;
  const allowed = ROLE_ACCESS[path];
  if (!allowed) return true; // нет правила — пускаем (например /login)
  return allowed.includes(role as Role);
}

// Первая доступная страница для редиректа после логина.
export function firstAccessiblePath(role: Role | string | undefined): string {
  const order = ['/dashboard', '/agents', '/academy', '/news', '/support', '/subscription-claims', '/analytics', '/settings'];
  for (const p of order) if (canAccess(role, p)) return p;
  return '/login';
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Супер-админ',
  admin:       'Админ',
  manager:     'Менеджер',
  agent:       'Агент',
};

export const ROLE_COLOR: Record<Role, string> = {
  super_admin: '#EF4444',
  admin:       '#C9A84C',
  manager:     '#4361EE',
  agent:       '#94A3B8',
};
