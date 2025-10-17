// src/services/eventLogger.js
// Сервис для логирования событий пользователей в таблицу events

class EventLogger {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Универсальный метод для логирования события
   * @param {number} telegramId - ID пользователя в Telegram
   * @param {string} eventType - Тип события (см. EVENT_TYPES)
   * @param {object} eventData - Дополнительные данные события (опционально)
   */
  async logEvent(telegramId, eventType, eventData = {}) {
    try {
      const { error } = await this.supabase
        .from('events')
        .insert({
          telegram_id: telegramId,
          event_type: eventType,
          event_data: eventData,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error(`❌ Error logging event ${eventType} for user ${telegramId}:`, error);
        return false;
      }

      console.log(`✅ Event logged: ${eventType} for user ${telegramId}`, eventData);
      return true;
    } catch (error) {
      console.error(`❌ Exception logging event ${eventType}:`, error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ONBOARDING СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь зарегистрировался (первый /start)
   */
  async logUserRegistered(telegramId, userData = {}) {
    return this.logEvent(telegramId, EVENT_TYPES.USER_REGISTERED, {
      first_name: userData.first_name,
      username: userData.username,
      language_code: userData.language_code
    });
  }

  /**
   * Пользователь завершил onboarding (настроил время уведомлений)
   */
  async logOnboardingCompleted(telegramId, settingsData = {}) {
    return this.logEvent(telegramId, EVENT_TYPES.ONBOARDING_COMPLETED, {
      morning_hour: settingsData.morning_hour,
      evening_hour: settingsData.evening_hour,
      timezone: settingsData.timezone
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ЗАДАЧИ СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь получил задачи на первый день
   */
  async logTasksReceivedDay1(telegramId, tasksCount) {
    return this.logEvent(telegramId, EVENT_TYPES.TASKS_RECEIVED_DAY_1, {
      tasks_count: tasksCount
    });
  }

  /**
   * Пользователь выполнил первую задачу
   */
  async logFirstTaskCompleted(telegramId, taskData = {}) {
    return this.logEvent(telegramId, EVENT_TYPES.FIRST_TASK_COMPLETED, {
      task_type: taskData.task_type,
      task_text: taskData.task_text
    });
  }

  /**
   * Пользователь выполнил 50%+ задач в первый день
   */
  async logDay1Completed50(telegramId, completionRate) {
    return this.logEvent(telegramId, EVENT_TYPES.DAY_1_COMPLETED_50, {
      completion_rate: completionRate
    });
  }

  /**
   * Пользователь выполнил 100% задач в первый день
   */
  async logDay1Completed100(telegramId, stats = {}) {
    return this.logEvent(telegramId, EVENT_TYPES.DAY_1_COMPLETED_100, {
      total_tasks: stats.total_tasks,
      completed_tasks: stats.completed_tasks,
      flow_score: stats.flow_score
    });
  }

  /**
   * Пользователь выполнил 100% задач в любой день
   */
  async logDayCompleted(telegramId, dayNumber, stats = {}) {
    return this.logEvent(telegramId, EVENT_TYPES.DAY_COMPLETED, {
      day_number: dayNumber,
      total_tasks: stats.total_tasks,
      completed_tasks: stats.completed_tasks,
      flow_score: stats.flow_score
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RETENTION СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь вернулся на второй день
   */
  async logReturnedDay2(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.RETURNED_DAY_2, {
      days_since_registration: 2
    });
  }

  /**
   * Пользователь вернулся на седьмой день
   */
  async logReturnedDay7(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.RETURNED_DAY_7, {
      days_since_registration: 7
    });
  }

  /**
   * Пользователь дошёл до 30 дня (завершил программу)
   */
  async logReturnedDay30(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.RETURNED_DAY_30, {
      days_since_registration: 30,
      program_completed: true
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // FEEDBACK СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь отправил обратную связь
   */
  async logFeedbackSubmitted(telegramId, dayNumber, feedbackType) {
    return this.logEvent(telegramId, EVENT_TYPES.FEEDBACK_SUBMITTED, {
      day_number: dayNumber,
      feedback_type: feedbackType
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHURN СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь ушёл (не возвращался 7+ дней)
   * Вызывается автоматически через cron job
   */
  async logChurned(telegramId, daysSinceLastActivity, lastLevel) {
    return this.logEvent(telegramId, EVENT_TYPES.CHURNED, {
      days_since_last_activity: daysSinceLastActivity,
      last_level: lastLevel
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // STREAK СОБЫТИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Пользователь достиг стрика в 3 дня
   */
  async logStreak3Days(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.STREAK_3_DAYS, {
      streak_days: 3
    });
  }

  /**
   * Пользователь достиг стрика в 7 дней
   */
  async logStreak7Days(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.STREAK_7_DAYS, {
      streak_days: 7
    });
  }

  /**
   * Пользователь достиг стрика в 14 дней
   */
  async logStreak14Days(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.STREAK_14_DAYS, {
      streak_days: 14
    });
  }

  /**
   * Пользователь достиг стрика в 30 дней
   */
  async logStreak30Days(telegramId) {
    return this.logEvent(telegramId, EVENT_TYPES.STREAK_30_DAYS, {
      streak_days: 30
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BATCH ОПЕРАЦИИ (для оптимизации)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Логировать несколько событий одновременно (batch insert)
   * @param {Array} events - Массив объектов событий [{telegram_id, event_type, event_data}, ...]
   */
  async logBatch(events) {
    try {
      const eventsToInsert = events.map(e => ({
        telegram_id: e.telegram_id,
        event_type: e.event_type,
        event_data: e.event_data || {},
        created_at: new Date().toISOString()
      }));

      const { error } = await this.supabase
        .from('events')
        .insert(eventsToInsert);

      if (error) {
        console.error('❌ Error batch logging events:', error);
        return false;
      }

      console.log(`✅ Batch logged ${events.length} events`);
      return true;
    } catch (error) {
      console.error('❌ Exception batch logging events:', error);
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // QUERY HELPERS (для проверки событий)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Проверить произошло ли событие для пользователя
   * @param {number} telegramId - ID пользователя
   * @param {string} eventType - Тип события
   * @returns {Promise<boolean>} - true если событие уже было
   */
  async hasEvent(telegramId, eventType) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('id')
        .eq('telegram_id', telegramId)
        .eq('event_type', eventType)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error(`Error checking event ${eventType}:`, error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error(`Exception checking event ${eventType}:`, error);
      return false;
    }
  }

  /**
   * Получить все события пользователя
   * @param {number} telegramId - ID пользователя
   * @param {number} limit - Лимит событий (по умолчанию 100)
   * @returns {Promise<Array>} - Массив событий
   */
  async getUserEvents(telegramId, limit = 100) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error(`Error getting user events:`, error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error(`Exception getting user events:`, error);
      return [];
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// КОНСТАНТЫ ТИПОВ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════

const EVENT_TYPES = {
  // Onboarding
  USER_REGISTERED: 'user_registered',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Задачи
  TASKS_RECEIVED_DAY_1: 'tasks_received_day_1',
  FIRST_TASK_COMPLETED: 'first_task_completed',
  DAY_1_COMPLETED_50: 'day_1_completed_50',
  DAY_1_COMPLETED_100: 'day_1_completed_100',
  DAY_COMPLETED: 'day_completed',

  // Retention
  RETURNED_DAY_2: 'returned_day_2',
  RETURNED_DAY_7: 'returned_day_7',
  RETURNED_DAY_30: 'returned_day_30',

  // Feedback
  FEEDBACK_SUBMITTED: 'feedback_submitted',

  // Churn
  CHURNED: 'churned',

  // Streaks
  STREAK_3_DAYS: 'streak_3_days',
  STREAK_7_DAYS: 'streak_7_days',
  STREAK_14_DAYS: 'streak_14_days',
  STREAK_30_DAYS: 'streak_30_days'
};

module.exports = {
  EventLogger,
  EVENT_TYPES
};
