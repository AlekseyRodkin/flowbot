// src/handlers/resetHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');

const resetHandler = async (ctx) => {
  const confirmText = `⚠️ *Внимание!*
  
Это действие сбросит весь твой прогресс:
- День программы вернется к 1
- Стрик обнулится
- Статистика сбросится

Ты уверен?`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да, начать заново', 'confirm_reset'),
      Markup.button.callback('❌ Отмена', 'cancel_reset')
    ]
  ]);

  await sendOrEditMessage(ctx, confirmText, keyboard);
};

const confirmReset = async (ctx, userService, statsService) => {
  try {
    const userId = ctx.from.id;
    
    // Сбрасываем пользователя
    await userService.updateUser(userId, {
      level: 1,
      onboarding_completed: false
    });
    
    // Удаляем сегодняшние задачи
    await statsService.clearUserTasks(userId);
    
    await ctx.answerCbQuery('✅ Прогресс сброшен');
    
    const resetText = `🔄 *Прогресс сброшен!*
    
Ты начинаешь заново с чистого листа.
Используй /start чтобы пройти настройку заново.

💪 Удачи в новом путешествии к продуктивности!`;
    
    await sendOrEditMessage(ctx, resetText);
    
    // Запускаем онбординг заново
    const startHandler = require('./startHandler');
    await startHandler.startHandler(ctx, userService);
    
  } catch (error) {
    console.error('Error in confirmReset:', error);
    await ctx.answerCbQuery('Ошибка при сбросе', true);
  }
};

const cancelReset = async (ctx) => {
  await ctx.answerCbQuery('Отменено');
  await sendOrEditMessage(ctx, '❌ Сброс отменен. Твой прогресс сохранен.');
};

module.exports = {
  resetHandler,
  confirmReset,
  cancelReset
};
