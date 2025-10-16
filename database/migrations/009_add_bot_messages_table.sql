-- Migration: Создание таблицы для трекинга сообщений бота
-- Цель: Очистка чата от старых сообщений при отправке утренних задач

-- Создаем таблицу для хранения всех message_id от бота
CREATE TABLE IF NOT EXISTS bot_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  message_id INTEGER NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('morning', 'evening', 'onboarding', 'other')),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Индексы для быстрого поиска
  CONSTRAINT fk_user FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индекс для быстрого поиска сообщений пользователя
CREATE INDEX idx_bot_messages_telegram_id ON bot_messages(telegram_id);

-- Индекс для фильтрации по типу и времени
CREATE INDEX idx_bot_messages_type_sent ON bot_messages(message_type, sent_at DESC);

-- Комментарии
COMMENT ON TABLE bot_messages IS 'Хранение message_id всех сообщений бота для управления историей чата';
COMMENT ON COLUMN bot_messages.message_type IS 'Тип сообщения: morning (утренние задачи), evening (вечерняя рефлексия), onboarding (онбординг), other (прочее)';
