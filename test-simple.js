// test-simple.js - Минимальный тест бота
require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Простые команды для теста
bot.start((ctx) => ctx.reply('✅ Бот работает! Привет, ' + ctx.from.first_name));
bot.help((ctx) => ctx.reply('Команды:\n/start - Тест\n/ping - Проверка'));
bot.command('ping', (ctx) => ctx.reply('🏓 Pong! Бот активен!'));

// Эхо любого текста
bot.on('text', (ctx) => {
  console.log('Получено сообщение:', ctx.message.text);
  ctx.reply('Эхо: ' + ctx.message.text);
});

// Запуск
bot.launch()
  .then(() => {
    console.log('✅ Тестовый бот запущен!');
    console.log('📱 Откройте @FlowList_Bot в Telegram');
    console.log('💬 Отправьте /ping для проверки');
  })
  .catch(err => {
    console.error('❌ Ошибка:', err.message);
  });

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
