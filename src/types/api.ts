/**
 * Welcome 24 — API Contract
 * ============================
 * Этот файл — единый источник истины для типов данных, которые
 * передаются между фронтом (порталом агента и админ-панелью)
 * и бэкендом. На production все эти ресурсы лежат за REST API:
 *
 *   GET    /api/{resource}            — список
 *   GET    /api/{resource}/{id}       — один объект
 *   POST   /api/{resource}            — создать
 *   PATCH  /api/{resource}/{id}       — частичное обновление
 *   DELETE /api/{resource}/{id}       — удалить
 *
 * Сейчас данные хранятся в mockData.ts (фронт-моки), а на бою
 * заменяются на fetch к этим эндпоинтам без изменения UI-кода.
 */

// ============================================================
// AGENTS — пользователи системы
// ============================================================
export type AgentRole = 'admin' | 'agent';
export type AgentStatus = 'active' | 'inactive' | 'blocked';
export type AgentLevel = 1 | 2 | 3;

export interface AgentSocials {
  telegram?: string;
  telegramChannel?: string;
  instagram?: string;
  vk?: string;
  max?: string;
  youtube?: string;
}

export interface Agent {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  photo: string | null;
  bio: string;
  role: AgentRole;
  status: AgentStatus;

  // Commission level
  level: AgentLevel;
  commission: 80 | 90 | 95;

  // MLM
  parentId: number | null;          // null = пришёл напрямую от Welcome 24
  teamLevel: number;                // 1..7 — позиция в дереве конкретного user'a

  // Stats
  joinDate: string;                 // ISO date
  experienceYears: number;
  totalDeals: number;
  totalVkd: number;
  totalIncome: number;

  // Agency
  specialization: string[];
  socials: AgentSocials;

  // Public rating
  rating: number;                   // 1.0–5.0
  reviewsCount: number;
}

// ============================================================
// REVIEWS — отзывы об агентах
// ============================================================
export interface AgentReview {
  id: number;
  agentId: number;
  authorId: number;                 // кто оставил отзыв
  authorName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;                     // >= 100 символов (валидация на фронте + бэке)
  createdAt: string;                // ISO datetime
  moderation: 'pending' | 'approved' | 'rejected';
}

// ============================================================
// DEALS — сделки
// ============================================================
export type DealStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';
export type DealType = 'primary' | 'secondary' | 'commercial' | 'suburban' | 'rent';

export interface Deal {
  id: number;
  agentId: number;
  clientName: string;
  address: string;
  city: string;
  type: DealType;
  vkd: number;                      // выручка комиссии в ₽
  income: number;                   // % от ВКД для агента
  commission: number;               // эффективный % (80/90/95)
  status: DealStatus;
  date: string;                     // ISO date
  notes: string;
}

// ============================================================
// SHARES — акции компании
// ============================================================
export type SharePacketType = 'purchase' | 'sale' | 'gift';
export type ShareOpType = 'issue' | 'transfer' | 'buyback';

export interface ShareQuote {
  id: number;
  date: string;
  price: number;                    // ₽ за 1 акцию
  note: string;
}

export interface SharePacket {
  id: number;
  ownerId: number;
  date: string;
  quantity: number;
  acquiredPrice: number;
  type: SharePacketType;
  note: string;
}

export interface ShareOperation {
  id: number;
  type: ShareOpType;
  fromAgentId: number | null;       // null = компания
  toAgentId: number | null;
  quantity: number;
  pricePerShare: number;
  totalAmount: number;
  date: string;
  notes: string;
}

// ============================================================
// COMPANY SETTINGS — глобальные параметры
// ============================================================
export interface CompanySettings {
  sharePrice: number;
  totalSharesIssued: number;
  totalSharesAvailable: number;
  level1Threshold: number;          // ₽ ВКД для перехода на 90%
  level2Threshold: number;          // ₽ ВКД для перехода на 95%
  level1Commission: 80;
  level2Commission: 90;
  level3Commission: 95;
}

// ============================================================
// MARKETING PLAN — 7 уровней пассивного дохода
// ============================================================
export interface MarketingLevel {
  level: number;                    // 1..7
  protected: number;                // % защищённого дохода
  growing: number | null;           // % растущего (или null для L1)
  required: number | null;          // нужно агентов на L1 с сделкой
  capPerAgent: number;              // ₽ годовой лимит с агента
}

// ============================================================
// ACADEMY — курсы, вебинары, события
// ============================================================
export type CourseLevel = 'Начинающий' | 'Средний' | 'Продвинутый';
export type CourseCategory =
  | 'Продажи' | 'Психология' | 'Маркетинг' | 'Лидерство'
  | 'Переговоры' | 'МЛМ' | 'Планирование' | 'Базовый';

export interface Lesson {
  id: number;
  title: string;
  duration: string;
  videoUrl: string;
  order: number;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  category: CourseCategory;
  level: CourseLevel;
  coverUrl: string;
  duration: string;                 // суммарная длительность
  lessons: Lesson[];
  authorId: number;
  authorName: string;
  rating: number;                   // средний рейтинг
  ratingCount: number;
  tags: string[];
  published: boolean;
  createdAt: string;
}

export interface CourseProgress {                // персональный прогресс
  agentId: number;
  courseId: number;
  completedLessons: number[];
  rating: 0 | 1 | 2 | 3 | 4 | 5;    // 0 = не поставил
  startedAt: string;
  finishedAt: string | null;
}

export type WebinarTopic = 'Новостройки' | 'Вторичка' | 'Юридический блок' | 'Ипотека' | 'Загородная' | 'Коммерческая';

export interface WebinarRecording {
  id: number;
  title: string;
  description: string;
  topic: WebinarTopic;
  videoUrl: string;
  coverUrl: string;
  duration: string;
  date: string;                     // дата проведения
  speakerId: number;
  speakerName: string;
  published: boolean;
  views: number;
  likesCount: number;
  isNew: boolean;
}

export interface WebinarComment {
  id: number;
  webinarId: number;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: string;
}

export type EventFormat = 'webinar' | 'masterclass' | 'meeting' | 'training';

export interface AcademyEvent {
  id: number;
  title: string;
  description: string;
  date: string;                     // YYYY-MM-DD
  startTime: string;                // HH:MM
  endTime: string;
  speakerId: number | null;
  speakerName: string;
  format: EventFormat;
  topic: string;
  location: string;                 // 'Онлайн' / 'Zoom' / адрес
  link: string;
  capacity: number | null;
  registered: number;               // count
  published: boolean;
}

export interface EventRegistration {
  id: number;
  eventId: number;
  agentId: number;
  registeredAt: string;
}

// ============================================================
// NEWS — новости и статьи
// ============================================================
export interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: 'Рынок' | 'Компания' | 'Обучение' | 'Советы' | 'Кейсы';
  coverUrl: string;
  authorName: string;
  date: string;
  readTime: string;
  likesCount: number;
  isFeatured: boolean;
  published: boolean;
}

export interface NewsComment {
  id: number;
  articleId: number;
  authorId: number;
  authorName: string;
  text: string;
  createdAt: string;
}

// ============================================================
// NOTIFICATIONS — для колокольчика
// ============================================================
export type NotificationType = 'deal' | 'agent' | 'shares' | 'news' | 'team' | 'alert' | 'system';

export interface Notification {
  id: number;
  recipientId: number;
  type: NotificationType;
  title: string;
  description: string;
  link: string | null;              // куда вести при клике
  createdAt: string;
  readAt: string | null;
}

// ============================================================
// REST endpoints — карта URLs
// ============================================================
export const API = {
  // Auth
  login:           'POST   /api/auth/login',
  logout:          'POST   /api/auth/logout',
  me:              'GET    /api/auth/me',

  // Agents
  agents:          'GET    /api/agents',
  agent:           'GET    /api/agents/:id',
  agentCreate:     'POST   /api/agents',
  agentUpdate:     'PATCH  /api/agents/:id',
  agentDelete:     'DELETE /api/agents/:id',
  agentReviews:    'GET    /api/agents/:id/reviews',
  agentReviewAdd:  'POST   /api/agents/:id/reviews',

  // Deals
  deals:           'GET    /api/deals',
  dealCreate:      'POST   /api/deals',
  dealUpdate:      'PATCH  /api/deals/:id',
  dealConfirm:     'POST   /api/deals/:id/confirm',
  dealPay:         'POST   /api/deals/:id/pay',
  dealCancel:      'POST   /api/deals/:id/cancel',

  // Shares
  sharesQuotes:    'GET    /api/shares/quotes',
  sharesQuoteAdd:  'POST   /api/shares/quotes',
  sharesQuoteDel:  'DELETE /api/shares/quotes/:id',
  sharesOps:       'GET    /api/shares/operations',
  sharesOpAdd:     'POST   /api/shares/operations',
  myPackets:       'GET    /api/shares/my-packets',

  // Settings & marketing
  settings:        'GET    /api/settings',
  settingsUpdate:  'PATCH  /api/settings',
  marketingPlan:   'GET    /api/marketing-plan',

  // Academy
  courses:         'GET    /api/academy/courses',
  courseCreate:    'POST   /api/academy/courses',
  courseUpdate:    'PATCH  /api/academy/courses/:id',
  courseDelete:    'DELETE /api/academy/courses/:id',
  courseProgress:  'GET    /api/academy/courses/:id/progress',
  courseRate:      'POST   /api/academy/courses/:id/rate',
  lessonComplete:  'POST   /api/academy/courses/:cid/lessons/:lid/complete',

  webinars:        'GET    /api/academy/webinars',
  webinarCreate:   'POST   /api/academy/webinars',
  webinarUpdate:   'PATCH  /api/academy/webinars/:id',
  webinarDelete:   'DELETE /api/academy/webinars/:id',
  webinarLike:     'POST   /api/academy/webinars/:id/like',
  webinarComment:  'POST   /api/academy/webinars/:id/comments',

  events:          'GET    /api/academy/events',
  eventCreate:     'POST   /api/academy/events',
  eventUpdate:     'PATCH  /api/academy/events/:id',
  eventDelete:     'DELETE /api/academy/events/:id',
  eventRegister:   'POST   /api/academy/events/:id/register',
  eventICS:        'GET    /api/academy/events/:id/ics',

  // News
  news:            'GET    /api/news',
  newsCreate:      'POST   /api/news',
  newsUpdate:      'PATCH  /api/news/:id',
  newsDelete:      'DELETE /api/news/:id',
  newsLike:        'POST   /api/news/:id/like',
  newsComment:     'POST   /api/news/:id/comments',

  // Notifications
  notifications:   'GET    /api/notifications',
  notifMarkRead:   'POST   /api/notifications/:id/read',
  notifMarkAll:    'POST   /api/notifications/read-all',
} as const;
