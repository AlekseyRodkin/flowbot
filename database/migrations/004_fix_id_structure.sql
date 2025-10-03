-- Миграция 004: Исправляем структуру ID
-- Цель: убрать путаницу между id и telegram_id
-- Решение: использовать telegram_id как основной ключ везде

-- 1. Создаем новую таблицу users с правильной структурой
DROP TABLE IF EXISTS users_new CASCADE;
CREATE TABLE users_new (
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

-- 2. Пересоздаем все связанные таблицы с telegram_id вместо user_id
DROP TABLE IF EXISTS tasks_new CASCADE;
CREATE TABLE tasks_new (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
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

DROP TABLE IF EXISTS daily_stats_new CASCADE;
CREATE TABLE daily_stats_new (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
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

DROP TABLE IF EXISTS streaks_new CASCADE;
CREATE TABLE streaks_new (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_days INTEGER DEFAULT 0,
    last_completed_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS user_achievements_new CASCADE;
CREATE TABLE user_achievements_new (
    telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (telegram_id, achievement_id)
);

DROP TABLE IF EXISTS reflections_new CASCADE;
CREATE TABLE reflections_new (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    what_worked TEXT,
    what_didnt TEXT,
    tomorrow_focus TEXT,
    ai_insights TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Мигрируем данные (если есть)
INSERT INTO users_new (
    telegram_id, username, first_name, last_name, level, subscription_type,
    subscription_end, timezone, language, onboarding_completed, created_at, updated_at
)
SELECT 
    telegram_id, username, first_name, last_name, level, subscription_type,
    subscription_end, timezone, language, onboarding_completed, created_at, updated_at
FROM users
WHERE telegram_id IS NOT NULL;

INSERT INTO tasks_new (
    telegram_id, date, task_text, task_type, position, completed, completed_at,
    skipped, ai_generated, created_at
)
SELECT 
    u.telegram_id, t.date, t.task_text, t.task_type, t.position, t.completed, 
    t.completed_at, t.skipped, t.ai_generated, t.created_at
FROM tasks t
JOIN users u ON t.user_id = u.id;

INSERT INTO daily_stats_new (
    telegram_id, date, total_tasks, completed_tasks, easy_completed,
    standard_completed, hard_completed, magic_completed, flow_score,
    productivity_index, notes, mood, created_at
)
SELECT 
    u.telegram_id, d.date, d.total_tasks, d.completed_tasks, d.easy_completed,
    d.standard_completed, d.hard_completed, d.magic_completed, d.flow_score,
    d.productivity_index, d.notes, d.mood, d.created_at
FROM daily_stats d
JOIN users u ON d.user_id = u.id;

INSERT INTO streaks_new (
    telegram_id, current_streak, longest_streak, total_days,
    last_completed_date, created_at, updated_at
)
SELECT 
    u.telegram_id, s.current_streak, s.longest_streak, s.total_days,
    s.last_completed_date, s.created_at, s.updated_at
FROM streaks s
JOIN users u ON s.user_id = u.id;

INSERT INTO user_achievements_new (telegram_id, achievement_id, unlocked_at)
SELECT 
    u.telegram_id, ua.achievement_id, ua.unlocked_at
FROM user_achievements ua
JOIN users u ON ua.user_id = u.id;

INSERT INTO reflections_new (
    telegram_id, date, what_worked, what_didnt, tomorrow_focus,
    ai_insights, created_at
)
SELECT 
    u.telegram_id, r.date, r.what_worked, r.what_didnt, r.tomorrow_focus,
    r.ai_insights, r.created_at
FROM reflections r
JOIN users u ON r.user_id = u.id;

-- 4. Удаляем старые таблицы и переименовываем новые
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS reflections CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS streaks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

ALTER TABLE users_new RENAME TO users;
ALTER TABLE tasks_new RENAME TO tasks;
ALTER TABLE daily_stats_new RENAME TO daily_stats;
ALTER TABLE streaks_new RENAME TO streaks;
ALTER TABLE user_achievements_new RENAME TO user_achievements;
ALTER TABLE reflections_new RENAME TO reflections;

-- 5. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tasks_telegram_date ON tasks(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_telegram_date ON daily_stats(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_streaks_telegram_id ON streaks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_telegram_id ON user_achievements(telegram_id);
CREATE INDEX IF NOT EXISTS idx_reflections_telegram_date ON reflections(telegram_id, date);

-- 6. Добавляем таблицы для реферальной системы (если их еще нет)
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    referred_telegram_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    referral_code VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed
    reward_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP,
    UNIQUE(referred_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_telegram_id);

-- 7. Комментарий для документации
COMMENT ON TABLE users IS 'Основная таблица пользователей, telegram_id - первичный ключ';
COMMENT ON TABLE tasks IS 'Задачи пользователей, связь через telegram_id';
COMMENT ON TABLE daily_stats IS 'Ежедневная статистика, связь через telegram_id';
COMMENT ON TABLE streaks IS 'Стрики пользователей, связь через telegram_id';