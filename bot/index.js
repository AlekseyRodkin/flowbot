// bot/index.js
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const winston = require('winston');
const moment = require('moment-timezone');

// Import handlers - исправляем импорты
const startHandler = require('../src/handlers/startHandler');
const { TaskHandler } = require('../src/handlers/taskHandler');
const { statsHandler } = require('../src/handlers/statsHandler');
const { settingsHandler } = require('../src/handlers/settingsHandler');
const { InviteHandler } = require('../src/handlers/inviteHandler');
const customTaskHandler = require('../src/handlers/customTaskHandler');
const { FeedbackHandler } = require('../src/handlers/feedbackHandler');
const { DonationHandler } = require('../src/handlers/donationHandler');

// Import services
const { TaskService } = require('../src/services/taskService');
const { UserService } = require('../src/services/userService');
const { AIService } = require('../src/services/aiService');
const { NotificationService } = require('../src/services/notificationService');
const { ReferralService } = require('../src/services/referralService');
const { CustomTaskService } = require('../src/services/customTaskService');
const { ViralService } = require('../src/services/viralService');
const { FeedbackService } = require('../src/services/feedbackService');

// Import session store
const { supabaseSession } = require('../src/utils/sessionStore');

// Import API server
const { startApiServer } = require('../src/api/server');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Enable session middleware with Supabase storage
bot.use(supabaseSession(supabase));

// Initialize services
const userService = new UserService(supabase);
const taskService = new TaskService(supabase);
const aiService = new AIService();
const notificationService = new NotificationService(bot, supabase, taskService, aiService, userService);
const referralService = new ReferralService(supabase, bot);
const customTaskService = new CustomTaskService(supabase);
const viralService = new ViralService(supabase, bot, referralService);
const feedbackService = new FeedbackService(supabase, bot);

// Initialize handlers
const taskHandler = new TaskHandler(supabase);
const inviteHandler = new InviteHandler(referralService, userService, supabase);
const feedbackHandler = new FeedbackHandler(feedbackService);
const donationHandler = new DonationHandler();

// Middleware для загрузки пользователя
bot.use(async (ctx, next) => {
  if (ctx.from) {
    try {
      // Используем getOrCreateUser для автоматического создания если нужно
      const user = await userService.getOrCreateUser(ctx.from);
      ctx.state.user = user;
      ctx.state.userService = userService;
      ctx.state.taskService = taskService;
    } catch (error) {
      logger.error('Error loading user:', error);
    }
  }
  await next();
});

// Middleware для логирования
bot.use(async (ctx, next) => {
  const start = Date.now();

  // Логируем входящее сообщение
  console.log(`\n📨 Получено: ${ctx.updateType} от @${ctx.from?.username || ctx.from?.id}`);
  if (ctx.message?.text) {
    console.log(`   Команда: ${ctx.message.text}`);
  }
  if (ctx.callbackQuery?.data) {
    console.log(`   Callback: ${ctx.callbackQuery.data}`);
  }

  await next();

  const responseTime = Date.now() - start;
  logger.info(`${ctx.updateType} processed in ${responseTime}ms`);
  console.log(`   ✅ Обработано за ${responseTime}ms`);
});

// Команда /start
bot.start(async (ctx) => {
  const startParam = ctx.message.text.split(' ')[1];
  const user = ctx.state.user;
  
  // Проверяем, есть ли реферальный код
  if (startParam && startParam.startsWith('ref_')) {
    const referralCode = startParam.substring(4);

    // Обрабатываем реферальную регистрацию (передаем user.id, а не telegram_id!)
    const referral = await referralService.processReferral(user.id, referralCode);

    if (referral) {
      await ctx.reply(
        '🎉 Отлично! Ты присоединился по приглашению друга!\n\n' +
        'Используй FlowBot 7 дней подряд (минимум 10 задач в день), ' +
        'и вы оба получите Pro подписку на месяц бесплатно! 🎁',
        { parse_mode: 'Markdown' }
      );
    }
  }
  
  await startHandler.startHandler(ctx, userService);
});

// Команда /reset - сбросить прогресс и начать заново
bot.command('reset', async (ctx) => {
  const resetHandler = require('../src/handlers/resetHandler');
  await resetHandler.resetHandler(ctx);
});

// Команда /task и /tasks - показать задачи на сегодня
bot.command('task', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await taskHandler.showTodayTasks(ctx, taskService, user);
});

bot.command('tasks', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await taskHandler.showTodayTasks(ctx, taskService, user);
});

// Команда /today - сгенерировать и показать задачи на сегодня
bot.command('today', async (ctx) => {
  try {
    // Используем пользователя из middleware
    const user = ctx.state.user;
    
    if (!user) {
      await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
      return;
    }
    
    // Проверяем, есть ли уже задачи на сегодня
    const existingTasks = await taskService.getTodayTasks(user.telegram_id);
    
    if (existingTasks && existingTasks.length > 0) {
      await ctx.reply('У тебя уже есть задачи на сегодня! Используй /task чтобы их увидеть.');
      return;
    }
    
    // Генерируем новые задачи
    await ctx.reply('🌅 Генерирую твой Flow List на сегодня...');
    
    const level = user.level || 1;
    let taskConfig = {};
    
    if (level <= 5) {
      taskConfig = { easy: 30, standard: 0, hard: 0 };
    } else if (level <= 10) {
      taskConfig = { easy: 15, standard: 10, hard: 5 };
    } else {
      taskConfig = { easy: 10, standard: 10, hard: 10 };
    }
    
    // Генерируем задачи через AI
    const tasks = await aiService.generateTasks(taskConfig, {
      level: level,
      preferences: user.preferences || [],
      antiPatterns: user.anti_patterns || []
    });
    
    // Сохраняем задачи
    await taskService.createTasks(user.telegram_id, tasks);
    
    // Показываем задачи
    await taskHandler.showTodayTasks(ctx, taskService, user);
    
  } catch (error) {
    logger.error('Error generating today tasks:', error);
    console.error('❌ Ошибка в /today:', error.message);
    await ctx.reply('Произошла ошибка при генерации задач. Попробуй позже или используй /help');
  }
});

// Команда /stats - показать статистику
bot.command('stats', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await statsHandler.showStats(ctx, user, userService, taskService);
});

// Команда /invite - реферальная программа
bot.command('invite', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await inviteHandler.showInviteMenu(ctx, user);
});

// Команда /referral_stats - статистика рефералов
bot.command('referral_stats', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await inviteHandler.showDetailedStats(ctx, user);
});

// Команда /settings - настройки
bot.command('settings', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await settingsHandler.showSettings(ctx, user);
});

// Команда /mytasks - пользовательские задачи
bot.command('mytasks', async (ctx) => {
  const user = ctx.state.user;
  if (!user) {
    await ctx.reply('Произошла ошибка. Попробуй /start для начала работы.');
    return;
  }
  await customTaskHandler.showCustomTasksMenu(ctx, taskService);
});

// Команда /help - помощь
bot.help(async (ctx) => {
  const helpMessage = `
🎯 *FlowBot - Команды*

📝 *Работа с задачами:*
/task или /tasks - Показать задачи на сегодня
/today - Сгенерировать новые задачи (если еще нет)
/mytasks - Управление своими задачами

📊 *Статистика:*
/stats - Твоя продуктивность
/achievements - Твои достижения

🤝 *Социальное:*
/invite - Пригласить друзей и получить Pro
/referral_stats - Статистика приглашений

⚙️ *Настройки:*
/settings - Время уведомлений
/reset - Сбросить прогресс и начать заново
/start - Перезапустить бота
/help - Это сообщение

💡 *Совет:* Используй /task чтобы начать работу с задачами прямо сейчас!

*Как использовать:*
1. Получай 30 задач каждое утро
2. Отмечай выполненные ✅
3. Следи за прогрессом
4. Входи в поток за 15 дней!

Есть вопросы? @flowbot_support
  `;
  await ctx.replyWithMarkdown(helpMessage);
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  // Проверяем, ожидается ли отзыв от пользователя
  if (ctx.session?.awaitingFeedback) {
    await feedbackHandler.handleFeedbackMessage(ctx, feedbackService, userService);
    return;
  }

  // Проверяем, ожидается ли ответ админа на отзыв
  if (ctx.session?.adminReplyTo) {
    try {
      const replyText = ctx.message.text;
      const { feedbackId, userId } = ctx.session.adminReplyTo;

      // Отправляем ответ пользователю
      await bot.telegram.sendMessage(userId, `💬 *Ответ от команды FlowBot:*\n\n${replyText}`, {
        parse_mode: 'Markdown'
      });

      // Очищаем сессию
      delete ctx.session.adminReplyTo;

      await ctx.reply('✅ Ответ отправлен пользователю!', {
        reply_markup: { remove_keyboard: true }
      });

      console.log(`✅ Admin replied to feedback #${feedbackId}, user ${userId}`);
    } catch (error) {
      console.error('Error sending admin reply:', error);
      await ctx.reply('❌ Ошибка отправки ответа');
    }
    return;
  }

  // Проверяем, находится ли пользователь в процессе создания задачи
  if (ctx.session?.creatingTask) {
    if (ctx.session.creatingTask.step === 'waiting_title') {
      await customTaskHandler.handleTaskTitle(ctx, customTaskService);
    } else if (ctx.session.creatingTask.step === 'waiting_description') {
      await customTaskHandler.handleTaskDescription(ctx, customTaskService);
    }
  }

  // Проверяем, ожидается ли ввод имени шаблона
  if (ctx.session?.awaitingTemplateName) {
    await templateHandler.handleTemplateNameInput(ctx, taskService);
  }

  // Проверяем, ожидается ли ввод текста для замены задачи
  if (ctx.session?.waitingFor === 'replace_task_text' && ctx.session?.replacingTaskId) {
    const newText = ctx.message.text;
    const taskId = ctx.session.replacingTaskId;

    try {
      // Обновляем текст задачи
      await taskService.updateTaskText(taskId, newText);

      await ctx.reply(
        '✅ *Задача успешно обновлена!*\n\nНовый текст сохранен.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 К списку задач', callback_data: 'show_tasks' }
            ]]
          }
        }
      );

      // Очищаем состояние сессии
      delete ctx.session.waitingFor;
      delete ctx.session.replacingTaskId;

    } catch (error) {
      console.error('Error updating task:', error);
      await ctx.reply('❌ Ошибка при обновлении задачи. Попробуйте еще раз.');
    }
  }
});

// Обработка голосовых сообщений (временно отключено)
bot.on('voice', async (ctx) => {
  try {
    console.log('🎤 Voice message received from:', ctx.from.username || ctx.from.id);
    
    await ctx.replyWithMarkdown(`🎤 *Голосовые сообщения*

Спасибо за голосовое сообщение! 

В будущем планируется добавить ИИ-коуча, который будет отвечать на твои голосовые сообщения персональными советами по продуктивности.

🚀 *Пока что используй:*
• Текстовые команды: /help, /task, /stats
• Кнопки в меню для быстрой навигации
• Добавление своих задач через "🎯 Мои задачи"

💡 Голосовой коуч появится в премиум-версии!`);

  } catch (error) {
    console.error('❌ Error processing voice message:', error);
    await ctx.reply('Произошла ошибка при обработке сообщения.');
  }
});

// Обработка callback queries (нажатия на кнопки)
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const [action, ...params] = data.split('_');
  console.log(`🔍 CALLBACK: data='${data}', action='${action}', params=${JSON.stringify(params)}`);

  switch(action) {
    case 'task':
      // Обработка отметки выполнения задачи
      await taskHandler.completeTask(ctx, taskService, params[0]);

      // Проверяем триггеры на 7-й и 14-й день в фоне (не блокируем UI)
      setImmediate(() => {
        const user = ctx.state.user;
        if (user) {
          viralService.checkAndSendDay7Trigger(user.telegram_id)
            .catch(err => console.error('Error checking day 7 trigger:', err));
          viralService.checkAndSendDay14Reminder(user.telegram_id)
            .catch(err => console.error('Error checking day 14 reminder:', err));
        }
      });
      break;
    
    case 'tasks':
      // Обработка команд для задач
      if (params[0] === 'page') {
        // Обработка пагинации
        if (params[1] === 'next') {
          // Переход на следующую страницу
          if (ctx.session.tasksPage === undefined) ctx.session.tasksPage = 0;
          ctx.session.tasksPage++;
          await taskHandler.updateTaskMessage(ctx, taskService, ctx.from.id);
          await ctx.answerCbQuery();
        } else if (params[1] === 'prev') {
          // Переход на предыдущую страницу
          if (ctx.session.tasksPage === undefined) ctx.session.tasksPage = 0;
          ctx.session.tasksPage = Math.max(0, ctx.session.tasksPage - 1);
          await taskHandler.updateTaskMessage(ctx, taskService, ctx.from.id);
          await ctx.answerCbQuery();
        } else if (params[1] === 'info') {
          // Информация о страницах
          await ctx.answerCbQuery('Используйте кнопки навигации для перехода между страницами');
        }
      }
      break;
    
    case 'replace':
      // Обработка пагинации для меню замены задач
      if (params[0] === 'page') {
        const user = ctx.state.user;
        // Инициализируем сессию, если не существует
        if (!ctx.session) {
          ctx.session = {};
        }
        if (params[1] === 'next') {
          // Переход на следующую страницу
          if (ctx.session.replaceTaskPage === undefined) ctx.session.replaceTaskPage = 0;
          ctx.session.replaceTaskPage++;
          await taskHandler.showReplaceTaskMenu(ctx, taskService, user.id, ctx.session.replaceTaskPage);
          await ctx.answerCbQuery();
        } else if (params[1] === 'prev') {
          // Переход на предыдущую страницу
          if (ctx.session.replaceTaskPage === undefined) ctx.session.replaceTaskPage = 0;
          ctx.session.replaceTaskPage = Math.max(0, ctx.session.replaceTaskPage - 1);
          await taskHandler.showReplaceTaskMenu(ctx, taskService, user.id, ctx.session.replaceTaskPage);
          await ctx.answerCbQuery();
        }
      } else if (params[0] === 'task' && params[1]) {
        // Обработка выбора задачи для замены
        const taskId = params[1];
        const user = ctx.state.user;
        // Инициализируем сессию, если не существует
        if (!ctx.session) {
          ctx.session = {};
        }
        ctx.session.replacingTaskId = taskId;
        
        await ctx.editMessageText(
          '✏️ *Введите новый текст задачи:*\n\nОтправьте новый текст для замены выбранной задачи.',
          { parse_mode: 'Markdown' }
        );
        
        // Устанавливаем режим ожидания текста для замены
        ctx.session.waitingFor = 'replace_task_text';
        await ctx.answerCbQuery();
      }
      break;
    
    case 'show':
      // Обработка показа разделов из главного меню
      switch(params[0]) {
        case 'tasks':
          await taskHandler.showTodayTasks(ctx, taskService, ctx.state.user, true);
          break;
        case 'stats':
          await statsHandler.showStats(ctx, ctx.state.user, userService, taskService);
          break;
        case 'daily':
          // Обработка показа дневной статистики
          if (params[1] === 'stats') {
            await statsHandler.showStats(ctx, ctx.state.user, userService, taskService);
          }
          break;
        case 'settings':
          await settingsHandler.showSettings(ctx, ctx.state.user);
          break;
        case 'feedback':
          await feedbackHandler.showFeedbackMenu(ctx);
          break;
        case 'main':
          // Обработка show_main_menu
          if (params[1] === 'menu') {
            try {
              console.log('🏠 Показываем главное меню для пользователя:', ctx.state.user?.telegram_id);
              const user = ctx.state.user;
              await startHandler.sendMainMenu(ctx, user, true, taskService);
              await ctx.answerCbQuery('Главное меню');
            } catch (error) {
              console.error('❌ Ошибка главного меню:', error.message, error.stack);
              await ctx.answerCbQuery('Ошибка');
            }
          }
          break;
        case 'help':
          const helpMessage = `🎯 *FlowBot - Команды*

📝 *Работа с задачами:*
/task или /tasks - Показать задачи на сегодня
/today - Сгенерировать новые задачи

📊 *Статистика и прогресс:*
/stats - Твоя статистика продуктивности
/achievements - Твои достижения

⚙️ *Настройки:*
/settings - Изменить настройки времени
/reset - Начать программу заново

🔒 *Приватность и данные:*
• Все задачи хранятся только у тебя
• Мы не читаем содержимое задач
• Никакой рекламы и продажи данных
• Можешь удалить всё в любой момент

💡 *Другое:*
/invite - Пригласить друзей (Pro бесплатно!)
/help - Это сообщение

🔄 *Быстрый старт:*
Отправь /today чтобы получить задачи прямо сейчас!`;

          const helpKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('◀️ Назад', 'back_to_menu')]
          ]);

          await ctx.editMessageText(helpMessage, {
            parse_mode: 'Markdown',
            ...helpKeyboard
          });
          break;
        case 'donation':
          // Показать варианты донатов
          await donationHandler.showDonationOptions(ctx, false);
          await ctx.answerCbQuery();
          break;
      }
      break;

    case 'complete':
      // Завершить день
      if (params[0] === 'day') {
        try {
          const user = ctx.state.user;
          const { g } = require('../src/utils/genderUtils');

          await ctx.answerCbQuery('День завершён!');

          // Проверяем, это 15-й день?
          if (user.level === 15) {
            // Специальное поздравление с предложением донатить
            const congratsMessage = `🎉🎉🎉 *ПОЗДРАВЛЯЕМ!* 🎉🎉🎉\n\n` +
              `Ты ${g(user, 'прошёл', 'прошла')} ВСЮ программу FlowBot!\n\n` +
              `*15 дней дисциплины и развития!*\n\n` +
              `━━━━━━━━━━━━━━━\n\n` +
              `Ты ${g(user, 'стал', 'стала')} лучше благодаря:\n` +
              `• Своим усилиям и упорству 💪\n` +
              `• Ежедневной работе над собой 🎯\n` +
              `• Нашей поддержке и методологии ✨\n\n` +
              `━━━━━━━━━━━━━━━\n\n` +
              `*Теперь ты знаешь, как входить в состояние потока!*\n\n` +
              `Можешь продолжать использовать бота дальше или сделать перерыв.\n\n` +
              `💝 *Если FlowBot ${g(user, 'помог', 'помогла')} тебе - поддержи проект!*\n` +
              `Это поможет нам стать лучше и помогать другим людям.`;

            const keyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback('💝 Поддержать проект', 'donation_show')
              ],
              [
                Markup.button.callback('📊 Моя статистика', 'show_stats')
              ],
              [
                Markup.button.callback('🏠 Главное меню', 'show_main_menu')
              ]
            ]);

            await ctx.editMessageText(congratsMessage, {
              parse_mode: 'Markdown',
              reply_markup: keyboard.reply_markup
            });
          } else {
            // Обычное завершение дня
            const completeMessage = `✅ *День завершён!*\n\n` +
              `Отличная работа! ${g(user, 'Отдохни', 'Отдохни')} и готовься к новому дню.\n\n` +
              `📅 Завтра день ${user.level}`;

            const keyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback('📊 Статистика', 'show_stats')
              ],
              [
                Markup.button.callback('🏠 Главное меню', 'show_main_menu')
              ]
            ]);

            await ctx.editMessageText(completeMessage, {
              parse_mode: 'Markdown',
              reply_markup: keyboard.reply_markup
            });
          }

          // Level увеличивается ТОЛЬКО при отправке утренних задач (notificationService.js)

        } catch (error) {
          console.error('Error completing day:', error);
          await ctx.answerCbQuery('Ошибка завершения дня');
        }
      }
      break;

    case 'donation':
      // Обработка донатов
      switch(params[0]) {
        case 'show':
          await donationHandler.showDonationOptions(ctx, true);
          await ctx.answerCbQuery();
          break;
        case 'sbp':
          await donationHandler.showSBPDetails(ctx);
          await ctx.answerCbQuery();
          break;
        case 'boosty':
          await donationHandler.showBoostyDetails(ctx);
          await ctx.answerCbQuery();
          break;
        case 'card':
          await donationHandler.showCardDetails(ctx);
          break;
        case 'thanks':
          await donationHandler.showThankYou(ctx);
          await ctx.answerCbQuery('Спасибо! ❤️');
          break;
      }
      break;

    case 'reset':
      // Сброс прогресса
      if (params[0] === 'progress') {
        await startHandler.resetProgress(ctx, userService);
      }
      break;

    
    
    
    case 'morning':
      // Установка времени утренних задач
      await settingsHandler.setMorningTime(ctx, userService, params[0]);
      break;

    case 'evening':
      // Установка времени вечерней рефлексии
      await settingsHandler.setEveningTime(ctx, userService, params[0]);
      break;
    
    case 'level':
      // Установка уровня сложности
      await startHandler.setUserLevel(ctx, userService, params[0]);
      break;
    
    case 'mood':
      // Сохранение настроения
      await statsHandler.saveMood(ctx, params[0]);
      break;

    case 'stats':
      // Обработка кнопок статистики
      if (params[0] === 'weekly') {
        await statsHandler.showDetailedStats(ctx, 'weekly');
        await ctx.answerCbQuery();
      } else if (params[0] === 'monthly') {
        await statsHandler.showDetailedStats(ctx, 'monthly');
        await ctx.answerCbQuery();
      } else if (params[0] === 'achievements') {
        await statsHandler.showAchievements(ctx);
        await ctx.answerCbQuery();
      }
      break;

    case 'tz':
      // Установка часового пояса
      await settingsHandler.setTimezone(ctx, userService, params[0]);
      break;

    case 'lang':
      // Изменение языка
      await settingsHandler.changeLanguage(ctx, userService, params[0]);
      break;

    case 'cancel':
      // Отмена сброса
      console.log(`🔍 CANCEL HANDLER: action='cancel', params=${JSON.stringify(params)}`);
      if (params[0] === 'reset') {
        try {
          await ctx.answerCbQuery('Сброс отменен');
          console.log('🔄 Отменяем сброс прогресса, показываем настройки');
          
          // Используем editMessageText для изменения существующего сообщения
          const user = ctx.state.user;
          const message = `⚙️ *Настройки*\n\n` +
            `🌅 Утренние задачи: ${user.morning_hour || 8}:00\n` +
            `🌙 Вечерняя рефлексия: ${user.evening_hour || 21}:00\n` +
            `🌍 Часовой пояс: ${user.timezone || 'Europe/Moscow'}\n` +
            `🌐 Язык: ${user.language === 'ru' ? 'Русский' : 'English'}\n` +
            `💎 Подписка: ${user.subscription_type === 'pro' ? 'Pro' : 'Бесплатная'}\n` +
            `📅 День программы: ${user.level <= 15 ? `${user.level}/15` : `${user.level} (ты в потоке! 🎉)`}\n\n` +
            `Что хочешь изменить?`;

          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🌅 Время утренних задач', 'settings_morning'),
              Markup.button.callback('🌙 Время рефлексии', 'settings_evening')
            ],
            [
              Markup.button.callback('🌍 Часовой пояс', 'settings_timezone'),
              Markup.button.callback('🌐 Язык', 'settings_language')
            ],
            [
              Markup.button.callback('🔔 Уведомления', 'settings_notifications'),
              Markup.button.callback('💎 Подписка', 'settings_subscription')
            ],
            [
              Markup.button.callback('🔄 Сбросить прогресс', 'settings_reset'),
              Markup.button.callback('❌ Удалить аккаунт', 'settings_delete')
            ],
            [
              Markup.button.callback('◀️ Назад', 'back_to_menu')
            ]
          ]);

          await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
          
        } catch (error) {
          console.error('❌ Ошибка отмены сброса:', error.message);
          await ctx.answerCbQuery('Ошибка отмены');
        }
      } else if (params[0] === 'delete') {
        try {
          await ctx.answerCbQuery('Удаление отменено');
          console.log('🔄 Отменяем удаление аккаунта, показываем настройки');
          
          // Используем editMessageText для изменения существующего сообщения
          const user = ctx.state.user;
          const message = `⚙️ *Настройки*\n\n` +
            `🌅 Утренние задачи: ${user.morning_hour || 8}:00\n` +
            `🌙 Вечерняя рефлексия: ${user.evening_hour || 21}:00\n` +
            `🌍 Часовой пояс: ${user.timezone || 'Europe/Moscow'}\n` +
            `🌐 Язык: ${user.language === 'ru' ? 'Русский' : 'English'}\n` +
            `💎 Подписка: ${user.subscription_type === 'pro' ? 'Pro' : 'Бесплатная'}\n` +
            `📅 День программы: ${user.level <= 15 ? `${user.level}/15` : `${user.level} (ты в потоке! 🎉)`}\n\n` +
            `Что хочешь изменить?`;

          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🌅 Время утренних задач', 'settings_morning'),
              Markup.button.callback('🌙 Время рефлексии', 'settings_evening')
            ],
            [
              Markup.button.callback('🌍 Часовой пояс', 'settings_timezone'),
              Markup.button.callback('🌐 Язык', 'settings_language')
            ],
            [
              Markup.button.callback('🔔 Уведомления', 'settings_notifications'),
              Markup.button.callback('💎 Подписка', 'settings_subscription')
            ],
            [
              Markup.button.callback('🔄 Сбросить прогресс', 'settings_reset'),
              Markup.button.callback('❌ Удалить аккаунт', 'settings_delete')
            ],
            [
              Markup.button.callback('◀️ Назад', 'back_to_menu')
            ]
          ]);

          await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            ...keyboard
          });
          
        } catch (error) {
          console.error('❌ Ошибка отмены удаления:', error.message);
          await ctx.answerCbQuery('Ошибка отмены');
        }
      } else {
        const resetHandler = require('../src/handlers/resetHandler');
        await resetHandler.cancelReset(ctx);
      }
      break;
    
    case 'refresh':
      if (params[0] === 'confirmation') {
        try {
          await taskHandler.showRefreshWarning(ctx);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа предупреждения:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'tasks') {
        try {
          const user = ctx.state.user;
          
          await taskService.deleteTodayTasks(user.telegram_id);
          await ctx.answerCbQuery('🔄 Генерирую новые задачи...');
          
          const level = user.level || 1;
          let taskConfig = {};
          
          if (level <= 5) {
            taskConfig = { easy: 30, standard: 0, hard: 0 };
          } else if (level <= 10) {
            taskConfig = { easy: 15, standard: 10, hard: 5 };
          } else {
            taskConfig = { easy: 10, standard: 10, hard: 10 };
          }
          
          const tasks = await aiService.generateTasks(taskConfig, {
            level: level,
            preferences: user.preferences || [],
            antiPatterns: user.anti_patterns || []
          });
          
          await taskService.createTasks(user.telegram_id, tasks);
          await taskHandler.showTodayTasks(ctx, taskService, user, true);
          
        } catch (error) {
          console.error('❌ Ошибка обновления задач:', error.message);
          await ctx.answerCbQuery('Ошибка обновления задач');
        }
      }
      break;
      
      
    case 'cancel_refresh':
      // Отмена обновления - вернуться к списку задач
      try {
        const user = ctx.state.user;
        await taskHandler.showTodayTasks(ctx, taskService, user, true);
        await ctx.answerCbQuery('Отменено');
      } catch (error) {
        console.error('❌ Ошибка отмены обновления:', error.message);
        await ctx.answerCbQuery('Ошибка');
      }
      break;
    
    case 'settings':
      // Обработка настроек
      if (params[0] === 'done') {
        // Кнопка "Готово" - возвращаемся в главное меню
        try {
          const user = ctx.state.user;
          await ctx.answerCbQuery('Настройки сохранены');
          await startHandler.sendMainMenu(ctx, user, true, taskService);
        } catch (error) {
          console.error('Error returning to menu from settings:', error);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'morning') {
        // Показать выбор времени утренних задач
        await ctx.answerCbQuery();
        await settingsHandler.showMorningTimeSelection(ctx, ctx.state.user);
      } else if (params[0] === 'evening') {
        // Показать выбор времени вечерней рефлексии
        await ctx.answerCbQuery();
        await settingsHandler.showEveningTimeSelection(ctx, ctx.state.user);
      } else if (params[0] === 'timezone') {
        // Показать выбор часового пояса
        await ctx.answerCbQuery();
        await settingsHandler.showTimezoneSettings(ctx);
      } else if (params[0] === 'language') {
        // Показать выбор языка
        await ctx.answerCbQuery();
        await settingsHandler.showLanguageSettings(ctx);
      } else if (params[0] === 'reset') {
        // Сброс прогресса
        try {
          await ctx.answerCbQuery('Подтверди сброс прогресса');

          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Да, сбросить всё', 'confirm_reset'),
              Markup.button.callback('❌ Отмена', 'cancel_reset')
            ]
          ]);

          await ctx.editMessageText(
            '⚠️ *Сброс прогресса*\n\n' +
            'Это действие удалит:\n' +
            '• Все выполненные задачи\n' +
            '• Статистику и стрики\n' +
            '• Достижения\n' +
            '• Настройки\n\n' +
            'Ты начнешь программу с 1 дня.\n\n' +
            '*Это действие нельзя отменить!*',
            {
              parse_mode: 'Markdown',
              ...keyboard
            }
          );

        } catch (error) {
          console.error('❌ Ошибка сброса настроек:', error.message);
          await ctx.answerCbQuery('Ошибка сброса настроек');
        }
      } else if (params[0] === 'delete') {
        // Удаление аккаунта
        try {
          await ctx.answerCbQuery('Подтверди удаление аккаунта');

          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🗑️ Да, удалить аккаунт', 'confirm_delete'),
              Markup.button.callback('❌ Отмена', 'cancel_delete')
            ]
          ]);

          await ctx.editMessageText(
            '🗑️ *Удаление аккаунта*\n\n' +
            'Это действие *ПОЛНОСТЬЮ УДАЛИТ* твой аккаунт:\n' +
            '• Все данные\n' +
            '• Весь прогресс\n' +
            '• Всю статистику\n' +
            '• Все настройки\n\n' +
            '*Восстановить данные будет НЕВОЗМОЖНО!*',
            {
              parse_mode: 'Markdown',
              ...keyboard
            }
          );

        } catch (error) {
          console.error('❌ Ошибка удаления аккаунта:', error.message);
          await ctx.answerCbQuery('Ошибка удаления аккаунта');
        }
      }
      break;

    case 'share':
    case 'invite':
    case 'referral':
      // Обработка реферальных действий
      ctx.session = { user: ctx.state.user };
      // Создаём ctx.match для совместимости с handleCallback
      ctx.match = [data];
      await inviteHandler.handleCallback(ctx);
      break;

    // Обработка пользовательских задач
    case 'custom':
      if (params[0] === 'tasks' && params[1] === 'menu') {
        await customTaskHandler.showCustomTasksMenu(ctx, taskService);
      } else if (params[0] === 'task') {
        switch (params[1]) {
          case 'create':
            await customTaskHandler.showCreateTaskDifficulty(ctx);
            break;
          case 'list':
            await customTaskHandler.showCustomTasksList(ctx, taskService);
            break;
          case 'stats':
            await customTaskHandler.showCustomTasksStats(ctx, taskService);
            break;
        }
      }
      break;

    case 'create':
      if (params[0] === 'task') {
        if (params[1] === 'easy' || params[1] === 'standard' || params[1] === 'hard' || params[1] === 'magic') {
          await customTaskHandler.showCreateTaskCategory(ctx, params[1]);
        } else if (params[1] === 'cat') {
          const category = params[2];
          const difficulty = params[3];
          await customTaskHandler.startTaskCreation(ctx, category, difficulty);
        }
      }
      break;

    case 'list':
      if (params[0] === 'tasks') {
        const difficulty = params[1] === 'all' ? null : params[1];
        const page = parseInt(params[2]) || 1;
        await customTaskHandler.showCustomTasksList(ctx, taskService, difficulty, page);
      }
      break;


    case 'delete':
      if (params[0] === 'task') {
        const taskId = params[1];
        await customTaskHandler.confirmTaskDeletion(ctx, taskId);
      }
      break;

    case 'confirm':
      // Обработка подтверждений
      console.log(`🔍 CONFIRM HANDLER: action='confirm', params=${JSON.stringify(params)}`);
      if (params[0] === 'reset') {
        console.log('🔄 Executing reset confirmation');
        await startHandler.confirmReset(ctx, userService, taskService);
      } else if (params[0] === 'delete') {
        if (params[1]) {
          // Удаление задачи
          const taskId = params[1];
          await customTaskHandler.deleteTask(ctx, taskService, taskId);
        } else {
          // Удаление аккаунта
          try {
            console.log('🗑️ Подтверждение удаления аккаунта для пользователя:', ctx.from.id);
            const user = ctx.state.user;

            await taskService.deleteAllUserTasks(user.telegram_id);
            await userService.deleteUser(user.telegram_id);

            await ctx.answerCbQuery('🗑️ Аккаунт удален');
            await ctx.editMessageText(
              '🗑️ *Аккаунт полностью удален*\n\n' +
              'Все твои данные удалены из системы.\n\n' +
              'Спасибо, что использовал FlowBot! 👋',
              { parse_mode: 'Markdown' }
            );
          } catch (error) {
            console.error('❌ Ошибка удаления аккаунта:', error.message);
            await ctx.answerCbQuery('Ошибка удаления аккаунта');
          }
        }
      } else if (params[0] === 'bulk') {
        // Обработка массовых операций
        const user = ctx.state.user;
        try {
          if (params[1] === 'complete' && params[2] === 'all') {
            await taskService.bulkCompleteAllTasks(user.telegram_id);
            await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);
            await ctx.answerCbQuery('✅ Все задачи отмечены как выполненные!');
          } else if (params[1] === 'uncomplete' && params[2] === 'all') {
            await taskService.bulkUncompleteAllTasks(user.telegram_id);
            await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);
            await ctx.answerCbQuery('⬜ Отметки сняты со всех задач!');
          } else if (params[1] === 'delete' && params[2] === 'completed') {
            const deleted = await taskService.bulkDeleteCompletedTasks(user.telegram_id);
            await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);
            await ctx.answerCbQuery(`🗑️ Удалено ${deleted.length} выполненных задач!`);
          } else if (params[1] === 'shuffle' && params[2] === 'tasks') {
            await taskService.shuffleTasksOrder(user.telegram_id);
            await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);
            await ctx.answerCbQuery('🔄 Порядок задач перемешан!');
          }
        } catch (error) {
          console.error('❌ Ошибка массового действия:', error.message);
          await ctx.answerCbQuery('Ошибка выполнения действия');
        }
      } else {
        console.log('⚠️ Неизвестный параметр confirm:', params[0]);
      }
      break;

    case 'skip':
      if (params[0] === 'description') {
        await customTaskHandler.skipDescription(ctx, taskService);
      }
      break;

      
    case 'mode':
      // Обработка выбора режима создания задач
      if (params[0] === 'ai' && params[1] === 'generate') {
        // Режим: бот генерирует задачи
        try {
          const user = ctx.state.user;
          await ctx.answerCbQuery('🤖 Генерирую задачи...');
          
          // Генерируем задачи как обычно
          const level = user.level || 1;
          let taskConfig = {};

          // Этап 1 (Дни 1-5): Easy - 30 очень простых дел
          // Этап 2 (Дни 6-10): Standard - 20 простых + 10 стандартных (БЕЗ сложных!)
          // Этап 3 (Дни 11-15+): Hard - 10 простых + 12 стандартных + 8 сложных
          if (level <= 5) {
            taskConfig = { easy: 30, standard: 0, hard: 0 };
          } else if (level <= 10) {
            taskConfig = { easy: 20, standard: 10, hard: 0 };
          } else {
            taskConfig = { easy: 10, standard: 12, hard: 8 };
          }
          
          const tasks = await aiService.generateTasks(taskConfig, {
            level: level,
            preferences: user.preferences || [],
            antiPatterns: user.anti_patterns || []
          });
          
          await taskService.createTasks(user.telegram_id, tasks);
          await taskHandler.showTodayTasks(ctx, taskService, user, true);
          
        } catch (error) {
          console.error('❌ Ошибка генерации задач:', error.message);
          await ctx.answerCbQuery('Ошибка генерации задач');
        }
      } else if (params[0] === 'manual' && params[1] === 'create') {
        // Режим: пользователь создает вручную
        try {
          const user = ctx.state.user;

          // Получаем реальное количество активных дней из статистики
          let currentDay = user.level || 1;
          try {
            const stats = await userService.getUserStats(user.telegram_id);
            if (stats && stats.totalDays !== undefined) {
              currentDay = stats.totalDays || 1;
            }
          } catch (error) {
            console.error('Error getting user stats for manual mode:', error);
          }

          // Определяем состав задач на основе дня программы
          let requiredTasks = {};
          // Этап 1 (Дни 1-5): Easy - 30 очень простых дел
          // Этап 2 (Дни 6-10): Standard - 20 простых + 10 стандартных (БЕЗ сложных!)
          // Этап 3 (Дни 11-15+): Hard - 10 простых + 12 стандартных + 8 сложных
          if (currentDay <= 5) {
            requiredTasks = { easy: 30, standard: 0, hard: 0 };
          } else if (currentDay <= 10) {
            requiredTasks = { easy: 20, standard: 10, hard: 0 };
          } else {
            requiredTasks = { easy: 10, standard: 12, hard: 8 };
          }

          let message = `✏️ *Ручное создание списка задач*\n\n`;
          if (currentDay <= 15) {
            message += `День ${currentDay} из 15\n\n`;
          } else {
            message += `День ${currentDay} (ты в потоке! 🎉)\n\n`;
          }
          message += `Вам нужно создать:\n`;
          message += `💚 Простые задачи: ${requiredTasks.easy}\n`;
          message += `💛 Средние задачи: ${requiredTasks.standard}\n`;
          message += `❤️ Сложные задачи: ${requiredTasks.hard}\n`;
          message += `✨ Магическая задача: 1\n\n`;
          message += `Выберите тип задач для добавления:`;

          await ctx.editMessageText(message, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('💚 Добавить простую', 'manual_add_easy')],
              [Markup.button.callback('💛 Добавить среднюю', 'manual_add_standard')],
              [Markup.button.callback('❤️ Добавить сложную', 'manual_add_hard')],
              [Markup.button.callback('✨ Добавить магическую', 'manual_add_magic')],
              [Markup.button.callback('✅ Завершить создание', 'manual_finish')],
              [Markup.button.callback('↩️ Назад в меню', 'show_main_menu')]
            ]).reply_markup
          });
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка ручного режима:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'use' && params[1] === 'template') {
        // Режим: использовать шаблон
        try {
          await templateHandler.showTemplatesMenu(ctx);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка шаблонов:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;
      
    // УДАЛЕНО: старый обработчик manual - используется новый обработчик ниже в строке 955
    // case 'manual':
    //   break;
      
    case 'replace':
      // Заменить конкретную задачу
      if (params[0] === 'task' && params[1]) {
        try {
          const taskId = parseInt(params[1]);
          const user = ctx.state.user;
          
          // Получаем случайную задачу из той же категории
          const task = await taskService.getTaskById(taskId);
          if (!task) {
            await ctx.answerCbQuery('Задача не найдена', true);
            return;
          }
          
          // Генерируем новую задачу того же типа
          const newTasks = await aiService.generateTasks(
            { [task.task_type]: 1 }, 
            {
              level: user.level || 1,
              preferences: user.preferences || [],
              antiPatterns: user.anti_patterns || []
            }
          );
          
          if (newTasks.length === 0) {
            await ctx.answerCbQuery('Не удалось сгенерировать новую задачу', true);
            return;
          }
          
          // Заменяем задачу
          await taskService.replaceTask(taskId, newTasks[0]);
          await ctx.answerCbQuery('✅ Задача заменена!');
          
          // Показываем обновленный список
          await taskHandler.showTodayTasks(ctx, taskService, user, true);
          
        } catch (error) {
          console.error('❌ Ошибка замены задачи:', error.message);
          await ctx.answerCbQuery('Ошибка замены задачи', true);
        }
      }
      break;

    // Обработчики для задач
    case 'back':
      if (params[0] === 'to' && params[1] === 'tasks') {
        try {
          const user = ctx.state.user;
          await taskHandler.showTodayTasks(ctx, taskService, user, true);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка возврата к задачам:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'to' && params[1] === 'menu') {
        try {
          const user = ctx.state.user;
          await startHandler.sendMainMenu(ctx, user, true, taskService);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка возврата к меню:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'to' && params[1] === 'main') {
        try {
          const user = ctx.state.user;
          await startHandler.sendMainMenu(ctx, user, true, taskService);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка возврата в меню:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'manual':
      // Обработка добавления пользовательских задач
      if (params[0] === 'add') {
        const difficulty = params[1]; // easy, standard, hard, magic
        try {
          // Запускаем процесс создания задачи с выбранной сложностью
          await customTaskHandler.showCreateTaskCategory(ctx, difficulty);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка при добавлении задачи:', error.message);
          await ctx.answerCbQuery('Ошибка при добавлении задачи');
        }
      } else if (params[0] === 'finish') {
        try {
          // Завершаем создание задач и показываем список
          await taskHandler.showTaskList(ctx, taskService, ctx.state.user?.telegram_id);
          await ctx.answerCbQuery('Задачи созданы!');
        } catch (error) {
          console.error('❌ Ошибка при завершении:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'edit':
      if (params[0] === 'list' && params[1] === 'menu') {
        try {
          await taskHandler.showEditListMenu(ctx);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню редактирования:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'replace' && params[1] === 'menu') {
        try {
          const user = ctx.state.user;
          if (!ctx.session) ctx.session = {};
          ctx.session.replaceTaskPage = 0;
          await taskHandler.showReplaceTaskMenu(ctx, taskService, user.id, 0);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню замены:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'add' && params[1] === 'custom') {
        try {
          await customTaskHandler.showCreateTaskDifficulty(ctx);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка добавления задачи:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'delete' && params[1] === 'menu') {
        try {
          const user = ctx.state.user;
          await taskHandler.showDeleteTaskMenu(ctx, taskService, user.telegram_id);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню удаления:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'task' && params[1] === 'menu') {
        // Показать список задач для редактирования
        try {
          const user = ctx.state.user;
          if (!ctx.session) ctx.session = {};
          ctx.session.replaceTaskPage = 0;
          await taskHandler.showReplaceTaskMenu(ctx, taskService, user.id, 0);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа меню редактирования:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'task' && params[1]) {
        // Обработка edit_task_${taskId} для редактирования пользовательских задач
        try {
          const taskId = params[1];
          await customTaskHandler.showTaskForEdit(ctx, taskService, taskId);
        } catch (error) {
          console.error('❌ Ошибка редактирования задачи:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'bulk' && params[1] === 'menu') {
        try {
          await taskHandler.showBulkEditMenu(ctx);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню массовых действий:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'rename' && params[1] === 'menu') {
        try {
          const user = ctx.state.user;
          await taskHandler.showRenameTaskMenu(ctx, taskService, user.telegram_id);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню переименования:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'type' && params[1] === 'menu') {
        try {
          const user = ctx.state.user;
          await taskHandler.showChangeTypeMenu(ctx, taskService, user.telegram_id);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка меню изменения типа:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'cancel':
      if (params[0] === 'refresh') {
        try {
          const user = ctx.state.user;
          await taskHandler.showTodayTasks(ctx, taskService, user, true);
          await ctx.answerCbQuery('Отменено');
        } catch (error) {
          console.error('❌ Ошибка отмены обновления:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'continue':
      if (params[0] === 'onboarding' && params[1] === 'step2') {
        try {
          console.log('➡️ Продолжаем онбординг - переход к шагу 2');
          await ctx.answerCbQuery('Продолжаем! ✨');
          await startHandler.sendOnboardingStep2(ctx);
        } catch (error) {
          console.error('❌ Ошибка перехода к шагу 2:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    // Обработчики онбординга
    case 'start':
      if (params[0] === 'onboarding') {
        try {
          console.log('🚀 User started onboarding:', ctx.from.id);
          await ctx.answerCbQuery('Отлично! Начинаем 🚀');

          // Сначала спрашиваем пол
          await startHandler.sendGenderSelection(ctx);
        } catch (error) {
          console.error('Error starting onboarding:', error);
          await ctx.answerCbQuery('Ошибка при начале онбординга');
        }
      }
      break;

    // Обработчик выбора пола
    case 'gender':
      if (params[0] === 'male' || params[0] === 'female') {
        try {
          const gender = params[0];
          await startHandler.setUserGender(ctx, userService, gender);
        } catch (error) {
          console.error('Error setting gender:', error);
          await ctx.answerCbQuery('Ошибка установки пола');
        }
      }
      break;

    // ОСТАВЛЯЕМ ДЛЯ СОВМЕСТИМОСТИ - удалить позже
    case 'level_old':
      if (params[0] === 'onboarding') {
        try {
          // Редактируем текущее сообщение вместо отправки нового
          const levelText = `*Шаг 1 из 3: Твой текущий уровень*

Выбери, что лучше описывает тебя сейчас:

_💡 Независимо от выбора, все начинают с простых задач — это ключ к успеху! Постепенное усложнение позволяет войти в поток._`;

          const { Markup } = require('telegraf');
          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('😴 Прокрастинирую', 'level_beginner'),
              Markup.button.callback('😐 Делаю тяжело', 'level_intermediate')
            ],
            [
              Markup.button.callback('💪 Хочу больше', 'level_advanced')
            ]
          ]);

          await ctx.editMessageText(levelText, {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
          });
        } catch (error) {
          console.error('❌ Ошибка начала онбординга:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'onboarding':
      // Обработка онбординга: утреннее и вечернее время
      if (params[0] === 'morning' && ['6', '7', '8', '9', '10', '11'].includes(params[1])) {
        // Онбординг: утреннее время
        try {
          const user = ctx.state.user;
          await userService.updateUser(user.telegram_id, {
            morning_hour: parseInt(params[1])
          });
          await ctx.answerCbQuery('Время утренних задач установлено!');
          await startHandler.sendOnboardingStep3(ctx);
        } catch (error) {
          console.error('❌ Ошибка времени утра (онбординг):', error.message);
          await ctx.answerCbQuery('Ошибка установки времени');
        }
      } else if (params[0] === 'evening' && ['19', '20', '21', '22', '23'].includes(params[1])) {
        // Онбординг: вечернее время
        try {
          const user = ctx.state.user;
          await userService.updateUser(user.telegram_id, {
            evening_hour: parseInt(params[1])
          });
          await ctx.answerCbQuery('Время вечерней рефлексии установлено!');
          // Передаем выбор сложности из сессии в completeOnboarding
          const difficultyChoice = ctx.session?.difficultyChoice || null;
          await startHandler.completeOnboarding(ctx, userService, difficultyChoice);
        } catch (error) {
          console.error('❌ Ошибка времени вечера (онбординг):', error.message);
          await ctx.answerCbQuery('Ошибка установки времени');
        }
      }
      break;

    case 'level':
      if (['beginner', 'intermediate', 'advanced'].includes(params[0])) {
        try {
          await startHandler.setUserLevel(ctx, userService, params[0]);
        } catch (error) {
          console.error('❌ Ошибка установки уровня:', error.message);
          await ctx.answerCbQuery('Ошибка установки уровня');
        }
      }
      break;

    case 'bulk':
      const user = ctx.state.user;
      if (params[0] === 'complete' && params[1] === 'all') {
        try {
          await taskHandler.showBulkConfirmation(ctx, 'bulk_complete_all', 'отметить все задачи как выполненные');
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа подтверждения:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'uncomplete' && params[1] === 'all') {
        try {
          await taskHandler.showBulkConfirmation(ctx, 'bulk_uncomplete_all', 'снять отметки со всех задач');
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа подтверждения:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'delete' && params[1] === 'completed') {
        try {
          await taskHandler.showBulkConfirmation(ctx, 'bulk_delete_completed', 'удалить все выполненные задачи');
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа подтверждения:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      } else if (params[0] === 'shuffle' && params[1] === 'tasks') {
        try {
          await taskHandler.showBulkConfirmation(ctx, 'bulk_shuffle_tasks', 'перемешать порядок задач');
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка показа подтверждения:', error.message);
          await ctx.answerCbQuery('Ошибка');
        }
      }
      break;

    case 'delete':
      if (params[0] === 'task' && params[1]) {
        try {
          const taskId = params[1];
          const user = ctx.state.user;
          await taskService.deleteTask(taskId);
          await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);
          await ctx.answerCbQuery('🗑️ Задача удалена!');
        } catch (error) {
          console.error('❌ Ошибка удаления задачи:', error.message);
          await ctx.answerCbQuery('Ошибка удаления задачи');
        }
      }
      break;

    case 'rename':
      if (params[0] === 'task' && params[1]) {
        try {
          const taskId = params[1];
          // Здесь нужно будет добавить логику ввода нового текста
          // Пока просто показываем заглушку
          await ctx.answerCbQuery('💡 Функция переименования в разработке');
        } catch (error) {
          console.error('❌ Ошибка переименования задачи:', error.message);
          await ctx.answerCbQuery('Ошибка переименования');
        }
      }
      break;

    case 'change':
      if (params[0] === 'type' && params[1]) {
        try {
          const taskId = params[1];
          await taskHandler.showTypeSelectionMenu(ctx, taskId);
          await ctx.answerCbQuery();
        } catch (error) {
          console.error('❌ Ошибка изменения типа:', error.message);
          await ctx.answerCbQuery('Ошибка изменения типа');
        }
      }
      break;

    case 'set':
      if (params[0] === 'type' && params[1] && params[2]) {
        try {
          const taskId = params[1];
          const newType = params[2];
          const user = ctx.state.user;

          await taskService.changeTaskType(taskId, newType);
          await taskHandler.updateTaskMessage(ctx, taskService, user.telegram_id);

          const typeNames = {
            easy: 'Простая 💚',
            standard: 'Средняя 💛',
            hard: 'Сложная ❤️',
            magic: 'Магическая ✨'
          };

          await ctx.answerCbQuery(`🎯 Тип изменен на: ${typeNames[newType]}`);
        } catch (error) {
          console.error('❌ Ошибка изменения типа задачи:', error.message);
          await ctx.answerCbQuery('Ошибка изменения типа');
        }
      }
      break;

    case 'feedback':
      // Обработка обратной связи
      if (params[0] === 'bug') {
        await feedbackHandler.startBugReport(ctx);
      } else if (params[0] === 'suggestion') {
        await feedbackHandler.startSuggestion(ctx);
      }
      break;

    case 'cancel':
      if (params[0] === 'feedback') {
        await feedbackHandler.cancelFeedback(ctx);
      } else if (params[0] === 'admin' && params[1] === 'reply') {
        // Отмена ответа админа
        if (ctx.session?.adminReplyTo) {
          delete ctx.session.adminReplyTo;
        }
        await ctx.editMessageText('❌ Отправка ответа отменена');
        await ctx.answerCbQuery('Отменено');
      }
      break;

    case 'admin':
      // Обработка действий админа с отзывами
      if (params[0] === 'feedback' && params[1] === 'reply') {
        const feedbackId = params[2];
        const userId = params[3];

        try {
          // Устанавливаем режим ожидания ответа админа
          if (!ctx.session) ctx.session = {};
          ctx.session.adminReplyTo = { feedbackId, userId };

          await ctx.answerCbQuery('💬 Напиши ответ пользователю');
          await ctx.reply('💬 Напиши текст ответа пользователю:', {
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('❌ Отмена', 'cancel_admin_reply')]
            ]).reply_markup
          });
        } catch (error) {
          console.error('Error handling admin feedback reply:', error);
          await ctx.answerCbQuery('Ошибка обработки');
        }
      }
      break;

    case 'complete':
      if (params[0] === 'day') {
        try {
          const user = ctx.state.user;
          if (!user) {
            await ctx.answerCbQuery('Ошибка: пользователь не найден');
            return;
          }

          // Получаем статистику дня
          const stats = await taskService.getDailyStats(user.telegram_id);

          const completionMessage = `
🎯 *День ${user.level} завершён!*

📊 *Твои результаты:*
✅ Выполнено задач: ${stats.completed_tasks}/${stats.total_tasks}
💚 Простые: ${stats.easy_completed}
💛 Средние: ${stats.standard_completed}
❤️ Сложные: ${stats.hard_completed}
✨ Магическая: ${stats.magic_completed ? '✅' : '⬜'}

🔥 Flow Score: ${stats.flow_score || 0}

${stats.completed_tasks >= 20 ? '🏆 Отличная работа!' : stats.completed_tasks >= 10 ? '👍 Хороший результат!' : '💪 Продолжай в том же духе!'}

_Отдохни и набирайся сил для завтрашнего дня!_
          `.trim();

          await ctx.editMessageText(completionMessage, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('🏠 Главное меню', 'show_main_menu')]
            ]).reply_markup
          });

          await ctx.answerCbQuery('✅ День завершён!');
        } catch (error) {
          console.error('Error completing day:', error);
          await ctx.answerCbQuery('Ошибка при завершении дня');
        }
      }
      break;

    default:
      console.log(`❌ DEFAULT CASE: action='${action}', params=${JSON.stringify(params)}`);
      await ctx.answerCbQuery('Неизвестная команда');
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  logger.error(`Error for ${ctx.updateType}`, err);
  ctx.reply('Произошла ошибка. Попробуйте позже или обратитесь в поддержку.');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


// Запуск бота
async function startBot() {
  try {
    // Проверяем подключение к базе данных
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      logger.error('Database connection failed:', error);
      process.exit(1);
    }
    
    logger.info('Database connected successfully');
    
    // Запускаем API сервер для webhook endpoints
    console.log('🔄 Starting API server...');
    try {
      await startApiServer();
      console.log('✅ API server started!');
      logger.info('API Server started successfully!');
    } catch (error) {
      logger.error('Failed to start API server:', error);
      console.error('⚠️ API сервер не запустился, но бот работает');
    }

    // Запускаем cron задачи для уведомлений
    try {
      console.log('🚀 Starting notification service...');
      await notificationService.initialize();
      console.log('📬 Notification service активирован\n');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      logger.error('Notification service initialization failed:', error);
      // НЕ выходим из приложения - бот может работать без уведомлений
      console.warn('⚠️ Бот продолжает работать без автоматических уведомлений\n');
    }

    // Выводим красивый статус
    const apiPort = process.env.PORT || process.env.API_PORT || 3001;
    console.log('\n════════════════════════════════════════════');
    console.log('✅ FlowBot успешно запущен!');
    console.log('════════════════════════════════════════════');
    console.log('📱 Telegram бот: @FlowList_Bot');
    console.log(`🌐 API сервер: http://0.0.0.0:${apiPort}`);
    console.log(`📡 Webhooks: http://0.0.0.0:${apiPort}/api/webhooks`);
    console.log('💬 Команды: /help, /task, /stats');
    console.log('🔄 Статус: Работает (Ctrl+C для остановки)');
    console.log('════════════════════════════════════════════\n');

    // Запускаем бота (polling режим - не возвращает промис)
    console.log('🔄 Launching bot...');
    bot.launch();
    logger.info('FlowBot started successfully!');

    // Graceful shutdown для PM2 и Docker
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received, starting graceful shutdown...`);

      try {
        // Останавливаем бота
        console.log('🛑 Stopping bot...');
        await bot.stop(signal);

        // Даем время завершить текущие запросы
        console.log('⏳ Waiting for pending requests...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Обработчики сигналов для graceful shutdown
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Для PM2 cluster mode
    if (process.send) {
      process.send('ready');
    }

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot();
