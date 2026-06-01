// Роли + матрица доступа админ-панели.
// Бэк уже сам блокирует мутации (requireSuperAdmin / requireStaff / requireAdmin),
// фронт делает то же самое для UX: прячет пункты сайдбара и блокирует роуты.

export type Role = 'super_admin' | 'admin' | 'manager' | 'agent' | 'lawyer' | 'broker' | 'listing_manager';

// Какие разделы видны каждой роли.
// Ключ — путь в App router; значение — список ролей с доступом.
export const ROLE_ACCESS: Record<string, Role[]> = {
  '/dashboard':  ['super_admin', 'admin'],
  '/agents':     ['super_admin', 'admin'],
  '/deals':      ['super_admin', 'admin'],
  // Заявки специалистам: видят админы + сами специалисты (юрист/брокер).
  '/cases':      ['super_admin', 'admin', 'lawyer', 'broker'],
  // Отдел рекламы: админы + листинг-менеджеры.
  '/ad-requests': ['super_admin', 'admin', 'listing_manager'],
  '/shares':     ['super_admin', 'admin'],
  '/academy':    ['super_admin', 'admin', 'manager'],
  '/news':       ['super_admin', 'admin', 'manager'],
  '/docs':       ['super_admin', 'admin', 'manager'],
  '/ai-prompts': ['super_admin'],
  '/ai-analytics': ['super_admin'],
  '/backoffice': ['super_admin'],
  '/support':    ['super_admin', 'admin'],
  '/subscription-claims': ['super_admin', 'admin'],
  '/subscriptions': ['super_admin', 'admin'],
  '/analytics':  ['super_admin'],
  '/reports':    ['super_admin', 'admin'],
  '/settings':   ['super_admin'],
};

// Критичные разделы — только super_admin, нельзя делегировать.
export const LOCKED_SECTIONS = ['/settings', '/ai-prompts'];

// Настраиваемые разделы (super_admin выдаёт/забирает у сотрудников). Метки для UI.
export const SECTION_LIST: { path: string; label: string }[] = [
  { path: '/dashboard',           label: 'Обзор' },
  { path: '/agents',              label: 'Агенты' },
  { path: '/deals',               label: 'Сделки' },
  { path: '/cases',               label: 'Заявки специалистам' },
  { path: '/ad-requests',         label: 'Отдел рекламы' },
  { path: '/shares',              label: 'Акции' },
  { path: '/academy',             label: 'Академия' },
  { path: '/news',                label: 'Новости' },
  { path: '/docs',                label: 'База данных' },
  { path: '/support',             label: 'Поддержка' },
  { path: '/subscriptions',       label: 'Абон. плата' },
  { path: '/subscription-claims', label: 'Заявки на оплату' },
  { path: '/reports',             label: 'Отчёты' },
  { path: '/analytics',           label: 'Аналитика' },
  { path: '/ai-analytics',        label: 'AI-аналитика' },
  { path: '/backoffice',          label: 'Команда' },
];

// sectionAccess — индивидуальный список разделов сотрудника (null = дефолт роли).
export function canAccess(role: Role | string | undefined, path: string, sectionAccess?: string[] | null): boolean {
  if (!role) return false;
  if (role === 'super_admin') return true;                 // super_admin видит всё
  if (LOCKED_SECTIONS.includes(path)) return false;        // критичные — только super_admin
  if (sectionAccess) return sectionAccess.includes(path);  // индивидуальная настройка
  const allowed = ROLE_ACCESS[path];
  if (!allowed) return true; // нет правила — пускаем (например /login)
  return allowed.includes(role as Role);
}

// Первая доступная страница для редиректа после логина.
export function firstAccessiblePath(role: Role | string | undefined, sectionAccess?: string[] | null): string {
  const order = ['/dashboard', '/cases', '/ad-requests', '/agents', '/academy', '/news', '/support', '/subscriptions', '/subscription-claims', '/reports', '/analytics', '/settings'];
  for (const p of order) if (canAccess(role, p, sectionAccess)) return p;
  return '/login';
}

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Супер-админ',
  admin:       'Админ',
  manager:     'Менеджер',
  agent:       'Агент',
  lawyer:      'Юрист',
  broker:      'Брокер',
  listing_manager: 'Листинг-менеджер',
};

export const ROLE_COLOR: Record<Role, string> = {
  super_admin: '#EF4444',
  admin:       '#C9A84C',
  manager:     '#4361EE',
  agent:       '#94A3B8',
  lawyer:      '#22C55E',
  broker:      '#8B5CF6',
  listing_manager: '#06B6D4',
};
