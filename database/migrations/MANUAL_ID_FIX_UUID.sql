-- РУЧНОЕ ИСПРАВЛЕНИЕ СТРУКТУРЫ ID (UUID VERSION)
-- Используйте эту версию если achievements.id имеет тип UUID

-- ШАГ 1: Проверяем текущую структуру БД
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('users', 'achievements', 'tasks') 
    AND column_name IN ('id', 'telegram_id', 'user_id', 'achievement_id')
ORDER BY table_name, column_name;

-- ШАГ 2: Создаем новую таблицу users с telegram_id как PRIMARY KEY
CREATE TABLE IF NOT EXISTS users_fixed (
    telegram_id BIGINT PRIMARY KEY,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    level INTEGER DEFAULT 1,
    subscription_type VARCHAR(50) DEFAULT 'free',
    subscription_end DATE,
    morning_hour INTEGER DEFAULT 8,
    evening_hour INTEGER DEFAULT 21,
    timezone VARCHAR(50) DEFAULT 'Europe/Moscow',
    language VARCHAR(10) DEFAULT 'ru',
    onboarding_completed BOOLEAN DEFAULT FALSE,
    preferences TEXT[],
    anti_patterns TEXT[],
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ШАГ 3: Мигрируем данные пользователей (если таблица users существует)
INSERT INTO users_fixed (
    telegram_id, username, first_name, last_name, level, subscription_type,
    subscription_end, timezone, language, onboarding_completed, created_at, updated_at
)
SELECT 
    telegram_id, username, first_name, last_name, 
    COALESCE(level, 1), COALESCE(subscription_type, 'free'),
    subscription_end, COALESCE(timezone, 'Europe/Moscow'), 
    COALESCE(language, 'ru'), COALESCE(onboarding_completed, false),
    COALESCE(created_at, NOW()), COALESCE(updated_at, NOW())
FROM users
WHERE telegram_id IS NOT NULL
ON CONFLICT (telegram_id) DO NOTHING;

-- ШАГ 4: Создаем таблицу tasks с правильными связями
CREATE TABLE IF NOT EXISTS tasks_fixed (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    task_text TEXT NOT NULL,
    task_type VARCHAR(50),
    position INTEGER,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    skipped BOOLEAN DEFAULT FALSE,
    ai_generated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ШАГ 5: Мигрируем данные задач (если есть старые данные)
INSERT INTO tasks_fixed (
    telegram_id, date, task_text, task_type, position, completed, 
    completed_at, skipped, ai_generated, created_at
)
SELECT 
    u.telegram_id, t.date, t.task_text, t.task_type, t.position, 
    t.completed, t.completed_at, 
    COALESCE(t.skipped, false), COALESCE(t.ai_generated, true), 
    COALESCE(t.created_at, NOW())
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE u.telegram_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ШАГ 6: Создаем таблицу daily_stats
CREATE TABLE IF NOT EXISTS daily_stats_fixed (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    easy_completed INTEGER DEFAULT 0,
    standard_completed INTEGER DEFAULT 0,
    hard_completed INTEGER DEFAULT 0,
    magic_completed BOOLEAN DEFAULT FALSE,
    flow_score INTEGER DEFAULT 0,
    productivity_index FLOAT,
    notes TEXT,
    mood VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(telegram_id, date)
);

-- ШАГ 7: Мигрируем статистику (если есть)
INSERT INTO daily_stats_fixed (
    telegram_id, date, total_tasks, completed_tasks, easy_completed,
    standard_completed, hard_completed, magic_completed, flow_score,
    productivity_index, notes, mood, created_at
)
SELECT 
    u.telegram_id, d.date, 
    COALESCE(d.total_tasks, 0), COALESCE(d.completed_tasks, 0), 
    COALESCE(d.easy_completed, 0), COALESCE(d.standard_completed, 0), 
    COALESCE(d.hard_completed, 0), COALESCE(d.magic_completed, false), 
    COALESCE(d.flow_score, 0), d.productivity_index, d.notes, d.mood,
    COALESCE(d.created_at, NOW())
FROM daily_stats d
JOIN users u ON d.user_id = u.id
WHERE u.telegram_id IS NOT NULL
ON CONFLICT (telegram_id, date) DO NOTHING;

-- ШАГ 8: Создаем таблицу streaks
CREATE TABLE IF NOT EXISTS streaks_fixed (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_days INTEGER DEFAULT 0,
    last_completed_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ШАГ 9: Мигрируем стрики (если есть)
INSERT INTO streaks_fixed (
    telegram_id, current_streak, longest_streak, total_days,
    last_completed_date, created_at, updated_at
)
SELECT 
    u.telegram_id, 
    COALESCE(s.current_streak, 0), COALESCE(s.longest_streak, 0), 
    COALESCE(s.total_days, 0), s.last_completed_date,
    COALESCE(s.created_at, NOW()), COALESCE(s.updated_at, NOW())
FROM streaks s
JOIN users u ON s.user_id = u.id
WHERE u.telegram_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ШАГ 10: Создаем таблицу user_achievements с UUID типом
-- ВАЖНО: Используем UUID для achievement_id так как achievements.id имеет тип UUID
CREATE TABLE IF NOT EXISTS user_achievements_fixed (
    telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (telegram_id, achievement_id)
);

-- ШАГ 11: Мигрируем достижения пользователей (если есть)
INSERT INTO user_achievements_fixed (telegram_id, achievement_id, unlocked_at)
SELECT 
    u.telegram_id, ua.achievement_id, COALESCE(ua.unlocked_at, NOW())
FROM user_achievements ua
JOIN users u ON ua.user_id = u.id
WHERE u.telegram_id IS NOT NULL
ON CONFLICT (telegram_id, achievement_id) DO NOTHING;

-- ШАГ 12: Создаем таблицу reflections
CREATE TABLE IF NOT EXISTS reflections_fixed (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    what_worked TEXT,
    what_didnt TEXT,
    tomorrow_focus TEXT,
    ai_insights TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ШАГ 13: Создаем таблицу referrals
CREATE TABLE IF NOT EXISTS referrals_fixed (
    id SERIAL PRIMARY KEY,
    referrer_telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    referred_telegram_id BIGINT REFERENCES users_fixed(telegram_id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    reward_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP,
    UNIQUE(referred_telegram_id)
);

-- ШАГ 14: Создаем индексы
CREATE INDEX IF NOT EXISTS idx_tasks_fixed_telegram_date ON tasks_fixed(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_fixed_telegram_date ON daily_stats_fixed(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_streaks_fixed_telegram_id ON streaks_fixed(telegram_id);

-- ШАГ 15: ПРОВЕРЯЕМ данные в новых таблицах
SELECT 'users_fixed' as table_name, COUNT(*) as count FROM users_fixed
UNION ALL
SELECT 'tasks_fixed', COUNT(*) FROM tasks_fixed
UNION ALL
SELECT 'daily_stats_fixed', COUNT(*) FROM daily_stats_fixed
UNION ALL
SELECT 'streaks_fixed', COUNT(*) FROM streaks_fixed
UNION ALL
SELECT 'user_achievements_fixed', COUNT(*) FROM user_achievements_fixed;

-- ШАГ 16: ФИНАЛЬНОЕ ПЕРЕИМЕНОВАНИЕ (выполните после проверки данных!)
-- ВНИМАНИЕ: Этот шаг удалит старые таблицы!

/*
-- Раскомментируйте и выполните после проверки:

-- Удаляем старые таблицы
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS reflections CASCADE; 
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS streaks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Переименовываем новые таблицы
ALTER TABLE users_fixed RENAME TO users;
ALTER TABLE tasks_fixed RENAME TO tasks;
ALTER TABLE daily_stats_fixed RENAME TO daily_stats;
ALTER TABLE streaks_fixed RENAME TO streaks;
ALTER TABLE user_achievements_fixed RENAME TO user_achievements;
ALTER TABLE referrals_fixed RENAME TO referrals;
ALTER TABLE reflections_fixed RENAME TO reflections;

-- Переименовываем индексы
ALTER INDEX idx_tasks_fixed_telegram_date RENAME TO idx_tasks_telegram_date;
ALTER INDEX idx_daily_stats_fixed_telegram_date RENAME TO idx_daily_stats_telegram_date;
ALTER INDEX idx_streaks_fixed_telegram_id RENAME TO idx_streaks_telegram_id;
*/

-- ШАГ 17: Финальная проверка
SELECT 
    'MIGRATION COMPLETED' as status,
    (SELECT COUNT(*) FROM users_fixed) as users_count,
    (SELECT COUNT(*) FROM tasks_fixed) as tasks_count,
    (SELECT COUNT(*) FROM user_achievements_fixed) as achievements_count;