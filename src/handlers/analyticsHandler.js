// src/handlers/analyticsHandler.js
// Обработчик команды /analytics для админа

const { Markup } = require('telegraf');

class AnalyticsHandler {
  constructor(analyticsService) {
    this.analyticsService = analyticsService;
  }

  /**
   * Показать analytics dashboard для админа
   * @param {object} ctx - Telegraf context
   */
  async showDashboard(ctx) {
    try {
      const telegram_id = ctx.from.id;
      const adminIds = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_ID || '')
        .split(',')
        .map(id => parseInt(id.trim()));

      // Проверка прав админа
      if (!adminIds.includes(telegram_id)) {
        await ctx.reply('❌ Доступ запрещён. Эта команда только для администраторов.');
        return;
      }

      console.log(`📊 Admin ${telegram_id} requested analytics dashboard`);

      // Получаем все метрики
      const metrics = await this.analyticsService.getDashboardMetrics();

      // Формируем сообщение
      const message = this.formatDashboardMessage(metrics);

      // Клавиатура с дополнительными опциями
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'analytics_refresh')],
        [Markup.button.callback('📈 События (7 дней)', 'analytics_events_7')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

      console.log(`✅ Analytics dashboard shown to admin ${telegram_id}`);
    } catch (error) {
      console.error('❌ Error showing analytics dashboard:', error);
      await ctx.reply('❌ Ошибка при получении метрик. Попробуй позже.');
    }
  }

  /**
   * Форматировать dashboard сообщение
   * @param {object} metrics - Объект с метриками
   * @returns {string} - Отформатированное сообщение
   */
  formatDashboardMessage(metrics) {
    const { retention, engagement, quality, feedback } = metrics;

    // Эмодзи-индикаторы прогресса
    const getRetentionEmoji = (value, target) => {
      if (value >= target) return '✅';
      if (value >= target * 0.8) return '⚠️';
      return '❌';
    };

    const message = `📊 *FlowBot Analytics*

*Retention:*
${getRetentionEmoji(retention.day2, 50)} Day 2: *${retention.day2}%* (цель: >50%)
${getRetentionEmoji(retention.day7, 30)} Day 7: *${retention.day7}%* (цель: >30%)
${getRetentionEmoji(retention.day30, 15)} Day 30: *${retention.day30}%* (цель: >15%)

*Engagement:*
Активных сегодня: *${engagement.active_today}*
Активных за неделю: *${engagement.active_week}*
Новых за неделю: *${engagement.new_week}*

*Quality:*
Avg completion Day 1: *${quality.avg_completion_day1}%*
Avg completion Week 1: *${quality.avg_completion_week1}%*
Churn rate: *${quality.churn_rate}%*

*Feedback:*${feedback.total_responses > 0 ? `
🔥 Позитивный: *${feedback.great}%*
👍 Нейтральный: *${feedback.unclear}%*
😐 Негативный: *${feedback.not_fit}%*
Всего ответов: ${feedback.total_responses}` : `
_Пока нет данных_`}

⏰ Обновлено: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

    return message;
  }

  /**
   * Обработать callback для обновления метрик
   */
  async handleRefresh(ctx) {
    try {
      await ctx.answerCbQuery('Обновляю метрики...');

      const metrics = await this.analyticsService.getDashboardMetrics();
      const message = this.formatDashboardMessage(metrics);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Обновить', 'analytics_refresh')],
        [Markup.button.callback('📈 События (7 дней)', 'analytics_events_7')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

      console.log(`✅ Analytics refreshed for admin ${ctx.from.id}`);
    } catch (error) {
      console.error('❌ Error refreshing analytics:', error);
      await ctx.answerCbQuery('Ошибка обновления');
    }
  }

  /**
   * Показать статистику событий за последние 7 дней
   */
  async showEventStats(ctx, daysBack = 7) {
    try {
      await ctx.answerCbQuery('Загружаю события...');

      const eventStats = await this.analyticsService.getEventStats(daysBack);

      let message = `📈 *События за последние ${daysBack} дней:*\n\n`;

      if (Object.keys(eventStats).length === 0) {
        message += '_Нет данных по событиям_';
      } else {
        // Сортируем по количеству
        const sorted = Object.entries(eventStats).sort((a, b) => b[1].count - a[1].count);

        sorted.forEach(([eventType, stats]) => {
          const emoji = this.getEventEmoji(eventType);
          message += `${emoji} \`${eventType}\`\n`;
          message += `   События: ${stats.count} | Уникальные: ${stats.unique_users}\n\n`;
        });
      }

      message += `⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к метрикам', 'analytics_refresh')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

      console.log(`✅ Event stats shown to admin ${ctx.from.id}`);
    } catch (error) {
      console.error('❌ Error showing event stats:', error);
      await ctx.answerCbQuery('Ошибка загрузки событий');
    }
  }

  /**
   * Получить эмодзи для типа события
   */
  getEventEmoji(eventType) {
    const emojiMap = {
      user_registered: '👤',
      onboarding_completed: '✅',
      tasks_received_day_1: '📋',
      first_task_completed: '🎯',
      day_1_completed_50: '⚡',
      day_1_completed_100: '💯',
      day_completed: '🏆',
      returned_day_2: '🔁',
      returned_day_7: '🔥',
      returned_day_30: '🎉',
      feedback_submitted: '💬',
      churned: '😔',
      streak_3_days: '⭐',
      streak_7_days: '🌟',
      streak_14_days: '✨',
      streak_30_days: '💫'
    };

    return emojiMap[eventType] || '📊';
  }
}

module.exports = { AnalyticsHandler };
