// src/services/analyticsService.js
// Сервис для получения метрик и аналитики FlowBot

class AnalyticsService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Получить все ключевые метрики для dashboard
   * @returns {Promise<object>} - Объект с метриками
   */
  async getDashboardMetrics() {
    try {
      const metrics = {
        retention: await this.getRetentionMetrics(),
        engagement: await this.getEngagementMetrics(),
        quality: await this.getQualityMetrics(),
        feedback: await this.getFeedbackMetrics()
      };

      return metrics;
    } catch (error) {
      console.error('❌ Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Retention метрики (Day 2, 7, 30)
   */
  async getRetentionMetrics() {
    try {
      const { data, error } = await this.supabase.rpc('get_retention_metrics');

      if (error) {
        // Fallback: выполним запрос напрямую
        const result = await this.supabase.from('users').select('level, created_at');

        if (result.error) {
          console.error('Error getting retention metrics:', result.error);
          return { day2: 0, day7: 0, day30: 0 };
        }

        const users = result.data.filter(
          u => new Date(u.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        );

        const total = users.length;
        const day2 = users.filter(u => u.level >= 2).length;
        const day7 = users.filter(u => u.level >= 7).length;
        const day30 = users.filter(u => u.level >= 30).length;

        return {
          day2: total > 0 ? Math.round((day2 / total) * 100) : 0,
          day7: total > 0 ? Math.round((day7 / total) * 100) : 0,
          day30: total > 0 ? Math.round((day30 / total) * 100) : 0
        };
      }

      return data[0] || { day2: 0, day7: 0, day30: 0 };
    } catch (error) {
      console.error('❌ Error in getRetentionMetrics:', error);
      return { day2: 0, day7: 0, day30: 0 };
    }
  }

  /**
   * Engagement метрики (активные пользователи)
   */
  async getEngagementMetrics() {
    try {
      const { data, error } = await this.supabase.rpc('get_engagement_metrics');

      if (error) {
        // Fallback
        const result = await this.supabase
          .from('users')
          .select('telegram_id, last_activity_at, created_at');

        if (result.error) {
          console.error('Error getting engagement metrics:', result.error);
          return { active_today: 0, active_week: 0, new_week: 0 };
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const activeToday = result.data.filter(
          u => u.last_activity_at && new Date(u.last_activity_at) >= today
        ).length;

        const activeWeek = result.data.filter(
          u => u.last_activity_at && new Date(u.last_activity_at) >= weekAgo
        ).length;

        const newWeek = result.data.filter(
          u => new Date(u.created_at) >= weekAgo
        ).length;

        return {
          active_today: activeToday,
          active_week: activeWeek,
          new_week: newWeek
        };
      }

      return data[0] || { active_today: 0, active_week: 0, new_week: 0 };
    } catch (error) {
      console.error('❌ Error in getEngagementMetrics:', error);
      return { active_today: 0, active_week: 0, new_week: 0 };
    }
  }

  /**
   * Quality метрики (completion rate, churn)
   */
  async getQualityMetrics() {
    try {
      const [completionDay1, completionWeek1, churnRate] = await Promise.all([
        this.getDay1CompletionRate(),
        this.getWeek1CompletionRate(),
        this.getChurnRate()
      ]);

      return {
        avg_completion_day1: completionDay1,
        avg_completion_week1: completionWeek1,
        churn_rate: churnRate
      };
    } catch (error) {
      console.error('❌ Error in getQualityMetrics:', error);
      return {
        avg_completion_day1: 0,
        avg_completion_week1: 0,
        churn_rate: 0
      };
    }
  }

  /**
   * Процент выполнения задач в первый день
   */
  async getDay1CompletionRate() {
    try {
      const { data, error } = await this.supabase
        .from('daily_stats')
        .select('completed_tasks, total_tasks, telegram_id')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (error) {
        console.error('Error getting Day 1 completion:', error);
        return 0;
      }

      // Получить пользователей на уровне 1
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('telegram_id')
        .eq('level', 1);

      if (usersError) {
        console.error('Error getting level 1 users:', usersError);
        return 0;
      }

      const level1Ids = new Set(users.map(u => u.telegram_id));
      const day1Stats = data.filter(ds => level1Ids.has(ds.telegram_id));

      if (day1Stats.length === 0) return 0;

      const avgCompletion =
        day1Stats.reduce((sum, ds) => {
          const rate = ds.total_tasks > 0 ? ds.completed_tasks / ds.total_tasks : 0;
          return sum + rate;
        }, 0) / day1Stats.length;

      return Math.round(avgCompletion * 100);
    } catch (error) {
      console.error('❌ Error in getDay1CompletionRate:', error);
      return 0;
    }
  }

  /**
   * Средний процент выполнения за первую неделю
   */
  async getWeek1CompletionRate() {
    try {
      const { data, error } = await this.supabase
        .from('daily_stats')
        .select('completed_tasks, total_tasks, telegram_id')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (error) {
        console.error('Error getting Week 1 completion:', error);
        return 0;
      }

      // Пользователи уровня 1-7
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('telegram_id')
        .lte('level', 7);

      if (usersError) {
        console.error('Error getting week 1 users:', usersError);
        return 0;
      }

      const week1Ids = new Set(users.map(u => u.telegram_id));
      const week1Stats = data.filter(ds => week1Ids.has(ds.telegram_id));

      if (week1Stats.length === 0) return 0;

      const avgCompletion =
        week1Stats.reduce((sum, ds) => {
          const rate = ds.total_tasks > 0 ? ds.completed_tasks / ds.total_tasks : 0;
          return sum + rate;
        }, 0) / week1Stats.length;

      return Math.round(avgCompletion * 100);
    } catch (error) {
      console.error('❌ Error in getWeek1CompletionRate:', error);
      return 0;
    }
  }

  /**
   * Churn rate (процент ушедших)
   */
  async getChurnRate() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('telegram_id, last_activity_at, level, created_at');

      if (error) {
        console.error('Error getting churn rate:', error);
        return 0;
      }

      // Только пользователи зарегистрированные хотя бы неделю назад
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const eligibleUsers = data.filter(u => new Date(u.created_at) < weekAgo);

      if (eligibleUsers.length === 0) return 0;

      // Churned = не активны 7+ дней И не завершили программу
      const churned = eligibleUsers.filter(
        u => u.level < 30 && (!u.last_activity_at || new Date(u.last_activity_at) < weekAgo)
      ).length;

      return Math.round((churned / eligibleUsers.length) * 100);
    } catch (error) {
      console.error('❌ Error in getChurnRate:', error);
      return 0;
    }
  }

  /**
   * Feedback метрики (распределение по типам)
   */
  async getFeedbackMetrics() {
    try {
      const { data, error } = await this.supabase
        .from('user_feedback')
        .select('feedback_type, day_number');

      if (error) {
        console.error('Error getting feedback metrics:', error);
        return { great: 0, unclear: 0, not_fit: 0, not_for_me: 0 };
      }

      if (data.length === 0) {
        return { great: 0, unclear: 0, not_fit: 0, not_for_me: 0 };
      }

      // Группировка по позитиву/нейтралу/негативу
      const positive = data.filter(f =>
        ['great', 'getting_rhythm', 'works'].includes(f.feedback_type)
      ).length;

      const neutral = data.filter(f =>
        ['unclear', 'have_questions', 'not_sure', 'slow_progress'].includes(f.feedback_type)
      ).length;

      const negative = data.filter(f =>
        ['not_fit', 'not_for_me', 'too_hard', 'want_stop', 'stopping'].includes(f.feedback_type)
      ).length;

      const total = data.length;

      return {
        great: total > 0 ? Math.round((positive / total) * 100) : 0,
        unclear: total > 0 ? Math.round((neutral / total) * 100) : 0,
        not_fit: total > 0 ? Math.round((negative / total) * 100) : 0,
        total_responses: total
      };
    } catch (error) {
      console.error('❌ Error in getFeedbackMetrics:', error);
      return { great: 0, unclear: 0, not_fit: 0, not_for_me: 0 };
    }
  }

  /**
   * Детальная статистика по событиям
   */
  async getEventStats(daysBack = 7) {
    try {
      const { data, error } = await this.supabase
        .from('events')
        .select('event_type, telegram_id, created_at')
        .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString());

      if (error) {
        console.error('Error getting event stats:', error);
        return {};
      }

      // Группируем по типам
      const stats = {};
      data.forEach(event => {
        if (!stats[event.event_type]) {
          stats[event.event_type] = { count: 0, unique_users: new Set() };
        }
        stats[event.event_type].count++;
        stats[event.event_type].unique_users.add(event.telegram_id);
      });

      // Преобразуем Set в число
      Object.keys(stats).forEach(key => {
        stats[key].unique_users = stats[key].unique_users.size;
      });

      return stats;
    } catch (error) {
      console.error('❌ Error in getEventStats:', error);
      return {};
    }
  }
}

module.exports = { AnalyticsService };
