-- Миграция 012: Добавление полей для паузы и контроля неактивности
-- Добавляет поля для отслеживания паузы программы и неактивности пользователей

-- 1. Добавляем поля паузы и неактивности в таблицу users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS inactive_days_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_interaction_date DATE;

-- 2. Добавляем поле статуса в таблицу tasks
-- Возможные значения: 'active', 'completed', 'skipped'
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- 3. Обновляем существующие задачи:
-- - Если completed = TRUE, устанавливаем status = 'completed'
-- - Если completed = FALSE, оставляем status = 'active'
UPDATE tasks
SET status = CASE
  WHEN completed = TRUE THEN 'completed'
  ELSE 'active'
END
WHERE status = 'active';

-- 4. Создаем индекс для оптимизации поиска по статусу задач
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- 5. Создаем индекс для оптимизации поиска пользователей на паузе
CREATE INDEX IF NOT EXISTS idx_users_is_paused ON users(is_paused);

-- 6. Инициализируем last_interaction_date текущей датой для активных пользователей
UPDATE users
SET last_interaction_date = CURRENT_DATE
WHERE onboarding_completed = TRUE
  AND last_interaction_date IS NULL;

-- Комментарии к полям:
COMMENT ON COLUMN users.is_paused IS 'Флаг паузы программы - если TRUE, утренние задачи не отправляются';
COMMENT ON COLUMN users.inactive_days_count IS 'Счётчик дней без активности подряд (без выполнения задач)';
COMMENT ON COLUMN users.last_interaction_date IS 'Дата последнего взаимодействия с ботом (нажатие кнопок, отметка задач)';
COMMENT ON COLUMN tasks.status IS 'Статус задачи: active (активная), completed (выполнена), skipped (пропущена)';
