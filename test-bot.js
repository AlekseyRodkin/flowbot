// test-bot.js - Скрипт для тестирования всех функций бота
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Инициализация Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testBotFunctions() {
  console.log('🧪 Начинаем тестирование FlowBot...\n');
  
  // 1. Тестируем создание задач
  console.log('1️⃣ Тестируем генерацию задач...');
  const AIService = require('./src/services/aiService');
  const aiService = new AIService();
  
  try {
    const tasks = await aiService.generateTasks({
      level: 1,
      preferences: ['productivity', 'health'],
      antiPatterns: []
    });
    console.log('✅ Сгенерировано задач:', tasks.length);
    console.log('Примеры задач:');
    tasks.slice(0, 5).forEach(task => {
      console.log(`  - ${task.text} (${task.type})`);
    });
  } catch (error) {
    console.log('❌ Ошибка генерации задач:', error.message);
  }
  
  console.log('\n-------------------\n');
  
  // 2. Тестируем работу с пользователями
  console.log('2️⃣ Тестируем сервис пользователей...');
  const UserService = require('./src/services/userService');
  const userService = new UserService(supabase);
  
  // Получаем вашего пользователя (замените на ваш Telegram ID)
  const testUserId = 'test_user_' + Date.now(); // Временный тестовый ID
  
  try {
    // Создаем тестового пользователя
    const user = await userService.createUser({
      telegram_id: testUserId,
      username: 'test_user',
      first_name: 'Test',
      last_name: 'User'
    });
    console.log('✅ Создан тестовый пользователь:', user.telegram_id);
    
    // Получаем статистику
    const stats = await userService.getUserStats(user.id);
    console.log('📊 Статистика пользователя:', stats);
    
  } catch (error) {
    console.log('❌ Ошибка работы с пользователем:', error.message);
  }
  
  console.log('\n-------------------\n');
  
  // 3. Тестируем систему достижений
  console.log('3️⃣ Тестируем систему достижений...');
  
  try {
    const { data: achievements } = await supabase
      .from('achievements')
      .select('*')
      .limit(5);
    
    console.log('🏆 Доступные достижения:');
    achievements?.forEach(ach => {
      console.log(`  ${ach.icon} ${ach.name} - ${ach.description}`);
    });
  } catch (error) {
    console.log('❌ Ошибка загрузки достижений:', error.message);
  }
  
  console.log('\n-------------------\n');
  
  // 4. Тестируем реферальную систему
  console.log('4️⃣ Тестируем реферальную систему...');
  const ReferralService = require('./src/services/referralService');
  const referralService = new ReferralService(supabase);
  
  try {
    const refLink = referralService.generateReferralLink('123456');
    console.log('🔗 Реферальная ссылка:', refLink);
    
    const refCode = referralService.parseReferralCode('ref_123456');
    console.log('📝 Извлеченный код:', refCode);
  } catch (error) {
    console.log('❌ Ошибка реферальной системы:', error.message);
  }
  
  console.log('\n-------------------\n');
  console.log('✨ Тестирование завершено!');
  console.log('\n📱 Теперь протестируйте в Telegram:');
  console.log('  /help - список команд');
  console.log('  /task - получить задачи');
  console.log('  /stats - статистика');
  console.log('  /settings - настройки');
  console.log('  /invite - пригласить друзей');
}

// Запускаем тесты
testBotFunctions().catch(console.error);
