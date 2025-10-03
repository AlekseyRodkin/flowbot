// src/services/viralService.js
const moment = require('moment-timezone');
const { Markup } = require('telegraf');

/**
 * Viral Service - триггеры для сарафанного радио
 * Отправляет приглашение поделиться на 7-й день
 */
class ViralService {
  constructor(supabase, bot, referralService) {
    this.supabase = supabase;
    this.bot = bot;
    this.referralService = referralService;
  }

  /**
   * Проверить и отправить триггер на 7-й день
   */
  async checkAndSendDay7Trigger(telegramId) {
    try {
      // Проверяем прошел ли пользователь 7 дней
      const hasPassed7Days = await this.hasUserCompleted7Days(telegramId);

      if (!hasPassed7Days) {
        return false;
      }

      // Проверяем не отправляли ли уже этот триггер
      const alreadySent = await this.hasTriggeredDay7(telegramId);

      if (alreadySent) {
        return false;
      }

      // Отправляем триггер
      await this.sendDay7InviteTrigger(telegramId);

      // Сохраняем что триггер отправлен
      await this.markTriggeredDay7(telegramId);

      return true;
    } catch (error) {
      console.error('Error checking day 7 trigger:', error);
      return false;
    }
  }

  /**
   * Проверка: прошел ли пользователь 7 дней
   */
  async hasUserCompleted7Days(telegramId) {
    try {
      // Получаем статистику за последние 10 дней
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('date, completed_tasks')
        .eq('user_telegram_id', telegramId)
        .gte('completed_tasks', 10) // Минимум 10 задач в день
        .order('date', { ascending: false })
        .limit(10);

      if (!stats || stats.length < 7) {
        return false; // Недостаточно активных дней
      }

      // Проверяем что есть 7 дней с 10+ задачами
      const activeDays = stats.filter(s => s.completed_tasks >= 10);
      return activeDays.length >= 7;
    } catch (error) {
      console.error('Error checking 7 days:', error);
      return false;
    }
  }

  /**
   * Проверка: отправляли ли уже триггер на 7-й день
   */
  async hasTriggeredDay7(telegramId) {
    try {
      const { data } = await this.supabase
        .from('viral_triggers')
        .select('id')
        .eq('user_telegram_id', telegramId)
        .eq('trigger_type', 'day7_invite')
        .single();

      return !!data;
    } catch (error) {
      // Если записи нет - триггер не отправлялся
      return false;
    }
  }

  /**
   * Отметить что триггер на 7-й день отправлен
   */
  async markTriggeredDay7(telegramId) {
    try {
      await this.supabase
        .from('viral_triggers')
        .insert([{
          user_telegram_id: telegramId,
          trigger_type: 'day7_invite',
          triggered_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error marking day 7 trigger:', error);
    }
  }

  /**
   * Отправить триггер на 7-й день - призыв поделиться
   */
  async sendDay7InviteTrigger(telegramId) {
    try {
      // Получаем данные пользователя
      const { data: user } = await this.supabase
        .from('users')
        .select('telegram_id, first_name')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        return;
      }

      // Получаем статистику пользователя
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('completed_tasks')
        .eq('user_telegram_id', telegramId)
        .gte('completed_tasks', 1);

      const totalTasks = stats?.reduce((sum, day) => sum + day.completed_tasks, 0) || 0;

      // Формируем сообщение
      const message =
        `🎉 *Поздравляем, ${user.first_name}!*\n\n` +
        `Ты прошел первую неделю продуктивности!\n\n` +
        `За 7 дней ты:\n` +
        `✅ Выполнил ${totalTasks}+ задач\n` +
        `✅ Вошел в состояние потока\n` +
        `✅ Победил прокрастинацию\n\n` +
        `💡 *Теперь у тебя есть шанс помочь своим друзьям изменить их жизнь!*\n\n` +
        `Поделись FlowBot с теми, кому это поможет:\n` +
        `• Друзьям, которые прокрастинируют\n` +
        `• Коллегам, которые хотят больше успевать\n` +
        `• Всем, кто мечтает о продуктивности\n\n` +
        `Не для награды, а чтобы они тоже стали продуктивнее 💪`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Поделиться с друзьями', 'share_telegram')],
        [Markup.button.callback('📊 Моя реферальная статистика', 'referral_stats')]
      ]);

      await this.bot.telegram.sendMessage(
        user.telegram_id,
        message,
        {
          parse_mode: 'Markdown',
          ...keyboard
        }
      );

      console.log(`✅ Day 7 viral trigger sent to user ${telegramId}`);
    } catch (error) {
      console.error('Error sending day 7 trigger:', error);
    }
  }

  /**
   * Триггер на 14-й день (если не поделился)
   */
  async checkAndSendDay14Reminder(telegramId) {
    try {
      // Проверяем прошел ли 14 дней
      const hasPassed14Days = await this.hasUserCompleted14Days(telegramId);

      if (!hasPassed14Days) {
        return false;
      }

      // Проверяем не отправляли ли уже этот триггер
      const alreadySent = await this.hasTriggeredDay14(telegramId);

      if (alreadySent) {
        return false;
      }

      // Проверяем поделился ли пользователь
      const hasShared = await this.hasUserShared(telegramId);

      if (hasShared) {
        return false; // Уже поделился, не нужно напоминать
      }

      // Отправляем напоминание
      await this.sendDay14Reminder(telegramId);

      // Сохраняем что триггер отправлен
      await this.markTriggeredDay14(telegramId);

      return true;
    } catch (error) {
      console.error('Error checking day 14 reminder:', error);
      return false;
    }
  }

  async hasUserCompleted14Days(telegramId) {
    try {
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('date, completed_tasks')
        .eq('user_telegram_id', telegramId)
        .gte('completed_tasks', 10)
        .order('date', { ascending: false })
        .limit(15);

      const activeDays = stats?.filter(s => s.completed_tasks >= 10) || [];
      return activeDays.length >= 14;
    } catch (error) {
      console.error('Error checking 14 days:', error);
      return false;
    }
  }

  async hasTriggeredDay14(telegramId) {
    try {
      const { data } = await this.supabase
        .from('viral_triggers')
        .select('id')
        .eq('user_telegram_id', telegramId)
        .eq('trigger_type', 'day14_reminder')
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }

  async markTriggeredDay14(telegramId) {
    try {
      await this.supabase
        .from('viral_triggers')
        .insert([{
          user_telegram_id: telegramId,
          trigger_type: 'day14_reminder',
          triggered_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error marking day 14 trigger:', error);
    }
  }

  async hasUserShared(telegramId) {
    try {
      // Проверяем есть ли хотя бы один реферал
      const { count } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_telegram_id', telegramId);

      return count > 0;
    } catch (error) {
      console.error('Error checking if user shared:', error);
      return false;
    }
  }

  async sendDay14Reminder(telegramId) {
    try {
      const { data: user } = await this.supabase
        .from('users')
        .select('telegram_id, first_name')
        .eq('telegram_id', telegramId)
        .single();

      if (!user) {
        return;
      }

      const message =
        `💪 *${user.first_name}, ты уже 2 недели в продуктивности!*\n\n` +
        `Это круто! Ты изменил свою жизнь.\n\n` +
        `Помнишь, мы предлагали поделиться FlowBot с друзьями?\n` +
        `Это действительно может помочь им так же, как помогло тебе.\n\n` +
        `💚 Поделись с теми, кому это важно!\n\n` +
        `Нажми /invite чтобы получить ссылку`;

      await this.bot.telegram.sendMessage(
        user.telegram_id,
        message,
        { parse_mode: 'Markdown' }
      );

      console.log(`✅ Day 14 reminder sent to user ${telegramId}`);
    } catch (error) {
      console.error('Error sending day 14 reminder:', error);
    }
  }
}

module.exports = { ViralService };
