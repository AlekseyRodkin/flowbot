// src/handlers/feedbackHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');
const { EventLogger, EVENT_TYPES } = require('../services/eventLogger');

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

  // ═══════════════════════════════════════════════════════════════
  // RETENTION FEEDBACK PROMPTS (Day 1, 3, 7)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Показать retention feedback для Day 1
   */
  async showDay1Feedback(ctx) {
    try {
      const message = `Как тебе первый день с FlowBot? 🌟`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔥 Круто, уже чувствую эффект!', 'retention_fb_1_great')],
        [Markup.button.callback('👍 Нормально, пока непонятно', 'retention_fb_1_unclear')],
        [Markup.button.callback('😐 Задачи не подошли', 'retention_fb_1_not_fit')],
        [Markup.button.callback('❌ Не для меня', 'retention_fb_1_not_for_me')]
      ]);

      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Error showing Day 1 feedback:', error);
    }
  }

  /**
   * Показать retention feedback для Day 3
   */
  async showDay3Feedback(ctx) {
    try {
      const message = `3 дня с FlowBot - как идёт? 💪`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Вхожу в ритм!', 'retention_fb_3_getting_rhythm')],
        [Markup.button.callback('🤔 Есть вопросы', 'retention_fb_3_have_questions')],
        [Markup.button.callback('😓 Сложновато', 'retention_fb_3_too_hard')],
        [Markup.button.callback('❌ Хочу остановиться', 'retention_fb_3_want_stop')]
      ]);

      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Error showing Day 3 feedback:', error);
    }
  }

  /**
   * Показать retention feedback для Day 7
   */
  async showDay7Feedback(ctx) {
    try {
      const message = `Неделя позади! Что думаешь? 🎯`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Продолжаю, это работает!', 'retention_fb_7_works')],
        [Markup.button.callback('📈 Вижу прогресс, но медленно', 'retention_fb_7_slow_progress')],
        [Markup.button.callback('😐 Не уверен пока', 'retention_fb_7_not_sure')],
        [Markup.button.callback('❌ Останавливаюсь', 'retention_fb_7_stopping')]
      ]);

      await ctx.reply(message, keyboard);
    } catch (error) {
      console.error('Error showing Day 7 feedback:', error);
    }
  }

  /**
   * Обработать ответ на retention feedback
   * @param {number} dayNumber - День программы (1, 3, 7)
   * @param {string} feedbackType - Тип отзыва (great, unclear и т.д.)
   */
  async handleRetentionFeedback(ctx, dayNumber, feedbackType) {
    try {
      const telegram_id = ctx.from.id;

      // Сохраняем в БД
      await this.feedbackService.saveRetentionFeedback(telegram_id, dayNumber, feedbackType);
      console.log(`✅ Retention feedback saved: Day ${dayNumber}, type ${feedbackType}`);

      // Log FEEDBACK_SUBMITTED event
      const eventLogger = new EventLogger(this.feedbackService.supabase);
      await eventLogger.logFeedbackSubmitted(telegram_id, dayNumber, feedbackType);

      // Благодарим пользователя
      let responseMessage = '';

      // Позитивный feedback
      if (['great', 'getting_rhythm', 'works'].includes(feedbackType)) {
        responseMessage = `✅ *Отлично!* 🎉\n\nСпасибо за отзыв! Продолжай в том же духе! 💪`;
      }
      // Нейтральный feedback
      else if (['unclear', 'have_questions', 'not_sure', 'slow_progress'].includes(feedbackType)) {
        responseMessage = `✅ *Спасибо за отзыв!* 📝\n\nМы учтём твои комментарии и будем улучшать бота.\n\nЕсли есть конкретные вопросы - используй /feedback для связи! 💬`;
      }
      // Негативный feedback
      else if (['not_fit', 'not_for_me', 'too_hard', 'want_stop', 'stopping'].includes(feedbackType)) {
        responseMessage = `😔 *Жаль, что не подошло...*\n\nСпасибо за честность! Твой отзыв поможет нам стать лучше.\n\nЕсли хочешь вернуться - я буду тут! 🤗`;
      }
      else {
        responseMessage = `✅ *Спасибо за отзыв!* 🙏`;
      }

      await ctx.editMessageText(responseMessage, {
        parse_mode: 'Markdown',
        reply_markup: undefined
      });

      await ctx.answerCbQuery('Спасибо! 🙏');

    } catch (error) {
      console.error('Error handling retention feedback:', error);
      await ctx.answerCbQuery('Ошибка при сохранении отзыва');
    }
  }
}

module.exports = { FeedbackHandler };
