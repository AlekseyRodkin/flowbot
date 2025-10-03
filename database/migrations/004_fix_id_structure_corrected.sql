-- Миграция 004: Исправляем структуру ID (ИСПРАВЛЕННАЯ ВЕРСИЯ)
-- Цель: убрать путаницу между id и telegram_id
-- Решение: использовать telegram_id как основной ключ везде

-- 1. Сначала проверим структуру таблицы achievements
DO $$ 
BEGIN
    -- Проверяем, существует ли таблица achievements и какой тип у id
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'achievements') THEN
        -- Создаем таблицу achievements с правильным типом
        CREATE TABLE achievements (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255),
            description TEXT,
            icon VARCHAR(50),
            points INTEGER DEFAULT 10
        );
        
        -- Вставляем базовые достижения
        INSERT INTO achievements (code, name, description, icon, points) VALUES
        ('first_task', 'Первый шаг', 'Выполнил первую задачу', '🎯', 10),
        ('streak_3', 'Разгон', '3 дня подряд', '🔥', 20),
        ('streak_7', 'Неделя силы', '7 дней подряд', '💪', 50),
        ('tasks_100', 'Центурион', '100 выполненных задач', '💯', 100),
        ('early_bird', 'Жаворонок', 'Выполнил задачи до 7 утра', '🌅', 30);
    END IF;
END $$;

-- 2. Создаем новую таблицу users с правильной структурой
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

-- 3. Пересоздаем все связанные таблицы с telegram_id вместо user_id
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

-- 4. Исправляем таблицу user_achievements с правильным типом achievement_id
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

-- 5. Мигрируем данные (если есть старые таблицы)
DO $$
BEGIN
    -- Проверяем, есть ли старая таблица users
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Мигрируем пользователей
        INSERT INTO users_new (
            telegram_id, username, first_name, last_name, level, subscription_type,
            subscription_end, timezone, language, onboarding_completed, created_at, updated_at
        )
        SELECT 
            telegram_id, username, first_name, last_name, level, subscription_type,
            subscription_end, timezone, language, onboarding_completed, created_at, updated_at
        FROM users
        WHERE telegram_id IS NOT NULL
        ON CONFLICT (telegram_id) DO NOTHING;

        -- Мигрируем задачи, если есть связанная таблица
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
            INSERT INTO tasks_new (
                telegram_id, date, task_text, task_type, position, completed, completed_at,
                skipped, ai_generated, created_at
            )
            SELECT 
                u.telegram_id, t.date, t.task_text, t.task_type, t.position, t.completed, 
                t.completed_at, t.skipped, t.ai_generated, t.created_at
            FROM tasks t
            JOIN users u ON t.user_id = u.id
            WHERE u.telegram_id IS NOT NULL;
        END IF;

        -- Мигрируем статистику, если есть
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'daily_stats') THEN
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
            JOIN users u ON d.user_id = u.id
            WHERE u.telegram_id IS NOT NULL
            ON CONFLICT (telegram_id, date) DO NOTHING;
        END IF;

        -- Мигрируем стрики, если есть
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'streaks') THEN
            INSERT INTO streaks_new (
                telegram_id, current_streak, longest_streak, total_days,
                last_completed_date, created_at, updated_at
            )
            SELECT 
                u.telegram_id, s.current_streak, s.longest_streak, s.total_days,
                s.last_completed_date, s.created_at, s.updated_at
            FROM streaks s
            JOIN users u ON s.user_id = u.id
            WHERE u.telegram_id IS NOT NULL;
        END IF;

        -- Мигрируем достижения, если есть
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_achievements') THEN
            INSERT INTO user_achievements_new (telegram_id, achievement_id, unlocked_at)
            SELECT 
                u.telegram_id, ua.achievement_id, ua.unlocked_at
            FROM user_achievements ua
            JOIN users u ON ua.user_id = u.id
            WHERE u.telegram_id IS NOT NULL
            ON CONFLICT (telegram_id, achievement_id) DO NOTHING;
        END IF;

        -- Мигрируем рефлексии, если есть
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reflections') THEN
            INSERT INTO reflections_new (
                telegram_id, date, what_worked, what_didnt, tomorrow_focus,
                ai_insights, created_at
            )
            SELECT 
                u.telegram_id, r.date, r.what_worked, r.what_didnt, r.tomorrow_focus,
                r.ai_insights, r.created_at
            FROM reflections r
            JOIN users u ON r.user_id = u.id
            WHERE u.telegram_id IS NOT NULL;
        END IF;
    END IF;
END $$;

-- 6. Удаляем старые таблицы и переименовываем новые
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

-- 7. Создаем индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_tasks_telegram_date ON tasks(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_telegram_date ON daily_stats(telegram_id, date);
CREATE INDEX IF NOT EXISTS idx_streaks_telegram_id ON streaks(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_telegram_id ON user_achievements(telegram_id);
CREATE INDEX IF NOT EXISTS idx_reflections_telegram_date ON reflections(telegram_id, date);

-- 8. Добавляем таблицы для реферальной системы (если их еще нет)
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

-- 9. Обновляем поле referred_by в таблице users, если нужно
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'referred_by'
    ) THEN
        ALTER TABLE users ADD COLUMN referred_by BIGINT REFERENCES users(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
    END IF;
END $$;

-- 10. Комментарии для документации
COMMENT ON TABLE users IS 'Основная таблица пользователей, telegram_id - первичный ключ';
COMMENT ON TABLE tasks IS 'Задачи пользователей, связь через telegram_id';
COMMENT ON TABLE daily_stats IS 'Ежедневная статистика, связь через telegram_id';
COMMENT ON TABLE streaks IS 'Стрики пользователей, связь через telegram_id';
COMMENT ON TABLE achievements IS 'Достижения в системе (INTEGER id)';
COMMENT ON TABLE user_achievements IS 'Связь пользователей и достижений';
COMMENT ON TABLE referrals IS 'Реферальная система';

-- Готово! Теперь все таблицы используют telegram_id как основной ключ связи