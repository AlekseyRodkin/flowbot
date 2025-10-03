-- Migration 003: Реферальная система и вирусный рост
-- Дата: 22.09.2025
-- Описание: Таблицы и функции для реферальной программы
-- ИСПРАВЛЕНО для Supabase (UUID вместо INTEGER)

-- ====================================
-- 1. ТАБЛИЦА РЕФЕРАЛОВ
-- ====================================
CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, rewarded
    referral_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    activated_at TIMESTAMP,
    rewarded_at TIMESTAMP,
    
    -- Метрики для анализа
    activation_days INTEGER, -- Сколько дней до активации
    total_tasks_completed INTEGER DEFAULT 0, -- Задач выполнено приглашенным
    
    UNIQUE(referred_id) -- Один пользователь может быть приглашен только одним рефером
);

-- Создаем индексы отдельными командами
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_created ON referrals(created_at);

-- ====================================
-- 2. ОБНОВЛЕНИЕ ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЕЙ
-- ====================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_founding_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS referral_bonus_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS active_referrals INTEGER DEFAULT 0;

-- Создаем индекс для быстрого поиска по реферальному коду
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- ====================================
-- 3. ТАБЛИЦА НАГРАД ЗА РЕФЕРАЛОВ
-- ====================================
CREATE TABLE IF NOT EXISTS referral_rewards (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(50), -- subscription_days, achievement, permanent_pro
    reward_value TEXT, -- Значение награды (дни, код достижения и т.д.)
    reason TEXT, -- Описание причины награды
    granted_at TIMESTAMP DEFAULT NOW()
);

-- Создаем индексы отдельными командами
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_type ON referral_rewards(reward_type);

-- ====================================
-- 4. РЕФЕРАЛЬНЫЕ ДОСТИЖЕНИЯ
-- ====================================
INSERT INTO achievements (code, name, description, icon, points) VALUES
    ('referral_1', 'Первый друг', 'Пригласил первого друга в FlowBot', '👥', 50),
    ('referral_3', 'Амбассадор', 'Привел 3 активных друзей', '🌟', 100),
    ('referral_5', 'Влиятельный', 'Привел 5 активных друзей', '💎', 200),
    ('referral_10', 'Легенда', 'Привел 10 активных друзей', '👑', 500),
    ('founding_member', 'Founding Member', 'Один из первых амбассадоров FlowBot', '🏆', 1000),
    ('viral_growth', 'Вирусный рост', 'Твои друзья тоже приводят друзей', '🚀', 300)
ON CONFLICT (code) DO NOTHING;

-- ====================================
-- 5. ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ РЕФЕРАЛЬНОГО КОДА
-- ====================================
CREATE OR REPLACE FUNCTION generate_referral_code(user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    code VARCHAR;
BEGIN
    -- Генерируем уникальный код на основе user_id и случайной строки
    code := LOWER(SUBSTRING(MD5(user_id::TEXT || NOW()::TEXT || RANDOM()::TEXT), 1, 8));
    
    -- Обновляем пользователя
    UPDATE users 
    SET referral_code = code 
    WHERE id = user_id 
    AND referral_code IS NULL;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 6. ФУНКЦИЯ ДЛЯ АКТИВАЦИИ РЕФЕРАЛА
-- ====================================
CREATE OR REPLACE FUNCTION activate_referral(referred_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    ref_record RECORD;
    days_active INTEGER;
    tasks_done INTEGER;
BEGIN
    -- Находим запись реферала
    SELECT * INTO ref_record
    FROM referrals
    WHERE referred_id = referred_user_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Проверяем активность за последние 7 дней
    SELECT COUNT(DISTINCT date) INTO days_active
    FROM daily_stats
    WHERE user_id = referred_user_id
    AND date >= CURRENT_DATE - INTERVAL '7 days'
    AND completed_tasks >= 10;
    
    IF days_active < 7 THEN
        RETURN FALSE;
    END IF;
    
    -- Считаем общее количество выполненных задач
    SELECT COALESCE(SUM(completed_tasks), 0) INTO tasks_done
    FROM daily_stats
    WHERE user_id = referred_user_id;
    
    -- Активируем реферал
    UPDATE referrals
    SET 
        status = 'active',
        activated_at = NOW(),
        activation_days = DATE_PART('day', NOW() - created_at),
        total_tasks_completed = tasks_done
    WHERE id = ref_record.id;
    
    -- Обновляем счетчики реферера
    UPDATE users
    SET 
        active_referrals = active_referrals + 1,
        total_referrals = total_referrals + 1
    WHERE id = ref_record.referrer_id;
    
    -- Начисляем награды обоим пользователям
    PERFORM grant_referral_rewards(ref_record.referrer_id, referred_user_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 7. ФУНКЦИЯ ДЛЯ НАЧИСЛЕНИЯ НАГРАД
-- ====================================
CREATE OR REPLACE FUNCTION grant_referral_rewards(
    referrer_id UUID,
    referred_id UUID
) RETURNS VOID AS $$
DECLARE
    referrer_active_count INTEGER;
    reward_days INTEGER := 30;
BEGIN
    -- Получаем количество активных рефералов реферера
    SELECT active_referrals INTO referrer_active_count
    FROM users
    WHERE id = referrer_id;
    
    -- Начисляем 30 дней Pro обоим
    UPDATE users
    SET 
        subscription_type = 'pro',
        subscription_end = GREATEST(
            COALESCE(subscription_end, CURRENT_DATE),
            CURRENT_DATE
        ) + INTERVAL '30 days',
        referral_bonus_days = referral_bonus_days + reward_days
    WHERE id IN (referrer_id, referred_id);
    
    -- Записываем награды
    INSERT INTO referral_rewards (user_id, reward_type, reward_value, reason)
    VALUES 
        (referrer_id, 'subscription_days', '30', 'Друг активировал подписку'),
        (referred_id, 'subscription_days', '30', 'Активация по реферальной ссылке');
    
    -- Специальные награды для реферера
    IF referrer_active_count = 1 THEN
        -- Первый реферал
        INSERT INTO user_achievements (user_id, achievement_id)
        SELECT referrer_id, id FROM achievements WHERE code = 'referral_1'
        ON CONFLICT DO NOTHING;
        
    ELSIF referrer_active_count = 3 THEN
        -- 3 реферала - Pro до конца года
        UPDATE users
        SET subscription_end = DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
        WHERE id = referrer_id;
        
        INSERT INTO user_achievements (user_id, achievement_id)
        SELECT referrer_id, id FROM achievements WHERE code = 'referral_3'
        ON CONFLICT DO NOTHING;
        
        INSERT INTO referral_rewards (user_id, reward_type, reward_value, reason)
        VALUES (referrer_id, 'subscription_days', '365', 'Достижение: 3 активных друга');
        
    ELSIF referrer_active_count = 5 THEN
        -- 5 рефералов - Founding Member с вечным Pro
        UPDATE users
        SET 
            subscription_end = '2099-12-31'::DATE,
            is_founding_member = TRUE,
            subscription_type = 'founding_member'
        WHERE id = referrer_id;
        
        INSERT INTO user_achievements (user_id, achievement_id)
        SELECT referrer_id, id FROM achievements WHERE code IN ('referral_5', 'founding_member')
        ON CONFLICT DO NOTHING;
        
        INSERT INTO referral_rewards (user_id, reward_type, reward_value, reason)
        VALUES (referrer_id, 'permanent_pro', 'true', 'Достижение: Founding Member');
        
    ELSIF referrer_active_count = 10 THEN
        -- 10 рефералов - Легенда
        INSERT INTO user_achievements (user_id, achievement_id)
        SELECT referrer_id, id FROM achievements WHERE code = 'referral_10'
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Обновляем статус реферала как награжденный
    UPDATE referrals
    SET 
        status = 'rewarded',
        rewarded_at = NOW()
    WHERE referrer_id = referrer_id 
    AND referred_id = referred_id;
    
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 8. ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ТОП РЕФЕРЕРОВ
-- ====================================
CREATE OR REPLACE FUNCTION get_top_referrers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    first_name VARCHAR,
    username VARCHAR,
    referral_count INTEGER,
    is_founding_member BOOLEAN,
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.first_name,
        u.username,
        u.active_referrals as referral_count,
        u.is_founding_member,
        ROW_NUMBER() OVER (ORDER BY u.active_referrals DESC, u.total_referrals DESC)::INTEGER as rank
    FROM users u
    WHERE u.active_referrals > 0
    ORDER BY u.active_referrals DESC, u.total_referrals DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 9. ФУНКЦИЯ ДЛЯ ПРОВЕРКИ РЕФЕРАЛЬНОЙ АКТИВНОСТИ
-- ====================================
CREATE OR REPLACE FUNCTION check_referral_activity()
RETURNS VOID AS $$
DECLARE
    pending_ref RECORD;
BEGIN
    -- Проверяем все pending рефералы
    FOR pending_ref IN 
        SELECT * FROM referrals 
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Пытаемся активировать
        PERFORM activate_referral(pending_ref.referred_id);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- 10. ПРЕДСТАВЛЕНИЕ ДЛЯ СТАТИСТИКИ
-- ====================================
CREATE OR REPLACE VIEW referral_statistics AS
SELECT 
    u.id as user_id,
    u.telegram_id,
    u.first_name,
    u.referral_code,
    COUNT(DISTINCT r.id) as total_invites,
    COUNT(DISTINCT CASE WHEN r.status IN ('active', 'rewarded') THEN r.id END) as active_invites,
    COUNT(DISTINCT CASE WHEN r.status = 'pending' THEN r.id END) as pending_invites,
    u.referral_bonus_days as total_bonus_days,
    u.is_founding_member,
    CASE 
        WHEN u.active_referrals >= 10 THEN 'Legend'
        WHEN u.active_referrals >= 5 THEN 'Founding Member'
        WHEN u.active_referrals >= 3 THEN 'Pro Ambassador'
        WHEN u.active_referrals >= 1 THEN 'Active Referrer'
        ELSE 'Starter'
    END as referral_status
FROM users u
LEFT JOIN referrals r ON r.referrer_id = u.id
GROUP BY u.id, u.telegram_id, u.first_name, u.referral_code, 
         u.referral_bonus_days, u.is_founding_member, u.active_referrals;

-- ====================================
-- 11. ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ====================================
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_status 
ON referrals(referrer_id, status);

CREATE INDEX IF NOT EXISTS idx_referrals_referred_status 
ON referrals(referred_id, status);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_type 
ON referral_rewards(user_id, reward_type);

-- ====================================
-- 12. ТРИГГЕР ДЛЯ ГЕНЕРАЦИИ РЕФЕРАЛЬНОГО КОДА
-- ====================================
CREATE OR REPLACE FUNCTION auto_generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := LOWER(SUBSTRING(
            MD5(NEW.id::TEXT || NOW()::TEXT || RANDOM()::TEXT), 
            1, 8
        ));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_referral_code
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION auto_generate_referral_code();

-- ====================================
-- КОНЕЦ МИГРАЦИИ
-- ====================================
COMMENT ON TABLE referrals IS 'Реферальная система для вирусного роста';
COMMENT ON COLUMN referrals.status IS 'pending - ожидает активации, active - активирован, rewarded - награжден';
COMMENT ON COLUMN users.is_founding_member IS 'Пользователь привел 5+ друзей и получил вечный Pro';
