-- Migration 004: Add difficulty level and fix user progress
-- Добавляем отдельное поле для уровня сложности пользователя

-- Добавляем новое поле для уровня сложности
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(50) DEFAULT 'intermediate';

-- Добавляем поля для стриков если их нет
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;

-- Добавляем индекс для быстрого поиска активных пользователей
CREATE INDEX IF NOT EXISTS idx_users_active 
ON users(subscription_type, subscription_end) 
WHERE subscription_type != 'free';

-- Сбрасываем level для всех пользователей на правильное значение
-- (количество дней с момента регистрации, без ограничений)
UPDATE users
SET level = EXTRACT(DAY FROM (NOW() - created_at)) + 1
WHERE level < 1;

-- Добавляем статус последней активности
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_active_date DATE DEFAULT CURRENT_DATE;

-- Комментарий для понимания структуры
COMMENT ON COLUMN users.level IS 'Текущий день программы (1-30+, может продолжаться)';
COMMENT ON COLUMN users.difficulty_level IS 'Уровень сложности: beginner, intermediate, advanced';
COMMENT ON COLUMN users.current_streak IS 'Текущий стрик выполненных дней подряд';
COMMENT ON COLUMN users.longest_streak IS 'Максимальный стрик за все время';
