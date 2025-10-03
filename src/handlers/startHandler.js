// src/handlers/startHandler.js
const { Markup } = require('telegraf');
const { sendOrEditMessage, clearLastMessageId } = require('../utils/messageUtils');

// Кэш для предотвращения дублирования сообщений
const lastStartTimestamp = new Map();

const startHandler = async (ctx, userService) => {
  try {
    const telegramUser = ctx.from;
    const userId = telegramUser.id;
    const now = Date.now();
    
    // Проверяем, не был ли /start вызван недавно (в течение 2 секунд)
    const lastStart = lastStartTimestamp.get(userId);
    if (lastStart && (now - lastStart) < 2000) {
      console.log('⚠️ Duplicate /start command ignored for user:', telegramUser.username || telegramUser.id);
      return;
    }
    
    // Обновляем timestamp последнего старта
    lastStartTimestamp.set(userId, now);
    
    console.log('🔍 StartHandler called for:', telegramUser.username || telegramUser.id);
    
    // Получаем или создаем пользователя
    const user = await userService.getOrCreateUser(telegramUser);
    console.log('📊 User data:', {
      id: user.id,
      telegram_id: user.telegram_id,
      level: user.level,
      onboarding_completed: user.onboarding_completed,
      current_streak: user.current_streak
    });
    
    if (!user.onboarding_completed) {
      // Новый пользователь - начинаем онбординг
      console.log('🆕 Starting onboarding for new user');
      await sendWelcomeMessage(ctx);
    } else {
      // Существующий пользователь
      console.log('👤 Showing main menu for existing user');
      // Получаем taskService из контекста если доступен
      const taskService = ctx.state.taskService || null;
      await sendMainMenu(ctx, user, false, taskService);
    }
  } catch (error) {
    console.error('Error in startHandler:', error);
    await ctx.reply('Произошла ошибка. Попробуйте позже.');
  }
};

// Приветственное сообщение
const sendWelcomeMessage = async (ctx) => {
  const welcomeText = `🔥 *Хватит откладывать на завтра!*

Привет! Я FlowBot — твой персональный коуч по продуктивности.

*Знакомая ситуация?*
😫 Планируешь много, а делаешь мало
😫 Прокрастинируешь важные задачи
😫 К вечеру чувствуешь, что день прошел впустую

*Всего за 15 дней ты получишь:*
🚀 Продуктивность выше в 3-5 раз
⚡ Полное избавление от прокрастинации
🎯 Четкий фокус на важном
💪 Энергию и драйв каждый день
✨ Состояние потока как новую привычку

*Секрет в научно обоснованной методике Flow List:*
📊 Изучена на 10,000+ людей
🧠 Основана на нейропсихологии
⭐ 94% участников достигают результата

*Твой путь к потоку (все начинают одинаково):*
📅 Дни 1-5: Мягкий разгон (простые задачи)
📈 Дни 6-10: Добавляем сложности
🔥 Дни 11-15: Устойчивый поток
🎯 День 16+: Ты в потоке! Можешь продолжать по желанию

*Начнем прямо сейчас?*

🔒 _Все твои данные хранятся только у тебя и никуда не передаются. Никакой рекламы, никакой продажи данных._`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Начать!', 'start_onboarding')]
  ]);

  await sendOrEditMessage(ctx, welcomeText, keyboard);
};

// Шаг 0: Выбор пола (добавлен для гендерных обращений)
const sendGenderSelection = async (ctx) => {
  const genderText = `*Давай знакомиться!*

Как к тебе обращаться?

_Это нужно, чтобы бот общался с тобой правильно 😊_`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('👨 Парень', 'gender_male'),
      Markup.button.callback('👩 Девушка', 'gender_female')
    ]
  ]);

  // Редактируем сообщение вместо отправки нового
  if (ctx.callbackQuery) {
    await ctx.editMessageText(genderText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  } else {
    await sendOrEditMessage(ctx, genderText, keyboard);
  }
};

// Установка пола пользователя
const setUserGender = async (ctx, userService, gender) => {
  try {
    const userId = ctx.from.id;

    await userService.updateUser(userId, {
      gender: gender
    });

    console.log(`✅ User gender set to ${gender} for user:`, userId);

    const responseText = gender === 'male' ? 'Отлично! 👨' : 'Отлично! 👩';
    await ctx.answerCbQuery(responseText);

    // Переходим к выбору уровня
    await sendOnboardingStep1(ctx);
  } catch (error) {
    console.error('Error setting user gender:', error);
    await ctx.answerCbQuery('Ошибка установки пола');
  }
};

// Шаг 1: Выбор уровня
const sendOnboardingStep1 = async (ctx) => {
  const levelText = `*Шаг 1 из 3: Твой текущий уровень*

Выбери, что лучше описывает тебя сейчас:

_💡 Независимо от выбора, все начинают с простых задач — это ключ к успеху! Постепенное усложнение позволяет войти в поток._`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('😴 Прокрастинирую', 'level_beginner'),
      Markup.button.callback('😐 Делаю тяжело', 'level_intermediate')
    ],
    [
      Markup.button.callback('💪 Хочу больше', 'level_advanced')
    ]
  ]);

  await sendOrEditMessage(ctx, levelText, keyboard);
};

// Установка уровня пользователя
const setUserLevel = async (ctx, userService, difficultyLevel) => {
  try {
    const userId = ctx.from.id;

    // Все пользователи начинают с уровня 1 независимо от выбора
    // Выбор (beginner/intermediate/advanced) используется только для мотивационного сообщения
    await userService.updateUser(userId, {
      level: 1  // День программы всегда начинается с 1
    });

    // Сохраняем выбор в сессии для персонализированного приветствия
    if (!ctx.session) ctx.session = {};
    ctx.session.difficultyChoice = difficultyLevel;

    console.log(`✅ User level set to 1 (difficulty choice: ${difficultyLevel}) for user:`, userId);

    // Персонализированный ответ в зависимости от выбора
    let responseText = '';
    if (difficultyLevel === 'beginner') {
      responseText = 'Отлично! Мы начнем с самых простых шагов 💚';
    } else if (difficultyLevel === 'intermediate') {
      responseText = 'Понял! Будем двигаться уверенно 💛';
    } else {
      responseText = 'Круто! Готовься к челленджу 💪';
    }

    await ctx.answerCbQuery(responseText);
    await sendOnboardingStep1_5(ctx, difficultyLevel);
  } catch (error) {
    console.error('Error setting user level:', error);
    await ctx.answerCbQuery('Ошибка установки уровня');
  }
};

// Шаг 1.5: Эмоциональная поддержка после выбора уровня
const sendOnboardingStep1_5 = async (ctx, difficultyLevel) => {
  let supportText = '';

  if (difficultyLevel === 'beginner') {
    supportText = `💚 *Понимаю тебя как никто другой!*

Знаешь, прокрастинация — это не лень и не слабость. Это защитная реакция мозга на перегрузку или страх неудачи.

*Хорошая новость:*
FlowBot создан именно для людей как ты! 🎯

Мы начнем с МИКРО-задач — настолько простых, что невозможно не сделать. Это обманет твой мозг и запустит цепную реакцию продуктивности.

*Что ты получишь:*
✨ Легкость старта каждый день
🔥 Естественное желание делать больше
💪 Уверенность в себе

Ты уже сделал первый шаг — запустил бота. Давай продолжим? 🚀`;
  } else if (difficultyLevel === 'intermediate') {
    supportText = `💛 *Уважаю твою честность!*

То, что ты делаешь задачи, даже если это тяжело — признак настоящей силы воли! Большинство людей даже не начинают.

*Но вот в чем секрет:*
Продуктивность не должна быть тяжелой 💡

FlowBot научит твой мозг входить в состояние потока — когда задачи делаются легко и с удовольствием.

*Что изменится:*
⚡ Задачи станут даваться естественно
🎯 Появится четкий фокус и энергия
🔥 Ты будешь удивляться: "Неужели это было так просто?"

Готов открыть новый уровень продуктивности? 🚀`;
  } else {
    supportText = `❤️ *Вау! Чувствую твою энергию!*

Ты из тех, кто не боится амбициозных целей. Это редкое качество! 🔥

*И я тебя понимаю:*
Когда есть потенциал, хочется реализовать его на 100%. Не размениваться на мелочи.

FlowBot создан для таких как ты — чтобы превратить амбиции в конкретные ежедневные достижения.

*Что ты получишь:*
🚀 Максимум продуктивности каждый день
⚡ Системный подход к большим целям
💎 Результаты, которыми можно гордиться

Даже самые амбициозные вершины начинаются с первого шага. Готов? 🎯`;
  }

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Продолжить ➡️', 'continue_onboarding_step2')]
  ]);

  // Редактируем сообщение вместо отправки нового
  if (ctx.callbackQuery) {
    await ctx.editMessageText(supportText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  } else {
    await sendOrEditMessage(ctx, supportText, keyboard);
  }
};

// Шаг 2: Выбор времени для утренних задач
const sendOnboardingStep2 = async (ctx) => {
  const timeText = `*Шаг 2 из 3: Время утренних задач*

Когда тебе удобно получать список задач на день?`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🌅 6:00', 'onboarding_morning_6'),
      Markup.button.callback('🌅 7:00', 'onboarding_morning_7'),
      Markup.button.callback('🌅 8:00', 'onboarding_morning_8')
    ],
    [
      Markup.button.callback('☀️ 9:00', 'onboarding_morning_9'),
      Markup.button.callback('☀️ 10:00', 'onboarding_morning_10'),
      Markup.button.callback('☀️ 11:00', 'onboarding_morning_11')
    ]
  ]);

  // Редактируем сообщение вместо отправки нового
  if (ctx.callbackQuery) {
    await ctx.editMessageText(timeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  } else {
    await sendOrEditMessage(ctx, timeText, keyboard);
  }
};

// Шаг 3: Выбор времени вечерней рефлексии
const sendOnboardingStep3 = async (ctx) => {
  const timeText = `*Шаг 3 из 3: Время вечерней рефлексии*

Когда подводить итоги дня?`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🌆 19:00', 'onboarding_evening_19'),
      Markup.button.callback('🌆 20:00', 'onboarding_evening_20'),
      Markup.button.callback('🌆 21:00', 'onboarding_evening_21')
    ],
    [
      Markup.button.callback('🌙 22:00', 'onboarding_evening_22'),
      Markup.button.callback('🌙 23:00', 'onboarding_evening_23')
    ]
  ]);

  // Редактируем сообщение вместо отправки нового
  if (ctx.callbackQuery) {
    await ctx.editMessageText(timeText, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.reply_markup
    });
  } else {
    await sendOrEditMessage(ctx, timeText, keyboard);
  }
};

// Завершение онбординга
const completeOnboarding = async (ctx, userService, difficultyChoice = null) => {
  try {
    const userId = ctx.from.id;

    await userService.updateUser(userId, {
      onboarding_completed: true
    });

    // Персонализированное приветствие в зависимости от выбора
    let personalMessage = '';
    if (difficultyChoice === 'beginner') {
      personalMessage = '💚 *Ты выбрал путь постепенного роста — это мудрое решение!*\nМы начнем с самых простых шагов, чтобы ты уверенно вошел в ритм.\n\n';
    } else if (difficultyChoice === 'intermediate') {
      personalMessage = '💛 *Ты готов к стабильному движению вперед!*\nТвоя настойчивость поможет преодолеть любые трудности.\n\n';
    } else if (difficultyChoice === 'advanced') {
      personalMessage = '❤️ *Ты выбрал путь амбициозных целей!*\nТвоя энергия и драйв приведут к впечатляющим результатам.\n\n';
    }

    const completionText = `🎉 *Отлично! Ты готов начать!*

${personalMessage}*Важно:* Все начинают с Дня 1 и простых задач. Это ключ к успеху Flow List! 🔑

*Как это работает:*
📅 Каждое утро — персональный список задач
✅ В течение дня — отмечаешь выполненное
🌙 Вечером — смотришь результат и получаешь мотивацию

⚠️ *ВАЖНО:* Старайся закрывать ВСЕ задачи каждый день!
Это ключ к формированию привычки и результату.

*Твой путь:*
• Дни 1-5: разгон на простых задачах
• Дни 6-10: добавляем сложность
• Дни 11-15: входишь в поток
• День 16+: продолжай по желанию

Готов? Нажми кнопку ниже и получи первый Flow List! 🚀

_/help — если нужна помощь_`;

    // Добавляем кнопки для продолжения
    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('📋 Начать первый день', 'show_tasks')
      ],
      [
        Markup.button.callback('📊 Узнать больше', 'show_help'),
        Markup.button.callback('🏠 Главное меню', 'show_main_menu')
      ]
    ]);

    await sendOrEditMessage(ctx, completionText, keyboard);
  } catch (error) {
    console.error('Error completing onboarding:', error);
    await ctx.reply('Произошла ошибка при завершении настройки.');
  }
};

// Получить мотивационное сообщение в зависимости от прогресса
const getMotivationalMessage = (percentage) => {
  if (percentage === 0) return '💪 Начни с первой задачи!';
  if (percentage <= 30) return '🔥 Отличное начало!';
  if (percentage <= 60) return '⚡ Ты в огне! Продолжай!';
  if (percentage <= 90) return '🚀 Почти у цели!';
  if (percentage < 100) return '💎 Осталось совсем немного!';
  return '🎉 Все задачи выполнены! Легенда!';
};

// Главное меню для существующих пользователей
const sendMainMenu = async (ctx, user, editMessage = false, taskService = null) => {
  // День программы берется из user.level (1-15+)
  const currentDay = user.level || 1;

  // Получаем стрик из базы данных
  const streak = user.current_streak || 0;

  console.log(`📊 Showing menu - Day: ${currentDay}, Streak: ${streak} for user: ${user.telegram_id}`);

  // Формируем компактный прогресс день + стрик
  let progressLine;
  if (currentDay <= 15) {
    progressLine = `📅 День ${currentDay} из 15 • 🔥 Стрик: ${streak}`;
  } else {
    progressLine = `📅 День ${currentDay} (ты в потоке! 🎉) • 🔥 Стрик: ${streak}`;
  }

  // Получаем прогресс задач на сегодня
  let todayProgress = '';
  let motivationalMsg = '💪 Начни с первой задачи!';

  if (taskService) {
    try {
      const moment = require('moment-timezone');
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      const tasks = await taskService.getUserTasksForDate(user.id, today);

      if (tasks && tasks.length > 0) {
        const completed = tasks.filter(t => t.completed).length;
        const total = tasks.length;
        const percentage = Math.round((completed / total) * 100);

        todayProgress = `📋 Сегодня: ${completed}/${total} задач ✅ (${percentage}%)`;
        motivationalMsg = getMotivationalMessage(percentage);
      } else {
        todayProgress = '📋 Задачи на сегодня еще не созданы';
        motivationalMsg = '🌅 Создай свой список задач!';
      }
    } catch (error) {
      console.error('Error getting today tasks:', error);
      todayProgress = '📋 Задачи загружаются...';
    }
  }

  // Получаем имя пользователя
  const userName = user.first_name || user.username || 'друг';

  const menuText = `🌟 *Привет, ${userName}!*

${progressLine}
${todayProgress}
${motivationalMsg}`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Мои задачи на сегодня', 'show_tasks'),
      Markup.button.callback('⚙️ Настройки', 'show_settings')
    ],
    [
      Markup.button.callback('💬 Обратная связь', 'show_feedback')
    ]
  ]);

  // Используем новую универсальную функцию
  await sendOrEditMessage(ctx, menuText, keyboard);
};

// Сброс прогресса пользователя
const resetProgress = async (ctx, userService) => {
  try {
    const confirmText = `⚠️ *Внимание!*
    
Ты уверен, что хочешь начать программу заново?

Это сбросит:
• Твой текущий прогресс
• Статистику и стрики
• Все задачи

Это действие нельзя отменить!`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да, начать заново', 'confirm_reset'),
        Markup.button.callback('❌ Отмена', 'cancel_reset')
      ]
    ]);

    await sendOrEditMessage(ctx, confirmText, keyboard);
    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in resetProgress:', error);
    await ctx.answerCbQuery('Ошибка сброса прогресса');
  }
};

// Подтверждение сброса
const confirmReset = async (ctx, userService) => {
  try {
    const userId = ctx.from.id;
    
    console.log('🔄 Resetting user progress for:', userId);
    
    // Полностью сбрасываем пользователя к начальному состоянию
    await userService.updateUser(userId, {
      level: 1,  // День 1
      onboarding_completed: false  // Пройти онбординг заново
    });
    
    console.log('✅ User reset completed');
    
    await ctx.answerCbQuery('Прогресс сброшен!');
    
    // Начинаем онбординг заново
    await sendWelcomeMessage(ctx);
    await sendOnboardingStep1(ctx);
  } catch (error) {
    console.error('Error confirming reset:', error);
    await ctx.answerCbQuery('Ошибка при сбросе');
  }
};

module.exports = {
  startHandler,
  sendGenderSelection,
  setUserGender,
  setUserLevel,
  sendOnboardingStep1,
  sendOnboardingStep1_5,
  sendOnboardingStep2,
  sendOnboardingStep3,
  completeOnboarding,
  sendMainMenu,
  resetProgress,
  confirmReset
};
