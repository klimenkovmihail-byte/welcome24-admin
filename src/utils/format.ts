// Утилиты форматирования админ-панели — единый источник для UI.
// Self-contained: копия идей портала, адаптирована под админку.

// Неразрывный пробел — чтобы «₽» и разряды не отрывались при переносе.
const NBSP = ' ';

// Дробная часть по-русски: запятая, максимум 1 знак («12,3», «2»).
const ru1 = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });

/** Русское склонение: plural(5, 'сделка', 'сделки', 'сделок') → «сделок». */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs % 100 >= 11 && abs % 100 <= 14) return many;
  if (abs % 10 === 1) return one;
  if (abs % 10 >= 2 && abs % 10 <= 4) return few;
  return many;
}

// SQLite отдаёт 'YYYY-MM-DD HH:MM:SS' (UTC без Z) — нормализуем к ISO,
// иначе Safari не парсит, а Chrome считает время локальным.
const parseIso = (iso?: string | null): Date | null => {
  if (!iso) return null;
  let s = iso;
  if (!s.includes('T') && !s.includes('Z')) {
    // Либо 'YYYY-MM-DD HH:MM:SS' (datetime UTC без Z) → пробел в 'T'+'Z',
    // либо 'YYYY-MM-DD' (date-only) → добавляем время: голый 'YYYY-MM-DDZ'
    // невалиден по спецификации и падает в Safari/iOS (Invalid Date).
    s = s.includes(' ') ? `${s.replace(' ', 'T')}Z` : `${s}T00:00:00Z`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Дата по-русски: «05.07.2026». Невалидный вход → ''. */
export function formatDate(iso?: string | null): string {
  const d = parseIso(iso);
  return d ? d.toLocaleDateString('ru-RU') : '';
}

/** Дата и время в локальной зоне пользователя: «05.07.2026 14:32». Невалидный вход → ''. */
export function formatDateTime(iso?: string | null): string {
  const d = parseIso(iso);
  if (!d) return '';
  return `${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

/** Целое с ru-RU группировкой разрядов: «12 345 678». */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

/** Полная сумма: «1 250 000 ₽» (перед ₽ — неразрывный пробел). */
export function formatRub(n: number): string {
  return `${formatNumber(n)}${NBSP}₽`;
}

/**
 * Деньги для отображения в UI:
 * - до 1 000 000 — полная сумма с пробелами: «14 088 ₽», «250 ₽»
 * - 1М и выше    — компактно: «1,5 млн ₽», «12,3 млн ₽»
 * - 1 млрд+      — «1,5 млрд ₽»
 * Перед знаком валюты — неразрывный пробел.
 */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return `0${NBSP}₽`;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${ru1(n / 1_000_000_000)}${NBSP}млрд${NBSP}₽`;
  if (abs >= 1_000_000)     return `${ru1(n / 1_000_000)}${NBSP}млн${NBSP}₽`;
  if (abs >= 1_000)         return `${ru1(n / 1_000)}${NBSP}тыс${NBSP}₽`;
  return `${formatNumber(n)}${NBSP}₽`;
}
