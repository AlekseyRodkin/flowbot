// src/handlers/feedbackHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');

class FeedbackHandler {
  constructor(feedbackService) {
    this.feedbackService = feedbackService;
  }

  // Показать меню выбора типа отзыва
  async showFeedbackMenu(ctx) {
    try {
      const message = `💬 *Обратная связь*

Мы рады услышать твоё мнение!

Что ты хочешь сообщить?`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🐛 Сообщить об ошибке', 'feedback_bug')],
        [Markup.button.callback('💡 Предложить улучшение', 'feedback_suggestion')],
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery();
      }
    } catch (error) {
      console.error('Error showing feedback menu:', error);
      await ctx.reply('Произошла ошибка. Попробуй позже.');
    }
  }

  // Начать процесс сообщения об ошибке
  async startBugReport(ctx) {
    try {
      // Устанавливаем состояние ожидания
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.awaitingFeedback = { type: 'bug' };

      const message = `🐛 *Сообщить об ошибке*

Опиши проблему, с которой ты столкнулся.

Постарайся указать:
• Что ты делал
• Что произошло
• Что ты ожидал увидеть

Напиши сообщение:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'cancel_feedback')]
        ]).reply_markup
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error starting bug report:', error);
      await ctx.answerCbQuery('Ошибка');
    }
  }

  // Начать процесс предложения улучшения
  async startSuggestion(ctx) {
    try {
      // Устанавливаем состояние ожидания
      if (!ctx.session) {
        ctx.session = {};
      }
      ctx.session.awaitingFeedback = { type: 'suggestion' };

      const message = `💡 *Предложить улучшение*

Расскажи, что бы ты хотел улучшить или добавить в бот.

Любые идеи приветствуются! 🙌

Напиши сообщение:`;

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Отмена', 'cancel_feedback')]
        ]).reply_markup
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error starting suggestion:', error);
      await ctx.answerCbQuery('Ошибка');
    }
  }

  // Обработать текстовое сообщение с отзывом
  async handleFeedbackMessage(ctx, feedbackService, userService) {
    try {
      const message = ctx.message.text;
      const type = ctx.session.awaitingFeedback.type;
      const telegram_id = ctx.from.id;

      console.log(`💬 Processing feedback from user ${telegram_id}, type: ${type}`);

      // Сохраняем отзыв в БД
      const savedFeedback = await feedbackService.saveFeedback(telegram_id, type, message);
      console.log(`✅ Feedback saved with ID: ${savedFeedback.id}`);

      // Получаем данные пользователя для уведомления
      const userData = await userService.getUserByTelegramId(telegram_id);

      if (!userData) {
        console.warn(`⚠️ User data not found for telegram_id ${telegram_id}, sending minimal notification`);
      }

      // Отправляем уведомление админу (даже если userData === null)
      await feedbackService.notifyAdmin(savedFeedback, userData || {
        telegram_id,
        username: null,
        level: 'N/A'
      });
      console.log(`✅ Admin notified about feedback #${savedFeedback.id}`);

      // Очищаем состояние
      delete ctx.session.awaitingFeedback;

      // Благодарим пользователя
      const responseMessage = type === 'bug'
        ? `✅ *Спасибо за сообщение об ошибке!*

Мы обязательно разберёмся и исправим проблему.`
        : `✅ *Спасибо за предложение!*

Мы рассмотрим твою идею и постараемся реализовать её.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🏠 Главное меню', 'show_main_menu')],
        [Markup.button.callback('💬 Ещё отзыв', 'show_feedback')]
      ]);

      await ctx.reply(responseMessage, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });

    } catch (error) {
      console.error('❌ Error handling feedback message:', error);
      console.error('Error stack:', error.stack);

      await ctx.reply(
        '❌ Произошла ошибка при сохранении отзыва.\n\n' +
        'Попробуй ещё раз или напиши напрямую в поддержку.',
        { parse_mode: 'Markdown' }
      );
    }
  }

  // Отменить процесс отправки отзыва
  async cancelFeedback(ctx) {
    try {
      // Очищаем состояние
      if (ctx.session && ctx.session.awaitingFeedback) {
        delete ctx.session.awaitingFeedback;
      }

      await this.showFeedbackMenu(ctx);
    } catch (error) {
      console.error('Error canceling feedback:', error);
      await ctx.answerCbQuery('Ошибка');
    }
  }
}

module.exports = { FeedbackHandler };
