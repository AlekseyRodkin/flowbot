// src/handlers/customTaskHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage } = require('../utils/messageUtils');

// Вспомогательные функции
const getEstimatedTime = (difficulty) => {
  switch (difficulty) {
    case 'easy': return 10;
    case 'standard': return 20;
    case 'hard': return 45;
    case 'magic': return 60;
    default: return 15;
  }
};

const getDifficultyIcon = (difficulty) => {
  switch (difficulty) {
    case 'easy': return '💚';
    case 'standard': return '📈';
    case 'hard': return '🔥';
    case 'magic': return '✨';
    default: return '📈';
  }
};

const getDifficultyLabel = (difficulty) => {
  switch (difficulty) {
    case 'easy': return 'Простая';
    case 'standard': return 'Средняя';
    case 'hard': return 'Сложная';
    case 'magic': return 'Волшебная';
    default: return 'Средняя';
  }
};

const getCategoryIcon = (category) => {
  switch (category) {
    case 'mental': return '🧠';
    case 'physical': return '💪';
    case 'creative': return '🎨';
    case 'social': return '👥';
    case 'household': return '🏠';
    case 'personal': return '⭐';
    default: return '📝';
  }
};

const getCategoryLabel = (category) => {
  switch (category) {
    case 'mental': return 'Умственная';
    case 'physical': return 'Физическая';
    case 'creative': return 'Творческая';
    case 'social': return 'Социальная';
    case 'household': return 'Домашняя';
    case 'personal': return 'Личная';
    default: return 'Общая';
  }
};

// Показать главное меню управления пользовательскими задачами
const showCustomTasksMenu = async (ctx, taskService) => {
  try {
    const telegramId = ctx.from.id;
    
    // Получаем статистику пользовательских задач
    const stats = await taskService.getCustomTasksStats(telegramId);
    
    const menuText = `📚 *Библиотека моих задач*\n\nВ вашей библиотеке ${stats.active} задач:\n\n💚 Простые: ${stats.byDifficulty.easy || 0}\n📈 Средние: ${stats.byDifficulty.standard}\n🔥 Сложные: ${stats.byDifficulty.hard}\n✨ Волшебные: ${stats.byDifficulty.magic}\n\nЗадачи из библиотеки можно добавлять в список на сегодня.`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Создать новую задачу', 'custom_task_create')],
      [Markup.button.callback('📋 Мои задачи на сегодня', 'show_tasks')],
      [Markup.button.callback('📊 Статистика', 'custom_task_stats')],
      [Markup.button.callback('🔙 Главное меню', 'back_to_main')]
    ]);
    
    await sendOrEditMessage(ctx, menuText, keyboard);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in showCustomTasksMenu:', error);
    const errorText = '❌ Произошла ошибка при загрузке меню задач.';
    await sendOrEditMessage(ctx, errorText);
    await ctx.answerCbQuery('Ошибка');
  }
};

// Показать процесс создания задачи - выбор сложности
const showCreateTaskDifficulty = async (ctx) => {
  try {
    const difficultyText = `*Создание новой задачи*\n\nВыберите уровень сложности:\n\n_🔒 Все задачи хранятся только у тебя и никуда не передаются_`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('💚 Простая (5-10 мин)', 'create_task_easy')],
      [Markup.button.callback('💛 Средняя (15-30 мин)', 'create_task_standard')],
      [Markup.button.callback('❤️ Сложная (30-60 мин)', 'create_task_hard')],
      [Markup.button.callback('✨ Магическая (60+ мин)', 'create_task_magic')],
      [Markup.button.callback('🔙 Назад', 'custom_tasks_menu')]
    ]);

    await sendOrEditMessage(ctx, difficultyText, keyboard);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in showCreateTaskDifficulty:', error);
    await ctx.answerCbQuery('Ошибка');
  }
};

// Упрощенная версия - сразу переходим к вводу названия без выбора категории
const showCreateTaskCategory = async (ctx, difficulty) => {
  try {
    // Сразу переходим к созданию задачи с категорией по умолчанию
    await startTaskCreation(ctx, 'personal', difficulty);
  } catch (error) {
    console.error('Error in showCreateTaskCategory:', error);
    await ctx.answerCbQuery('Ошибка');
  }
};

// Начать создание задачи - запросить название
const startTaskCreation = async (ctx, category, difficulty) => {
  try {
    const difficultyLabels = {
      'easy': '💚 Простая',
      'standard': '📈 Средняя',
      'hard': '🔥 Сложная',
      'magic': '✨ Волшебная'
    };
    
    const taskExamples = {
      'easy': [
        "Выпить стакан воды",
        "Сделать 10 приседаний", 
        "Написать СМС другу"
      ],
      'standard': [
        "Прочитать 20 страниц книги",
        "Приготовить завтрак",
        "Ответить на рабочие письма"
      ],
      'hard': [
        "Написать отчет по проекту",
        "Провести уборку в комнате",
        "Изучить новую тему курса"
      ],
      'magic': [
        "Разработать план на месяц",
        "Создать презентацию для клиента",
        "Написать статью в блог"
      ]
    };
    
    // Категории больше не используются
    
    // Сохраняем контекст создания задачи в сессии пользователя
    if (!ctx.session) ctx.session = {};
    ctx.session.creatingTask = {
      category: 'personal',  // Используем категорию "личная" по умолчанию
      difficulty,
      step: 'waiting_title'
    };
    
    // Выбираем случайный пример для данного уровня сложности
    const examples = taskExamples[difficulty];
    if (!examples || examples.length === 0) {
      console.error('No examples found for difficulty:', difficulty);
      await ctx.answerCbQuery('Ошибка при получении примеров');
      return;
    }
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    
    const promptText = `*Создание ${difficultyLabels[difficulty].toLowerCase()} задачи*\n\nНапишите название задачи:\n\n_Пример: "${randomExample}"_`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'custom_tasks_menu')]
    ]);
    
    await sendOrEditMessage(ctx, promptText, keyboard);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in startTaskCreation:', error);
    await ctx.answerCbQuery('Ошибка');
  }
};

// Обработать название задачи и запросить описание
const handleTaskTitle = async (ctx, customTaskService) => {
  try {
    if (!ctx.session?.creatingTask || ctx.session.creatingTask.step !== 'waiting_title') {
      return;
    }
    
    const title = ctx.message.text.trim();
    
    if (title.length < 3) {
      // Используем sendOrEditMessage вместо reply для редактирования
      const errorText = '❌ Название слишком короткое. Минимум 3 символа.\n\nВведите название задачи:';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'custom_tasks_menu')]
      ]);
      await sendOrEditMessage(ctx, errorText, keyboard);
      return;
    }
    
    if (title.length > 100) {
      // Используем sendOrEditMessage вместо reply для редактирования
      const errorText = '❌ Название слишком длинное. Максимум 100 символов.\n\nВведите название задачи:';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'custom_tasks_menu')]
      ]);
      await sendOrEditMessage(ctx, errorText, keyboard);
      return;
    }
    
    // Сохраняем название
    ctx.session.creatingTask.title = title;
    
    // Для всех задач кроме сложных сразу создаем без описания
    const difficulty = ctx.session.creatingTask.difficulty;
    if (difficulty !== 'hard') {
      // Сразу создаем задачу и добавляем в список на сегодня
      const taskData = {
        title: ctx.session.creatingTask.title,
        description: null,
        category: ctx.session.creatingTask.category,
        difficulty: ctx.session.creatingTask.difficulty,
        estimated_time: getEstimatedTime(ctx.session.creatingTask.difficulty)
      };
      
      const { customTask, todayTask } = await customTaskService.createAndAddToToday(ctx.from.id, taskData);
      const createdTask = customTask;
      
      if (createdTask) {
        const successText = `✅ *Задача создана и добавлена на сегодня!*\n\n**${createdTask.title}**\n\n${getDifficultyIcon(createdTask.difficulty)} ${getDifficultyLabel(createdTask.difficulty)}\n⏱️ ~${createdTask.estimated_time} минут`;
        
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📋 Мои задачи на сегодня', 'show_tasks')],
          [Markup.button.callback('➕ Создать ещё', 'custom_task_create')],
          [Markup.button.callback('🔙 В меню', 'show_main_menu')]
        ]);
        
        await sendOrEditMessage(ctx, successText, keyboard);
      } else {
        const errorText = '❌ Произошла ошибка при создании задачи. Попробуйте ещё раз.';
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('🔄 Попробовать снова', 'custom_task_create')],
          [Markup.button.callback('🔙 В меню', 'custom_tasks_menu')]
        ]);
        await sendOrEditMessage(ctx, errorText, keyboard);
      }
      
      // Очищаем сессию
      delete ctx.session.creatingTask;
      return;
    }
    
    // Только для сложных задач запрашиваем описание
    ctx.session.creatingTask.step = 'waiting_description';
    
    const descriptionExamples = {
      'hard': [
        "Включить статистику и выводы",
        "Тщательно, включая труднодоступные места",
        "С конспектированием ключевых моментов"
      ]
    };
    
    // Проверяем, есть ли примеры для данного уровня сложности
    let promptText;
    
    if (difficulty === 'hard' && descriptionExamples[difficulty]) {
      const examples = descriptionExamples[difficulty];
      const randomExample = examples[Math.floor(Math.random() * examples.length)];
      promptText = `*Название:* ${title}\n\nТеперь добавьте описание задачи (или напишите "пропустить"):\n\n_Пример: "${randomExample}"_`;
    } else {
      promptText = `*Название:* ${title}\n\nТеперь добавьте описание задачи (или напишите "пропустить"):`;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('⏭️ Пропустить', 'skip_description')],
      [Markup.button.callback('❌ Отмена', 'custom_tasks_menu')]
    ]);
    
    await sendOrEditMessage(ctx, promptText, keyboard);
  } catch (error) {
    console.error('Error in handleTaskTitle:', error);
    const errorText = '❌ Произошла ошибка. Попробуйте ещё раз.';
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 В меню', 'custom_tasks_menu')]
    ]);
    await sendOrEditMessage(ctx, errorText, keyboard);
  }
};

// Обработать описание задачи и создать её
const handleTaskDescription = async (ctx, customTaskService) => {
  try {
    if (!ctx.session?.creatingTask || ctx.session.creatingTask.step !== 'waiting_description') {
      return;
    }
    
    let description = null;
    if (ctx.message.text.trim().toLowerCase() !== 'пропустить') {
      description = ctx.message.text.trim();
      
      if (description.length > 500) {
        const errorText = '❌ Описание слишком длинное. Максимум 500 символов.\n\nВведите описание задачи:';
        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Пропустить', 'skip_description')],
          [Markup.button.callback('❌ Отмена', 'custom_tasks_menu')]
        ]);
        await sendOrEditMessage(ctx, errorText, keyboard);
        return;
      }
    }
    
    // Создаем задачу и добавляем в список на сегодня
    const taskData = {
      title: ctx.session.creatingTask.title,
      description,
      category: ctx.session.creatingTask.category,
      difficulty: ctx.session.creatingTask.difficulty,
      estimated_time: getEstimatedTime(ctx.session.creatingTask.difficulty)
    };
    
    const { customTask, todayTask } = await customTaskService.createAndAddToToday(ctx.from.id, taskData);
    const createdTask = customTask;
    
    if (createdTask) {
      const successText = `✅ *Задача создана и добавлена на сегодня!*\n\n**${createdTask.title}**\n${createdTask.description ? `\n${createdTask.description}` : ''}\n\n${getDifficultyIcon(createdTask.difficulty)} ${getDifficultyLabel(createdTask.difficulty)}\n⏱️ ~${createdTask.estimated_time} минут`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 Мои задачи на сегодня', 'show_tasks')],
        [Markup.button.callback('➕ Создать ещё', 'custom_task_create')],
        [Markup.button.callback('🔙 В меню', 'show_main_menu')]
      ]);
      
      await sendOrEditMessage(ctx, successText, keyboard);
    } else {
      const errorText = '❌ Произошла ошибка при создании задачи. Попробуйте ещё раз.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Попробовать снова', 'custom_task_create')],
        [Markup.button.callback('🔙 В меню', 'custom_tasks_menu')]
      ]);
      await sendOrEditMessage(ctx, errorText, keyboard);
    }
    
    // Очищаем сессию
    delete ctx.session.creatingTask;
    
  } catch (error) {
    console.error('Error in handleTaskDescription:', error);
    const errorText = '❌ Произошла ошибка при создании задачи.';
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔙 В меню', 'custom_tasks_menu')]
    ]);
    await sendOrEditMessage(ctx, errorText, keyboard);
    delete ctx.session.creatingTask;
  }
};

// Пропустить описание
const skipDescription = async (ctx, taskService) => {
  try {
    if (!ctx.session?.creatingTask) {
      await ctx.answerCbQuery('Ошибка создания задачи');
      return;
    }

    // Создаем задачу без описания и добавляем в список на сегодня
    const taskData = {
      title: ctx.session.creatingTask.title,
      description: null,
      category: ctx.session.creatingTask.category,
      difficulty: ctx.session.creatingTask.difficulty,
      estimated_time: getEstimatedTime(ctx.session.creatingTask.difficulty)
    };

    const customTaskService = taskService.getCustomTaskService();
    const { customTask, todayTask } = await customTaskService.createAndAddToToday(ctx.from.id, taskData);
    const createdTask = customTask;
    
    if (createdTask) {
      const successText = `✅ *Задача создана и добавлена на сегодня!*\n\n**${createdTask.title}**\n\n${getDifficultyIcon(createdTask.difficulty)} ${getDifficultyLabel(createdTask.difficulty)}\n⏱️ ~${createdTask.estimated_time} минут\n\n📋 Задача добавлена в список на сегодня!`;
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📋 К задачам на сегодня', 'show_tasks')],
        [Markup.button.callback('➕ Создать ещё', 'custom_task_create')],
        [Markup.button.callback('🔙 В главное меню', 'show_main_menu')]
      ]);
      
      await sendOrEditMessage(ctx, successText, keyboard);
    } else {
      await sendOrEditMessage(ctx, 'Произошла ошибка при создании задачи. Попробуйте ещё раз.');
    }
    
    // Очищаем сессию
    delete ctx.session.creatingTask;
    await ctx.answerCbQuery('Задача создана!');
    
  } catch (error) {
    console.error('Error in skipDescription:', error);
    await ctx.answerCbQuery('Ошибка при создании задачи');
    delete ctx.session.creatingTask;
  }
};

// Показать список пользовательских задач
const showCustomTasksList = async (ctx, taskService, difficulty = null, page = 1) => {
  try {
    const telegramId = ctx.from.id;
    const filters = difficulty ? { difficulty } : {};
    const tasks = await taskService.getUserCustomTasks(telegramId, filters);
    
    if (tasks.length === 0) {
      const emptyText = difficulty 
        ? `У вас нет ${getDifficultyLabel(difficulty).toLowerCase()} задач.`
        : 'У вас нет пользовательских задач.';
      
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать задачу', 'custom_task_create')],
        [Markup.button.callback('🔙 Назад', 'custom_tasks_menu')]
      ]);
      
      await sendOrEditMessage(ctx, emptyText, keyboard);
      await ctx.answerCbQuery();
      return;
    }
    
    // Пагинация
    const tasksPerPage = 5;
    const totalPages = Math.ceil(tasks.length / tasksPerPage);
    const startIndex = (page - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const currentTasks = tasks.slice(startIndex, endIndex);
    
    let listText = difficulty 
      ? `📋 *${getDifficultyLabel(difficulty)} задачи* (${tasks.length})\n\n`
      : `📋 *Мои задачи* (${tasks.length})\n\n`;
    
    currentTasks.forEach((task, index) => {
      const number = startIndex + index + 1;
      listText += `${number}. **${task.title}**\n`;
      listText += `${getDifficultyIcon(task.difficulty)} ⏱️ ${task.estimated_time}мин\n`;
      if (task.description) {
        listText += `_${task.description.length > 50 ? task.description.substring(0, 50) + '...' : task.description}_\n`;
      }
      listText += '\n';
    });
    
    // Создаем клавиатуру
    const buttons = [];
    
    // Кнопки задач для редактирования
    const taskButtons = currentTasks.map((task, index) => {
      const number = startIndex + index + 1;
      return Markup.button.callback(`${number}`, `edit_task_${task.id}`);
    });
    
    // Разбиваем кнопки задач на ряды по 5
    for (let i = 0; i < taskButtons.length; i += 5) {
      buttons.push(taskButtons.slice(i, i + 5));
    }
    
    // Пагинация
    if (totalPages > 1) {
      const paginationButtons = [];
      if (page > 1) {
        paginationButtons.push(Markup.button.callback('⬅️', `list_tasks_${difficulty || 'all'}_${page - 1}`));
      }
      paginationButtons.push(Markup.button.callback(`${page}/${totalPages}`, 'noop'));
      if (page < totalPages) {
        paginationButtons.push(Markup.button.callback('➡️', `list_tasks_${difficulty || 'all'}_${page + 1}`));
      }
      buttons.push(paginationButtons);
    }
    
    // Фильтры по сложности
    if (!difficulty) {
      buttons.push([
        Markup.button.callback('💚 Простые', 'list_tasks_easy_1'),
        Markup.button.callback('📈 Средние', 'list_tasks_standard_1')
      ]);
      buttons.push([
        Markup.button.callback('🔥 Сложные', 'list_tasks_hard_1'),
        Markup.button.callback('✨ Волшебные', 'list_tasks_magic_1')
      ]);
    } else {
      buttons.push([Markup.button.callback('📋 Все задачи', 'list_tasks_all_1')]);
    }
    
    // Действия
    buttons.push([
      Markup.button.callback('➕ Создать', 'custom_task_create'),
      Markup.button.callback('🔙 Назад', 'custom_tasks_menu')
    ]);
    
    const keyboard = Markup.inlineKeyboard(buttons);
    
    await sendOrEditMessage(ctx, listText, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Error in showCustomTasksList:', error);
    await ctx.answerCbQuery('Ошибка при загрузке задач');
  }
};

// Показать задачу для редактирования
const showTaskForEdit = async (ctx, taskService, taskId) => {
  try {
    const task = await taskService.getCustomTaskService().getCustomTaskById(taskId, ctx.from.id);
    
    if (!task) {
      await ctx.answerCbQuery('Задача не найдена');
      return;
    }
    
    const taskText = `✏️ *Редактирование задачи*\n\n**${task.title}**\n${task.description ? `\n${task.description}\n` : ''}\n${getDifficultyIcon(task.difficulty)} ${getDifficultyLabel(task.difficulty)}\n⏱️ ~${task.estimated_time} минут`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Изменить название', `edit_task_title_${taskId}`)],
      [Markup.button.callback('📝 Изменить описание', `edit_task_desc_${taskId}`)],
      [Markup.button.callback('📊 Изменить сложность', `edit_task_difficulty_${taskId}`)],
      [Markup.button.callback('🗑️ Удалить задачу', `delete_task_${taskId}`)],
      [Markup.button.callback('🔙 К задачам на сегодня', 'show_tasks')]
    ]);
    
    await sendOrEditMessage(ctx, taskText, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Error in showTaskForEdit:', error);
    await ctx.answerCbQuery('Ошибка при загрузке задачи');
  }
};

// Показать статистику пользовательских задач
const showCustomTasksStats = async (ctx, taskService) => {
  try {
    const telegramId = ctx.from.id;
    const stats = await taskService.getCustomTasksStats(telegramId);
    
    const statsText = `📊 *Статистика моих задач*\n\n📋 Всего задач: ${stats.total}\n✅ Активных: ${stats.active}\n\n*По сложности:*\n💚 Простые: ${stats.byDifficulty.easy || 0}\n📈 Средние: ${stats.byDifficulty.standard}\n🔥 Сложные: ${stats.byDifficulty.hard}\n✨ Волшебные: ${stats.byDifficulty.magic}`;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📋 Мои задачи на сегодня', 'show_tasks')],
      [Markup.button.callback('➕ Создать задачу', 'custom_task_create')],
      [Markup.button.callback('🔙 Назад', 'custom_tasks_menu')]
    ]);
    
    await sendOrEditMessage(ctx, statsText, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Error in showCustomTasksStats:', error);
    await ctx.answerCbQuery('Ошибка при загрузке статистики');
  }
};

// Подтверждение удаления задачи
const confirmTaskDeletion = async (ctx, taskId) => {
  try {
    const confirmText = `⚠️ *Подтверждение удаления*\n\nВы уверены, что хотите удалить эту задачу?\n\nЭто действие нельзя отменить.`;
    
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да, удалить', `confirm_delete_${taskId}`),
        Markup.button.callback('❌ Отмена', `edit_task_${taskId}`)
      ]
    ]);
    
    await sendOrEditMessage(ctx, confirmText, keyboard);
    await ctx.answerCbQuery();
    
  } catch (error) {
    console.error('Error in confirmTaskDeletion:', error);
    await ctx.answerCbQuery('Ошибка');
  }
};

// Удалить задачу
const deleteTask = async (ctx, taskService, taskId) => {
  try {
    const result = await taskService.deleteCustomTask(taskId, ctx.from.id);
    
    if (result) {
      await sendOrEditMessage(ctx, '✅ Задача удалена.');
      await ctx.answerCbQuery('Задача удалена');
      
      // Возвращаемся к списку задач через 2 секунды
      setTimeout(async () => {
        try {
          await showCustomTasksList(ctx, taskService);
        } catch (error) {
          console.error('Error returning to task list:', error);
        }
      }, 2000);
    } else {
      await ctx.answerCbQuery('Ошибка при удалении задачи');
    }
    
  } catch (error) {
    console.error('Error in deleteTask:', error);
    await ctx.answerCbQuery('Ошибка при удалении задачи');
  }
};

module.exports = {
  showCustomTasksMenu,
  showCreateTaskDifficulty,
  showCreateTaskCategory,
  startTaskCreation,
  handleTaskTitle,
  handleTaskDescription,
  skipDescription,
  showCustomTasksList,
  showTaskForEdit,
  showCustomTasksStats,
  confirmTaskDeletion,
  deleteTask
};