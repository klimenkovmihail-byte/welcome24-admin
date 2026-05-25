/**
 * api/academy — обёртка над /api/academy/* для админки.
 *
 * Три ресурса: webinars, events, courses (+lessons).
 * Бэк отдаёт snake_case + 0/1 для bool. Нормализуем в camelCase к
 * существующим Admin*-типам из mockData.ts (чтобы не ломать UI).
 */

import { api } from './apiClient';
import type {
  AdminCourse, AdminLesson, AdminWebinar, AdminEvent,
  AdminEventFormat, AcademyCategoryName, WebinarTopicName,
} from '../data/mockData';

// ============== WEBINARS ==============
type RawWebinar = {
  id: number;
  title: string;
  description: string;
  topic: string;
  video_url: string;
  cover_url: string;
  duration: string;
  date: string;
  speaker_id: number | null;
  speaker_name: string;
  views: number;
  likes_count: number;
  is_new: number;
  published: number;
};

function normalizeWebinar(raw: RawWebinar): AdminWebinar {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    topic: (raw.topic || 'Новостройки') as WebinarTopicName,
    coverUrl: raw.cover_url || '',
    videoUrl: raw.video_url || '',
    duration: raw.duration || '',
    date: raw.date,
    speaker: raw.speaker_name || '',
    views: raw.views || 0,
    likes: raw.likes_count || 0,
    published: !!raw.published,
    isNew: !!raw.is_new,
  };
}

export interface WebinarPayload {
  title: string;
  description?: string;
  topic?: WebinarTopicName | string;
  videoUrl?: string;
  coverUrl?: string;
  duration?: string;
  date?: string;
  speakerName?: string;
  isNew?: boolean;
  published?: boolean;
}

// ============== EVENTS ==============
type RawEvent = {
  id: number;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  speaker_id: number | null;
  speaker_name: string;
  format: AdminEventFormat;
  topic: string;
  location: string;
  link: string;
  capacity: number | null;
  published: number;
};

function normalizeEvent(raw: RawEvent): AdminEvent {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    date: raw.date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    speaker: raw.speaker_name || '',
    format: raw.format,
    topic: raw.topic || '',
    location: raw.location || 'Онлайн',
    link: raw.link || '',
    capacity: raw.capacity,
    registered: 0,
    published: !!raw.published,
  };
}

export interface EventPayload {
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  speakerName?: string;
  format?: AdminEventFormat;
  topic?: string;
  location?: string;
  link?: string;
  capacity?: number | null;
  published?: boolean;
}

// ============== COURSES ==============
type RawLesson = {
  id: number;
  course_id: number;
  title: string;
  duration: string;
  video_url: string;
  order_idx: number;
};

type RawCourse = {
  id: number;
  title: string;
  description: string;
  category: string;
  level: string;
  cover_url: string;
  duration: string;
  author_id: number | null;
  author_name: string;
  rating: number;
  rating_count: number;
  tags: string[];
  published: boolean;
  lessons: RawLesson[];
};

function normalizeLesson(raw: RawLesson): AdminLesson {
  return {
    id: raw.id,
    title: raw.title,
    duration: raw.duration || '',
    videoUrl: raw.video_url || '',
  };
}

function normalizeCourse(raw: RawCourse): AdminCourse {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description || '',
    category: (raw.category || 'Базовый') as AcademyCategoryName,
    level: (raw.level || 'Начинающий') as AdminCourse['level'],
    coverUrl: raw.cover_url || '',
    duration: raw.duration || '',
    author: raw.author_name || '',
    lessons: (raw.lessons || []).map(normalizeLesson),
    rating: raw.rating || 0,
    ratingCount: raw.rating_count || 0,
    published: !!raw.published,
  };
}

export interface CoursePayload {
  title: string;
  description?: string;
  category?: string;
  level?: string;
  coverUrl?: string;
  duration?: string;
  authorName?: string;
  published?: boolean;
  lessons?: Array<{ title: string; duration?: string; videoUrl?: string }>;
}

export const academyApi = {
  // webinars
  listWebinars: () =>
    api.get<RawWebinar[]>('/api/academy/webinars').then(rows => rows.map(normalizeWebinar)),
  createWebinar: (payload: WebinarPayload) =>
    api.post<{ id: number }>('/api/academy/webinars', payload as unknown as Record<string, unknown>),
  updateWebinar: (id: number, payload: Partial<WebinarPayload>) =>
    api.patch<{ ok: true }>(`/api/academy/webinars/${id}`, payload as unknown as Record<string, unknown>),
  removeWebinar: (id: number) =>
    api.del<{ ok: true }>(`/api/academy/webinars/${id}`),

  // events
  listEvents: () =>
    api.get<RawEvent[]>('/api/academy/events').then(rows => rows.map(normalizeEvent)),
  createEvent: (payload: EventPayload) =>
    api.post<{ id: number }>('/api/academy/events', payload as unknown as Record<string, unknown>),
  updateEvent: (id: number, payload: Partial<EventPayload>) =>
    api.patch<{ ok: true }>(`/api/academy/events/${id}`, payload as unknown as Record<string, unknown>),
  removeEvent: (id: number) =>
    api.del<{ ok: true }>(`/api/academy/events/${id}`),

  // courses
  listCourses: () =>
    api.get<RawCourse[]>('/api/academy/courses').then(rows => rows.map(normalizeCourse)),
  createCourse: (payload: CoursePayload) =>
    api.post<{ id: number }>('/api/academy/courses', payload as unknown as Record<string, unknown>),
  updateCourse: (id: number, payload: Partial<CoursePayload>) =>
    api.patch<{ ok: true }>(`/api/academy/courses/${id}`, payload as unknown as Record<string, unknown>),
  removeCourse: (id: number) =>
    api.del<{ ok: true }>(`/api/academy/courses/${id}`),
};
