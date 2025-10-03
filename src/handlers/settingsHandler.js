// src/handlers/settingsHandler.js
const { Markup } = require('telegraf');
const moment = require('moment-timezone');
const { sendOrEditMessage } = require('../utils/messageUtils');

class SettingsHandler {
  // Показать настройки
  async showSettings(ctx, user) {
    try {
      const message = `⚙️ *Настройки*\n\n` +
        `🌅 Утренние задачи: ${user.morning_hour || 8}:00\n` +
        `🌙 Вечерняя рефлексия: ${user.evening_hour || 21}:00\n` +
        `🌍 Часовой пояс: ${user.timezone}\n` +
        `🌐 Язык: ${user.language === 'ru' ? 'Русский' : 'English'}\n` +
        `📅 День программы: ${user.level <= 15 ? `${user.level}/15` : `${user.level} (ты в потоке! 🎉)`}\n\n` +
        `Что хочешь изменить?`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Статистика', 'show_stats'),
          Markup.button.callback('🆘 Помощь', 'show_help')
        ],
        [
          Markup.button.callback('🌅 Время утренних задач', 'settings_morning'),
          Markup.button.callback('🌙 Время рефлексии', 'settings_evening')
        ],
        [
          Markup.button.callback('🌍 Часовой пояс', 'settings_timezone'),
          Markup.button.callback('🌐 Язык', 'settings_language')
        ],
        [
          Markup.button.callback('🔄 Сбросить прогресс', 'settings_reset'),
          Markup.button.callback('❌ Удалить аккаунт', 'settings_delete')
        ],
        [
          Markup.button.callback('◀️ Назад', 'back_to_menu')
        ]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error in showSettings:', error);
      await ctx.reply('Ошибка при загрузке настроек.');
    }
  }

  // Установить время утренних задач
  async setMorningTime(ctx, userService, time) {
    try {
      const userId = ctx.from.id;
      const hour = parseInt(time);

      await userService.updateUser(userId, {
        morning_hour: hour
      });

      await ctx.answerCbQuery(`Утренние задачи будут приходить в ${hour}:00`);

      // Обновляем сообщение
      const message = `✅ *Сохранено!*\n\n` +
        `Ты будешь получать задачи в *${hour}:00* каждый день.\n\n` +
        `Хочешь настроить что-то ещё?`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к настройкам', 'show_settings')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error setting morning time:', error);
      await ctx.answerCbQuery('Ошибка при изменении времени');
    }
  }

  // Установить время вечерней рефлексии
  async setEveningTime(ctx, userService, time) {
    try {
      const userId = ctx.from.id;
      const hour = parseInt(time);

      await userService.updateUser(userId, {
        evening_hour: hour
      });

      await ctx.answerCbQuery(`Вечерняя рефлексия будет в ${hour}:00`);

      // Обновляем сообщение
      const message = `✅ *Сохранено!*\n\n` +
        `Подведение итогов дня будет в *${hour}:00*.\n\n` +
        `Хочешь настроить что-то ещё?`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к настройкам', 'show_settings')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error setting evening time:', error);
      await ctx.answerCbQuery('Ошибка при изменении времени');
    }
  }

  // Показать выбор времени утренних задач
  async showMorningTimeSelection(ctx, user) {
    const currentHour = user?.morning_hour || 8;

    const message = `🌅 *Выбери время для утренних задач*\n\n` +
      `Когда тебе удобно получать список задач на день?`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(currentHour === 5 ? '● 5:00' : '○ 5:00', 'morning_5'),
        Markup.button.callback(currentHour === 6 ? '● 6:00' : '○ 6:00', 'morning_6'),
        Markup.button.callback(currentHour === 7 ? '● 7:00' : '○ 7:00', 'morning_7')
      ],
      [
        Markup.button.callback(currentHour === 8 ? '● 8:00' : '○ 8:00', 'morning_8'),
        Markup.button.callback(currentHour === 9 ? '● 9:00' : '○ 9:00', 'morning_9'),
        Markup.button.callback(currentHour === 10 ? '● 10:00' : '○ 10:00', 'morning_10')
      ],
      [
        Markup.button.callback(currentHour === 11 ? '● 11:00' : '○ 11:00', 'morning_11'),
        Markup.button.callback(currentHour === 12 ? '● 12:00' : '○ 12:00', 'morning_12')
      ],
      [Markup.button.callback('◀️ Назад', 'show_settings')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Показать выбор времени вечерней рефлексии
  async showEveningTimeSelection(ctx, user) {
    const currentHour = user?.evening_hour || 21;

    const message = `🌙 *Выбери время для вечерней рефлексии*\n\n` +
      `Когда подводить итоги дня?`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback(currentHour === 18 ? '● 18:00' : '○ 18:00', 'evening_18'),
        Markup.button.callback(currentHour === 19 ? '● 19:00' : '○ 19:00', 'evening_19'),
        Markup.button.callback(currentHour === 20 ? '● 20:00' : '○ 20:00', 'evening_20')
      ],
      [
        Markup.button.callback(currentHour === 21 ? '● 21:00' : '○ 21:00', 'evening_21'),
        Markup.button.callback(currentHour === 22 ? '● 22:00' : '○ 22:00', 'evening_22'),
        Markup.button.callback(currentHour === 23 ? '● 23:00' : '○ 23:00', 'evening_23')
      ],
      [Markup.button.callback('◀️ Назад', 'show_settings')]
    ]);

    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Показать настройки часового пояса
  async showTimezoneSettings(ctx) {
    const message = `🌍 *Выбери часовой пояс*\n\n` +
      `Это важно для правильной отправки уведомлений.`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🇷🇺 Москва (GMT+3)', 'tz_Moscow')],
      [Markup.button.callback('🇰🇿 Алматы (GMT+6)', 'tz_Almaty')],
      [Markup.button.callback('🇺🇦 Киев (GMT+2)', 'tz_Kiev')],
      [Markup.button.callback('🇬🇪 Тбилиси (GMT+4)', 'tz_Tbilisi')],
      [Markup.button.callback('🇦🇲 Ереван (GMT+4)', 'tz_Yerevan')],
      [Markup.button.callback('🇹🇷 Стамбул (GMT+3)', 'tz_Istanbul')],
      [Markup.button.callback('🇦🇪 Дубай (GMT+4)', 'tz_Dubai')],
      [Markup.button.callback('🇬🇧 Лондон (GMT)', 'tz_London')],
      [Markup.button.callback('🇩🇪 Берлин (GMT+1)', 'tz_Berlin')],
      [Markup.button.callback('🇺🇸 Нью-Йорк (GMT-5)', 'tz_NewYork')],
      [Markup.button.callback('◀️ Назад', 'show_settings')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Установить часовой пояс
  async setTimezone(ctx, userService, timezone) {
    try {
      const userId = ctx.from.id;
      
      const timezoneMap = {
        'Moscow': 'Europe/Moscow',
        'Almaty': 'Asia/Almaty',
        'Kiev': 'Europe/Kiev',
        'Tbilisi': 'Asia/Tbilisi',
        'Yerevan': 'Asia/Yerevan',
        'Istanbul': 'Europe/Istanbul',
        'Dubai': 'Asia/Dubai',
        'London': 'Europe/London',
        'Berlin': 'Europe/Berlin',
        'NewYork': 'America/New_York'
      };
      
      const tz = timezoneMap[timezone] || 'Europe/Moscow';
      
      await userService.updateUser(userId, {
        timezone: tz
      });
      
      await ctx.answerCbQuery('Часовой пояс обновлен');
      await this.showSettings(ctx, await userService.getUserByTelegramId(userId));
    } catch (error) {
      console.error('Error setting timezone:', error);
      await ctx.answerCbQuery('Ошибка при изменении часового пояса');
    }
  }

  // Показать настройки языка
  async showLanguageSettings(ctx) {
    const message = `🌐 *Выбери язык интерфейса*`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
      [Markup.button.callback('🇬🇧 English', 'lang_en')],
      [Markup.button.callback('◀️ Назад', 'show_settings')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Изменить язык
  async changeLanguage(ctx, userService, language) {
    try {
      const userId = ctx.from.id;
      
      await userService.updateUser(userId, {
        language: language
      });
      
      const message = language === 'ru' 
        ? 'Язык изменен на русский'
        : 'Language changed to English';
      
      await ctx.answerCbQuery(message);
      await this.showSettings(ctx, await userService.getUserByTelegramId(userId));
    } catch (error) {
      console.error('Error changing language:', error);
      await ctx.answerCbQuery('Error changing language');
    }
  }

  // Показать настройки уведомлений
  async showNotificationSettings(ctx, user) {
    const message = `🔔 *Настройки уведомлений*\n\n` +
      `Выбери, какие уведомления ты хочешь получать:`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(
        user.notifications_morning ? '✅ Утренние задачи' : '⬜ Утренние задачи',
        'toggle_morning_notif'
      )],
      [Markup.button.callback(
        user.notifications_evening ? '✅ Вечерняя рефлексия' : '⬜ Вечерняя рефлексия',
        'toggle_evening_notif'
      )],
      [Markup.button.callback(
        user.notifications_reminders ? '✅ Напоминания' : '⬜ Напоминания',
        'toggle_reminder_notif'
      )],
      [Markup.button.callback(
        user.notifications_achievements ? '✅ Достижения' : '⬜ Достижения',
        'toggle_achievement_notif'
      )],
      [Markup.button.callback('◀️ Назад', 'show_settings')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Переключить уведомления
  async toggleNotifications(ctx, userService, type) {
    try {
      const userId = ctx.from.id;
      const user = await userService.getUserByTelegramId(userId);
      
      const updateField = `notifications_${type}`;
      const currentValue = user[updateField] !== false; // По умолчанию true
      
      await userService.updateUser(userId, {
        [updateField]: !currentValue
      });
      
      await ctx.answerCbQuery(
        !currentValue ? 'Уведомления включены' : 'Уведомления выключены'
      );
      
      // Обновляем экран настроек уведомлений
      const updatedUser = await userService.getUserByTelegramId(userId);
      await this.showNotificationSettings(ctx, updatedUser);
    } catch (error) {
      console.error('Error toggling notifications:', error);
      await ctx.answerCbQuery('Ошибка при изменении настроек');
    }
  }

  // Показать информацию о подписке
  async showSubscriptionInfo(ctx, user) {
    let message = `💎 *Информация о подписке*\n\n`;
    message += `Текущий план: *${this.getSubscriptionName(user.subscription_type)}*\n`;
    
    if (user.subscription_end) {
      const endDate = moment(user.subscription_end);
      const daysLeft = endDate.diff(moment(), 'days');
      message += `Действует до: ${endDate.format('DD.MM.YYYY')}\n`;
      message += `Осталось дней: ${daysLeft}\n`;
    }
    
    message += `\n*Доступные планы:*\n\n`;
    
    message += `🆓 *Free*\n`;
    message += `• 10 задач в день\n`;
    message += `• Базовая статистика\n`;
    message += `• Стрики до 7 дней\n\n`;
    
    message += `💎 *Pro (499₽/мес)*\n`;
    message += `• 30+ задач в день\n`;
    message += `• AI персонализация\n`;
    message += `• Интеграции (Notion, Calendar)\n`;
    message += `• Приоритетная поддержка\n`;
    message += `• Все достижения\n\n`;
    
    message += `👥 *Team (299₽/мес за пользователя)*\n`;
    message += `• Все из Pro\n`;
    message += `• Командная статистика\n`;
    message += `• Соревнования\n`;
    message += `• Admin dashboard\n`;
    
    const keyboard = user.subscription_type === 'free'
      ? Markup.inlineKeyboard([
          [Markup.button.callback('💎 Upgrade to Pro', 'upgrade_pro')],
          [Markup.button.callback('👥 Team план', 'upgrade_team')],
          [Markup.button.callback('◀️ Назад', 'show_settings')]
        ])
      : Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отменить подписку', 'cancel_subscription')],
          [Markup.button.callback('◀️ Назад', 'show_settings')]
        ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Подтверждение сброса прогресса
  async confirmReset(ctx) {
    const message = `⚠️ *Внимание!*\n\n` +
      `Ты уверен, что хочешь сбросить весь прогресс?\n\n` +
      `Это действие:\n` +
      `• Обнулит твой уровень (день программы)\n` +
      `• Удалит всю статистику\n` +
      `• Сбросит все стрики\n` +
      `• Удалит достижения\n\n` +
      `*Это действие нельзя отменить!*`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('❌ Отмена', 'show_settings'),
        Markup.button.callback('🔄 Сбросить', 'confirm_reset_yes')
      ]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Подтверждение удаления аккаунта
  async confirmDelete(ctx) {
    const message = `🚨 *ВНИМАНИЕ!*\n\n` +
      `Ты уверен, что хочешь удалить аккаунт?\n\n` +
      `Это действие:\n` +
      `• Удалит ВСЕ твои данные без возможности восстановления\n` +
      `• Отменит подписку (если есть)\n` +
      `• Удалит всю историю и прогресс\n\n` +
      `✅ *После удаления никакие данные не сохраняются*\n\n` +
      `*ЭТО ДЕЙСТВИЕ НЕОБРАТИМО!*\n\n` +
      `Для подтверждения отправь команду:\n` +
      `/delete_account_confirm`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Я передумал', 'show_settings')]
    ]);
    
    await ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  }

  // Получить название подписки
  getSubscriptionName(type) {
    const names = {
      'free': 'Free',
      'pro': 'Pro',
      'team': 'Team',
      'enterprise': 'Enterprise'
    };
    return names[type] || 'Free';
  }
}

module.exports = {
  settingsHandler: new SettingsHandler()
};
