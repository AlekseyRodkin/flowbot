// src/handlers/pauseHandler.js
// Обработчик для управления паузой программы и закрытия незавершённых задач

const moment = require('moment-timezone');
const { sendOrEditMessage } = require('../utils/messageUtils');

// Обработка кнопки "Поставить на паузу"
const pauseProgram = async (ctx, userService) => {
  try {
    const userId = ctx.from.id;

    // Устанавливаем паузу
    await userService.pauseUser(userId);

    await ctx.answerCbQuery('⏸️ Программа на паузе');

    const pauseText = `⏸️ *Программа поставлена на паузу*\n\n` +
      `Утренние задачи больше не будут приходить.\n` +
      `Твой текущий уровень и прогресс сохранены.\n\n` +
      `Когда будешь готов продолжить, используй команду /resume`;

    await sendOrEditMessage(ctx, pauseText);

    console.log(`✅ User ${userId} paused the program`);
  } catch (error) {
    console.error('Error in pauseProgram:', error);
    await ctx.answerCbQuery('Ошибка при установке паузы', true);
  }
};

// Обработка кнопки "Закрыть все задачи" (отметить как пропущенные)
const skipAllTasks = async (ctx, supabase, userService) => {
  try {
    const userId = ctx.from.id;
    const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

    // Получаем все незавершённые задачи пользователя (не только сегодняшние)
    const { data: incompleteTasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('telegram_id', userId)
      .eq('completed', false)
      .neq('status', 'skipped');

    if (incompleteTasks && incompleteTasks.length > 0) {
      // Отмечаем все незавершённые задачи как пропущенные
      await supabase
        .from('tasks')
        .update({ status: 'skipped' })
        .eq('telegram_id', userId)
        .eq('completed', false)
        .neq('status', 'skipped');

      // Сбрасываем счётчик неактивных дней
      await userService.resetInactiveDays(userId);

      await ctx.answerCbQuery('✅ Все задачи отмечены как пропущенные');

      const skipText = `📋 *Все незавершённые задачи закрыты*\n\n` +
        `Отмечено как пропущенные: ${incompleteTasks.length} задач\n\n` +
        `Теперь ты можешь:\n` +
        `• Продолжить программу — нажми /resume\n` +
        `• Получить задачи на сегодня — утренние задачи придут в назначенное время`;

      await sendOrEditMessage(ctx, skipText);

      console.log(`✅ User ${userId} skipped ${incompleteTasks.length} tasks`);
    } else {
      await ctx.answerCbQuery('Нет незавершённых задач');

      const noTasksText = `ℹ️ *Нет незавершённых задач*\n\n` +
        `Все твои задачи уже выполнены! 🎉\n\n` +
        `Продолжай в том же духе!`;

      await sendOrEditMessage(ctx, noTasksText);
    }
  } catch (error) {
    console.error('Error in skipAllTasks:', error);
    await ctx.answerCbQuery('Ошибка при закрытии задач', true);
  }
};

// Обработка кнопки "Продолжить дальше"
const continueProgram = async (ctx, userService, notificationService) => {
  try {
    const userId = ctx.from.id;

    // Сбрасываем счётчик неактивных дней
    await userService.resetInactiveDays(userId);

    // Получаем данные пользователя
    const user = await userService.getUser(userId);

    if (!user) {
      await ctx.answerCbQuery('Пользователь не найден', true);
      return;
    }

    await ctx.answerCbQuery('✅ Продолжаем!');

    const continueText = `💪 *Отлично! Продолжаем!*\n\n` +
      `Твои задачи на сегодня уже готовы.\n` +
      `Сейчас отправлю...`;

    await sendOrEditMessage(ctx, continueText);

    // Отправляем задачи пользователю
    await notificationService.sendTasksToUser(user);

    console.log(`✅ User ${userId} chose to continue the program`);
  } catch (error) {
    console.error('Error in continueProgram:', error);
    await ctx.answerCbQuery('Ошибка при продолжении программы', true);
  }
};

module.exports = {
  pauseProgram,
  skipAllTasks,
  continueProgram
};
