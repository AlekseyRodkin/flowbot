// Проверка токена и запуск простого бота
require('dotenv').config();
const https = require('https');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

console.log('🔍 Проверка токена бота...\n');

// Проверяем токен через getMe
const options = {
  hostname: 'api.telegram.org',
  path: `/bot${TOKEN}/getMe`,
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.ok) {
        console.log('✅ Токен валидный!');
        console.log('🤖 Информация о боте:');
        console.log('   Имя:', result.result.first_name);
        console.log('   Username: @' + result.result.username);
        console.log('   ID:', result.result.id);
        console.log('   Может присоединяться к группам:', result.result.can_join_groups);
        console.log('   Может читать все сообщения:', result.result.can_read_all_group_messages);
        console.log('   Поддерживает inline:', result.result.supports_inline_queries);
        
        console.log('\n📱 Бот готов к работе!');
        console.log('🔗 Откройте в Telegram: https://t.me/' + result.result.username);
        
        // Теперь запускаем простой эхо-бот
        console.log('\n🚀 Запуск эхо-бота для тестирования...');
        startSimpleBot();
      } else {
        console.error('❌ Ошибка API:', result);
      }
    } catch (e) {
      console.error('❌ Ошибка парсинга:', e.message);
      console.error('Ответ:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Ошибка подключения:', error.message);
  if (error.message.includes('ENOTFOUND')) {
    console.error('   Проверьте интернет-соединение');
  }
});

req.end();

// Простой эхо-бот для тестирования
function startSimpleBot() {
  const { Telegraf } = require('telegraf');
  const bot = new Telegraf(TOKEN);
  
  bot.start((ctx) => {
    ctx.reply(
      '🎉 Привет! FlowList_Bot работает!\n\n' +
      '🎯 Это тестовый режим.\n' +
      'Для запуска полной версии используйте:\n' +
      '`npm run dev` или `node bot/index.js`\n\n' +
      'Команды:\n' +
      '/start - Это сообщение\n' +
      '/test - Тестовое сообщение\n' +
      '/echo [текст] - Повторить текст',
      { parse_mode: 'Markdown' }
    );
  });
  
  bot.command('test', (ctx) => {
    ctx.reply('✅ Команды работают!');
  });
  
  bot.command('echo', (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (text) {
      ctx.reply(`Эхо: ${text}`);
    } else {
      ctx.reply('Используйте: /echo ваш текст');
    }
  });
  
  bot.on('text', (ctx) => {
    ctx.reply(`Вы написали: "${ctx.message.text}"\n\nИспользуйте /start для списка команд`);
  });
  
  bot.launch()
    .then(() => {
      console.log('✅ Эхо-бот запущен!');
      console.log('💬 Отправьте любое сообщение боту для проверки');
    })
    .catch((err) => {
      console.error('❌ Ошибка запуска:', err.message);
    });
  
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
