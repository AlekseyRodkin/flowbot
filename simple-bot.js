// Простой бот с polling для обхода проблем с сетью
require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

console.log('🚀 Запуск FlowList_Bot...\n');

// Базовые команды
bot.start((ctx) => {
  console.log('✅ Получена команда /start от', ctx.from.username || ctx.from.id);
  ctx.reply(
    '🎯 *Добро пожаловать в FlowList Bot!*\n\n' +
    'Я помогу тебе войти в состояние потока за 15 дней.\n\n' +
    '*Команды:*\n' +
    '/start - Начать работу\n' +
    '/help - Список команд\n' +
    '/status - Проверить статус бота\n\n' +
    '💡 _Полная версия запускается через npm run dev_',
    { parse_mode: 'Markdown' }
  );
});

bot.help((ctx) => {
  console.log('📚 Команда /help от', ctx.from.username || ctx.from.id);
  ctx.reply(
    '*Доступные команды:*\n\n' +
    '/start - Начать работу с ботом\n' +
    '/help - Показать это сообщение\n' +
    '/status - Проверить работу бота\n' +
    '/test - Тестовая команда',
    { parse_mode: 'Markdown' }
  );
});

bot.command('status', (ctx) => {
  console.log('🔍 Команда /status от', ctx.from.username || ctx.from.id);
  ctx.reply('✅ Бот работает нормально!\n\n' + 
    `Время: ${new Date().toLocaleString('ru-RU', {timeZone: 'Europe/Moscow'})}\n` +
    `Ваш ID: ${ctx.from.id}\n` +
    `Username: @${ctx.from.username || 'не указан'}`
  );
});

bot.command('test', (ctx) => {
  console.log('🧪 Команда /test от', ctx.from.username || ctx.from.id);
  ctx.reply('🧪 Тестовая команда работает!');
});

// Обработка обычного текста
bot.on('text', (ctx) => {
  console.log('💬 Сообщение от', ctx.from.username || ctx.from.id, ':', ctx.message.text);
  ctx.reply(
    `Получено сообщение: "${ctx.message.text}"\n\n` +
    'Используйте /help для списка доступных команд.'
  );
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`❌ Ошибка для ${ctx.updateType}:`, err);
  ctx.reply('Произошла ошибка. Попробуйте позже.');
});

// Запуск с использованием polling
bot.launch({
  webhook: undefined,
  allowedUpdates: ['message', 'callback_query']
})
.then(() => {
  console.log('✅ FlowList_Bot успешно запущен!');
  console.log('📱 Откройте Telegram: https://t.me/FlowList_Bot');
  console.log('💬 Отправьте /start для начала работы');
  console.log('\nℹ️  Для остановки нажмите Ctrl+C\n');
})
.catch((error) => {
  console.error('❌ Не удалось запустить бота:', error.message);
  
  if (error.message.includes('409')) {
    console.log('\n⚠️  Возможно, бот уже запущен в другом процессе.');
    console.log('Попробуйте остановить все процессы node и запустить заново.');
  } else if (error.message.includes('401')) {
    console.log('\n⚠️  Неверный токен бота.');
    console.log('Проверьте TELEGRAM_BOT_TOKEN в файле .env');
  } else if (error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT')) {
    console.log('\n⚠️  Проблема с сетью.');
    console.log('Возможные решения:');
    console.log('1. Проверьте интернет-соединение');
    console.log('2. Попробуйте использовать VPN');
    console.log('3. Проверьте настройки файрвола');
  }
  
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n⏹️  Остановка бота...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n⏹️  Остановка бота...');
  bot.stop('SIGTERM');
});
