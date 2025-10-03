-- Migration: Add 'easy' difficulty to custom_tasks
-- Description: Добавляет поддержку легких задач в пользовательские задачи

-- Удаляем старое ограничение
ALTER TABLE custom_tasks DROP CONSTRAINT IF EXISTS custom_tasks_difficulty_check;

-- Добавляем новое ограничение с поддержкой 'easy'
ALTER TABLE custom_tasks ADD CONSTRAINT custom_tasks_difficulty_check 
    CHECK (difficulty IN ('easy', 'standard', 'hard', 'magic'));

-- Комментарий к обновленному полю
COMMENT ON COLUMN custom_tasks.difficulty IS 'Уровень сложности задачи (easy, standard, hard, magic)';