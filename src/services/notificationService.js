// src/services/notificationService.js
const cron = require('node-cron');
const moment = require('moment-timezone');
const dailyInsights = require('../content/dailyInsights');
const { getMotivationalMessage } = require('../content/motivationalMessages');

class NotificationService {
  constructor(bot, supabase, taskService, aiService, userService) {
    this.bot = bot;
    this.supabase = supabase;
    this.taskService = taskService;
    this.aiService = aiService;
    this.userService = userService;
    this.scheduledJobs = new Map();
  }

  // Инициализация всех cron-задач
  async initialize() {
    try {
      console.log('🕐 Initializing notification service...');

      // Основные задачи на каждый час для проверки
      this.scheduleHourlyCheck();

      // Дневные напоминания
      this.scheduleDayReminders();

      console.log('✅ Notification service initialized');
      console.log(`📅 Cron schedule: Every hour at :00`);
      console.log(`🌅 Morning tasks: checked every hour`);
      console.log(`🌙 Evening reflection: checked every hour`);
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
      throw error;
    }
  }

  // Проверка каждый час для отправки утренних задач И вечерней рефлексии
  scheduleHourlyCheck() {
    console.log('📌 Scheduling hourly check (every hour at :00)...');

    cron.schedule('0 * * * *', async () => {
      const currentHour = moment().tz('Europe/Moscow').hour();
      console.log(`\n⏰ ═══════════════════════════════════════`);
      console.log(`⏰ Hourly check triggered at ${currentHour}:00`);
      console.log(`⏰ ═══════════════════════════════════════\n`);

      try {
        // Проверяем утренние задачи
        await this.sendMorningTasks();

        // Проверяем вечернюю рефлексию
        await this.sendEveningReflection();
      } catch (error) {
        console.error(`❌ Error in hourly check:`, error);
      }
    });

    console.log('✅ Hourly check scheduled successfully');
  }

  // Отправка утренних задач
  async sendMorningTasks() {
    const now = moment().tz('Europe/Moscow');
    const currentHour = now.hour();

    console.log(`🌅 ─────────────────────────────────────`);
    console.log(`🌅 Checking MORNING tasks for ${currentHour}:00`);
    console.log(`🌅 Query: morning_hour = ${currentHour} AND onboarding_completed = true`);

    // Получаем всех активных пользователей с morning_hour = текущий час
    const { data: users, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('morning_hour', currentHour)
      .eq('onboarding_completed', true);

    if (error) {
      console.error('❌ Error fetching users for morning tasks:', error);
      return;
    }

    console.log(`✅ Found ${users?.length || 0} user(s) for morning tasks at ${currentHour}:00`);

    if (users && users.length > 0) {
      users.forEach(u => {
        console.log(`   - ${u.first_name || u.username} (ID: ${u.telegram_id}, morning_hour: ${u.morning_hour})`);
      });
    }

    for (const user of users) {
      try {
        console.log(`📤 Sending tasks to user ${user.telegram_id} (${user.first_name || user.username})`);
        await this.sendTasksToUser(user);
      } catch (error) {
        console.error(`❌ Error sending tasks to user ${user.telegram_id}:`, error);
      }
    }
  }

  // Отправка задач конкретному пользователю
  async sendTasksToUser(user) {
    // Получаем реальное количество активных дней из статистики
    let currentDay = user.level || 1;
    try {
      const stats = await this.userService.getUserStats(user.telegram_id);
      if (stats && stats.totalDays !== undefined) {
        currentDay = stats.totalDays || 1;
      }
    } catch (error) {
      console.error('Error getting user stats for morning tasks:', error);
    }

    // Определяем конфигурацию задач на основе дня программы
    const taskConfig = this.getTaskConfig(currentDay);

    // Генерируем задачи через AI
    const tasks = await this.aiService.generateTasks(taskConfig, user);

    // Сохраняем задачи в базу данных
    await this.taskService.saveDailyTasks(user.id, tasks);

    // Формируем сообщение с реальным днем программы
    const message = this.formatTasksMessage(tasks, currentDay);

    // Отправляем сообщение
    await this.bot.telegram.sendMessage(user.telegram_id, message, {
      parse_mode: 'Markdown',
      reply_markup: this.createTaskKeyboard(tasks)
    });

    console.log(`✅ Sent morning tasks to user ${user.telegram_id} (day ${user.level})`);

    // Увеличиваем уровень пользователя ПОСЛЕ отправки (для следующего дня)
    const nextLevel = (user.level || 1) + 1;
    await this.supabase
      .from('users')
      .update({ level: nextLevel })
      .eq('id', user.id);

    console.log(`📈 User ${user.telegram_id} level increased: ${user.level} → ${nextLevel}`);
  }

  // Получить конфигурацию задач по уровню
  getTaskConfig(level) {
    // Дни 1-5: Разгон (30 простых)
    // Дни 6-10: Усложнение (15 простых + 10 средних + 5 сложных)
    // Дни 11+: Поток (10 простых + 10 средних + 10 сложных, повторяется)
    if (level <= 5) {
      return { easy: 30, standard: 0, hard: 0 };
    } else if (level <= 10) {
      return { easy: 15, standard: 10, hard: 5 };
    } else {
      return { easy: 10, standard: 10, hard: 10 };
    }
  }

  // Получить инсайт дня
  getDailyInsight(level) {
    const key = level <= 15 ? `day${level}` : 'day16plus';
    return dailyInsights[key] || dailyInsights.day1;
  }

  // Форматировать сообщение с задачами
  formatTasksMessage(tasks, level) {
    // Добавляем инсайт дня
    const insight = this.getDailyInsight(level);
    let message = `💡 *${insight.title}*\n\n`;
    message += `${insight.text}\n\n`;
    message += `───────────────\n\n`;

    // Приветствие
    message += `🌅 *Доброе утро!*\n`;
    if (level <= 15) {
      message += `📅 День ${level} из 15\n\n`;
    } else {
      message += `📅 День ${level} (ты в потоке! 🎉)\n\n`;
    }
    message += `*Твой Flow List на сегодня:*\n\n`;
    
    const easyTasks = tasks.filter(t => t.type === 'easy');
    const standardTasks = tasks.filter(t => t.type === 'standard');
    const hardTasks = tasks.filter(t => t.type === 'hard');
    const magicTask = tasks.find(t => t.type === 'magic');
    
    if (easyTasks.length > 0) {
      message += `💚 *Простые задачи:*\n`;
      easyTasks.forEach((task, i) => {
        message += `${i + 1}. ${task.text}\n`;
      });
      message += '\n';
    }
    
    if (standardTasks.length > 0) {
      message += `💛 *Средние задачи:*\n`;
      standardTasks.forEach((task, i) => {
        message += `${i + 1}. ${task.text}\n`;
      });
      message += '\n';
    }
    
    if (hardTasks.length > 0) {
      message += `❤️ *Сложные задачи:*\n`;
      hardTasks.forEach((task, i) => {
        message += `${i + 1}. ${task.text}\n`;
      });
      message += '\n';
    }
    
    if (magicTask) {
      message += `✨ *Магическая задача:*\n${magicTask.text}\n\n`;
    }
    
    message += `_Начни с первой простой задачи и войди в поток!_`;
    
    return message;
  }

  // Создать клавиатуру для задач
  createTaskKeyboard(tasks) {
    return {
      inline_keyboard: [
        [
          { text: '📋 Открыть список', callback_data: 'show_tasks' }
        ],
        [
          { text: '📊 Моя статистика', callback_data: 'show_stats' }
        ]
      ]
    };
  }

  // Отправка вечерней рефлексии
  async sendEveningReflection() {
    const now = moment().tz('Europe/Moscow');
    const currentHour = now.hour();

    console.log(`🌙 ─────────────────────────────────────`);
    console.log(`🌙 Checking EVENING reflection for ${currentHour}:00`);
    console.log(`🌙 Query: evening_hour = ${currentHour} AND onboarding_completed = true`);

    // Получаем всех активных пользователей с evening_hour = текущий час
    const { data: users, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('evening_hour', currentHour)
      .eq('onboarding_completed', true);

    if (error) {
      console.error('❌ Error fetching users for evening reflection:', error);
      return;
    }

    console.log(`✅ Found ${users?.length || 0} user(s) for evening reflection at ${currentHour}:00`);

    if (users && users.length > 0) {
      users.forEach(u => {
        console.log(`   - ${u.first_name || u.username} (ID: ${u.telegram_id}, evening_hour: ${u.evening_hour})`);
      });
    }

    for (const user of users) {
      try {
        console.log(`📤 Sending reflection to user ${user.telegram_id} (${user.first_name || user.username})`);
        await this.sendReflectionToUser(user);
      } catch (error) {
        console.error(`❌ Error sending reflection to user ${user.telegram_id}:`, error);
      }
    }
  }

  // Дневные напоминания (14:00 и 18:00)
  scheduleDayReminders() {
    // Проверка в 14:00
    cron.schedule('0 14 * * *', async () => {
      console.log('⏰ Sending afternoon reminders (14:00)...');
      await this.sendDayReminders('afternoon');
    });

    // Проверка в 18:00
    cron.schedule('0 18 * * *', async () => {
      console.log('⏰ Sending evening reminders (18:00)...');
      await this.sendDayReminders('evening');
    });
  }

  // Отправка дневных напоминаний
  async sendDayReminders(timeOfDay) {
    const { data: users, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('onboarding_completed', true);

    if (error) {
      console.error('Error fetching users for reminders:', error);
      return;
    }

    const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

    for (const user of users) {
      try {
        // Получаем задачи пользователя на сегодня
        const tasks = await this.taskService.getUserTasksForDate(user.telegram_id, today);

        if (tasks.length === 0) {
          continue; // Нет задач на сегодня
        }

        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Получаем мотивационное сообщение
        const motivationalMsg = getMotivationalMessage(completed, total, timeOfDay);

        // Если функция вернула null - значит прогресс хороший, не беспокоим
        if (!motivationalMsg) {
          console.log(`✅ User ${user.telegram_id} has good progress (${percentage}%), skipping reminder`);
          continue;
        }

        // Формируем финальное сообщение
        const message = `${motivationalMsg.emoji} *${motivationalMsg.title}*\n\n${motivationalMsg.text}`;

        await this.bot.telegram.sendMessage(user.telegram_id, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Открыть задачи', callback_data: 'show_tasks' }]
            ]
          }
        });

        console.log(`✅ Sent ${timeOfDay} reminder to user ${user.telegram_id} (${completed}/${total} tasks, ${percentage}%)`);
      } catch (error) {
        console.error(`Error sending day reminder to user ${user.telegram_id}:`, error);
      }
    }
  }

  // Отправка рефлексии пользователю
  async sendReflectionToUser(user) {
    // Получаем статистику дня
    const today = moment().tz(user.timezone || 'Europe/Moscow').format('YYYY-MM-DD');
    const tasks = await this.taskService.getUserTasksForDate(user.telegram_id, today);

    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Формируем сообщение в зависимости от процента выполнения
    let message = `🌙 *Вечерняя рефлексия*\n\n`;
    message += `📊 Сегодня выполнено: ${completed}/${total} задач (${percentage}%)\n`;
    message += `🔥 Стрик: ${user.current_streak || 0} дней\n\n`;

    if (percentage < 100) {
      // Не все задачи закрыты - мотивируем
      message += `⚠️ *Важно закрывать все задачи!*\n`;
      message += `Каждая закрытая задача — это кирпичик твоей новой привычки.\n\n`;
      message += `💪 *Завтра у тебя точно получится!*\n\n`;
      message += `Помни: главное не скорость, а регулярность. Закрывай все задачи, и результат не заставит себя ждать!\n\n`;
    } else {
      // Все задачи закрыты - хвалим
      const { g } = require('../utils/genderUtils');
      message += `🎉 *Отлично! Ты ${g(user, 'закрыл', 'закрыла')} все задачи!*\n`;
      message += `Так ты формируешь железную привычку продуктивности!\n\n`;
      message += `Ты ${g(user, 'молодец', 'молодец')}! Продолжай в том же духе 💪\n\n`;
    }

    message += `Как ты себя чувствуешь?`;

    // Формируем клавиатуру
    const keyboard = [
      [
        { text: '😊 Отлично', callback_data: 'mood_great' },
        { text: '👍 Хорошо', callback_data: 'mood_good' }
      ],
      [
        { text: '😐 Нормально', callback_data: 'mood_normal' },
        { text: '😔 Устал', callback_data: 'mood_tired' }
      ]
    ];

    // Если есть незакрытые задачи, добавляем кнопку для их просмотра
    if (percentage < 100) {
      keyboard.push([
        { text: '📋 Закрыть оставшиеся задачи', callback_data: 'show_tasks' }
      ]);
    }

    await this.bot.telegram.sendMessage(user.telegram_id, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }
}

module.exports = { NotificationService };
