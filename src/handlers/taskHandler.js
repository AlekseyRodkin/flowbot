// src/handlers/taskHandler.js
const { Markup } = require('telegraf');
const moment = require('moment-timezone');
const { sendOrEditMessage } = require('../utils/messageUtils');
const { g, getWord } = require('../utils/genderUtils');

class TaskHandler {
  constructor(supabase = null) {
    this.tasksPerPage = 10;
    this.supabase = supabase;
  }

  // Показать задачи на сегодня
  async showTodayTasks(ctx, taskService, user, editMessage = false) {
    try {
      // Инициализируем сессию, если не существует
      if (!ctx.session) {
        ctx.session = {};
      }
      
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(user.id, today);
      
      if (!tasks || tasks.length === 0) {
        await this.showTaskCreationModeSelection(ctx, user);
        return;
      }

      // Группируем задачи по типам
      const tasksByType = this.groupTasksByType(tasks);

      // Используем user.level как единственный источник истины для номера дня
      const currentDay = user.level || 1;

      // Формируем сообщение
      let message = `📅 *Мои задачи на сегодня*\n`;
      if (currentDay <= 30) {
        message += `День ${currentDay} из 30\n\n`;
      } else {
        message += `День ${currentDay} (программа завершена! 🎉)\n\n`;
      }
      
      // Счетчики выполнения
      const completed = tasks.filter(t => t.completed).length;
      const total = tasks.length;
      const percentage = Math.round((completed / total) * 100);
      
      message += `Прогресс: ${completed}/${total} (${percentage}%)\n`;
      message += this.getProgressBar(percentage) + '\n\n';
      
      // Выводим задачи по категориям
      if (tasksByType.easy.length > 0) {
        message += `💚 *Простые задачи:*\n`;
        message += this.formatTaskList(tasksByType.easy);
      }

      if (tasksByType.standard.length > 0) {
        message += `\n💛 *Средние задачи:*\n`;
        message += this.formatTaskList(tasksByType.standard);
      }

      // Сложные задачи - показываем с плейсхолдером если нет
      const hardTasksCount = tasksByType.hard.length;
      const hardTasksExpected = user.level >= 11 ? 8 : 0;

      if (hardTasksExpected > 0) {
        message += `\n🔴 *Сложные задачи (${hardTasksCount}/${hardTasksExpected}):*\n`;

        if (hardTasksCount > 0) {
          message += this.formatTaskList(tasksByType.hard);
        }

        if (hardTasksCount === 0) {
          // Когда совсем нет задач - более информативное сообщение
          message += `\n💡 _Добавь 8 сложных задач через кнопку "✏️ Изменить список" ниже_ ⬇️\n`;
        } else if (hardTasksCount < hardTasksExpected) {
          // Когда есть, но не хватает
          const needMore = hardTasksExpected - hardTasksCount;
          const taskWord = needMore === 1 ? 'задачу' : (needMore < 5 ? 'задачи' : 'задач');
          message += `\n➕ _Добавь ещё ${needMore} ${taskWord}_\n`;
        }
      }

      if (tasksByType.magic.length > 0) {
        message += `\n✨ *Магическая задача:*\n`;
        message += this.formatTaskList(tasksByType.magic);
      }

      // Инициализируем страницу, если не задана
      if (ctx.session.tasksPage === undefined) {
        ctx.session.tasksPage = 0;
      }
      
      // Клавиатура для управления
      const keyboard = this.createTasksKeyboard(tasks, ctx.session.tasksPage);
      
      await sendOrEditMessage(ctx, message, keyboard);
    } catch (error) {
      console.error('Error showing tasks:', error);
      await ctx.reply('Не удалось загрузить задачи. Попробуйте позже.');
    }
  }

  // Отметить задачу как выполненную
  async completeTask(ctx, taskService, taskId) {
    try {
      // 1. Отметить задачу (критичная операция)
      const task = await taskService.completeTask(taskId);

      if (!task) {
        await ctx.answerCbQuery('Задача не найдена', true);
        return;
      }

      // 2. Проверяем тип задачи для специального поздравления
      let motivationalMsg;
      if (task.task_type === 'magic') {
        // Для магической задачи - особое поздравление
        const user = ctx.state.user;
        await ctx.reply(this.getMagicTaskMessage(user), { parse_mode: 'Markdown' });
        motivationalMsg = '✨ Магия!';
      } else {
        // Для обычных задач - мотивационное сообщение по количеству
        const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
        const allTasksNow = await taskService.getUserTasksForDate(task.telegram_id, today);
        const completedCount = allTasksNow.filter(t => t.completed).length;
        motivationalMsg = this.getMotivationalMessage(completedCount);
      }

      // 3. СРАЗУ отправить мотивационный ответ пользователю
      await ctx.answerCbQuery(motivationalMsg);

      // 4. Параллельно: получить статистику + обновить UI
      const [stats] = await Promise.all([
        taskService.getDailyStats(task.telegram_id),
        this.updateTaskMessage(ctx, taskService, task.telegram_id)
      ]);

      // 4. Проверка достижений - в фоне
      setImmediate(async () => {
        this.checkAchievements(stats);

        // Проверка выполнения ВСЕХ задач на сегодня (кроме магической)
        // Получаем реальное количество задач из БД, а не из статистики
        const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
        const allTasks = await taskService.getUserTasksForDate(task.telegram_id, today);

        // Исключаем магическую задачу из подсчёта
        const regularTasks = allTasks.filter(t => t.task_type !== 'magic');
        const totalTasks = regularTasks.length;
        const completedTasks = regularTasks.filter(t => t.completed).length;

        console.log(`📊 Task completion check: ${completedTasks}/${totalTasks} regular tasks completed (excluding magic)`);

        if (completedTasks === totalTasks && totalTasks > 0) {
          console.log(`🎉 All tasks completed! Updating streak and incrementing user level`);
          const user = ctx.state.user; // Получаем пользователя из контекста

          // 1. СНАЧАЛА обновляем стрик (заслуженно!)
          await taskService.updateStreak(task.telegram_id);

          // 2. ПОТОМ увеличиваем уровень пользователя при завершении всех задач
          const currentLevel = user.level || 1;
          const nextLevel = currentLevel + 1;

          await this.supabase
            .from('users')
            .update({ level: nextLevel })
            .eq('telegram_id', task.telegram_id);

          console.log(`📈 User ${task.telegram_id} level increased: ${currentLevel} → ${nextLevel}`);

          // Обновляем user object для использования в сообщении
          user.level = nextLevel;

          this.sendEpicCompletion(ctx, stats, user).catch(err =>
            console.error('Error sending epic completion:', err)
          );
        }
      });

    } catch (error) {
      console.error('Error completing task:', error);
      await ctx.answerCbQuery('Ошибка при выполнении задачи', true);
    }
  }

  // Переключить статус задачи
  async toggleTask(ctx, taskService, taskId) {
    try {
      const task = await taskService.toggleTask(taskId);
      
      if (!task) {
        await ctx.answerCbQuery('Задача не найдена', true);
        return;
      }

      const message = task.completed 
        ? '✅ Задача выполнена!' 
        : '⏸ Задача снова активна';
      
      await ctx.answerCbQuery(message);
      
      // Обновляем сообщение с задачами
      await this.updateTaskMessage(ctx, taskService, task.telegram_id);
      
    } catch (error) {
      console.error('Error toggling task:', error);
      await ctx.answerCbQuery('Ошибка при обновлении задачи', true);
    }
  }

  // Группировка задач по типам
  groupTasksByType(tasks) {
    return {
      easy: tasks.filter(t => t.task_type === 'easy'),
      standard: tasks.filter(t => t.task_type === 'standard'),
      hard: tasks.filter(t => t.task_type === 'hard'),
      magic: tasks.filter(t => t.task_type === 'magic')
    };
  }

  // Форматирование списка задач
  formatTaskList(tasks) {
    return tasks.map((task, index) => {
      const checkbox = task.completed ? '✅' : '⬜';
      const prefix = task.is_custom ? '👤' : '🌟';
      const text = task.completed 
        ? `~${task.task_text}~` 
        : task.task_text;
      return `${checkbox} ${prefix} ${text}`;
    }).join('\n') + '\n';
  }

  // Прогресс-бар
  getProgressBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    
    // Используем более яркие символы для лучшей видимости
    const filledChar = '🟩'; // Зеленый квадрат для заполненной части
    const emptyChar = '⬜'; // Белый квадрат для пустой части
    
    // Добавляем эмодзи в зависимости от прогресса
    let emoji = '';
    if (percentage === 0) emoji = '😴';
    else if (percentage < 25) emoji = '🌱';
    else if (percentage < 50) emoji = '🚶';
    else if (percentage < 75) emoji = '🏃';
    else if (percentage < 100) emoji = '🔥';
    else emoji = '🎯';
    
    return filledChar.repeat(filled) + emptyChar.repeat(empty) + ` ${emoji} ${percentage}%`;
  }

  // Создание клавиатуры для задач
  createTasksKeyboard(tasks, page = 0) {
    const buttons = [];
    const TASKS_PER_PAGE = 5;
    
    // Кнопки для быстрого доступа
    buttons.push([
      Markup.button.callback('✏️ Изменить список', 'edit_list_menu'),
      Markup.button.callback('🔄 Обновить задачи', 'refresh_confirmation')
    ]);
    
    // Фильтруем невыполненные задачи
    const uncompletedTasks = tasks.filter(t => !t.completed);
    const totalPages = Math.ceil(uncompletedTasks.length / TASKS_PER_PAGE);
    
    // Берем задачи для текущей страницы
    const startIndex = page * TASKS_PER_PAGE;
    const endIndex = startIndex + TASKS_PER_PAGE;
    const pageTasks = uncompletedTasks.slice(startIndex, endIndex);
    
    // Добавляем кнопки задач текущей страницы
    pageTasks.forEach(task => {
      buttons.push([
        Markup.button.callback(
          `⬜ ${task.task_text.substring(0, 30)}...`,
          `task_${task.id}`
        )
      ]);
    });
    
    // Кнопки пагинации, если задач больше чем на одну страницу
    if (totalPages > 1) {
      const paginationButtons = [];
      if (page > 0) {
        paginationButtons.push(Markup.button.callback('◀️ Назад', 'tasks_page_prev'));
      }
      paginationButtons.push(Markup.button.callback(`${page + 1}/${totalPages}`, 'tasks_page_info'));
      if (page < totalPages - 1) {
        paginationButtons.push(Markup.button.callback('Вперёд ▶️', 'tasks_page_next'));
      }
      buttons.push(paginationButtons);
    }

    buttons.push([
      Markup.button.callback('📊 Статистика дня', 'show_daily_stats')
    ]);

    buttons.push([
      Markup.button.callback('🏠 Главное меню', 'show_main_menu'),
      Markup.button.callback('⚙️ Настройки', 'show_settings')
    ]);

    return Markup.inlineKeyboard(buttons);
  }

  // Мотивационные сообщения (гендерно-нейтральные)
  getMotivationalMessage(completedCount) {
    const messages = {
      1: '🎯 Отличное начало!',
      5: '🔥 Ты в огне! Продолжай!',
      10: '⚡ 10 задач! Ты в потоке!',
      15: '💪 Половина пути пройдена!',
      20: '🚀 20 задач! Невероятно!',
      25: '🌟 Почти у цели!',
      30: '👑 ВСЕ 30! Ты легенда дня!'
    };

    return messages[completedCount] || `✅ Выполнено ${completedCount} задач!`;
  }

  // Специальное поздравление для магической задачи
  getMagicTaskMessage(user) {
    return `✨🎉 *МАГИЯ СВЕРШИЛАСЬ!* 🎉✨

Ты ${g(user, 'совершил', 'совершила')} нечто волшебное сегодня!

💫 Чудеса случаются каждый день —
ты только что ${g(user, 'создал', 'создала')} одно из них!

🌟 В жизни так много волшебства,
нужно только открыть глаза и ${g(user, 'поверить', 'поверить')}!`;
  }

  // Обновление сообщения с задачами
  async updateTaskMessage(ctx, taskService, userId) {
    try {
      // Инициализируем сессию, если не существует
      if (!ctx.session) {
        ctx.session = {};
      }
      
      // Получаем обновленные задачи
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(userId, today);

      // Проверяем и корректируем номер страницы
      const TASKS_PER_PAGE = 5;
      const uncompletedTasks = tasks.filter(t => !t.completed);
      const totalPages = Math.ceil(uncompletedTasks.length / TASKS_PER_PAGE);
      if (ctx.session.tasksPage >= totalPages && totalPages > 0) {
        ctx.session.tasksPage = 0; // Сброс на первую страницу
      }

      // Формируем новое сообщение
      const tasksByType = this.groupTasksByType(tasks);
      const completed = tasks.filter(t => t.completed).length;
      const total = tasks.length;
      const percentage = Math.round((completed / total) * 100);
      
      let message = `📅 *Твои задачи на сегодня*\n\n`;
      message += `Прогресс: ${completed}/${total} (${percentage}%)\n`;
      message += this.getProgressBar(percentage) + '\n\n';
      
      // Задачи по категориям
      if (tasksByType.easy.length > 0) {
        message += `💚 *Простые задачи:*\n`;
        message += this.formatTaskList(tasksByType.easy);
      }

      if (tasksByType.standard.length > 0) {
        message += `\n💛 *Средние задачи:*\n`;
        message += this.formatTaskList(tasksByType.standard);
      }

      // Получаем уровень пользователя для определения ожидаемого количества сложных задач
      const userLevel = ctx.state.user?.level || 1;
      const hardTasksCount = tasksByType.hard.length;
      const hardTasksExpected = userLevel >= 11 ? 8 : 0;

      if (hardTasksExpected > 0) {
        message += `\n🔴 *Сложные задачи (${hardTasksCount}/${hardTasksExpected}):*\n`;

        if (hardTasksCount > 0) {
          message += this.formatTaskList(tasksByType.hard);
        }

        if (hardTasksCount === 0) {
          // Когда совсем нет задач (кроме метазадачи планирования)
          message += `\n💡 _Сначала выполни задачу "Составить список", затем добавь ещё 5-10 сложных задач самостоятельно через кнопку "✏️ Изменить список" ниже_ ⬇️\n`;
          message += `_⚠️ Важно: выполни все задачи для завершения дня!_\n`;
        } else if (hardTasksCount < hardTasksExpected) {
          // Когда есть, но не хватает
          const needMore = hardTasksExpected - hardTasksCount;
          const taskWord = needMore === 1 ? 'задачу' : (needMore < 5 ? 'задачи' : 'задач');
          message += `\n➕ _Добавь ещё ${needMore} ${taskWord}_\n`;
        }
      }

      if (tasksByType.magic.length > 0) {
        message += `\n✨ *Магическая задача:*\n`;
        message += this.formatTaskList(tasksByType.magic);
      }
      
      // Используем сохраненную страницу или 0
      const page = ctx.session.tasksPage || 0;
      const keyboard = this.createTasksKeyboard(tasks, page);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error updating task message:', error);
    }
  }

  // Отправка эпичного поздравления при завершении всех 30 задач
  async sendEpicCompletion(ctx, stats, user) {
    const epicMessage = `
🎆🎆🎆 *НЕВЕРОЯТНО!* 🎆🎆🎆

*ТЫ ${g(user, 'ВЫПОЛНИЛ', 'ВЫПОЛНИЛА')} ВСЕ ЗАДАЧИ ДНЯ!*

🏆 *ТЫ ЛЕГЕНДА ДНЯ!* 🏆

━━━━━━━━━━━━━━━

*Сейчас самое важное:*

1️⃣ Положи руку на сердце
2️⃣ Посмотри на себя в зеркало
3️⃣ Скажи себе ВСЛУХ:

_"Я МОЛОДЕЦ!_
_Я ${g(user, 'СПРАВИЛСЯ', 'СПРАВИЛАСЬ')}!_
_Я ${g(user, 'ДОСТОИН', 'ДОСТОЙНА')} УВАЖЕНИЯ!_
_Я БЛАГОДАРЮ СЕБЯ ЗА ЭТОТ ДЕНЬ!"_

━━━━━━━━━━━━━━━

⚡ *Ты ${g(user, 'вошел', 'вошла')} в состояние ПОТОКА*
🧠 *Твой мозг выработал максимум дофамина*
💪 *Ты ${g(user, 'доказал', 'доказала')}, что ${g(user, 'способен', 'способна')} на всё!*

✨ _Прочувствуй этот момент..._
✨ _Это ТЫ это ${g(user, 'сделал', 'сделала')}!_
✨ _Ты - ${g(user, 'ГЕРОЙ', 'ГЕРОИНЯ')} своей жизни!_

━━━━━━━━━━━━━━━

*Твоя статистика дня:*
💚 Простых: ${stats.easy_completed}
💛 Средних: ${stats.standard_completed} 
❤️ Сложных: ${stats.hard_completed}
✨ Магическая: ${stats.magic_completed ? '✅' : '❌'}

🔥 Flow Score: ${stats.flow_score || 100}%
⚡ Баллы продуктивности: ${stats.productivity_index || 0}

━━━━━━━━━━━━━━━

*ПОЗДРАВЛЯЮ, ${g(user, 'ЧЕМПИОН', 'ЧЕМПИОНКА')}!* 🎉

_Теперь иди и отпразднуй свою победу!_
_Ты это ${g(user, 'заслужил', 'заслужила')}!_
    `.trim();

    // Отправляем эпичное сообщение
    await ctx.reply(epicMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📊 Посмотреть полную статистику', callback_data: 'show_daily_stats' }
          ],
          [
            { text: '🎯 Завершить день', callback_data: 'complete_day' }
          ]
        ]
      }
    });

    // Дополнительно отправляем стикер или GIF для усиления эффекта
    try {
      // Отправляем праздничный стикер
      await ctx.replyWithSticker('CAACAgIAAxkBAAEBaUtmF1234567890ABCDEF'); // Замените на реальный ID стикера
    } catch (e) {
      // Если стикер не найден, просто продолжаем
      console.log('Sticker not found, continuing...');
    }
  }

  // Проверка достижений (без отправки сообщений)
  checkAchievements(stats) {
    const achievements = [];
    
    // Проверяем различные достижения
    if (stats.completed === 1) {
      achievements.push('🎯 Первый шаг!');
    }
    if (stats.completed === 10) {
      achievements.push('✅ Разминка завершена!');
    }
    if (stats.completed === 20) {
      achievements.push('⚡ В потоке!');
    }
    if (stats.completed === 30) {
      achievements.push('👑 Легенда дня!');
    }
    
    // Возвращаем достижения для логирования
    if (achievements.length > 0) {
      console.log('🏆 Достижения разблокированы:', achievements.join(', '));
    }
    
    return achievements;
  }

  // Показать предупреждение об обновлении задач
  async showRefreshWarning(ctx) {
    try {
      const warningText = `🛑 *СТОП! А ты уверен?*

🧠 *Научный факт:* Постоянная смена задач разрушает состояние потока!

Когда ты часто меняешь задачи, мозг:
❌ Теряет фокус и концентрацию  
❌ Тратит энергию на переключение
❌ Не входит в глубокое состояние потока

💡 *Совет коуча:* Лучше выполнить то, что есть — даже если задачи кажутся не идеальными. Именно так формируется привычка завершать начатое!

✅ Обновление задач полностью сбросит твой прогресс на сегодня.

Все равно хочешь продолжить?`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Да, обновить', 'refresh_tasks'),
          Markup.button.callback('❌ Отмена', 'cancel_refresh')
        ]
      ]);
      
      await ctx.editMessageText(warningText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing refresh warning:', error);
      await ctx.answerCbQuery('Ошибка при показе предупреждения');
    }
  }

  // Показать меню редактирования списка задач
  async showEditListMenu(ctx) {
    try {
      const menuText = `✏️ *Изменить список задач*

Выберите действие:`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✏️ Редактировать', 'edit_task_menu'),
          Markup.button.callback('➕ Добавить', 'edit_add_custom')
        ],
        [
          Markup.button.callback('❌ Удалить', 'edit_delete_menu')
        ],
        [
          Markup.button.callback('↩️ Вернуться к списку', 'back_to_tasks')
        ]
      ]);
      
      await ctx.editMessageText(menuText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing edit menu:', error);
      await ctx.answerCbQuery('Ошибка при показе меню редактирования');
    }
  }

  // Показать задачи для замены
  async showReplaceTaskMenu(ctx, taskService, userId, page = 0) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(userId, today);
      const uncompletedTasks = tasks.filter(t => !t.completed);
      
      if (uncompletedTasks.length === 0) {
        await ctx.editMessageText('Нет невыполненных задач для замены!', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]
          ]).reply_markup
        });
        return;
      }

      const TASKS_PER_PAGE = 10;
      const totalPages = Math.ceil(uncompletedTasks.length / TASKS_PER_PAGE);
      const startIndex = page * TASKS_PER_PAGE;
      const endIndex = startIndex + TASKS_PER_PAGE;
      const pageTasks = uncompletedTasks.slice(startIndex, endIndex);

      let message = `🔄 *Выберите задачу для замены:*\n`;
      if (totalPages > 1) {
        message += `_Страница ${page + 1} из ${totalPages}_\n\n`;
      } else {
        message += `\n`;
      }
      
      const keyboard = [];
      pageTasks.forEach(task => {
        const taskText = task.task_text.length > 30 
          ? task.task_text.substring(0, 30) + '...' 
          : task.task_text;
        keyboard.push([
          Markup.button.callback(
            `${this.getTaskTypeIcon(task.task_type)} ${taskText}`,
            `replace_task_${task.id}`
          )
        ]);
      });
      
      // Добавляем кнопки навигации
      if (totalPages > 1) {
        const paginationButtons = [];
        if (page > 0) {
          paginationButtons.push(Markup.button.callback('◀️ Назад', 'replace_page_prev'));
        }
        if (page < totalPages - 1) {
          paginationButtons.push(Markup.button.callback('Вперёд ▶️', 'replace_page_next'));
        }
        if (paginationButtons.length > 0) {
          keyboard.push(paginationButtons);
        }
      }
      
      keyboard.push([Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    } catch (error) {
      console.error('Error showing replace menu:', error);
      await ctx.answerCbQuery('Ошибка при показе задач');
    }
  }

  // Получить иконку для типа задачи
  getTaskTypeIcon(taskType) {
    switch (taskType) {
      case 'easy': return '💚';
      case 'standard': return '💛';
      case 'hard': return '❤️';
      case 'magic': return '✨';
      default: return '📋';
    }
  }

  // Показать выбор режима создания задач
  async showTaskCreationModeSelection(ctx, user, editMessage = false) {
    try {
      // Используем user.level как единственный источник истины для номера дня
      const currentDay = user.level || 1;

      let progressText;
      if (currentDay <= 15) {
        progressText = `День ${currentDay} из 15`;
      } else {
        progressText = `День ${currentDay} (ты в потоке! 🎉)`;
      }

      const modeText = `🎯 *Как формируем задачи на сегодня?*

${progressText}`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✨ Создай для меня', 'mode_ai_generate'),
          Markup.button.callback(`✏️ ${g(user, 'Сам', 'Сама')} составлю`, 'mode_manual_create')
        ]
      ]);
      
      if (editMessage) {
        await ctx.editMessageText(modeText, {
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      } else {
        await ctx.replyWithMarkdown(modeText, keyboard);
      }
    } catch (error) {
      console.error('Error showing mode selection:', error);
      await ctx.reply('Ошибка при показе выбора режима');
    }
  }

  // Показать меню массовых действий
  async showBulkEditMenu(ctx) {
    try {
      const menuText = `🔄 *Массовые действия*

Выберите действие:`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Отметить все', 'bulk_complete_all'),
          Markup.button.callback('⬜ Снять отметки', 'bulk_uncomplete_all')
        ],
        [
          Markup.button.callback('❌ Удалить выполненные', 'bulk_delete_completed'),
          Markup.button.callback('🔄 Перемешать', 'bulk_shuffle_tasks')
        ],
        [
          Markup.button.callback('↩️ Назад к редактированию', 'edit_list_menu')
        ]
      ]);
      
      await ctx.editMessageText(menuText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing bulk edit menu:', error);
      await ctx.answerCbQuery('Ошибка при показе меню массовых действий');
    }
  }

  // Показать меню переименования задач
  async showRenameTaskMenu(ctx, taskService, userId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(userId, today);
      
      if (tasks.length === 0) {
        await ctx.editMessageText('Нет задач для переименования!', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]
          ]).reply_markup
        });
        return;
      }

      let message = `📝 *Выберите задачу для переименования:*\n\n`;
      
      const keyboard = [];
      tasks.slice(0, 10).forEach(task => {
        const taskText = task.task_text.length > 30 
          ? task.task_text.substring(0, 30) + '...' 
          : task.task_text;
        const status = task.completed ? '✅' : '⬜';
        keyboard.push([
          Markup.button.callback(
            `${status} ${this.getTaskTypeIcon(task.task_type)} ${taskText}`,
            `rename_task_${task.id}`
          )
        ]);
      });
      
      keyboard.push([Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    } catch (error) {
      console.error('Error showing rename menu:', error);
      await ctx.answerCbQuery('Ошибка при показе задач для переименования');
    }
  }

  // Показать меню изменения типа задач
  async showChangeTypeMenu(ctx, taskService, userId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(userId, today);
      
      if (tasks.length === 0) {
        await ctx.editMessageText('Нет задач для изменения типа!', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]
          ]).reply_markup
        });
        return;
      }

      let message = `🎯 *Выберите задачу для изменения типа:*\n\n`;
      
      const keyboard = [];
      tasks.slice(0, 10).forEach(task => {
        const taskText = task.task_text.length > 30 
          ? task.task_text.substring(0, 30) + '...' 
          : task.task_text;
        const status = task.completed ? '✅' : '⬜';
        keyboard.push([
          Markup.button.callback(
            `${status} ${this.getTaskTypeIcon(task.task_type)} ${taskText}`,
            `change_type_${task.id}`
          )
        ]);
      });
      
      keyboard.push([Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    } catch (error) {
      console.error('Error showing change type menu:', error);
      await ctx.answerCbQuery('Ошибка при показе задач для изменения типа');
    }
  }

  // Показать выбор нового типа для задачи
  async showTypeSelectionMenu(ctx, taskId) {
    try {
      const menuText = `🎯 *Выберите новый тип задачи:*`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('💚 Простая', `set_type_${taskId}_easy`),
          Markup.button.callback('💛 Средняя', `set_type_${taskId}_standard`)
        ],
        [
          Markup.button.callback('❤️ Сложная', `set_type_${taskId}_hard`),
          Markup.button.callback('✨ Магическая', `set_type_${taskId}_magic`)
        ],
        [
          Markup.button.callback('↩️ Назад', 'edit_type_menu')
        ]
      ]);
      
      await ctx.editMessageText(menuText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing type selection menu:', error);
      await ctx.answerCbQuery('Ошибка при показе выбора типа');
    }
  }

  // Показать подтверждение массового действия
  async showBulkConfirmation(ctx, action, actionText) {
    try {
      const warningText = `⚠️ *Подтверждение действия*

Вы уверены, что хотите ${actionText}?

Это действие нельзя отменить!`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Да, выполнить', `confirm_${action}`),
          Markup.button.callback('❌ Отмена', 'edit_bulk_menu')
        ]
      ]);
      
      await ctx.editMessageText(warningText, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (error) {
      console.error('Error showing bulk confirmation:', error);
      await ctx.answerCbQuery('Ошибка при показе подтверждения');
    }
  }

  // Показать меню удаления задач
  async showDeleteTaskMenu(ctx, taskService, userId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(userId, today);
      
      if (tasks.length === 0) {
        await ctx.editMessageText('Нет задач для удаления!', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]
          ]).reply_markup
        });
        return;
      }

      let message = `❌ *Выберите задачу для удаления:*\n\n`;
      
      const keyboard = [];
      tasks.slice(0, 10).forEach(task => {
        const taskText = task.task_text.length > 30 
          ? task.task_text.substring(0, 30) + '...' 
          : task.task_text;
        const status = task.completed ? '✅' : '⬜';
        keyboard.push([
          Markup.button.callback(
            `${status} ${this.getTaskTypeIcon(task.task_type)} ${taskText}`,
            `delete_task_${task.id}`
          )
        ]);
      });
      
      keyboard.push([Markup.button.callback('↩️ Назад к меню', 'edit_list_menu')]);
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    } catch (error) {
      console.error('Error showing delete menu:', error);
      await ctx.answerCbQuery('Ошибка при показе задач для удаления');
    }
  }
}

module.exports = {
  TaskHandler,
  taskHandler: null // будет инициализирован в bot/index.js
};
