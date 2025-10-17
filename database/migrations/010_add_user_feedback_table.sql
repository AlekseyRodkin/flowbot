-- Migration: Создание таблицы для обратной связи от пользователей
-- Цель: Собирать фидбек после Day 1, Day 3, Day 7 для анализа retention

-- Создаем таблицу для хранения обратной связи
CREATE TABLE IF NOT EXISTS user_feedback (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number > 0),
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('great', 'good', 'unclear', 'not_fit', 'not_for_me', 'getting_rhythm', 'have_questions', 'too_hard', 'want_stop', 'works', 'slow_progress', 'not_sure', 'stopping')),
  feedback_text TEXT, -- Дополнительный текст если пользователь напишет
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Индексы для быстрого поиска
  CONSTRAINT fk_user FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Индексы для быстрого поиска
CREATE INDEX idx_user_feedback_telegram_id ON user_feedback(telegram_id);
CREATE INDEX idx_user_feedback_day ON user_feedback(day_number);
CREATE INDEX idx_user_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_user_feedback_created ON user_feedback(created_at DESC);

-- Комментарии
COMMENT ON TABLE user_feedback IS 'Обратная связь пользователей после Day 1, 3, 7 для анализа retention';
COMMENT ON COLUMN user_feedback.day_number IS 'День программы когда был собран фидбек (1, 3, 7)';
COMMENT ON COLUMN user_feedback.feedback_type IS 'Тип отзыва: great (отлично), good (нормально), unclear (непонятно), not_fit (не подошло), not_for_me (не для меня), getting_rhythm (вхожу в ритм), have_questions (есть вопросы), too_hard (сложновато), want_stop (хочу остановиться), works (работает), slow_progress (медленный прогресс), not_sure (не уверен), stopping (останавливаюсь)';
