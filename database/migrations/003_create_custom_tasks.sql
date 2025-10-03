-- Migration: Create custom_tasks table
-- Description: Позволяет пользователям создавать свои собственные задачи

CREATE TABLE IF NOT EXISTS custom_tasks (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('mental', 'physical', 'creative', 'social', 'household', 'personal')),
    difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('standard', 'hard', 'magic')),
    estimated_time INTEGER DEFAULT 15, -- время в минутах
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Индексы для быстрого поиска
    CONSTRAINT fk_custom_tasks_user FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

-- Создаем индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_custom_tasks_telegram_id ON custom_tasks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_difficulty ON custom_tasks(difficulty);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_category ON custom_tasks(category);
CREATE INDEX IF NOT EXISTS idx_custom_tasks_active ON custom_tasks(is_active);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_custom_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления времени изменения
CREATE TRIGGER trigger_update_custom_tasks_updated_at
    BEFORE UPDATE ON custom_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_custom_tasks_updated_at();

-- Комментарии к таблице и полям
COMMENT ON TABLE custom_tasks IS 'Пользовательские задачи для FlowBot';
COMMENT ON COLUMN custom_tasks.telegram_id IS 'ID пользователя в Telegram';
COMMENT ON COLUMN custom_tasks.title IS 'Название задачи';
COMMENT ON COLUMN custom_tasks.description IS 'Подробное описание задачи';
COMMENT ON COLUMN custom_tasks.category IS 'Категория задачи';
COMMENT ON COLUMN custom_tasks.difficulty IS 'Уровень сложности задачи';
COMMENT ON COLUMN custom_tasks.estimated_time IS 'Примерное время выполнения в минутах';
COMMENT ON COLUMN custom_tasks.is_active IS 'Активна ли задача для использования';