// src/config/constants.js
/**
 * Константы приложения FlowBot
 * Централизованное хранение всех магических чисел и конфигурационных значений
 */

module.exports = {
  // Временные зоны
  DEFAULT_TIMEZONE: 'Europe/Moscow',

  // Задачи и прогресс
  TASKS: {
    MIN_TASKS_FOR_STREAK: 15,          // Минимум задач для засчитывания стрика
    TASKS_PER_PAGE: 10,                 // Количество задач на странице
    MAX_DAILY_TASKS: 30,                // Максимум задач в день

    // Конфигурация по дням
    DAY_1_EASY: 10,
    DAYS_2_5_EASY: 30,
    DAYS_6_10_EASY: 20,
    DAYS_6_10_STANDARD: 10,
    DAYS_11_15_EASY: 10,
    DAYS_11_15_STANDARD: 11,
    DAYS_11_15_HARD: 9,
    DAYS_16_PLUS_EASY: 10,
    DAYS_16_PLUS_STANDARD: 11,
    DAYS_16_PLUS_HARD: 9,
  },

  // Подписки
  SUBSCRIPTION_TYPES: {
    FREE: 'free',
    PRO: 'pro',
    TEAM: 'team',
  },

  // Время по умолчанию
  DEFAULT_MORNING_HOUR: 8,
  DEFAULT_EVENING_HOUR: 21,

  // Язык по умолчанию
  DEFAULT_LANGUAGE: 'ru',

  // Весовые коэффициенты для productivity_index
  TASK_WEIGHTS: {
    EASY: 1,
    STANDARD: 2,
    HARD: 3,
    MAGIC_BONUS: 10,
  },

  // Milestones программы
  MILESTONES: {
    PROGRAM_LENGTH: 15,                 // Основная программа - 15 дней
    EXTENDED_PROGRAM_LENGTH: 30,        // Расширенная программа
    DAY_7_MILESTONE: 7,
    DAY_14_MILESTONE: 14,
    DAY_15_COMPLETION: 15,
  },

  // Стрики
  STREAK: {
    MILESTONE_3_DAYS: 3,
    MILESTONE_7_DAYS: 7,
    MILESTONE_14_DAYS: 14,
    MILESTONE_30_DAYS: 30,
  },

  // Уровни сложности
  DIFFICULTY_LEVELS: {
    BEGINNER: 'beginner',
    INTERMEDIATE: 'intermediate',
    ADVANCED: 'advanced',
  },

  // Типы задач
  TASK_TYPES: {
    EASY: 'easy',
    STANDARD: 'standard',
    HARD: 'hard',
    MAGIC: 'magic',
  },

  // Типы сообщений бота
  MESSAGE_TYPES: {
    MORNING: 'morning',
    EVENING: 'evening',
    REMINDER: 'reminder',
  },

  // Telegram API
  TELEGRAM: {
    MAX_MESSAGE_LENGTH: 4096,
    RATE_LIMIT_DELAY: 50,              // мс между сообщениями
  },

  // Таймауты и задержки
  DELAYS: {
    DELETE_MESSAGE_DELAY: 500,          // мс
    EPIC_MESSAGE_DELAY: 3000,           // 3 секунды
    RETENTION_FEEDBACK_DELAY: 3000,     // 3 секунды
  },

  // AI генерация
  AI: {
    DEFAULT_MODEL: 'gpt-4',
    SIMILARITY_THRESHOLD: 0.7,          // Порог схожести задач
  },

  // Retention feedback дни
  RETENTION_DAYS: [1, 3, 7],

  // Admin
  ADMIN_ROLES: {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MODERATOR: 'moderator',
  },
};
