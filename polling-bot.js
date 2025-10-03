// Простейший тест бота с polling
require('dotenv').config();
const { Telegraf } = require('telegraf');

console.log('🔍 Проверка токена...');
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ Токен не найден!');
  process.exit(1);
}

console.log('✅ Токен найден');
console.log('🤖 Создание бота...');

const bot = new Telegraf(token);

console.log('📝 Регистрация команд...');

// Простейшие команды
bot.start((ctx) => {
  console.log('📨 Получена команда /start от', ctx.from.username || ctx.from.first_name);
  ctx.reply('🎉 FlowBot работает! Привет, ' + ctx.from.first_name + '!');
});

bot.help((ctx) => {
  console.log('📨 Получена команда /help');
  ctx.reply('Команды:\n/start - Начать\n/help - Помощь');
});

// Обработка любого текста
bot.on('text', (ctx) => {
  console.log('📨 Получено сообщение:', ctx.message.text);
  ctx.reply('Вы написали: ' + ctx.message.text);
});

// Обработка ошибок
bot.catch((err) => {
  console.error('❌ Ошибка в боте:', err);
});

console.log('🚀 Попытка запуска с polling...');

// Запускаем с явными настройками polling
bot.launch({
  webhook: {
    // Отключаем webhook, используем polling
    domain: undefined,
    port: undefined
  },
  polling: {
    timeout: 30,
    limit: 100
  }
}).then(() => {
  console.log('');
  console.log('✅ БОТ УСПЕШНО ЗАПУЩЕН!');
  console.log('=====================================');
  console.log('📱 Откройте Telegram');
  console.log('🔍 Найдите: @FlowList_Bot');  
  console.log('💬 Отправьте: /start');
  console.log('=====================================');
  console.log('');
  console.log('📊 Лог сообщений:');
}).catch((err) => {
  console.error('');
  console.error('❌ ОШИБКА ЗАПУСКА:');
  console.error('=====================================');
  
  if (err.code === 'ETELEGRAM') {
    const desc = err.response?.description || err.message;
    
    if (desc.includes('Unauthorized')) {
      console.error('⚠️  Неверный токен бота!');
      console.error('   Проверьте TELEGRAM_BOT_TOKEN в .env');
    } else if (desc.includes('Conflict')) {
      console.error('⚠️  Бот уже запущен в другом месте!');
      console.error('   Остановите другой процесс или подождите 1 минуту');
    } else {
      console.error('⚠️ ', desc);
    }
  } else {
    console.error(err.message);
  }
  console.error('=====================================');
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('\n👋 Остановка бота...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
});
