// SSE-менеджер (Фаза В): ОДИН EventSource на всё приложение — мгновенные
// чаты/инбокс/колокол. Событие — «звонок» без данных (тип + координаты),
// подписчики сами дотягивают данные обычными запросами. Поллинг остаётся
// фоллбэком: подписчики опрашивают реже, пока канал жив (sseConnected).
//
// Auth: EventSource не умеет Authorization-заголовок → POST /api/events/ticket
// (Bearer) выдаёт тикет, поток открывается с ?ticket=. Реконнект всегда свой
// (встроенный авто-реконнект не переживает 401/рестарт бэка): закрыли →
// новый тикет → новый EventSource, backoff до 30с.

import { api, API_BASE_URL, getToken } from '../api/apiClient';

type Handler = (data: Record<string, unknown>) => void;

const handlers = new Map<string, Set<Handler>>();
let es: EventSource | null = null;
let connected = false;
let started = false;
let retryMs = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function sseConnected(): boolean { return connected; }

/** Подписка на тип события ('thread' | 'notify' | '$status'). Возвращает отписку. */
export function sseSubscribe(type: string, fn: Handler): () => void {
  let set = handlers.get(type);
  if (!set) { set = new Set(); handlers.set(type, set); }
  set.add(fn);
  if (!started) { started = true; connect(); }
  return () => { set!.delete(fn); };
}

function emit(type: string, data: Record<string, unknown>) {
  handlers.get(type)?.forEach(fn => { try { fn(data); } catch { /* tolerate */ } });
}

function setConnected(v: boolean) {
  if (connected === v) return;
  connected = v;
  emit('$status', { connected: v });
}

async function connect() {
  if (!getToken()) { scheduleReconnect(); return; } // ещё не залогинен — подождём
  try {
    const { ticket } = await api.post<{ ticket: string }>('/events/ticket');
    const src = new EventSource(`${API_BASE_URL}/api/events?ticket=${encodeURIComponent(ticket)}`);
    es = src;
    src.onopen = () => { retryMs = 1000; setConnected(true); };
    src.onerror = () => {
      // Любая ошибка (сеть/401/рестарт бэка): закрываем и пересоздаём с новым тикетом.
      setConnected(false);
      src.close();
      if (es === src) es = null;
      scheduleReconnect();
    };
    for (const t of ['thread', 'notify']) {
      src.addEventListener(t, (e: MessageEvent) => {
        try { emit(t, JSON.parse(e.data)); } catch { /* tolerate */ }
      });
    }
  } catch {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, retryMs);
  retryMs = Math.min(retryMs * 2, 30_000);
}
