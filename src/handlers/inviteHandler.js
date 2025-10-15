// src/handlers/inviteHandler.js
const { Markup } = require('telegraf');
const moment = require('moment-timezone');

class InviteHandler {
  constructor(referralService, userService, supabase) {
    this.referralService = referralService;
    this.userService = userService;
    this.supabase = supabase;
  }

  // Главное меню приглашений
  async showInviteMenu(ctx, user) {
    try {
      // Генерируем реферальную ссылку
      const referralLink = await this.referralService.generateReferralLink(user.id);
      
      // Получаем статистику рефералов
      const stats = await this.referralService.getReferralStats(user.id);
      
      // Получаем глобальную статистику
      const globalStats = await this.referralService.getGlobalStats();

      // Формируем сообщение с правильным посылом
      const viralMessage = this.buildViralMessage(stats, globalStats, user);
      const buttons = this.buildInviteKeyboard(referralLink, stats);

      await ctx.reply(viralMessage, {
        parse_mode: 'Markdown',
        ...buttons,
        disable_web_page_preview: true
      });

      // Показываем персональную ссылку
      await ctx.reply(
        `🔗 *Твоя персональная ссылка:*\n` +
        `\`${referralLink}\`\n\n` +
        `Нажми на ссылку, чтобы скопировать 📋`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      console.error('Error showing invite menu:', error);
      await ctx.reply('😔 Произошла ошибка. Попробуй позже.');
    }
  }

  // Формирование вирусного сообщения
  buildViralMessage(stats, globalStats, user) {
    const { 
      totalInvited = 0, 
      activeReferrals = 0, 
      pendingReferrals = 0,
      leaderboardPosition = 0,
      isPermanentPro = false
    } = stats || {};

    // Выбираем правильный посыл в зависимости от этапа
    let hook = '';
    let motivation = '';
    
    if (totalInvited === 0) {
      // Новичок - мотивируем начать
      hook = `💚 *Помоги друзьям стать продуктивнее!*\n\n`;
      motivation =
        `FlowBot помог тебе войти в состояние потока.\n` +
        `Теперь твоя очередь помочь друзьям!\n\n` +
        `*Почему это важно:*\n` +
        `• Твои друзья перестанут прокрастинировать\n` +
        `• Они войдут в состояние потока\n` +
        `• Вместе вы достигнете большего!\n\n` +
        `Поделись с теми, кому это поможет:\n` +
        `✅ Друзьям, которые откладывают дела\n` +
        `✅ Коллегам, которые хотят больше успевать\n` +
        `✅ Всем, кто мечтает о продуктивности`;
    } else if (activeReferrals < 3) {
      // Уже есть рефералы - мотивируем продолжать
      hook = `🚀 *Ты уже помог ${activeReferrals} ${this.pluralize(activeReferrals, 'другу', 'друзьям', 'друзьям')} стать продуктивнее!*\n\n`;
      motivation =
        `*Твой прогресс:*\n` +
        `✅ Приглашено: ${totalInvited}\n` +
        `⏳ Ждут активации: ${pendingReferrals}\n` +
        `🏆 Активных: ${activeReferrals}\n\n` +
        `*До следующего уровня:*\n` +
        `${this.getProgressBar(activeReferrals, 3)} ${activeReferrals}/3\n` +
        `${3 - activeReferrals > 0 ? `Осталось ${3 - activeReferrals} до статуса "Амбассадор"!` : '✅ Статус "Амбассадор" получен!'}\n\n` +
        `*Следующие цели:*\n` +
        `• 3 друга = Бейдж "Амбассадор"\n` +
        `• 5 друзей = Бейдж "Founding Member" 👑\n` +
        `• 10+ друзей = Бейдж "Легенда" ⚡`;
    } else if (activeReferrals < 5) {
      // Близок к Founding Member
      hook = `🔥 *Ты почти у цели! ${activeReferrals} ${this.pluralize(activeReferrals, 'другу помог', 'друзьям помогли', 'друзьям помогли')}!*\n\n`;
      motivation =
        `*До статуса Founding Member:*\n` +
        `${this.getProgressBar(activeReferrals, 5)} ${activeReferrals}/5\n\n` +
        `Еще ${5 - activeReferrals} ${this.pluralize(5 - activeReferrals, 'друг', 'друга', 'друзей')} и ты получишь:\n` +
        `👑 Статус Founding Member\n` +
        `💎 Особый значок в профиле\n` +
        `🚀 Ранний доступ к новым функциям\n` +
        `❤️ Вечную благодарность команды\n\n` +
        `Ты так близко к легенде!`;
    } else {
      // Founding Member
      hook = `👑 *Ты - Founding Member FlowBot!*\n\n`;
      motivation =
        `*Твои достижения:*\n` +
        `✅ Ты помог ${activeReferrals} ${this.pluralize(activeReferrals, 'другу', 'друзьям', 'друзьям')} стать продуктивнее!\n` +
        `✅ Топ-${leaderboardPosition} в рейтинге амбассадоров\n` +
        `✅ Статус "Легенда" сообщества\n\n` +
        `Продолжай менять жизни людей к лучшему!\n` +
        `Каждый новый друг - это еще одна история успеха 🌟`;
    }

    // Добавляем глобальный прогресс сообщества
    const communitySection = 
      `\n📊 *Прогресс сообщества:*\n` +
      `${this.getProgressBar(globalStats?.totalUsers || 0, 1000)} ` +
      `${globalStats?.totalUsers || 0}/1000 пользователей\n\n` +
      `${globalStats?.progressPercent >= 100 
        ? '🎉 Цель достигнута! Скоро запустим новые функции!' 
        : `Когда нас будет 1000, добавим крутые функции для всех!`}`;

    return hook + motivation + communitySection;
  }

  // Клавиатура приглашений
  buildInviteKeyboard(referralLink, stats) {
    const buttons = [];

    // Главная кнопка - поделиться
    buttons.push([
      Markup.button.callback(
        `📤 Поделиться в Telegram`,
        `share_telegram`
      )
    ]);

    // Готовые тексты для разных аудиторий
    buttons.push([
      Markup.button.callback('💼 Текст для коллег', 'invite_text_work'),
      Markup.button.callback('👥 Текст для друзей', 'invite_text_friends')
    ]);

    // Статистика и рейтинг
    buttons.push([
      Markup.button.callback('📊 Моя статистика', 'referral_stats'),
      Markup.button.callback('🏆 Рейтинг', 'referral_leaderboard')
    ]);

    // Помощь
    buttons.push([
      Markup.button.callback('❓ Как это работает', 'referral_help'),
      Markup.button.callback('🔙 Назад', 'menu')
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  // Обработка callback кнопок
  async handleCallback(ctx) {
    const action = ctx.match[0];
    const user = ctx.session.user;

    switch(action) {
      case 'invite':
        // Главное меню приглашений
        await this.showInviteMenu(ctx, user);
        break;
      case 'share_telegram':
        await this.shareToTelegram(ctx, user);
        break;
      case 'invite_text_work':
        await this.showWorkText(ctx, user);
        break;
      case 'invite_text_friends':
        await this.showFriendsText(ctx, user);
        break;
      case 'referral_stats':
        await this.showDetailedStats(ctx, user);
        break;
      case 'referral_leaderboard':
        await this.showLeaderboard(ctx);
        break;
      case 'referral_help':
        await this.showHelp(ctx);
        break;
    }

    await ctx.answerCbQuery();
  }

  // Поделиться в Telegram
  async shareToTelegram(ctx, user) {
    const referralLink = await this.referralService.generateReferralLink(user.id);

    const shareText =
      `🎯 Я использую FlowBot для повышения продуктивности!\n\n` +
      `За неделю я:\n` +
      `✅ Перестал прокрастинировать\n` +
      `✅ Начал выполнять 30+ задач в день\n` +
      `✅ Вошел в состояние потока\n\n` +
      `Попробуй бесплатно: ${referralLink}\n\n` +
      `Это работает! 💪`;

    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;

    await ctx.editMessageText(
      `📤 *Нажми кнопку, чтобы поделиться:*`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Поделиться в Telegram', url: shareUrl }],
            [{ text: '🔙 Назад к меню', callback_data: 'invite' }]
          ]
        }
      }
    );
  }

  // Текст для коллег
  async showWorkText(ctx, user) {
    const referralLink = await this.referralService.generateReferralLink(user.id);

    const workText =
      `Привет! Хочу поделиться инструментом, который реально помог мне стать продуктивнее.\n\n` +
      `FlowBot - это Telegram-бот, который использует научную технику Flow List для входа в состояние потока.\n\n` +
      `Что дает:\n` +
      `• Структурированный подход к задачам\n` +
      `• Постепенное наращивание сложности\n` +
      `• Измеримый прогресс каждый день\n` +
      `• Полное избавление от прокрастинации\n\n` +
      `Попробуй: ${referralLink}`;

    await ctx.editMessageText(
      `💼 *Текст для коллег:*\n\n` +
      `\`\`\`\n${workText}\n\`\`\`\n\n` +
      `_Нажми на текст, чтобы скопировать_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Назад к меню', callback_data: 'invite' }
          ]]
        }
      }
    );
  }

  // Текст для друзей
  async showFriendsText(ctx, user) {
    const referralLink = await this.referralService.generateReferralLink(user.id);

    const friendsText =
      `Йоу! Помнишь, я жаловался на прокрастинацию? Нашел решение 🔥\n\n` +
      `Это бот в Telegram, который каждый день дает 30 задач разной сложности. ` +
      `Звучит просто, но реально работает!\n\n` +
      `Короче, попробуй: ${referralLink}\n\n` +
      `Через неделю сам поймешь насколько это меняет 💪`;

    await ctx.editMessageText(
      `👥 *Текст для друзей:*\n\n` +
      `\`\`\`\n${friendsText}\n\`\`\`\n\n` +
      `_Нажми на текст, чтобы скопировать_`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Назад к меню', callback_data: 'invite' }
          ]]
        }
      }
    );
  }

  // Детальная статистика
  async showDetailedStats(ctx, user) {
    try {
      const stats = await this.referralService.getReferralStats(user.id);
      
      let message = `📊 *Твоя реферальная статистика:*\n\n`;
      
      // Основные метрики
      message += `*Метрики:*\n`;
      message += `👥 Всего приглашено: ${stats.totalInvited}\n`;
      message += `✅ Активных: ${stats.activeReferrals}\n`;
      message += `⏳ Ожидают: ${stats.pendingReferrals}\n`;
      message += `🎯 Людям помогли: ${stats.activeReferrals}\n\n`;

      // Статус
      if (stats.isPermanentPro) {
        message += `👑 *Статус: Founding Member*\n`;
        message += `✨ Ты помог ${stats.activeReferrals}+ людям!\n\n`;
      } else if (stats.activeReferrals >= 3) {
        message += `🌟 *Статус: Амбассадор*\n`;
        message += `✨ Ты активно помогаешь другим!\n\n`;
      } else {
        message += `📈 *Статус: Помощник*\n\n`;
      }

      // Список друзей
      if (stats.friends && stats.friends.length > 0) {
        message += `*Твои друзья:*\n`;
        for (const friend of stats.friends.slice(0, 5)) {
          const name = friend.users?.first_name || 'Друг';
          const status = friend.status === 'active' ? '✅' : '⏳';
          const days = moment(friend.created_at).fromNow();
          message += `${status} ${name} - ${days}\n`;
        }
      }

      // Позиция в рейтинге
      if (stats.leaderboardPosition > 0) {
        message += `\n🏆 *Позиция в рейтинге: #${stats.leaderboardPosition}*`;
      }

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Назад к меню', callback_data: 'invite' }
          ]]
        }
      });
    } catch (error) {
      console.error('Error showing stats:', error);
      await ctx.reply('😔 Не удалось загрузить статистику');
    }
  }

  // Рейтинг рефереров
  async showLeaderboard(ctx) {
    try {
      const { data: topReferrers } = await this.supabase
        .rpc('get_top_referrers', { limit: 10 });

      let message = `🏆 *Топ-10 амбассадоров FlowBot:*\n\n`;
      
      const medals = ['🥇', '🥈', '🥉'];
      
      for (let i = 0; i < topReferrers.length; i++) {
        const referrer = topReferrers[i];
        const medal = medals[i] || `${i + 1}.`;
        const name = referrer.first_name || 'Аноним';
        const count = referrer.referral_count;
        
        message += `${medal} *${name}* - ${count} ${this.pluralize(count, 'друг', 'друга', 'друзей')}\n`;
        
        if (i === 2) message += '\n'; // Отступ после топ-3
      }

      message += `\n_Пригласи друзей и попади в топ!_`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Назад к меню', callback_data: 'invite' }
          ]]
        }
      });
    } catch (error) {
      console.error('Error showing leaderboard:', error);
      await ctx.reply('😔 Не удалось загрузить рейтинг');
    }
  }

  // Справка
  async showHelp(ctx) {
    const helpText =
      `❓ *Как работает реферальная программа:*\n\n` +

      `*Шаг 1: Пригласи друзей*\n` +
      `Отправь друзьям свою персональную ссылку\n\n` +

      `*Шаг 2: Друзья регистрируются*\n` +
      `Друзья переходят по ссылке и начинают использовать FlowBot\n\n` +

      `*Шаг 3: 7 дней активности*\n` +
      `Друзья используют бота минимум 7 дней (выполняют хотя бы 10 задач в день)\n\n` +

      `*Шаг 4: Получи признание*\n` +
      `✅ Ты помогаешь друзьям стать продуктивнее\n` +
      `✅ Получаешь бейджи и статусы\n` +
      `✅ Попадаешь в рейтинг амбассадоров\n\n` +

      `*Система бейджей:*\n` +
      `• 1 друг = Бейдж "Помощник"\n` +
      `• 3 друга = Бейдж "Амбассадор"\n` +
      `• 5 друзей = Бейдж "Founding Member" 👑\n` +
      `• 10+ друзей = Бейдж "Легенда" ⚡\n\n` +

      `*Важно:*\n` +
      `• Друзья должны быть активны 7 дней подряд\n` +
      `• Минимум 10 задач в день для активации\n` +
      `• Бейджи начисляются автоматически\n` +
      `• Нет ограничений на количество приглашений\n\n` +

      `*FAQ:*\n` +
      `Q: Можно ли приглашать несколько друзей?\n` +
      `A: Да! Чем больше, тем лучше! Помогай всем, кому это нужно.\n\n` +

      `Q: Когда я получу бейдж?\n` +
      `A: Сразу после 7 дней активности друга\n\n` +

      `Q: Зачем это делать?\n` +
      `A: Ты помогаешь людям стать продуктивнее и меняешь их жизнь к лучшему!`;

    await ctx.editMessageText(helpText, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '🔙 Назад к меню', callback_data: 'invite' }
        ]]
      }
    });
  }

  // Вспомогательные функции
  getProgressBar(current, target) {
    const percentage = Math.min(100, Math.round((current / target) * 100));
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
  }

  pluralize(count, one, two, five) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    
    return five;
  }
}

module.exports = { InviteHandler };
