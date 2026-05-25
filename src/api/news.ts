/**
 * api/news — обёртка над /api/news/* для админки.
 *
 * Бэк хранит: title, summary, content, category, cover_url, author_name,
 * date, read_time, likes_count, is_featured, published.
 * Фронт работает с моделью Article (поля camelCase + pinned/likes).
 */

import { api } from './apiClient';

export interface Article {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  coverUrl: string;
  author: string;
  date: string;
  readTime: string;
  likes: number;
  pinned: boolean;
  published: boolean;
}

export interface ArticleComment {
  id: number;
  articleId: number;
  authorName: string;
  text: string;
  createdAt: string;
}

type RawArticle = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
  cover_url: string;
  author_name: string;
  date: string;
  read_time: string;
  likes_count: number;
  is_featured: number;
  published: number;
  created_at: string;
};

type RawComment = {
  id: number;
  article_id: number;
  author_id: number;
  author_name: string;
  text: string;
  created_at: string;
};

function normalize(raw: RawArticle): Article {
  return {
    id: raw.id,
    title: raw.title,
    summary: raw.summary || '',
    content: raw.content || '',
    category: raw.category,
    coverUrl: raw.cover_url || '',
    author: raw.author_name || '',
    date: raw.date,
    readTime: raw.read_time || '',
    likes: raw.likes_count || 0,
    pinned: !!raw.is_featured,
    published: !!raw.published,
  };
}

function normalizeComment(raw: RawComment): ArticleComment {
  return {
    id: raw.id,
    articleId: raw.article_id,
    authorName: raw.author_name,
    text: raw.text,
    createdAt: raw.created_at,
  };
}

export interface ArticlePayload {
  title: string;
  summary?: string;
  content?: string;
  category?: string;
  coverUrl?: string;
  authorName?: string;
  date?: string;
  readTime?: string;
  isFeatured?: boolean;
  published?: boolean;
}

export const newsApi = {
  list: () => api.get<RawArticle[]>('/api/news').then(rows => rows.map(normalize)),
  create: (payload: ArticlePayload) =>
    api.post<{ id: number }>('/api/news', payload as unknown as Record<string, unknown>),
  update: (id: number, payload: Partial<ArticlePayload>) =>
    api.patch<{ ok: true }>(`/api/news/${id}`, payload as unknown as Record<string, unknown>),
  remove: (id: number) => api.del<{ ok: true }>(`/api/news/${id}`),

  comments: (articleId: number) =>
    api.get<RawComment[]>(`/api/news/${articleId}/comments`).then(rows => rows.map(normalizeComment)),
  deleteComment: (commentId: number) =>
    api.del<{ ok: true }>(`/api/news/_comment/${commentId}`),
};
