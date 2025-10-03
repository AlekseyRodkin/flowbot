-- Migration 004: Fix Telegram ID as Primary Key
-- Исправляем архитектуру чтобы использовать telegram_id везде

-- 1. Создаем новые таблицы с telegram_id как PRIMARY KEY

-- Новая таблица пользователей
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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Новая таблица задач
CREATE TABLE tasks_new (
    id SERIAL PRIMARY KEY,
    user_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
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

-- Новая таблица статистики
CREATE TABLE daily_stats_new (
    id SERIAL PRIMARY KEY,
    user_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
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
    UNIQUE(user_telegram_id, date)
);

-- Новая таблица стриков
CREATE TABLE streaks_new (
    user_telegram_id BIGINT PRIMARY KEY REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_days INTEGER DEFAULT 0,
    last_completed_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Новая таблица достижений пользователей
CREATE TABLE user_achievements_new (
    user_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_telegram_id, achievement_id)
);

-- Новая таблица рефлексий
CREATE TABLE reflections_new (
    id SERIAL PRIMARY KEY,
    user_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    what_worked TEXT,
    what_didnt TEXT,
    tomorrow_focus TEXT,
    ai_insights TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Новая таблица платежей
CREATE TABLE payments_new (
    id SERIAL PRIMARY KEY,
    user_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    amount DECIMAL(10, 2),
    currency VARCHAR(10) DEFAULT 'RUB',
    status VARCHAR(50),
    payment_system VARCHAR(50),
    payment_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Новая таблица рефералов
CREATE TABLE referrals_new (
    id SERIAL PRIMARY KEY,
    referrer_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    referred_telegram_id BIGINT REFERENCES users_new(telegram_id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    reward_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP,
    UNIQUE(referred_telegram_id)
);

-- Мигрируем данные (если есть)
INSERT INTO users_new SELECT * FROM users WHERE telegram_id IS NOT NULL;

-- Мигрируем задачи
INSERT INTO tasks_new (user_telegram_id, date, task_text, task_type, position, completed, completed_at, skipped, ai_generated, created_at)
SELECT u.telegram_id, t.date, t.task_text, t.task_type, t.position, t.completed, t.completed_at, t.skipped, t.ai_generated, t.created_at
FROM tasks t
JOIN users u ON t.user_id = u.id
WHERE u.telegram_id IS NOT NULL;

-- Мигрируем статистику
INSERT INTO daily_stats_new (user_telegram_id, date, total_tasks, completed_tasks, easy_completed, standard_completed, hard_completed, magic_completed, flow_score, productivity_index, notes, mood, created_at)
SELECT u.telegram_id, ds.date, ds.total_tasks, ds.completed_tasks, ds.easy_completed, ds.standard_completed, ds.hard_completed, ds.magic_completed, ds.flow_score, ds.productivity_index, ds.notes, ds.mood, ds.created_at
FROM daily_stats ds
JOIN users u ON ds.user_id = u.id
WHERE u.telegram_id IS NOT NULL;

-- Мигрируем стрики
INSERT INTO streaks_new (user_telegram_id, current_streak, longest_streak, total_days, last_completed_date, created_at, updated_at)
SELECT u.telegram_id, s.current_streak, s.longest_streak, s.total_days, s.last_completed_date, s.created_at, s.updated_at
FROM streaks s
JOIN users u ON s.user_id = u.id
WHERE u.telegram_id IS NOT NULL;

-- Удаляем старые таблицы и переименовываем новые
DROP TABLE IF EXISTS user_achievements CASCADE;
DROP TABLE IF EXISTS reflections CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP TABLE IF EXISTS streaks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Переименовываем новые таблицы
ALTER TABLE users_new RENAME TO users;
ALTER TABLE tasks_new RENAME TO tasks;
ALTER TABLE daily_stats_new RENAME TO daily_stats;
ALTER TABLE streaks_new RENAME TO streaks;
ALTER TABLE user_achievements_new RENAME TO user_achievements;
ALTER TABLE reflections_new RENAME TO reflections;
ALTER TABLE payments_new RENAME TO payments;
ALTER TABLE referrals_new RENAME TO referrals;

-- Создаем индексы для производительности
CREATE INDEX idx_tasks_user_date ON tasks(user_telegram_id, date);
CREATE INDEX idx_tasks_completed ON tasks(user_telegram_id, completed, date);
CREATE INDEX idx_stats_user_date ON daily_stats(user_telegram_id, date DESC);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_telegram_id);
CREATE INDEX idx_referrals_status ON referrals(status);

-- Обновляем serial sequences
SELECT setval('tasks_id_seq', COALESCE((SELECT MAX(id) FROM tasks), 1));
SELECT setval('daily_stats_id_seq', COALESCE((SELECT MAX(id) FROM daily_stats), 1));
SELECT setval('reflections_id_seq', COALESCE((SELECT MAX(id) FROM reflections), 1));
SELECT setval('payments_id_seq', COALESCE((SELECT MAX(id) FROM payments), 1));
SELECT setval('referrals_id_seq', COALESCE((SELECT MAX(id) FROM referrals), 1));
