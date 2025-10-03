-- Migration: Add is_custom field to tasks table
-- Description: Позволяет различать задачи Flow методологии и пользовательские задачи в едином списке

-- Добавляем поле is_custom к таблице tasks
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_tasks_is_custom ON tasks(is_custom);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_task_id ON tasks(custom_task_id);

-- Комментарии к новым полям
COMMENT ON COLUMN tasks.is_custom IS 'Флаг пользовательской задачи (true) или задачи Flow методологии (false)';
COMMENT ON COLUMN tasks.custom_task_id IS 'Ссылка на оригинальную пользовательскую задачу из библиотеки';