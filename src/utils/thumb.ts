// URL превью выводится из URL фото по той же схеме, что на бэке
// (helpers/images.js → thumbKey): .../RND.png → .../RND_thumb.webp.
// Только для картинок на нашем Object Storage; внешние/base64 — как есть.
const STORAGE_HOST = 'storage.yandexcloud.net';

export function thumbUrl(url?: string | null): string | null {
  if (!url) return null;
  if (!url.includes(STORAGE_HOST)) return url;
  if (url.includes('_thumb.webp')) return url;
  const [base] = url.split('?');
  return base.replace(/\.[^./]+$/, '') + '_thumb.webp';
}
