/* Web Push — клиентская логика для админки (юрист/брокер/админ).
 * Бэк тот же: /api/agents/me/push-key|subscribe|unsubscribe. */

import { agentsApi } from './api/agents';

export type PushState = 'unsupported' | 'server-off' | 'denied' | 'subscribed' | 'default';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

let swReg: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try { swReg = await navigator.serviceWorker.register('/sw.js'); return swReg; }
  catch { return null; }
}

async function getReg(): Promise<ServiceWorkerRegistration | null> {
  if (swReg) return swReg;
  if (!('serviceWorker' in navigator)) return null;
  swReg = (await navigator.serviceWorker.ready.catch(() => null)) as ServiceWorkerRegistration | null;
  return swReg;
}

export async function getPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  let serverOn = false;
  try { serverOn = (await agentsApi.pushKey()).enabled; } catch { serverOn = false; }
  if (!serverOn) return 'server-off';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await getReg();
  const existing = reg ? await reg.pushManager.getSubscription() : null;
  if (existing && Notification.permission === 'granted') return 'subscribed';
  return 'default';
}

export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  const { enabled, publicKey } = await agentsApi.pushKey().catch(() => ({ enabled: false, publicKey: '' }));
  if (!enabled || !publicKey) return 'server-off';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'default';
  const reg = (await registerServiceWorker()) || (await getReg());
  if (!reg) return 'unsupported';
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
    await agentsApi.pushSubscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    });
  }
  return 'subscribed';
}

// Привязать существующую подписку к текущему вошедшему пользователю.
export async function syncPushSubscription(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return;
  const reg = await getReg();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (!sub) return;
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
    await agentsApi.pushSubscribe({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      userAgent: navigator.userAgent,
    }).catch(() => {});
  }
}
