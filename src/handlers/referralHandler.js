// src/handlers/referralHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');

class ReferralHandler {
  constructor(referralService) {
    this.referralService = referralService;
  }

  // Показать реферальное меню
  async showInviteMenu(ctx) {
    try {
      const user = ctx.state.user;
      const stats = await this.referralService.getReferralStats(user.id);
      const globalStats = await this.referralService.getGlobalStats();
      const referralLink = await this.referralService.generateReferralLink(user.id);

      let message = `🚀 *Развивай FlowBot вместе с нами!*\n\n`;
      
      // Прогресс сообщества
      const progressBar = this.generateProgressBar(globalStats.progressPercent);
      message += `*Цель сообщества:*\n`;
      message += `${progressBar}\n`;
      message += `👥 ${globalStats.totalUsers}/1000 пользователей\n\n`;

      // Личная статистика
      message += `*Твой вклад:*\n`;
      message += `✅ Приглашено друзей: ${stats.totalInvited}\n`;
      message += `🔥 Активных: ${stats.activeReferrals}\n`;
      message += `⏳ Ждут активации: ${stats.pendingReferrals}\n`;
      
      if (stats.isPermanentPro) {
        message += `\n🏆 *Ты — Founding Member!*\n`;
        message += `Pro подписка навсегда активна\n`;
      } else if (stats.daysOfProEarned > 0) {
        message += `\n💎 Заработано дней Pro: ${stats.daysOfProEarned}\n`;
      }

      message += `\n📨 *Твоя ссылка для приглашения:*\n`;
      message += `\`${referralLink}\`\n\n`;
      
      message += `🎁 *Что получают друзья:*\n`;
      message += `• 30 дней Pro после 7 дней активности\n`;
      message += `• Персональный AI-коуч\n`;
      message += `• Доступ к закрытому сообществу\n\n`;
      
      message += `🎯 *Твои награды:*\n`;
      message += `• 1 друг = +30 дней Pro\n`;
      message += `• 3 друга = Pro до конца года\n`;
      message += `• 5 друзей = Pro навсегда + статус Founding Member\n`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Поделиться в Telegram', 'share_telegram')],
        [Markup.button.callback('📋 Скопировать текст приглашения', 'copy_invite_text')],
        [Markup.button.callback('👥 Мои друзья', 'show_friends')],
        [Markup.button.callback('🏆 Топ рефереров', 'referral_leaderboard')],
        [Markup.button.callback('🎯 Создать челлендж', 'create_challenge')],
        [Markup.button.callback('◀️ Назад', 'back_to_menu')]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing invite menu:', error);
      await sendOrEditMessage(ctx, 'Ошибка при загрузке реферального меню');
    }
  }

  // Поделиться в Telegram
  async shareInTelegram(ctx) {
    try {
      const user = ctx.state.user;
      const referralLink = await this.referralService.generateReferralLink(user.id);
      
      const shareText = this.getShareText(user.first_name, referralLink);
      
      // Создаем кнопку для шаринга
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url(
          '📤 Поделиться', 
          `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`
        )],
        [Markup.button.callback('◀️ Назад', 'invite')]
      ]);

      await sendOrEditMessage(ctx, 
        `📤 *Поделись с друзьями*\n\n` +
        `Нажми кнопку ниже, чтобы отправить приглашение в любой чат:`, 
        keyboard
      );
    } catch (error) {
      console.error('Error sharing:', error);
      await ctx.answerCbQuery('Ошибка при создании ссылки');
    }
  }

  // Показать текст для копирования
  async showCopyText(ctx) {
    try {
      const user = ctx.state.user;
      const referralLink = await this.referralService.generateReferralLink(user.id);
      const shareText = this.getShareText(user.first_name, referralLink);

      const backKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад', 'invite')]
      ]);
      
      await sendOrEditMessage(ctx,
        `📋 *Текст для приглашения*\n\n` +
        `Скопируй и отправь друзьям:\n\n` +
        `\`\`\`\n${shareText}\n\`\`\``,
        backKeyboard
      );
    } catch (error) {
      console.error('Error showing copy text:', error);
      await ctx.answerCbQuery('Ошибка');
    }
  }

  // Показать список друзей
  async showFriends(ctx) {
    try {
      const user = ctx.state.user;
      const stats = await this.referralService.getReferralStats(user.id);

      if (!stats.friends || stats.friends.length === 0) {
        const noFriendsKeyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📤 Пригласить друзей', 'share_telegram')],
          [Markup.button.callback('◀️ Назад', 'invite')]
        ]);
        
        await sendOrEditMessage(ctx,
          `👥 *Твои друзья*\n\n` +
          `Пока никто не присоединился по твоей ссылке.\n\n` +
          `Пригласи друзей и следи за их прогрессом здесь!`,
          noFriendsKeyboard
        );
        return;
      }

      let message = `👥 *Твои друзья в FlowBot*\n\n`;

      for (const friend of stats.friends) {
        const name = friend.users?.first_name || 'Друг';
        const status = this.getFriendStatus(friend.status);
        const level = friend.users?.level || 1;
        const activeDays = friend.daily_stats?.length || 0;

        message += `${status} *${name}*\n`;
        message += `   День программы: ${level <= 30 ? `${level}/30` : `${level} (завершена!)`}\n`;
        
        if (friend.status === 'pending') {
          message += `   Активных дней: ${activeDays}/7\n`;
          message += `   До награды: ${7 - activeDays} дней\n`;
        } else if (friend.status === 'active') {
          message += `   ✅ Награда получена!\n`;
        }
        message += '\n';
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Пригласить еще', 'share_telegram')],
        [Markup.button.callback('◀️ Назад', 'invite')]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing friends:', error);
      await ctx.answerCbQuery('Ошибка загрузки списка друзей');
    }
  }

  // Показать лидерборд рефереров
  async showLeaderboard(ctx) {
    try {
      const user = ctx.state.user;
      const stats = await this.referralService.getReferralStats(user.id);
      
      // Получаем топ рефереров (нужно добавить этот метод)
      const { data: topReferrers } = await ctx.state.supabase
        .rpc('get_top_referrers', { limit: 10 });

      let message = `🏆 *Топ амбассадоров FlowBot*\n\n`;

      const medals = ['🥇', '🥈', '🥉'];
      
      topReferrers?.forEach((referrer, index) => {
        const medal = medals[index] || `${index + 1}.`;
        const isYou = referrer.user_id === user.id ? ' _(это ты!)_' : '';
        
        message += `${medal} *${referrer.first_name}*${isYou}\n`;
        message += `   Приглашено: ${referrer.referral_count} друзей\n`;
        
        if (referrer.is_founding_member) {
          message += `   🏆 Founding Member\n`;
        }
        message += '\n';
      });

      if (stats.leaderboardPosition > 10) {
        message += `...\n\n`;
        message += `${stats.leaderboardPosition}. *${user.first_name}* _(это ты)_\n`;
        message += `   Приглашено: ${stats.activeReferrals} друзей\n`;
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📤 Догнать лидеров', 'share_telegram')],
        [Markup.button.callback('◀️ Назад', 'invite')]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing leaderboard:', error);
      await ctx.answerCbQuery('Ошибка загрузки рейтинга');
    }
  }

  // Создать челлендж с друзьями
  async createChallenge(ctx) {
    try {
      const user = ctx.state.user;
      const referralLink = await this.referralService.generateReferralLink(user.id);

      const challengeText = 
        `🏆 *НЕДЕЛЬНЫЙ ЧЕЛЛЕНДЖ ПРОДУКТИВНОСТИ*\n\n` +
        `${user.first_name} бросает вызов!\n\n` +
        `📋 Правила:\n` +
        `• 7 дней подряд\n` +
        `• Минимум 20 задач в день\n` +
        `• Кто пропустит день - выбывает\n` +
        `• Проигравший покупает пиццу 🍕\n\n` +
        `Присоединяйся: ${referralLink}`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url(
          '🚀 Отправить вызов друзьям',
          `https://t.me/share/url?text=${encodeURIComponent(challengeText)}`
        )],
        [Markup.button.callback('📋 Скопировать текст', 'copy_challenge')],
        [Markup.button.callback('◀️ Назад', 'invite')]
      ]);

      await sendOrEditMessage(ctx,
        `🎯 *Создай челлендж с друзьями*\n\n` +
        `Соревнование - лучший способ стать продуктивнее!\n\n` +
        `Отправь друзьям вызов и покажи, кто здесь самый продуктивный 💪`,
        keyboard
      );
    } catch (error) {
      console.error('Error creating challenge:', error);
      await ctx.answerCbQuery('Ошибка создания челленджа');
    }
  }

  // Генерация прогресс-бара
  generateProgressBar(percent) {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
  }

  // Получить статус друга
  getFriendStatus(status) {
    const statuses = {
      'pending': '⏳',
      'active': '✅',
      'rewarded': '🏆'
    };
    return statuses[status] || '👤';
  }

  // Варианты текстов для шаринга
  getShareText(userName, link) {
    const variants = [
      {
        title: "Дружеский",
        text: `Привет! ${userName} использует FlowBot для продуктивности и рекомендует тебе попробовать!\n\n` +
              `🚀 Что это:\n` +
              `Бот помогает войти в состояние потока за 15 дней через научную методику Flow List\n\n` +
              `🎁 Что ты получишь:\n` +
              `• 30 простых задач каждый день\n` +
              `• Персональный AI-коуч\n` +
              `• 30 дней Pro после недели активности\n\n` +
              `Присоединяйся: ${link}`
      },
      {
        title: "Мотивирующий",
        text: `💪 Хочешь стать продуктивнее в 3 раза за 15 дней?\n\n` +
              `Я уже ${userName} дней в FlowBot и выполняю по 30 задач в день!\n\n` +
              `Это не магия, а научная методика:\n` +
              `✅ Начинаешь с простых задач\n` +
              `✅ Постепенно усложняешь\n` +
              `✅ Входишь в состояние потока\n\n` +
              `Попробуй бесплатно: ${link}`
      },
      {
        title: "Челлендж",
        text: `🏆 ВЫЗОВ ПРИНЯТ?\n\n` +
              `${userName} выполняет 30 задач в день с FlowBot!\n\n` +
              `Спорим, ты не сможешь неделю подряд? 😏\n\n` +
              `Если продержишься 7 дней:\n` +
              `🎁 Получишь Pro на месяц\n` +
              `💪 Прокачаешь продуктивность\n` +
              `🔥 Докажешь, что можешь\n\n` +
              `Принимай вызов: ${link}`
      }
    ];

    // Выбираем рандомный вариант или первый
    return variants[0].text;
  }

  // Обработка реферальной ссылки при старте
  async handleReferralStart(ctx, referralCode) {
    try {
      const newUser = ctx.state.user;
      
      // Убираем префикс ref_
      const cleanCode = referralCode.replace('ref_', '');
      
      // Обрабатываем реферал
      const referral = await this.referralService.processReferral(
        newUser.id, 
        cleanCode
      );

      if (referral) {
        await sendOrEditMessage(ctx,
          `🎉 *Отлично!*\n\n` +
          `Ты присоединился по приглашению друга!\n\n` +
          `Когда ты будешь активен 7 дней подряд:\n` +
          `✅ Ты получишь 30 дней Pro бесплатно\n` +
          `✅ Твой друг тоже получит 30 дней Pro\n\n` +
          `Давай начнем твой путь к продуктивности! 🚀`
        );
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error handling referral start:', error);
      return false;
    }
  }

  // Проверка активации реферала (вызывается каждый день)
  async checkReferralActivation(userId) {
    try {
      const activated = await this.referralService.activateReferral(userId);
      
      if (activated) {
        console.log(`Referral activated for user ${userId}`);
      }
    } catch (error) {
      console.error('Error checking referral activation:', error);
    }
  }
}

module.exports = { ReferralHandler };
