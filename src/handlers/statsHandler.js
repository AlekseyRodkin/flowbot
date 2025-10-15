// src/handlers/statsHandler.js
const { Markup } = require('telegraf');
const moment = require('moment-timezone');
const { sendOrEditMessage } = require('../utils/messageUtils');

class StatsHandler {
  // Показать основную статистику
  async showStats(ctx, user, userService, taskService) {
    try {
      // Получаем статистику пользователя
      const stats = await userService.getUserStats(user.telegram_id);
      const todayStats = await taskService.getDailyStats(user.telegram_id);
      
      if (!stats) {
        await sendOrEditMessage(ctx, 'Не удалось загрузить статистику. Попробуйте позже.');
        return;
      }

      // Формируем сообщение со статистикой
      let message = `📊 *Твоя статистика*\n\n`;
      
      // Общие показатели
      message += `*📅 Общий прогресс:*\n`;
      if (user.level <= 30) {
        message += `День программы: ${user.level}/30\n`;
      } else {
        message += `День программы: ${user.level} (завершена! 🎉)\n`;
      }
      message += `Всего выполнено задач: ${stats.totalTasks}\n`;
      message += `Активных дней: ${stats.totalDays}\n`;
      message += `Среднее задач в день: ${stats.averageTasks}\n`;
      message += `Процент выполнения: ${stats.completionRate}%\n\n`;
      
      // Стрики
      message += `*🔥 Стрики:*\n`;
      message += `Текущий стрик: ${stats.currentStreak} дней\n`;
      message += `Лучший стрик: ${stats.longestStreak} дней\n\n`;
      
      // Сегодняшний день
      message += `*📆 Сегодня:*\n`;
      message += `Выполнено: ${todayStats.completed_tasks}/${todayStats.total_tasks}\n`;
      message += `Flow Score: ${todayStats.flow_score}%\n`;
      
      if (todayStats.easy_completed > 0) {
        message += `💚 Простых: ${todayStats.easy_completed}\n`;
      }
      if (todayStats.standard_completed > 0) {
        message += `💛 Средних: ${todayStats.standard_completed}\n`;
      }
      if (todayStats.hard_completed > 0) {
        message += `❤️ Сложных: ${todayStats.hard_completed}\n`;
      }
      if (todayStats.magic_completed) {
        message += `✨ Магическая: выполнена!\n`;
      }
      
      // Достижения
      if (stats.achievements && stats.achievements.length > 0) {
        message += `\n*🏆 Последние достижения:*\n`;
        const recentAchievements = stats.achievements.slice(-3);
        for (const ach of recentAchievements) {
          message += `${ach.achievements.icon} ${ach.achievements.name}\n`;
        }
      }

      // Клавиатура с опциями
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📈 График за неделю', 'stats_weekly'),
          Markup.button.callback('📊 График за месяц', 'stats_monthly')
        ],
        [
          Markup.button.callback('🏆 Все достижения', 'stats_achievements')
        ],
        [
          Markup.button.callback('◀️ Назад', 'back_to_menu')
        ]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error in showStats:', error);
      await sendOrEditMessage(ctx, 'Произошла ошибка при загрузке статистики.');
    }
  }

  // Генерация emoji-графика
  generateEmojiBar(value, max, width = 10) {
    if (max === 0) return '⬜'.repeat(width);
    const filled = Math.round((value / max) * width);
    return '🟩'.repeat(filled) + '⬜'.repeat(width - filled);
  }

  // Показать детальную статистику за период
  async showDetailedStats(ctx, period) {
    try {
      const user = ctx.state.user;
      const userService = ctx.state.userService;

      const stats = await userService.getUserStats(user.id);

      if (!stats || !stats.recentDays) {
        await ctx.answerCbQuery('Нет данных для отображения');
        return;
      }

      let message = '';
      let days = [];

      if (period === 'weekly') {
        message = `📈 *Статистика за неделю*\n\n`;
        days = stats.recentDays.slice(0, 7);

        // Находим максимум для нормализации
        const maxTasks = Math.max(...days.map(d => d.completed_tasks || 0));

        // Находим лучший день
        const bestDay = days.reduce((best, d) =>
          (d.completed_tasks || 0) > (best.completed_tasks || 0) ? d : best
        );

        // Генерируем график по дням
        for (const day of days) {
          const completed = day.completed_tasks || 0;
          const dayName = moment(day.date).format('dd');
          const dayNum = moment(day.date).format('DD');
          const bar = this.generateEmojiBar(completed, maxTasks, 10);
          const isBest = day === bestDay ? ' ⭐' : '';

          message += `${dayName} ${dayNum}  ${bar}  ${completed}${isBest}\n`;
        }

        message += `\n`;

      } else if (period === 'monthly') {
        message = `📊 *Статистика за месяц*\n\n`;
        days = stats.monthlyStats || stats.recentDays.slice(0, 30);
      }

      // Статистика по периоду
      const totalCompleted = days.reduce((sum, d) => sum + (d.completed_tasks || 0), 0);
      const avgCompleted = Math.round(totalCompleted / days.length);
      const bestDay = days.reduce((best, d) =>
        (d.completed_tasks || 0) > (best.completed_tasks || 0) ? d : best
      );

      message += `💪 Всего: ${totalCompleted} задач\n`;
      message += `🔥 Среднее: ${avgCompleted}/день\n`;
      message += `🏆 Лучший день: ${moment(bestDay.date).format('DD.MM')} (${bestDay.completed_tasks})\n`;

      // Для месячного графика добавляем активные дни
      if (period === 'monthly') {
        const activeDays = days.filter(d => (d.completed_tasks || 0) > 0).length;
        message += `📈 Активных дней: ${activeDays}/${days.length}\n`;
      }

      // Анализ по типам задач
      const easyTotal = days.reduce((sum, d) => sum + (d.easy_completed || 0), 0);
      const standardTotal = days.reduce((sum, d) => sum + (d.standard_completed || 0), 0);
      const hardTotal = days.reduce((sum, d) => sum + (d.hard_completed || 0), 0);

      if (easyTotal + standardTotal + hardTotal > 0) {
        message += `\n*По типам задач:*\n`;
        message += `💚 Простых: ${easyTotal}\n`;
        message += `💛 Средних: ${standardTotal}\n`;
        message += `❤️ Сложных: ${hardTotal}\n`;
      }

      // Для месячного графика добавляем статистику по неделям
      if (period === 'monthly' && days.length >= 7) {
        message += `\n*По неделям:*\n`;

        for (let i = 0; i < Math.ceil(days.length / 7); i++) {
          const weekDays = days.slice(i * 7, (i + 1) * 7);
          const weekTotal = weekDays.reduce((sum, d) => sum + (d.completed_tasks || 0), 0);
          message += `Неделя ${i + 1}:  ${weekTotal} задач\n`;
        }
      }

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к статистике', 'show_stats')]
      ]);

      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error in showDetailedStats:', error);
      await ctx.answerCbQuery('Ошибка загрузки статистики');
    }
  }

  // Сохранить настроение
  async saveMood(ctx, mood) {
    try {
      const user = ctx.state.user;
      const taskService = ctx.state.taskService;
      
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      await taskService.saveMood(user.id, today, mood);
      
      await ctx.answerCbQuery('Настроение сохранено!');
      
      // Мотивационное сообщение в зависимости от настроения
      let response = '';
      switch(mood) {
        case 'great':
          response = '😊 Отлично! Рад, что у тебя продуктивный день!';
          break;
        case 'good':
          response = '👍 Хорошо! Продолжай в том же духе!';
          break;
        case 'normal':
          response = '😐 Нормально - тоже результат. Завтра будет лучше!';
          break;
        case 'tired':
          response = '😔 Устал? Отдохни хорошенько. Завтра новый день!';
          break;
      }
      
      response += '\n\nХочешь добавить заметку о сегодняшнем дне?';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📝 Добавить рефлексию', 'add_reflection')],
        [Markup.button.callback('➡️ Пропустить', 'skip_reflection')]
      ]);
      
      await sendOrEditMessage(ctx, response, keyboard);
    } catch (error) {
      console.error('Error saving mood:', error);
      await ctx.answerCbQuery('Ошибка сохранения настроения');
    }
  }

  // Показать все достижения
  async showAchievements(ctx) {
    try {
      const user = ctx.state.user;
      const userService = ctx.state.userService;
      
      const stats = await userService.getUserStats(user.id);
      
      if (!stats || !stats.achievements) {
        await ctx.answerCbQuery('У тебя пока нет достижений');
        return;
      }

      let message = `🏆 *Твои достижения*\n\n`;
      
      // Группируем достижения по категориям
      const streakAchievements = [];
      const taskAchievements = [];
      const specialAchievements = [];
      
      for (const ach of stats.achievements) {
        const achievement = ach.achievements;
        const achText = `${achievement.icon} *${achievement.name}*\n_${achievement.description}_\n+${achievement.points} очков\n\n`;
        
        if (achievement.code.startsWith('streak_')) {
          streakAchievements.push(achText);
        } else if (achievement.code.startsWith('task_')) {
          taskAchievements.push(achText);
        } else {
          specialAchievements.push(achText);
        }
      }
      
      if (streakAchievements.length > 0) {
        message += `*🔥 Стрики:*\n${streakAchievements.join('')}`;
      }
      
      if (taskAchievements.length > 0) {
        message += `*✅ Задачи:*\n${taskAchievements.join('')}`;
      }
      
      if (specialAchievements.length > 0) {
        message += `*✨ Особые:*\n${specialAchievements.join('')}`;
      }
      
      // Общие очки
      const totalPoints = stats.achievements.reduce(
        (sum, ach) => sum + (ach.achievements.points || 0), 0
      );
      message += `\n*Всего очков: ${totalPoints}* 🎯`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('◀️ Назад к статистике', 'show_stats')]
      ]);
      
      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing achievements:', error);
      await ctx.answerCbQuery('Ошибка загрузки достижений');
    }
  }

  // Генерировать отчет
  async generateReport(ctx, user) {
    try {
      const userService = ctx.state.userService;
      const stats = await userService.getUserStats(user.id);
      
      if (!stats) {
        await sendOrEditMessage(ctx, 'Недостаточно данных для генерации отчета.');
        return;
      }

      let report = `📋 *Персональный отчет FlowBot*\n`;
      report += `_${moment().format('DD.MM.YYYY')}_\n\n`;
      
      report += `👤 *Пользователь:* ${user.first_name}\n`;
      if (user.level <= 30) {
        report += `📅 *День программы:* ${user.level}/30\n`;
      } else {
        report += `📅 *День программы:* ${user.level} (завершена! 🎉)\n`;
      }
      
      report += `*📊 Общая статистика:*\n`;
      report += `• Всего задач выполнено: ${stats.totalTasks}\n`;
      report += `• Активных дней: ${stats.totalDays}\n`;
      report += `• Среднее задач в день: ${stats.averageTasks}\n`;
      report += `• Процент выполнения: ${stats.completionRate}%\n`;
      report += `• Текущий стрик: ${stats.currentStreak} дней\n`;
      report += `• Лучший стрик: ${stats.longestStreak} дней\n\n`;
      
      // Анализ продуктивности
      let analysis = `*🔍 Анализ продуктивности:*\n`;
      
      if (stats.completionRate >= 80) {
        analysis += `✅ Отличная продуктивность! Ты в топ-20% пользователей.\n`;
      } else if (stats.completionRate >= 60) {
        analysis += `👍 Хорошая продуктивность. Есть куда расти!\n`;
      } else {
        analysis += `📈 Продуктивность можно улучшить. Попробуй начинать с простых задач.\n`;
      }
      
      if (stats.currentStreak >= 7) {
        analysis += `🔥 Великолепный стрик! Продолжай в том же духе.\n`;
      } else if (stats.currentStreak >= 3) {
        analysis += `💪 Хороший стрик. Не останавливайся!\n`;
      } else {
        analysis += `🎯 Работай над регулярностью - это ключ к успеху.\n`;
      }
      
      report += analysis + '\n';
      
      // Рекомендации
      report += `*💡 Рекомендации:*\n`;
      
      if (stats.averageTasks < 15) {
        report += `• Попробуй выполнять минимум 15 задач в день\n`;
      }
      if (stats.completionRate < 70) {
        report += `• Начинай день с 5 самых простых задач для разгона\n`;
      }
      if (stats.currentStreak < 3) {
        report += `• Фокусируйся на ежедневном выполнении для создания привычки\n`;
      }
      
      report += `\n_Спасибо, что используешь FlowBot!_ 🚀`;

      await sendOrEditMessage(ctx, report);
    } catch (error) {
      console.error('Error generating report:', error);
      await sendOrEditMessage(ctx, 'Ошибка при генерации отчета.');
    }
  }
}

module.exports = {
  statsHandler: new StatsHandler()
};
