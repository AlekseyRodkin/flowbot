const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function forceResetUser() {
  try {
    console.log('🔄 Принудительный сброс пользователя...');
    
    // Ваш Telegram ID
    const telegramId = 272559647;
    
    // Обновляем пользователя
    const { data, error } = await supabase
      .from('users')
      .update({
        level: 1,
        onboarding_completed: false,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_id', telegramId)
      .select();

    if (error) {
      console.error('❌ Ошибка сброса:', error);
      return;
    }

    console.log('✅ Пользователь сброшен:', data[0]);
    
    // Также сбрасываем стрик если есть
    const { data: streakData, error: streakError } = await supabase
      .from('streaks')
      .update({
        current_streak: 0,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', data[0].id)
      .select();

    if (!streakError) {
      console.log('✅ Стрик сброшен:', streakData);
    } else {
      console.log('ℹ️ Стрик не найден (нормально для нового пользователя)');
    }
    
    console.log('\n🎯 Готово! Теперь отправьте /start боту');
    
  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  }
}

forceResetUser();