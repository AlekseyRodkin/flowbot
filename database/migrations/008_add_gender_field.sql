-- Миграция: Добавление поля gender для гендерных обращений
-- Дата: 2025-10-01

-- Добавляем поле gender в таблицу users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS gender VARCHAR(10);

-- gender может быть: 'male', 'female', или NULL (не указано)
-- NULL используется для пользователей, которые прошли онбординг до добавления этого поля

-- Комментарий к полю
COMMENT ON COLUMN users.gender IS 'Пол пользователя для правильных обращений: male, female, или NULL';
