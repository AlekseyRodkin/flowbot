// trigger-morning-tasks.js - Запуск утренних задач прямо сейчас
require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const { AIService } = require('./src/services/aiService');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const aiService = new AIService();

async function sendMorningTasksNow() {
  console.log('🌅 Запускаем утренние задачи...\n');
  
  // Получаем вашего пользователя
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (!users || users.length === 0) {
    console.log('❌ Пользователь не найден в базе');
    return;
  }
  
  const user = users[0];
  console.log('👤 Отправляем задачи для:', user.username || user.first_name);
  
  // Определяем уровень задач
  const level = user.level || 1;
  let taskConfig = {};

  // Этап 1 (Дни 1-5): Easy - 30 очень простых дел
  // Этап 2 (Дни 6-10): Standard - 20 простых + 10 стандартных (БЕЗ сложных!)
  // Этап 3 (Дни 11-15): Hard - 10 простых + 12 стандартных + 8 сложных
  // Дни 16+: Поток - повторение этапа 3 (продолжение по желанию)
  if (level <= 5) {
    taskConfig = { easy: 30, standard: 0, hard: 0 };
  } else if (level <= 10) {
    taskConfig = { easy: 20, standard: 10, hard: 0 };
  } else {
    // Для дней 11 и далее используем одинаковую конфигурацию
    taskConfig = { easy: 10, standard: 12, hard: 8 };
  }
  
  console.log('📊 День программы:', level);
  console.log('📝 Конфигурация:', taskConfig);
  
  // Генерируем задачи
  const tasks = await aiService.generateTasks({
    level: level,
    preferences: user.preferences || [],
    antiPatterns: user.anti_patterns || [],
    ...taskConfig
  });
  
  // Сохраняем задачи в базу
  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < tasks.length; i++) {
    await supabase.from('tasks').insert({
      user_id: user.id,
      date: today,
      task_text: tasks[i].text,
      task_type: tasks[i].type,
      position: i + 1,
      ai_generated: true
    });
  }

  // Увеличиваем уровень пользователя на следующий день
  const nextLevel = (user.level || 1) + 1;
  await supabase
    .from('users')
    .update({ level: nextLevel })
    .eq('id', user.id);

  console.log(`📈 User level increased: ${level} → ${nextLevel}`);

  // Формируем сообщение
  let message = '🌅 Доброе утро! Твой Flow List на сегодня:\n\n';
  if (level <= 15) {
    message += `📅 День ${level} из 15\n\n`;
  } else {
    message += `📅 День ${level} (ты в потоке! 🎉)\n\n`;
  }
  
  // Группируем задачи по типам
  const easyTasks = tasks.filter(t => t.type === 'easy');
  const standardTasks = tasks.filter(t => t.type === 'standard');
  const hardTasks = tasks.filter(t => t.type === 'hard');
  const magicTasks = tasks.filter(t => t.type === 'magic');
  
  if (easyTasks.length > 0) {
    message += '🟢 Простые задачи:\n';
    easyTasks.slice(0, 10).forEach((task, i) => {
      message += `${i + 1}. ${task.text}\n`;
    });
    if (easyTasks.length > 10) {
      message += `... и еще ${easyTasks.length - 10} задач\n`;
    }
    message += '\n';
  }
  
  if (standardTasks.length > 0) {
    message += '🟡 Средние задачи:\n';
    standardTasks.forEach((task, i) => {
      message += `${i + 1}. ${task.text}\n`;
    });
    message += '\n';
  }
  
  if (hardTasks.length > 0) {
    message += '🔴 Сложные задачи:\n';
    hardTasks.forEach((task, i) => {
      message += `${i + 1}. ${task.text}\n`;
    });
    message += '\n';
  }
  
  if (magicTasks.length > 0) {
    message += '✨ Магическая задача:\n';
    message += `${magicTasks[0].text}\n\n`;
  }
  
  message += '💡 Начни с первой простой задачи!\n';
  message += 'Используй /task для работы с задачами';
  
  // Отправляем сообщение
  await bot.telegram.sendMessage(user.telegram_id, message);
  
  console.log('✅ Задачи отправлены!');
  console.log('📱 Проверьте Telegram');
}

// Запускаем
sendMorningTasksNow()
  .then(() => {
    console.log('\n✨ Готово!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
  });
