// Проверка токена бота
require('dotenv').config();
const axios = require('axios');

async function checkBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env');
    return;
  }
  
  console.log('🔍 Проверка токена бота...');
  
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    
    if (response.data.ok) {
      const bot = response.data.result;
      console.log('✅ Токен валидный!');
      console.log('🤖 Информация о боте:');
      console.log(`   Имя: ${bot.first_name}`);
      console.log(`   Username: @${bot.username}`);
      console.log(`   ID: ${bot.id}`);
      console.log(`   Can join groups: ${bot.can_join_groups}`);
      console.log(`   Can read messages: ${bot.can_read_all_group_messages}`);
      console.log('');
      console.log('📱 Ссылка на бота: https://t.me/' + bot.username);
    } else {
      console.error('❌ Ошибка:', response.data.description);
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке токена:');
    if (error.response && error.response.data) {
      console.error('   ', error.response.data.description);
      
      if (error.response.data.description.includes('Unauthorized')) {
        console.error('');
        console.error('⚠️  Токен неверный. Проверьте:');
        console.error('   1. Правильно ли скопирован токен от @BotFather');
        console.error('   2. Нет ли лишних пробелов в начале/конце токена');
      }
    } else {
      console.error('   ', error.message);
    }
  }
}

checkBot();
