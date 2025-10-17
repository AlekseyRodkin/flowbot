-- Migration: Создание таблицы для трекинга событий пользователей
-- Цель: Логировать все ключевые события для анализа retention и поведения

-- Создаем таблицу для хранения событий
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Внешний ключ
  CONSTRAINT fk_user FOREIGN KEY (telegram_id)
    REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX idx_events_telegram_id ON events(telegram_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_events_telegram_type ON events(telegram_id, event_type);
CREATE INDEX idx_events_type_created ON events(event_type, created_at DESC);

-- Индекс для поиска по данным события (JSONB)
CREATE INDEX idx_events_data ON events USING gin(event_data);

-- Комментарии
COMMENT ON TABLE events IS 'Трекинг всех событий пользователей для анализа retention и поведения';
COMMENT ON COLUMN events.event_type IS 'Тип события: user_registered, onboarding_completed, tasks_received_day_1, first_task_completed, day_1_completed_100, day_1_completed_50, returned_day_2, returned_day_7, feedback_submitted, churned';
COMMENT ON COLUMN events.event_data IS 'Дополнительные данные события в формате JSON (например: {"tasks_count": 10, "completion_rate": 0.8})';

-- Создаём enum для типов событий (опционально, для строгой типизации)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
    CREATE TYPE event_type_enum AS ENUM (
      'user_registered',
      'onboarding_completed',
      'tasks_received_day_1',
      'first_task_completed',
      'day_1_completed_100',
      'day_1_completed_50',
      'day_completed',
      'returned_day_2',
      'returned_day_7',
      'returned_day_30',
      'feedback_submitted',
      'churned',
      'streak_3_days',
      'streak_7_days',
      'streak_14_days',
      'streak_30_days'
    );
  END IF;
END $$;

-- Добавляем constraint для проверки типов событий
ALTER TABLE events
ADD CONSTRAINT check_event_type
CHECK (event_type IN (
  'user_registered',
  'onboarding_completed',
  'tasks_received_day_1',
  'first_task_completed',
  'day_1_completed_100',
  'day_1_completed_50',
  'day_completed',
  'returned_day_2',
  'returned_day_7',
  'returned_day_30',
  'feedback_submitted',
  'churned',
  'streak_3_days',
  'streak_7_days',
  'streak_14_days',
  'streak_30_days'
));
