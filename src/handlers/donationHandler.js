// src/handlers/donationHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');
const { g } = require('../utils/genderUtils');

class DonationHandler {
  // Показать варианты донатов
  async showDonationOptions(ctx, fromDay15 = false) {
    try {
      const user = ctx.state.user;

      let message = `💝 *Поддержать FlowBot*\n\n`;

      if (fromDay15) {
        message += `Ты ${g(user, 'прошёл', 'прошла')} всю программу и ${g(user, 'стал', 'стала')} лучше!\n\n`;
        message += `Это произошло благодаря:\n`;
        message += `• Твоим усилиям и дисциплине 💪\n`;
        message += `• Нашей поддержке и методологии 🎯\n\n`;
      } else {
        message += `Спасибо, что используешь FlowBot! 🙏\n\n`;
      }

      message += `Если бот ${g(user, 'помог', 'помогла')} тебе стать продуктивнее - поддержи проект суммой, которую не жалко.\n\n`;
      message += `Твоя поддержка помогает нам:\n`;
      message += `• 🚀 Развивать новые функции\n`;
      message += `• 💻 Оплачивать серверы и API\n`;
      message += `• ✨ Улучшать опыт пользователей\n`;
      message += `• ❤️ Помогать другим становиться лучше\n\n`;
      message += `Выбери удобный способ:`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💳 СБП (мгновенно)', 'donation_sbp')
        ],
        [
          Markup.button.callback('⭐ Boosty (подписка)', 'donation_boosty')
        ],
        [
          Markup.button.callback('💰 Номер карты', 'donation_card')
        ],
        [
          Markup.button.callback('◀️ Назад', fromDay15 ? 'show_main_menu' : 'show_settings')
        ]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing donation options:', error);
      await ctx.reply('Ошибка при загрузке вариантов оплаты');
    }
  }

  // Показать детали для СБП
  async showSBPDetails(ctx) {
    try {
      const sbpLink = process.env.DONATION_SBP_LINK || 'НЕ_НАСТРОЕНО';

      const message = `💳 *Оплата через СБП*\n\n` +
        `Система быстрых платежей - самый простой способ!\n\n` +
        `*Как оплатить:*\n` +
        `1. Нажми кнопку "Открыть СБП" ниже\n` +
        `2. Выбери свой банк\n` +
        `3. Укажи сумму\n` +
        `4. Подтверди оплату\n\n` +
        `_Перевод мгновенный, без комиссии!_ ✨`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url('💳 Открыть СБП', sbpLink)
        ],
        [
          Markup.button.callback('◀️ Другие способы', 'show_donation')
        ]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing SBP details:', error);
      await ctx.answerCbQuery('Ошибка загрузки СБП');
    }
  }

  // Показать детали для Boosty
  async showBoostyDetails(ctx) {
    try {
      const boostyLink = process.env.DONATION_BOOSTY_LINK || 'https://boosty.to/flowbot';

      const message = `⭐ *Поддержка через Boosty*\n\n` +
        `Boosty - это платформа для поддержки авторов.\n\n` +
        `*Преимущества:*\n` +
        `• Можно оформить ежемесячную подписку\n` +
        `• Или сделать разовый донат\n` +
        `• Удобно оплачивать картой\n\n` +
        `*Что дальше:*\n` +
        `1. Нажми кнопку "Открыть Boosty"\n` +
        `2. Выбери сумму поддержки\n` +
        `3. Оплати удобным способом\n\n` +
        `_Спасибо за поддержку!_ 🙏`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url('⭐ Открыть Boosty', boostyLink)
        ],
        [
          Markup.button.callback('◀️ Другие способы', 'show_donation')
        ]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing Boosty details:', error);
      await ctx.answerCbQuery('Ошибка загрузки Boosty');
    }
  }

  // Показать детали для карты
  async showCardDetails(ctx) {
    try {
      const cardNumber = process.env.DONATION_CARD_NUMBER || '0000 0000 0000 0000';
      const cardHolder = process.env.DONATION_CARD_HOLDER || 'CARD HOLDER';

      const message = `💰 *Перевод на карту*\n\n` +
        `Можешь перевести на карту любую удобную сумму.\n\n` +
        `*Номер карты:*\n` +
        `\`${cardNumber}\`\n\n` +
        `*Получатель:*\n` +
        `${cardHolder}\n\n` +
        `_Нажми на номер карты, чтобы скопировать_ 📋\n\n` +
        `Спасибо за поддержку! ❤️`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('◀️ Другие способы', 'show_donation')
        ],
        [
          Markup.button.callback('🏠 Главное меню', 'show_main_menu')
        ]
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

      await ctx.answerCbQuery('Номер карты готов к копированию');
    } catch (error) {
      console.error('Error showing card details:', error);
      await ctx.answerCbQuery('Ошибка загрузки данных карты');
    }
  }

  // Показать благодарность после доната
  async showThankYou(ctx) {
    try {
      const user = ctx.state.user;

      const message = `💝 *ОГРОМНОЕ СПАСИБО!*\n\n` +
        `Твоя поддержка очень важна для нас! 🙏\n\n` +
        `Благодаря таким людям как ты, FlowBot может развиваться и помогать всё большему количеству людей становиться продуктивнее.\n\n` +
        `Ты ${g(user, 'молодец', 'молодец')}! ❤️`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🏠 Главное меню', 'show_main_menu')
        ]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing thank you:', error);
    }
  }
}

module.exports = { DonationHandler };
