require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugUser() {
  const telegramId = 972753303; // Ваш Telegram ID
  
  console.log('Проверяем пользователя с ID:', telegramId);
  
  // Проверяем пользователя
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', telegramId);
    
  if (error) {
    console.error('Ошибка:', error);
  } else if (data && data.length > 0) {
    console.log('Найден пользователь:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\nВажные поля:');
    console.log('- level:', data[0].level);
    console.log('- onboarding_completed:', data[0].onboarding_completed);
    console.log('- created_at:', data[0].created_at);
    
    // Проверяем стрики
    const { data: streaks } = await supabase
      .from('streaks')
      .select('*')
      .eq('user_id', data[0].id);
    
    if (streaks && streaks.length > 0) {
      console.log('\nСтрики:');
      console.log('- current_streak:', streaks[0].current_streak);
      console.log('- longest_streak:', streaks[0].longest_streak);
    }
  } else {
    console.log('Пользователь не найден в базе данных');
  }
  
  process.exit(0);
}

debugUser();
