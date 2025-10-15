// src/content/motivationalMessages.js
// Мотивационные сообщения для дневных напоминаний (БЕЗ использования AI)

// Сообщения для 14:00 (когда выполнено < 30%)
const afternoonLowProgress = [
  {
    emoji: '💪',
    title: 'Время действовать!',
    text: 'У тебя ещё {{remaining}} {{taskWord}} на сегодня.\n\nПомни: каждая выполненная задача приближает тебя к цели!\nНе откладывай на потом - начни прямо сейчас! 🔥'
  },
  {
    emoji: '⚡',
    title: 'Половина дня прошла!',
    text: 'Осталось {{remaining}} {{taskWord}}.\n\nСейчас самое время войти в поток!\nВыполни хотя бы 5 задач подряд - почувствуешь прилив энергии! 💥'
  },
  {
    emoji: '🎯',
    title: 'Давай наверстаем!',
    text: 'Ещё {{remaining}} {{taskWord}} ждут тебя.\n\nМаленький секрет: начни с САМОЙ простой задачи.\nОна запустит цепную реакцию продуктивности! 🚀'
  },
  {
    emoji: '🔥',
    title: 'Разожги свой огонь!',
    text: 'У тебя {{remaining}} {{taskWord}}.\n\nПоставь таймер на 25 минут.\nСколько успеешь закрыть за это время? Поехали! ⏱️'
  },
  {
    emoji: '💡',
    title: 'Время включиться!',
    text: 'Осталось {{remaining}} {{taskWord}}.\n\nСовет дня: делай задачи блоками по 3 штуки.\nЭто помогает держать фокус! 🎯'
  }
];

// Сообщения для 14:00 (когда выполнено 30-60%)
const afternoonMediumProgress = [
  {
    emoji: '👍',
    title: 'Отличный темп!',
    text: 'Ты уже {{completed}} {{taskWord}} {{completedVerb}}!\n\nОсталось ещё {{remaining}}.\nПродолжай в том же духе - ты на правильном пути! 🎯'
  },
  {
    emoji: '🌟',
    title: 'Ты молодец!',
    text: 'Уже {{completed}} задач позади!\n\nЕщё {{remaining}} {{taskWord}} - и ты чемпион дня.\nНе сбавляй темп! 💪'
  },
  {
    emoji: '⚡',
    title: 'Ты в ударе!',
    text: '{{completed}} {{taskWord}} {{completedVerb}} - это сила!\n\nДо финиша осталось {{remaining}}.\nТы справишься! 🔥'
  },
  {
    emoji: '🚀',
    title: 'Прогресс есть!',
    text: '{{completed}} задач уже выполнено!\n\nОсталось {{remaining}}.\nТы на середине пути - самое время ускориться! ⚡'
  }
];

// Сообщения для 18:00 (когда выполнено < 60%)
const eveningLowProgress = [
  {
    emoji: '⏰',
    title: 'Вечер! Последний рывок!',
    text: 'Осталось {{remaining}} {{taskWord}}.\n\nУ тебя ещё есть время!\nЗакрой хотя бы половину - это уже победа! 💪'
  },
  {
    emoji: '🌙',
    title: 'Не сдавайся!',
    text: 'День почти прошёл, но у тебя {{remaining}} {{taskWord}}.\n\nДаже если закроешь не все - это лучше, чем ничего.\nКаждая задача имеет значение! 🎯'
  },
  {
    emoji: '💥',
    title: 'Финишная прямая!',
    text: 'Ещё {{remaining}} {{taskWord}}.\n\nВключи любимую музыку и сделай последний рывок!\nЗавтра ты будешь гордиться собой! 🔥'
  },
  {
    emoji: '⚡',
    title: 'Вечерний спринт!',
    text: '{{remaining}} {{taskWord}} до конца дня.\n\nПоставь цель: закрыть минимум 5 задач.\nТы можешь больше, чем думаешь! 💪'
  },
  {
    emoji: '🎯',
    title: 'Время действовать!',
    text: 'У тебя {{remaining}} {{taskWord}}.\n\nНе откладывай на завтра то, что можешь сделать сегодня.\nНачни ПРЯМО СЕЙЧАС! 🚀'
  }
];

// Сообщения для 18:00 (когда выполнено 60-90%)
const eveningGoodProgress = [
  {
    emoji: '🔥',
    title: 'Отлично работаешь!',
    text: 'Ты {{completedVerb}} уже {{completed}} {{taskWord}}!\n\nОсталось всего {{remaining}}.\nЕщё чуть-чуть - и день твой! 💪'
  },
  {
    emoji: '⭐',
    title: 'Почти у цели!',
    text: '{{completed}} задач позади!\n\nЕщё {{remaining}} - и ты легенда дня.\nФиниш близко! 🎯'
  },
  {
    emoji: '💪',
    title: 'Сильный результат!',
    text: '{{completed}} {{taskWord}} выполнено!\n\nОсталось {{remaining}}.\nТы справишься - это уже очевидно! 🚀'
  },
  {
    emoji: '🎖️',
    title: 'Ты на высоте!',
    text: 'Уже {{completed}} задач!\n\nЕщё {{remaining}} {{taskWord}} - и ты герой дня.\nДавай, финишная прямая! ⚡'
  }
];

// Функция для выбора случайного сообщения
function getRandomMessage(messages) {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Функция для форматирования числа задач
function formatTaskWord(count) {
  if (count === 1) return 'задача';
  if (count >= 2 && count <= 4) return 'задачи';
  return 'задач';
}

// Функция для форматирования глагола "выполнил/выполнила"
function formatCompletedVerb(count) {
  if (count === 1) return 'выполнена';
  if (count >= 2 && count <= 4) return 'выполнены';
  return 'выполнено';
}

// Главная функция для получения мотивационного сообщения
function getMotivationalMessage(completed, total, timeOfDay) {
  const remaining = total - completed;
  const percentage = Math.round((completed / total) * 100);

  let messageTemplate;

  // Выбираем подходящее сообщение
  if (timeOfDay === 'afternoon') { // 14:00
    if (percentage < 30) {
      messageTemplate = getRandomMessage(afternoonLowProgress);
    } else if (percentage < 60) {
      messageTemplate = getRandomMessage(afternoonMediumProgress);
    } else {
      // Если уже > 60% в 14:00 - молодец! Не беспокоим
      return null;
    }
  } else if (timeOfDay === 'evening') { // 18:00
    if (percentage < 60) {
      messageTemplate = getRandomMessage(eveningLowProgress);
    } else if (percentage < 90) {
      messageTemplate = getRandomMessage(eveningGoodProgress);
    } else {
      // Если уже > 90% в 18:00 - всё отлично! Не беспокоим
      return null;
    }
  }

  // Форматируем сообщение
  const taskWord = formatTaskWord(remaining);
  const completedVerb = formatCompletedVerb(completed);

  const text = messageTemplate.text
    .replace(/\{\{remaining\}\}/g, remaining)
    .replace(/\{\{completed\}\}/g, completed)
    .replace(/\{\{taskWord\}\}/g, taskWord)
    .replace(/\{\{completedVerb\}\}/g, completedVerb);

  return {
    emoji: messageTemplate.emoji,
    title: messageTemplate.title,
    text: text
  };
}

module.exports = {
  getMotivationalMessage,
  afternoonLowProgress,
  afternoonMediumProgress,
  eveningLowProgress,
  eveningGoodProgress
};
