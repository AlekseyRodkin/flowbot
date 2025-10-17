// src/services/feedbackService.js
const moment = require('moment-timezone');
const { Markup } = require('telegraf');

class FeedbackService {
  constructor(supabase, bot = null) {
    this.supabase = supabase;
    this.bot = bot;
  }

  // Сохранить отзыв от пользователя
  async saveFeedback(telegram_id, type, message) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .insert({
          user_id: telegram_id,
          type: type,
          message: message,
          status: 'new'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving feedback:', error);
        throw error;
      }

      console.log(`✅ Feedback saved: ${type} from user ${telegram_id}`);
      return data;
    } catch (error) {
      console.error('Error in saveFeedback:', error);
      throw error;
    }
  }

  // Получить все отзывы (для админа)
  async getAllFeedback(filters = {}) {
    try {
      let query = this.supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      // Фильтр по типу
      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      // Фильтр по статусу
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      // Фильтр по пользователю
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }

      // Лимит записей
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting feedback:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAllFeedback:', error);
      throw error;
    }
  }

  // Получить отзывы конкретного пользователя
  async getUserFeedback(telegram_id) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .select('*')
        .eq('user_id', telegram_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting user feedback:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserFeedback:', error);
      throw error;
    }
  }

  // Обновить статус отзыва
  async updateFeedbackStatus(id, status) {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .update({ status: status })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating feedback status:', error);
        throw error;
      }

      console.log(`✅ Feedback ${id} status updated to ${status}`);
      return data;
    } catch (error) {
      console.error('Error in updateFeedbackStatus:', error);
      throw error;
    }
  }

  // Получить статистику отзывов
  async getFeedbackStats() {
    try {
      const { data, error } = await this.supabase
        .from('feedback')
        .select('type, status');

      if (error) {
        console.error('Error getting feedback stats:', error);
        throw error;
      }

      const stats = {
        total: data.length,
        bugs: data.filter(f => f.type === 'bug').length,
        suggestions: data.filter(f => f.type === 'suggestion').length,
        new: data.filter(f => f.status === 'new').length,
        in_progress: data.filter(f => f.status === 'in_progress').length,
        resolved: data.filter(f => f.status === 'resolved').length,
        closed: data.filter(f => f.status === 'closed').length
      };

      return stats;
    } catch (error) {
      console.error('Error in getFeedbackStats:', error);
      throw error;
    }
  }

  // Уведомить админа о новом отзыве
  async notifyAdmin(feedbackData, userData) {
    if (!this.bot) {
      console.log('⚠️ Bot not initialized, skipping admin notification');
      return;
    }

    const adminId = process.env.ADMIN_TELEGRAM_ID;
    const channelId = process.env.FEEDBACK_CHANNEL_ID;

    if (!adminId && !channelId) {
      console.log('⚠️ No admin ID or channel ID configured');
      return;
    }

    try {
      // Безопасное получение данных пользователя
      const username = userData?.username ? '@' + userData.username : 'Пользователь';
      const telegramId = userData?.telegram_id || 'N/A';
      const userLevel = userData?.level || 'N/A';

      // Формируем красивое сообщение
      const typeEmoji = feedbackData.type === 'bug' ? '🐛' : '💡';
      const typeText = feedbackData.type === 'bug' ? 'НОВАЯ ОШИБКА' : 'НОВОЕ ПРЕДЛОЖЕНИЕ';

      const message = `${typeEmoji} *${typeText}*

📱 От: ${username} (${telegramId})
📅 День: ${userLevel}
🆔 Feedback ID: #${feedbackData.id}

📝 *Сообщение:*
${feedbackData.message}

⏰ ${moment().tz('Europe/Moscow').format('DD.MM.YYYY HH:mm')}`;

      // Клавиатура с кнопкой ответа
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💬 Ответить', `admin_feedback_reply_${feedbackData.id}_${telegramId}`)]
      ]);

      // Отправляем админу
      if (adminId) {
        await this.bot.telegram.sendMessage(adminId, message, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
        console.log(`✅ Admin notified about feedback #${feedbackData.id}`);
      }

      // Опционально отправляем в канал
      if (channelId) {
        await this.bot.telegram.sendMessage(channelId, message, {
          parse_mode: 'Markdown'
        });
        console.log(`✅ Channel notified about feedback #${feedbackData.id}`);
      }

    } catch (error) {
      console.error('❌ Error notifying admin:', error);
      console.error('Error stack:', error.stack);
      // Не бросаем ошибку, чтобы не сломать основной процесс
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RETENTION FEEDBACK (Day 1, 3, 7)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Сохранить retention feedback (от кнопок Day 1/3/7)
   * @param {number} telegram_id - ID пользователя
   * @param {number} day_number - День программы (1, 3, 7)
   * @param {string} feedback_type - Тип отзыва (great, good, unclear, not_fit и т.д.)
   */
  async saveRetentionFeedback(telegram_id, day_number, feedback_type) {
    try {
      const { data, error } = await this.supabase
        .from('user_feedback')
        .insert({
          telegram_id,
          day_number,
          feedback_type,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error saving retention feedback:', error);
        throw error;
      }

      console.log(`✅ Retention feedback saved: Day ${day_number}, type ${feedback_type} from user ${telegram_id}`);
      return data;
    } catch (error) {
      console.error('❌ Error in saveRetentionFeedback:', error);
      throw error;
    }
  }

  /**
   * Проверить отправлял ли пользователь feedback для конкретного дня
   * @param {number} telegram_id - ID пользователя
   * @param {number} day_number - День программы (1, 3, 7)
   * @returns {Promise<boolean>} - true если уже отправлял
   */
  async hasRetentionFeedback(telegram_id, day_number) {
    try {
      const { data, error } = await this.supabase
        .from('user_feedback')
        .select('id')
        .eq('telegram_id', telegram_id)
        .eq('day_number', day_number)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Error checking retention feedback:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ Error in hasRetentionFeedback:', error);
      return false;
    }
  }
}

module.exports = { FeedbackService };
