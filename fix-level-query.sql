-- SQL запрос для исправления level пользователя
--
-- ПРОБЛЕМА: Level был увеличен дважды из-за бага
-- Пользователь завершил день 1, но level стал 3 вместо 2
--
-- РЕШЕНИЕ: Уменьшить level на 1

-- Сначала проверяем текущий level
SELECT
  telegram_id,
  first_name,
  level,
  current_streak,
  updated_at
FROM users
WHERE telegram_id = 272559647;

-- Исправляем level: 3 → 2
UPDATE users
SET
  level = 2,
  updated_at = NOW()
WHERE telegram_id = 272559647;

-- Проверяем результат
SELECT
  telegram_id,
  first_name,
  level,
  current_streak,
  updated_at
FROM users
WHERE telegram_id = 272559647;
