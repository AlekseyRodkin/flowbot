require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function resetUser() {
  const telegramId = 972753303; // Ваш Telegram ID
  
  // Удаляем старого пользователя если есть
  console.log('Удаляем старого пользователя...');
  await supabase
    .from('users')
    .delete()
    .eq('telegram_id', telegramId);
    
  // Удаляем стрики
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegramId);
    
  if (users && users.length > 0) {
    await supabase
      .from('streaks')
      .delete()
      .eq('user_id', users[0].id);
      
    await supabase
      .from('tasks')
      .delete()
      .eq('user_id', users[0].id);
  }
  
  console.log('✅ Пользователь сброшен!');
  console.log('Теперь отправьте /start боту для начала с чистого листа.');
  
  process.exit(0);
}

resetUser();
