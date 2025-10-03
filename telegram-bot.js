// ФИНАЛЬНАЯ ВЕРСИЯ - запуск через getUpdates
require('dotenv').config();

console.log('🚀 FlowList Bot - Инициализация...\n');

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('❌ Токен не найден в .env!');
  process.exit(1);
}

// Используем node-telegram-bot-api для простоты
const TelegramBot = require('node-telegram-bot-api');

// Создаем бота с polling
const bot = new TelegramBot(TOKEN, { 
  polling: true,
  filepath: false // Отключаем загрузку файлов для упрощения
});

console.log('✅ Бот создан, запускаем polling...\n');

// Обработчик /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name;
  
  console.log(`📨 /start от ${name} (@${msg.from.username})`);
  
  const welcome = `
🎯 <b>Добро пожаловать в FlowBot!</b>

Привет, ${name}! 

Я помогу тебе войти в состояние потока за 15 дней через технику Flow List.

<b>Что ты получишь:</b>
✅ Рост продуктивности в 3-5 раз
✅ Избавление от прокрастинации
✅ Ощущение "всё успеваю"
✅ Энергия и драйв каждый день

<b>Команды:</b>
/start - Начать заново
/help - Помощь
/tasks - Пример задач
`;
  
  bot.sendMessage(chatId, welcome, { parse_mode: 'HTML' });
});

// Обработчик /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`📋 /help от @${msg.from.username}`);
  
  bot.sendMessage(chatId, `
📖 Справка FlowBot

Доступные команды:
/start - Начать
/help - Эта справка  
/tasks - Пример задач на день

Бот находится в тестовом режиме.
Полный функционал будет доступен после настройки всех сервисов.
`);
});

// Обработчик /tasks
bot.onText(/\/tasks/, (msg) => {
  const chatId = msg.chat.id;
  console.log(`📝 /tasks от @${msg.from.username}`);
  
  const tasks = `
<b>📋 Пример задач на сегодня:</b>

<i>Простые (1-2 минуты):</i>
• Выпить стакан воды
• Сделать 5 глубоких вдохов
• Улыбнуться себе в зеркале
• Написать одно слово благодарности
• Потянуться на 30 секунд

<i>Средние (10-15 минут):</i>
• Ответить на 3 сообщения
• Прочитать 5 страниц книги
• Сделать мини-зарядку
• Позвонить другу

<i>Сложные (30+ минут):</i>
• Завершить важную задачу по работе
• Написать план на завтра

Выполняй по порядку для входа в поток! 🎯
`;
  
  bot.sendMessage(chatId, tasks, { parse_mode: 'HTML' });
});

// Обработка любых сообщений
bot.on('message', (msg) => {
  // Пропускаем команды
  if (msg.text && msg.text.startsWith('/')) return;
  
  const chatId = msg.chat.id;
  console.log(`💬 Сообщение от @${msg.from.username}: "${msg.text}"`);
  
  bot.sendMessage(chatId, 'Я получил ваше сообщение. Используйте /help для списка команд.');
});

// Обработка ошибок polling
bot.on('polling_error', (error) => {
  console.error('❌ Ошибка polling:', error.message);
  
  if (error.code === 'ETELEGRAM' && error.response.body.error_code === 409) {
    console.error('⚠️  Конфликт: бот уже запущен в другом месте!');
    console.error('   Решение: подождите минуту и попробуйте снова');
  }
});

// Успешный запуск
bot.on('polling', () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║   ✅ FLOWBOT УСПЕШНО ЗАПУЩЕН!         ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log('║   🤖 Бот: @FlowList_Bot               ║');
  console.log('║   📱 Ссылка: t.me/FlowList_Bot        ║');
  console.log('╠═══════════════════════════════════════╣');
  console.log('║   Откройте Telegram и отправьте       ║');
  console.log('║   боту команду /start                 ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log('\n📊 Лог активности:\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Остановка бота...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.stopPolling();
  process.exit(0);
});
