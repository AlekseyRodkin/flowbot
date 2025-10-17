-- Analytics SQL Queries для FlowBot
-- Все запросы для измерения retention, engagement, completion метрик

-- ═══════════════════════════════════════════════════════════════
-- RETENTION МЕТРИКИ
-- ═══════════════════════════════════════════════════════════════

-- Day 1 → Day 2 Retention
-- Показывает какой % пользователей вернулся на второй день
SELECT
  COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END)::float /
  NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day2_retention_percent,
  COUNT(DISTINCT telegram_id) as total_users,
  COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END) as returned_day2
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Day 1 → Day 7 Retention
-- Показывает какой % пользователей дошёл до 7 дня
SELECT
  COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END)::float /
  NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day7_retention_percent,
  COUNT(DISTINCT telegram_id) as total_users,
  COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END) as reached_day7
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Day 1 → Day 30 Retention (завершили программу)
SELECT
  COUNT(DISTINCT CASE WHEN level >= 30 THEN telegram_id END)::float /
  NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day30_retention_percent,
  COUNT(DISTINCT telegram_id) as total_users,
  COUNT(DISTINCT CASE WHEN level >= 30 THEN telegram_id END) as completed_program
FROM users
WHERE created_at >= NOW() - INTERVAL '60 days';

-- Retention по дням (cohort analysis)
WITH cohorts AS (
  SELECT
    DATE(created_at) as cohort_date,
    telegram_id,
    level
  FROM users
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  cohort_date,
  COUNT(DISTINCT telegram_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END) as day2_retained,
  COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END) as day7_retained,
  COUNT(DISTINCT CASE WHEN level >= 30 THEN telegram_id END) as day30_retained,
  ROUND(COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END)::numeric / NULLIF(COUNT(DISTINCT telegram_id), 0) * 100, 1) as day2_percent,
  ROUND(COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END)::numeric / NULLIF(COUNT(DISTINCT telegram_id), 0) * 100, 1) as day7_percent
FROM cohorts
GROUP BY cohort_date
ORDER BY cohort_date DESC;


-- ═══════════════════════════════════════════════════════════════
-- COMPLETION МЕТРИКИ
-- ═══════════════════════════════════════════════════════════════

-- Процент выполнения задач в первый день
WITH day1_stats AS (
  SELECT
    ds.telegram_id,
    ds.completed_tasks,
    ds.total_tasks,
    CASE
      WHEN ds.total_tasks > 0
      THEN ds.completed_tasks::float / ds.total_tasks
      ELSE 0
    END as completion_rate
  FROM daily_stats ds
  JOIN users u ON u.telegram_id = ds.telegram_id
  WHERE u.level = 1
    AND ds.date >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  ROUND(AVG(completion_rate) * 100, 1) as avg_completion_percent,
  COUNT(CASE WHEN completion_rate >= 1.0 THEN 1 END) as completed_100_percent,
  COUNT(CASE WHEN completion_rate >= 0.5 AND completion_rate < 1.0 THEN 1 END) as completed_50_to_99_percent,
  COUNT(CASE WHEN completion_rate < 0.5 THEN 1 END) as completed_below_50_percent,
  COUNT(*) as total_day1_users
FROM day1_stats;

-- Средний процент выполнения за первую неделю
SELECT
  ROUND(AVG(
    CASE
      WHEN total_tasks > 0
      THEN completed_tasks::float / total_tasks * 100
      ELSE 0
    END
  ), 1) as avg_completion_week1_percent
FROM daily_stats ds
JOIN users u ON u.telegram_id = ds.telegram_id
WHERE u.level <= 7
  AND ds.date >= CURRENT_DATE - INTERVAL '30 days';

-- Распределение completion rate по дням
SELECT
  CASE
    WHEN u.level <= 5 THEN '1-5'
    WHEN u.level <= 10 THEN '6-10'
    WHEN u.level <= 15 THEN '11-15'
    WHEN u.level <= 20 THEN '16-20'
    WHEN u.level <= 25 THEN '21-25'
    WHEN u.level <= 30 THEN '26-30'
    ELSE '31+'
  END as day_range,
  COUNT(DISTINCT ds.telegram_id) as users_count,
  ROUND(AVG(
    CASE
      WHEN ds.total_tasks > 0
      THEN ds.completed_tasks::float / ds.total_tasks * 100
      ELSE 0
    END
  ), 1) as avg_completion_percent
FROM daily_stats ds
JOIN users u ON u.telegram_id = ds.telegram_id
WHERE ds.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY day_range
ORDER BY MIN(u.level);


-- ═══════════════════════════════════════════════════════════════
-- ENGAGEMENT МЕТРИКИ
-- ═══════════════════════════════════════════════════════════════

-- Активные пользователи сегодня, за неделю, за месяц
SELECT
  COUNT(DISTINCT CASE WHEN last_activity_at >= CURRENT_DATE THEN telegram_id END) as active_today,
  COUNT(DISTINCT CASE WHEN last_activity_at >= CURRENT_DATE - INTERVAL '7 days' THEN telegram_id END) as active_week,
  COUNT(DISTINCT CASE WHEN last_activity_at >= CURRENT_DATE - INTERVAL '30 days' THEN telegram_id END) as active_month,
  COUNT(DISTINCT telegram_id) as total_users
FROM users;

-- Активные пользователи по дням (тренд)
SELECT
  DATE(last_activity_at) as date,
  COUNT(DISTINCT telegram_id) as active_users
FROM users
WHERE last_activity_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(last_activity_at)
ORDER BY date DESC
LIMIT 30;

-- Новые регистрации по дням
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_users
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;


-- ═══════════════════════════════════════════════════════════════
-- CHURN АНАЛИЗ
-- ═══════════════════════════════════════════════════════════════

-- Churn по дням программы (на каком дне бросают)
SELECT
  level as dropped_at_day,
  COUNT(*) as user_count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM users WHERE level < 30 AND last_activity_at < NOW() - INTERVAL '7 days') * 100, 1) as percent_of_churned
FROM users
WHERE last_activity_at < NOW() - INTERVAL '7 days'
  AND level < 30
GROUP BY level
ORDER BY user_count DESC
LIMIT 10;

-- Общий churn rate
SELECT
  COUNT(CASE WHEN last_activity_at < NOW() - INTERVAL '7 days' AND level < 30 THEN 1 END) as churned_users,
  COUNT(*) as total_users,
  ROUND(
    COUNT(CASE WHEN last_activity_at < NOW() - INTERVAL '7 days' AND level < 30 THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) as churn_rate_percent
FROM users
WHERE created_at < NOW() - INTERVAL '7 days'; -- Только те кто был хотя бы неделю назад


-- ═══════════════════════════════════════════════════════════════
-- FEEDBACK АНАЛИЗ
-- ═══════════════════════════════════════════════════════════════

-- Распределение feedback по типам (Day 1)
SELECT
  feedback_type,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM user_feedback WHERE day_number = 1), 0) * 100, 1) as percent
FROM user_feedback
WHERE day_number = 1
GROUP BY feedback_type
ORDER BY count DESC;

-- Распределение feedback по типам (Day 3)
SELECT
  feedback_type,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM user_feedback WHERE day_number = 3), 0) * 100, 1) as percent
FROM user_feedback
WHERE day_number = 3
GROUP BY feedback_type
ORDER BY count DESC;

-- Распределение feedback по типам (Day 7)
SELECT
  feedback_type,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM user_feedback WHERE day_number = 7), 0) * 100, 1) as percent
FROM user_feedback
WHERE day_number = 7
GROUP BY feedback_type
ORDER BY count DESC;

-- Динамика feedback (как меняется с Day 1 → Day 3 → Day 7)
SELECT
  day_number,
  COUNT(*) as total_feedback,
  COUNT(CASE WHEN feedback_type IN ('great', 'good', 'getting_rhythm', 'works') THEN 1 END) as positive,
  COUNT(CASE WHEN feedback_type IN ('unclear', 'not_sure', 'have_questions') THEN 1 END) as neutral,
  COUNT(CASE WHEN feedback_type IN ('not_fit', 'not_for_me', 'too_hard', 'want_stop', 'stopping') THEN 1 END) as negative,
  ROUND(
    COUNT(CASE WHEN feedback_type IN ('great', 'good', 'getting_rhythm', 'works') THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0) * 100,
    1
  ) as positive_percent
FROM user_feedback
GROUP BY day_number
ORDER BY day_number;


-- ═══════════════════════════════════════════════════════════════
-- EVENT TRACKING
-- ═══════════════════════════════════════════════════════════════

-- Топ событий за последние 7 дней
SELECT
  event_type,
  COUNT(*) as count,
  COUNT(DISTINCT telegram_id) as unique_users
FROM events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY count DESC;

-- Funnel анализ (от регистрации до Day 1 completion)
WITH funnel AS (
  SELECT
    COUNT(DISTINCT CASE WHEN event_type = 'user_registered' THEN telegram_id END) as registered,
    COUNT(DISTINCT CASE WHEN event_type = 'onboarding_completed' THEN telegram_id END) as completed_onboarding,
    COUNT(DISTINCT CASE WHEN event_type = 'tasks_received_day_1' THEN telegram_id END) as received_tasks,
    COUNT(DISTINCT CASE WHEN event_type = 'first_task_completed' THEN telegram_id END) as completed_first_task,
    COUNT(DISTINCT CASE WHEN event_type = 'day_1_completed_50' THEN telegram_id END) as completed_50_percent,
    COUNT(DISTINCT CASE WHEN event_type = 'day_1_completed_100' THEN telegram_id END) as completed_100_percent
  FROM events
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  'Registered' as step,
  registered as users,
  100.0 as percent
FROM funnel
UNION ALL
SELECT
  'Onboarding',
  completed_onboarding,
  ROUND(completed_onboarding::numeric / NULLIF(registered, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT
  'Received Tasks',
  received_tasks,
  ROUND(received_tasks::numeric / NULLIF(registered, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT
  'First Task Done',
  completed_first_task,
  ROUND(completed_first_task::numeric / NULLIF(registered, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT
  'Day 1: 50%+',
  completed_50_percent,
  ROUND(completed_50_percent::numeric / NULLIF(registered, 0) * 100, 1)
FROM funnel
UNION ALL
SELECT
  'Day 1: 100%',
  completed_100_percent,
  ROUND(completed_100_percent::numeric / NULLIF(registered, 0) * 100, 1)
FROM funnel;


-- ═══════════════════════════════════════════════════════════════
-- STREAK АНАЛИЗ
-- ═══════════════════════════════════════════════════════════════

-- Распределение пользователей по текущему стрику
SELECT
  CASE
    WHEN current_streak = 0 THEN '0 (no streak)'
    WHEN current_streak BETWEEN 1 AND 2 THEN '1-2 days'
    WHEN current_streak BETWEEN 3 AND 6 THEN '3-6 days'
    WHEN current_streak BETWEEN 7 AND 13 THEN '7-13 days (1-2 weeks)'
    WHEN current_streak BETWEEN 14 AND 29 THEN '14-29 days (2-4 weeks)'
    WHEN current_streak >= 30 THEN '30+ days (month+)'
  END as streak_range,
  COUNT(*) as user_count,
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM streaks) * 100, 1) as percent
FROM streaks
GROUP BY streak_range
ORDER BY MIN(current_streak);

-- Средний и максимальный стрик
SELECT
  ROUND(AVG(current_streak), 1) as avg_current_streak,
  MAX(current_streak) as max_current_streak,
  ROUND(AVG(longest_streak), 1) as avg_longest_streak,
  MAX(longest_streak) as max_longest_streak
FROM streaks;


-- ═══════════════════════════════════════════════════════════════
-- SUMMARY DASHBOARD QUERY
-- Один запрос для показа всех ключевых метрик
-- ═══════════════════════════════════════════════════════════════

WITH metrics AS (
  -- Retention
  SELECT
    COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END)::float /
    NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day2_retention,
    COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END)::float /
    NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day7_retention,
    COUNT(DISTINCT CASE WHEN level >= 30 THEN telegram_id END)::float /
    NULLIF(COUNT(DISTINCT telegram_id), 0) * 100 as day30_retention,
    -- Engagement
    COUNT(DISTINCT CASE WHEN last_activity_at >= CURRENT_DATE THEN telegram_id END) as active_today,
    COUNT(DISTINCT CASE WHEN last_activity_at >= CURRENT_DATE - INTERVAL '7 days' THEN telegram_id END) as active_week,
    COUNT(DISTINCT CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN telegram_id END) as new_week,
    -- Total
    COUNT(DISTINCT telegram_id) as total_users
  FROM users
  WHERE created_at >= NOW() - INTERVAL '30 days'
)
SELECT
  -- Retention
  ROUND(day2_retention, 1) as day2_retention_percent,
  ROUND(day7_retention, 1) as day7_retention_percent,
  ROUND(day30_retention, 1) as day30_retention_percent,
  -- Engagement
  active_today,
  active_week,
  new_week,
  total_users
FROM metrics;
