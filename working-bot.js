// Финальная версия работающего бота
require('dotenv').config();
const { Telegraf } = require('telegraf');

console.log('🚀 FlowList Bot - Запуск...\n');

// Проверка токена
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле!');
  process.exit(1);
}

// Создание бота
const bot = new Telegraf(token);

// Счетчик сообщений для отслеживания активности
let messageCount = 0;

// Команда /start
bot.start((ctx) => {
  messageCount++;
  const user = ctx.from;
  console.log(`✅ [${messageCount}] /start от @${user.username || user.first_name}`);
  
  const message = `
🎯 *Добро пожаловать в FlowBot!*

Привет, ${user.first_name}! 

Я помогу тебе войти в состояние потока за 15 дней.

*Доступные команды:*
/start - Начать заново
/help - Помощь
/tasks - Пример задач на день

_Полный функционал с AI-генерацией задач будет доступен после настройки всех сервисов._
`;
  
  ctx.replyWithMarkdown(message);
});

// Команда /help
bot.help((ctx) => {
  messageCount++;
  console.log(`📋 [${messageCount}] /help от @${ctx.from.username}`);
  
  ctx.reply(`
📖 Помощь по FlowBot

Команды:
/start - Начать
/help - Эта справка
/tasks - Пример задач

Бот находится в режиме тестирования.
`);
});

// Команда /tasks - пример
bot.command('tasks', (ctx) => {
  messageCount++;
  console.log(`📝 [${messageCount}] /tasks от @${ctx.from.username}`);
  
  ctx.replyWithMarkdown(`
*📋 Пример задач на сегодня:*

_Простые (1-2 минуты):_
• Выпить стакан воды
• Сделать 5 глубоких вдохов
• Улыбнуться

_Средние (5-15 минут):_
• Ответить на 3 письма
• Сделать зарядку
• Позвонить другу

_Сложные (30+ минут):_
• Завершить важную задачу
• Написать отчет

Выполняй по порядку для входа в поток!
`);
});

// Обработка любых текстовых сообщений
bot.on('text', (ctx) => {
  messageCount++;
  const text = ctx.message.text;
  console.log(`💬 [${messageCount}] Сообщение от @${ctx.from.username}: "${text}"`);
  
  if (!text.startsWith('/')) {
    ctx.reply('Я понял ваше сообщение. Используйте /help для списка команд.');
  }
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error('❌ Ошибка:', err);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});

// ЗАПУСК БОТА
bot.launch()
  .then(() => {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   ✅ БОТ УСПЕШНО ЗАПУЩЕН!             ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log('║   🤖 Бот: @FlowList_Bot               ║');
    console.log('║   📱 Ссылка: t.me/FlowList_Bot        ║');
    console.log('╠═══════════════════════════════════════╣');
    console.log('║   Отправьте боту /start для проверки  ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('\n📊 Лог активности:\n');
  })
  .catch(err => {
    console.error('\n❌ КРИТИЧЕСКАЯ ОШИБКА:');
    
    if (err.response && err.response.error_code === 409) {
      console.error('Бот уже запущен в другом процессе!');
      console.error('Решение: подождите 1 минуту и попробуйте снова');
    } else if (err.response && err.response.error_code === 401) {
      console.error('Неверный токен бота!');
      console.error('Проверьте TELEGRAM_BOT_TOKEN в .env файле');
    } else {
      console.error(err.message);
    }
    
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n\n👋 Получен сигнал остановки...');
  bot.stop('SIGINT');
  console.log('✅ Бот остановлен');
  process.exit(0);
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});
