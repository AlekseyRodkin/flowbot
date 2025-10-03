-- database/migrations/008_add_feedback_table.sql
-- Таблица для сбора отзывов, багов и предложений от пользователей

CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'suggestion')),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_feedback_updated_at BEFORE UPDATE ON feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Комментарии для документации
COMMENT ON TABLE feedback IS 'Таблица для хранения отзывов пользователей (баги и предложения)';
COMMENT ON COLUMN feedback.type IS 'Тип отзыва: bug (ошибка) или suggestion (предложение)';
COMMENT ON COLUMN feedback.status IS 'Статус обработки: new, in_progress, resolved, closed';
