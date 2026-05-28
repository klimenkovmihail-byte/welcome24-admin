import type { Agent, Deal, ShareOperation, CompanySettings } from '../types';

export const companySettings: CompanySettings = {
  sharePrice: 7044,
  totalSharesIssued: 100000,
  totalSharesAvailable: 43250,
  level1Threshold: 2000000,
  level2Threshold: 5000000,
  level1Commission: 80,
  level2Commission: 90,
  level3Commission: 95,
};

// Helper: defaults for the new public-profile fields
const defaultSocials = {};

export const agents: Agent[] = [
  { id: 1, name: 'Клименков Михаил Михайлович', email: 'mk@w24.agency', phone: '+7 (999) 123-45-67', city: 'Москва', level: 1, commission: 80, status: 'active', parentId: null, parentName: null, joinDate: '2024-03-15', specialization: ['Жилая', 'Вторичная'], vkdYear: 638350, incomeYear: 510680, dealsYear: 2, shares: 7560, teamSize: 48,
    photo: null, bio: 'CEO Welcome 24. 4 года опыта, помогаю молодым семьям найти первую квартиру в Москве.',
    socials: { telegram: 'mk_w24', telegramChannel: '@welcome24_ceo', instagram: 'mikhail.klimenkov', vk: 'klimenkov_mk', max: 'mk_w24' },
    rating: 5.0, reviewsCount: 12 },
  { id: 2, name: 'Кулаков Степан Владимирович', email: 'kulakov@w24.agency', phone: '+7 (905) 234-56-78', city: 'Москва', level: 3, commission: 95, status: 'active', parentId: 1, parentName: 'Клименков Михаил Михайлович', joinDate: '2024-01-10', specialization: ['Жилая', 'Загородная'], vkdYear: 8450000, incomeYear: 6760000, dealsYear: 24, shares: 12400, teamSize: 6,
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    bio: 'Топ-1 агент Welcome 24. 24 сделки за 5 месяцев. Веду YouTube-канал про недвижимость.',
    socials: { telegram: 'kulakov_step', telegramChannel: '@kulakov_property', instagram: 'stepan.kulakov' },
    rating: 5.0, reviewsCount: 8 },
  { id: 3, name: 'Радченко Дмитрий Владимирович', email: 'radchenko@w24.agency', phone: '+7 (918) 345-67-89', city: 'Краснодар', level: 3, commission: 95, status: 'active', parentId: 1, parentName: 'Клименков Михаил Михайлович', joinDate: '2024-01-20', specialization: ['Жилая', 'Коммерческая'], vkdYear: 6200000, incomeYear: 4960000, dealsYear: 19, shares: 9800, teamSize: 5,
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    bio: 'Краснодарский край и побережье. Большая база клиентов из Москвы.',
    socials: { telegram: 'radchenko_d', telegramChannel: '@krasnodar_realty', instagram: 'dmitriy.radchenko' },
    rating: 4.8, reviewsCount: 4 },
  { id: 4, name: 'Мухин Вячеслав Александрович', email: 'mukhin@w24.agency', phone: '+7 (916) 456-78-90', city: 'Москва', level: 2, commission: 90, status: 'active', parentId: 1, parentName: 'Клименков Михаил Михайлович', joinDate: '2024-11-05', specialization: ['Жилая'], vkdYear: 5800000, incomeYear: 4640000, dealsYear: 17, shares: 8200, teamSize: 10,
    photo: null,
    bio: 'Спецагент по сложным сделкам: расселение коммуналок, наследство, проблемная история объекта.',
    socials: { telegram: 'mukhin_v', vk: 'mukhin_realty' },
    rating: 4.6, reviewsCount: 5 },
  { id: 5, name: 'Верховская Валерия Владимировна', email: 'verkh@w24.agency', phone: '+7 (921) 567-89-01', city: 'СПб', level: 2, commission: 90, status: 'active', parentId: 1, parentName: 'Клименков Михаил Михайлович', joinDate: '2025-02-01', specialization: ['Жилая', 'Коммерческая'], vkdYear: 4950000, incomeYear: 3960000, dealsYear: 15, shares: 6100, teamSize: 1,
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    bio: 'Топовый агент Петербурга. Специализируюсь на квартирах в исторических домах и новостройках.',
    socials: { telegram: 'verkhovskaya', instagram: 'valeria.spb', vk: 'verkhovskaya_v' },
    rating: 4.9, reviewsCount: 7 },
  { id: 6, name: 'Изотов Илья Анатольевич', email: 'izotov@w24.agency', phone: '+7 (999) 678-90-12', city: 'Москва', level: 2, commission: 90, status: 'active', parentId: 1, parentName: 'Клименков Михаил Михайлович', joinDate: '2025-03-10', specialization: ['Жилая'], vkdYear: 4200000, incomeYear: 3360000, dealsYear: 13, shares: 4500, teamSize: 1,
    photo: null, bio: '', socials: defaultSocials, rating: 4.5, reviewsCount: 2 },
  { id: 7, name: 'Санкин Александр Александрович', email: 'sankin@w24.agency', phone: '+7 (999) 789-01-23', city: 'Новосибирск', level: 2, commission: 90, status: 'inactive', parentId: 2, parentName: 'Кулаков Степан Владимирович', joinDate: '2025-02-15', specialization: ['Жилая'], vkdYear: 3600000, incomeYear: 2880000, dealsYear: 11, shares: 3200, teamSize: 2,
    photo: null, bio: '', socials: defaultSocials, rating: 4.3, reviewsCount: 1 },
  { id: 8, name: 'Ситников Андрей Николаевич', email: 'sitnikov@w24.agency', phone: '+7 (999) 890-12-34', city: 'Екатеринбург', level: 1, commission: 80, status: 'active', parentId: 2, parentName: 'Кулаков Степан Владимирович', joinDate: '2024-12-01', specialization: ['Жилая'], vkdYear: 3100000, incomeYear: 2480000, dealsYear: 10, shares: 2800, teamSize: 1,
    photo: null, bio: '', socials: defaultSocials, rating: 4.4, reviewsCount: 0 },
  { id: 9, name: 'Бородина Елена Валерьевна', email: 'borodina@w24.agency', phone: '+7 (999) 901-23-45', city: 'Казань', level: 1, commission: 80, status: 'active', parentId: 3, parentName: 'Радченко Дмитрий Владимирович', joinDate: '2025-04-05', specialization: ['Жилая'], vkdYear: 2800000, incomeYear: 2240000, dealsYear: 9, shares: 1500, teamSize: 1,
    photo: null, bio: '', socials: defaultSocials, rating: 4.7, reviewsCount: 1 },
  { id: 10, name: 'Михалева Полина Игоревна', email: 'mikhaleva@w24.agency', phone: '+7 (999) 012-34-56', city: 'Москва', level: 1, commission: 80, status: 'blocked', parentId: 4, parentName: 'Мухин Вячеслав Александрович', joinDate: '2025-05-10', specialization: ['Жилая'], vkdYear: 0, incomeYear: 0, dealsYear: 0, shares: 500, teamSize: 1,
    photo: null, bio: '', socials: defaultSocials, rating: 0, reviewsCount: 0 },
];

// Reviews waiting for moderation or already approved
export const agentReviews: AgentReview[] = [
  { id: 1, agentId: 2,  authorName: 'Петров И.А.',    rating: 5, text: 'Степан — это уровень! Закрыл сделку на 4.5 млн ВКД за две недели. Я бы и за месяц не справился.', createdAt: '2026-05-10', moderation: 'approved' },
  { id: 2, agentId: 2,  authorName: 'Орлова Н.С.',    rating: 5, text: 'Помог купить дом на Рублёвке. Знает всех важных людей в этом районе.',                              createdAt: '2026-05-22', moderation: 'approved' },
  { id: 3, agentId: 2,  authorName: 'Михалева П.И.',  rating: 5, text: 'Лучший наставник! Его принципы продаж работают на 100%.',                                          createdAt: '2026-04-30', moderation: 'approved' },
  { id: 4, agentId: 3,  authorName: 'Сидорова М.В.',  rating: 5, text: 'Подобрал отличную квартиру в новостройке ЖК «Южный». Очень довольна!',                              createdAt: '2026-05-15', moderation: 'approved' },
  { id: 5, agentId: 5,  authorName: 'Новикова Т.О.',  rating: 5, text: 'Валерия нашла мне квартиру моей мечты на Невском! Невероятный профессионализм.',                    createdAt: '2026-05-18', moderation: 'approved' },
  { id: 6, agentId: 5,  authorName: 'Семёнов А.К.',   rating: 5, text: 'Лучший агент в СПб без преувеличения.',                                                            createdAt: '2026-04-02', moderation: 'approved' },
  { id: 7, agentId: 4,  authorName: 'Козлов Д.П.',    rating: 5, text: 'Помог с расселением коммуналки на Проспекте Мира. Сложнейшая сделка, всё прошло без проблем.',     createdAt: '2026-05-20', moderation: 'approved' },
  // Ожидают модерации
  { id: 8, agentId: 7,  authorName: 'Анонимный пользователь', rating: 1, text: 'Не отвечает на звонки, пропадает после показа. Не рекомендую.',                              createdAt: '2026-05-23', moderation: 'pending' },
  { id: 9, agentId: 10, authorName: 'Какой-то клиент',         rating: 2, text: 'Очень странный текст с подозрительными словами, проверьте на модерации.',                  createdAt: '2026-05-24', moderation: 'pending' },
];

export const deals: Deal[] = [
  { id: 1, agentId: 2, agentName: 'Кулаков Степан Владимирович', clientName: 'Петров И.А.', address: 'Москва, ул. Тверская, 15 кв. 42', vkd: 4500000, income: 4275000, commission: 95, status: 'paid', date: '2026-05-10', city: 'Москва', type: 'secondary', notes: '' },
  { id: 2, agentId: 3, agentName: 'Радченко Дмитрий Владимирович', clientName: 'Сидорова М.В.', address: 'Краснодар, ул. Красная, 8 кв. 15', vkd: 2800000, income: 2660000, commission: 95, status: 'confirmed', date: '2026-05-15', city: 'Краснодар', type: 'primary', notes: 'Новостройка ЖК Южный' },
  { id: 3, agentId: 1, agentName: 'Клименков Михаил Михайлович', clientName: 'Иванов А.С.', address: 'Москва, ул. Профсоюзная, 44 кв. 108', vkd: 300000, income: 240000, commission: 80, status: 'paid', date: '2026-04-02', city: 'Москва', type: 'secondary', notes: '' },
  { id: 4, agentId: 4, agentName: 'Мухин Вячеслав Александрович', clientName: 'Козлов Д.П.', address: 'Москва, пр. Мира, 120 кв. 5', vkd: 6200000, income: 5580000, commission: 90, status: 'pending', date: '2026-05-20', city: 'Москва', type: 'secondary', notes: 'Ожидаем банковское одобрение' },
  { id: 5, agentId: 5, agentName: 'Верховская Валерия Владимировна', clientName: 'Новикова Т.О.', address: 'СПб, Невский пр., 55 кв. 12', vkd: 3100000, income: 2790000, commission: 90, status: 'confirmed', date: '2026-05-18', city: 'СПб', type: 'secondary', notes: '' },
  { id: 6, agentId: 6, agentName: 'Изотов Илья Анатольевич', clientName: 'Морозов В.К.', address: 'Москва, ул. Ленина, 2 кв. 87', vkd: 2200000, income: 1980000, commission: 90, status: 'paid', date: '2026-05-05', city: 'Москва', type: 'primary', notes: '' },
  { id: 7, agentId: 2, agentName: 'Кулаков Степан Владимирович', clientName: 'Орлова Н.С.', address: 'Москва, Рублёвское ш., 18', vkd: 12000000, income: 11400000, commission: 95, status: 'pending', date: '2026-05-22', city: 'Москва', type: 'suburban', notes: 'VIP клиент, загородный дом' },
];

export const shareOperations: ShareOperation[] = [
  { id: 1, type: 'issue', fromAgentId: null, fromAgentName: null, toAgentId: 2, toAgentName: 'Кулаков Степан Владимирович', quantity: 5000, pricePerShare: 5000, totalAmount: 25000000, date: '2024-01-15', notes: 'Первичная эмиссия' },
  { id: 2, type: 'issue', fromAgentId: null, fromAgentName: null, toAgentId: 1, toAgentName: 'Клименков Михаил Михайлович', quantity: 7560, pricePerShare: 5500, totalAmount: 41580000, date: '2024-03-20', notes: 'Инвестиционный пакет основателя' },
  { id: 3, type: 'transfer', fromAgentId: 2, fromAgentName: 'Кулаков Степан Владимирович', toAgentId: 8, toAgentName: 'Ситников Андрей Николаевич', quantity: 500, pricePerShare: 6200, totalAmount: 3100000, date: '2025-03-10', notes: 'Мотивационный пакет' },
  { id: 4, type: 'issue', fromAgentId: null, fromAgentName: null, toAgentId: 3, toAgentName: 'Радченко Дмитрий Владимирович', quantity: 3000, pricePerShare: 6800, totalAmount: 20400000, date: '2025-06-01', notes: 'За выполнение плана 2025' },
  { id: 5, type: 'transfer', fromAgentId: 1, fromAgentName: 'Клименков Михаил Михайлович', toAgentId: 5, toAgentName: 'Верховская Валерия Владимировна', quantity: 200, pricePerShare: 7000, totalAmount: 1400000, date: '2025-09-15', notes: 'Поощрительный пакет' },
  { id: 6, type: 'issue', fromAgentId: null, fromAgentName: null, toAgentId: 4, toAgentName: 'Мухин Вячеслав Александрович', quantity: 2000, pricePerShare: 7044, totalAmount: 14088000, date: '2026-01-10', notes: 'Пакет за Q4 2025' },
  { id: 7, type: 'buyback', fromAgentId: 7, fromAgentName: 'Санкин Александр Александрович', toAgentId: null, toAgentName: null, quantity: 300, pricePerShare: 7044, totalAmount: 2113200, date: '2026-04-01', notes: 'Выкуп при выходе из команды' },
];

/** Quote history of W24 share (asc by date) — set by admin */
export interface ShareQuote { id: number; date: string; price: number; note: string }
export const shareQuotes: ShareQuote[] = [
  { id: 1, date: '2024-07-16', price: 5000, note: 'Стартовая котировка при запуске' },
  { id: 2, date: '2025-04-04', price: 5841, note: 'Итоги Q1 2025' },
  { id: 3, date: '2025-08-18', price: 6834, note: 'После запуска офиса в Краснодаре' },
  { id: 4, date: '2026-02-20', price: 7044, note: 'Текущая котировка' },
];

// ============================================================
// ACADEMY admin data — для CMS курсов / вебинаров / событий
// ============================================================

export type AcademyCategoryName =
  | 'Продажи' | 'Психология' | 'Маркетинг' | 'Лидерство'
  | 'Переговоры' | 'МЛМ' | 'Планирование' | 'Базовый';

export const COURSE_CATEGORIES: AcademyCategoryName[] = [
  'Базовый', 'Продажи', 'Психология', 'Маркетинг', 'Лидерство',
  'Переговоры', 'МЛМ', 'Планирование',
];

export type WebinarTopicName = 'Новостройки' | 'Вторичка' | 'Юридический блок' | 'Ипотека' | 'Загородная' | 'Коммерческая';

export const WEBINAR_TOPICS: WebinarTopicName[] = [
  'Новостройки', 'Вторичка', 'Юридический блок', 'Ипотека', 'Загородная', 'Коммерческая',
];

export interface AdminLesson { id: number; title: string; duration: string; videoUrl: string }

export interface CourseAttachment {
  name: string;
  url: string;
  key?: string;
  size?: number;
}

export interface AdminCourse {
  id: number;
  title: string;
  description: string;
  content?: string;
  attachments?: CourseAttachment[];
  orderIdx?: number;
  category: AcademyCategoryName;
  level: 'Начинающий' | 'Средний' | 'Продвинутый';
  coverUrl: string;
  duration: string;
  author: string;
  lessons: AdminLesson[];
  rating: number;
  ratingCount: number;
  published: boolean;
}

export const adminCourses: AdminCourse[] = [
  { id: 1, title: 'Основы риэлторского дела',  category: 'Базовый',      level: 'Начинающий',  description: 'Базовый курс для начинающих агентов. Юридическая база, этика, первые сделки.', coverUrl: '',                                                                            duration: '4 часа 30 мин', author: 'Клименков М.М.', rating: 4.9, ratingCount: 87, published: true,
    lessons: [
      { id: 1, title: 'Введение в профессию',          duration: '15 мин', videoUrl: '' },
      { id: 2, title: 'Правовая база: ключевые законы', duration: '25 мин', videoUrl: '' },
      { id: 3, title: 'Первый контакт с клиентом',     duration: '20 мин', videoUrl: '' },
    ],
  },
  { id: 2, title: 'Психология продаж в недвижимости', category: 'Продажи',  level: 'Средний', description: 'Техники убеждения, работа с возражениями, построение доверия с клиентом.',     coverUrl: '', duration: '6 часов 15 мин', author: 'Радченко Д.В.',  rating: 4.8, ratingCount: 54, published: true,
    lessons: [
      { id: 1, title: 'Типология клиентов',         duration: '22 мин', videoUrl: '' },
      { id: 2, title: 'Техника активного слушания', duration: '18 мин', videoUrl: '' },
      { id: 3, title: 'Работа с возражениями',      duration: '30 мин', videoUrl: '' },
    ],
  },
  { id: 3, title: 'Переговоры на миллион',            category: 'Переговоры', level: 'Продвинутый', description: 'Техника переговоров с клиентами, контрагентами, банком.',                    coverUrl: '', duration: '6 часов', author: 'Кулаков С.В.', rating: 4.9, ratingCount: 32, published: true,
    lessons: [
      { id: 1, title: 'Подготовка к переговорам', duration: '20 мин', videoUrl: '' },
      { id: 2, title: 'Техника BATNA',            duration: '25 мин', videoUrl: '' },
    ],
  },
  { id: 4, title: 'Маркетинг объектов недвижимости', category: 'Маркетинг', level: 'Средний', description: 'Продвижение объектов: фото, видео, соцсети, таргетированная реклама.', coverUrl: '', duration: '5 часов', author: 'Верховская В.В.', rating: 4.7, ratingCount: 41, published: true, lessons: [] },
  { id: 5, title: 'MLM-структура Welcome 24',         category: 'МЛМ',      level: 'Средний', description: 'Как работает многоуровневая система дохода. Уровни команды, защищённый и растущий процент.', coverUrl: '', duration: '3 часа 45 мин', author: 'Мухин В.А.', rating: 4.6, ratingCount: 28, published: true, lessons: [] },
  { id: 6, title: 'Построение команды агентов',       category: 'Лидерство', level: 'Продвинутый', description: 'Рекрутинг, мотивация, обучение команды. Многоуровневая система дохода W24.', coverUrl: '', duration: '7 часов', author: 'Клименков М.М.', rating: 4.9, ratingCount: 19, published: true, lessons: [] },
  { id: 7, title: 'Планирование на год вперёд',       category: 'Планирование', level: 'Средний', description: 'Постановка целей по SMART. Декомпозиция плана. Контроль выполнения.', coverUrl: '', duration: '4 часа', author: 'Радченко Д.В.', rating: 4.7, ratingCount: 12, published: false, lessons: [] },
  { id: 8, title: 'Психология клиента',              category: 'Психология', level: 'Средний', description: 'Психотипы клиентов. Триггеры и страхи при покупке жилья.', coverUrl: '', duration: '5 часов 30 мин', author: 'Верховская В.В.', rating: 4.8, ratingCount: 23, published: true, lessons: [] },
];

// === Webinars ===
export interface AdminWebinar {
  id: number;
  title: string;
  description: string;
  topic: WebinarTopicName;
  coverUrl: string;
  videoUrl: string;
  duration: string;
  date: string;
  speaker: string;
  views: number;
  likes: number;
  published: boolean;
  isNew: boolean;
}

export const adminWebinars: AdminWebinar[] = [
  { id: 1, title: 'Семейная ипотека 2.0 — новые условия с июня',   description: 'Разбор изменений семейной ипотеки.',                topic: 'Ипотека',          coverUrl: '', videoUrl: '', duration: '1ч 24мин', date: '2026-05-19', speaker: 'Колесникова А.В.', views: 1287, likes: 87, published: true, isNew: true },
  { id: 2, title: 'Топ-5 ЖК Москвы для инвестора в 2026',           description: 'Объективный анализ инвестпотенциала пяти ЖК.',     topic: 'Новостройки',      coverUrl: '', videoUrl: '', duration: '58 мин',   date: '2026-05-12', speaker: 'Кулаков С.В.',     views: 942,  likes: 56, published: true, isNew: true },
  { id: 3, title: 'Альтернативная сделка: как не потерять цепочку', description: 'Пошаговая инструкция.',                            topic: 'Вторичка',         coverUrl: '', videoUrl: '', duration: '1ч 36мин', date: '2026-04-28', speaker: 'Мухин В.А.',       views: 1543, likes: 124, published: true, isNew: false },
  { id: 4, title: 'Проверка квартиры перед покупкой: чек-лист',    description: 'Все документы, которые нужно запросить.',          topic: 'Юридический блок', coverUrl: '', videoUrl: '', duration: '47 мин',   date: '2026-04-20', speaker: 'Радченко Д.В.',    views: 2014, likes: 178, published: true, isNew: false },
  { id: 5, title: 'Загородные дома: что покупать в 2026',           description: 'Сегменты загородной недвижимости.',                topic: 'Загородная',       coverUrl: '', videoUrl: '', duration: '1ч 12мин', date: '2026-04-15', speaker: 'Аникеев В.В.',     views: 776,  likes: 42, published: true, isNew: false },
];

// === Schedule events ===
export type AdminEventFormat = 'webinar' | 'masterclass' | 'meeting' | 'training';

export interface AdminEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  speaker: string;
  format: AdminEventFormat;
  topic: string;
  location: string;
  link: string;
  capacity: number | null;
  registered: number;
  published: boolean;
}

// ============================================================
// MARKETING PLAN — 7 уровней пассивного дохода (управляется админом)
// ============================================================
export interface MarketingPlanRow {
  level: number;            // 1..7
  protected: number;        // % защищённого
  growing: number | null;   // % растущего (или null для L1)
  required: number | null;  // нужно агентов на L1 с сделкой
  capPerAgent: number;      // ₽ годовой лимит
}

export const marketingPlan: MarketingPlanRow[] = [
  { level: 1, protected: 3.5, growing: null, required: null, capPerAgent: 100_000 },
  { level: 2, protected: 0.1, growing: 2.8,  required: 5,    capPerAgent: 120_000 },
  { level: 3, protected: 0.1, growing: 2.4,  required: 10,   capPerAgent: 80_000  },
  { level: 4, protected: 0.1, growing: 1.4,  required: 15,   capPerAgent: 60_000  },
  { level: 5, protected: 0.1, growing: 0.9,  required: 20,   capPerAgent: 30_000  },
  { level: 6, protected: 0.5, growing: 2.0,  required: 25,   capPerAgent: 50_000  },
  { level: 7, protected: 0.5, growing: 4.0,  required: 40,   capPerAgent: 100_000 },
];

// ============================================================
// ACHIEVEMENTS — определения ачивок (управляются админом)
// ============================================================
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementTriggerType =
  | 'first_agent_invited' | 'first_deal' | 'commission_year' | 'level_reached'
  | 'team_l1_size' | 'deals_year' | 'commission_total';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;             // emoji
  tier: AchievementTier;
  trigger: AchievementTriggerType;
  threshold: number;        // для commission_year=1000000, level_reached=2|3, ...
  active: boolean;          // включена ли вообще
}

export const achievementDefs: AchievementDef[] = [
  { id: 'first_agent',   title: 'Первый рекрут',      description: 'Привёл первого агента в команду',                    icon: '🤝', tier: 'bronze',   trigger: 'first_agent_invited', threshold: 1,        active: true },
  { id: 'first_deal',    title: 'Первая сделка',      description: 'Закрыл первую сделку в Welcome 24',                   icon: '🏠', tier: 'bronze',   trigger: 'first_deal',          threshold: 1,        active: true },
  { id: 'commission_1m', title: 'Миллион в копилку',  description: '1 000 000 ₽ комиссии за год',                         icon: '💎', tier: 'silver',   trigger: 'commission_year',     threshold: 1_000_000, active: true },
  { id: 'level_2',       title: 'Старшая лига 90%',   description: '2 000 000 ₽ ВКД — переход на 90% комиссии',           icon: '⚡', tier: 'gold',     trigger: 'level_reached',       threshold: 2,        active: true },
  { id: 'level_3',       title: 'Элитный 95%',        description: '5 000 000 ₽ ВКД — переход на 95% комиссии',           icon: '👑', tier: 'platinum', trigger: 'level_reached',       threshold: 3,        active: true },
  { id: 'team_10',       title: 'Капитан десятки',    description: '10 агентов на первом уровне команды',                 icon: '👥', tier: 'silver',   trigger: 'team_l1_size',        threshold: 10,       active: true },
  { id: 'team_50',       title: 'Армия из 50',        description: '50 агентов на первом уровне команды',                 icon: '🏆', tier: 'gold',     trigger: 'team_l1_size',        threshold: 50,       active: true },
  { id: 'deals_10',      title: 'Десятка',            description: '10 сделок за один год',                               icon: '🔥', tier: 'silver',   trigger: 'deals_year',          threshold: 10,       active: true },
  { id: 'deals_30',      title: 'Тридцатка',          description: '30 сделок за один год',                               icon: '⭐', tier: 'gold',     trigger: 'deals_year',          threshold: 30,       active: true },
  { id: 'deals_50',      title: 'Полтинник',          description: '50 сделок за один год',                               icon: '💫', tier: 'platinum', trigger: 'deals_year',          threshold: 50,       active: true },
  { id: 'total_10m',     title: 'Декамиллионер',      description: '10 000 000 ₽ общей комиссии за карьеру',              icon: '💰', tier: 'platinum', trigger: 'commission_total',    threshold: 10_000_000, active: true },
];

export const adminEvents: AdminEvent[] = [
  { id: 1, title: 'MLM на пальцах', description: 'Закрытая встреча для лидеров уровня L2+. Тонкая настройка маркетингового плана.',         date: '2026-05-24', startTime: '18:00', endTime: '19:30', speaker: 'Клименков М.М.',   format: 'meeting',     topic: 'МЛМ',                location: 'Zoom',                                  link: 'https://zoom.us/j/12345',  capacity: 15, registered: 6,   published: true },
  { id: 2, title: 'Семейная ипотека: разбор кейсов мая',  description: 'Открытый онлайн-вебинар.',                                            date: '2026-05-26', startTime: '14:00', endTime: '15:30', speaker: 'Колесникова А.В.', format: 'webinar',     topic: 'Ипотека',           location: 'Онлайн',                                link: 'https://welcome24.ru/live', capacity: null, registered: 87, published: true },
  { id: 3, title: 'Мастер-класс: продающая фотосессия',   description: 'Анна Колесникова показывает фотосъёмку объектов на смартфон.',          date: '2026-05-28', startTime: '11:00', endTime: '13:00', speaker: 'Колесникова А.В.', format: 'masterclass', topic: 'Маркетинг',          location: 'Москва, БЦ «Меркурий», 14 этаж',         link: '',                          capacity: 20, registered: 18, published: true },
  { id: 4, title: 'Новостройки СПб: тренды Q2 2026',      description: 'Свежие данные по запускам и ценам.',                                   date: '2026-05-29', startTime: '15:00', endTime: '16:30', speaker: 'Верховская В.В.',  format: 'webinar',     topic: 'Новостройки',        location: 'Онлайн',                                link: 'https://welcome24.ru/live', capacity: null, registered: 156, published: true },
  { id: 5, title: 'Тренинг новичков: первая сделка',      description: 'Закрытый тренинг для агентов первого месяца.',                          date: '2026-05-30', startTime: '10:00', endTime: '14:00', speaker: 'Мухин В.А.',       format: 'training',    topic: 'Базовый',            location: 'Москва, БЦ «Меркурий», 14 этаж',         link: '',                          capacity: 12, registered: 8, published: true },
  { id: 6, title: 'Юридический блок: типичные ошибки',    description: 'Дмитрий Радченко разбирает 10 ошибок, которые срывают сделки.',         date: '2026-06-02', startTime: '13:00', endTime: '14:30', speaker: 'Радченко Д.В.',    format: 'webinar',     topic: 'Юридический блок',   location: 'Онлайн',                                link: 'https://welcome24.ru/live', capacity: null, registered: 64, published: true },
];
