const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixUserLevel() {
  try {
    console.log('🔧 Исправление level пользователя...');

    // Ваш Telegram ID (из force-reset-user.js)
    const telegramId = 272559647;

    // Получаем текущие данные пользователя
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (fetchError) {
      console.error('❌ Ошибка получения пользователя:', fetchError);
      return;
    }

    console.log('📊 Текущие данные пользователя:');
    console.log(`   - telegram_id: ${user.telegram_id}`);
    console.log(`   - first_name: ${user.first_name}`);
    console.log(`   - level: ${user.level}`);
    console.log(`   - current_streak: ${user.current_streak}`);
    console.log('');

    // Исправляем level: уменьшаем на 1 (из-за бага было двойное увеличение)
    const correctLevel = Math.max(1, (user.level || 1) - 1);

    console.log(`🔧 Исправление: level ${user.level} → ${correctLevel}`);
    console.log('   Причина: Двойное увеличение level из-за предыдущего бага');
    console.log('');

    // Обновляем level
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        level: correctLevel,
        updated_at: new Date().toISOString()
      })
      .eq('telegram_id', telegramId)
      .select();

    if (updateError) {
      console.error('❌ Ошибка обновления:', updateError);
      return;
    }

    console.log('✅ Level успешно исправлен!');
    console.log('');
    console.log('📊 Обновленные данные:');
    console.log(`   - level: ${updated[0].level}`);
    console.log('');
    console.log('🎯 Теперь завтра вы получите задачи для дня 2');

  } catch (error) {
    console.error('❌ Непредвиденная ошибка:', error);
  } finally {
    process.exit(0);
  }
}

// Запуск
console.log('');
console.log('═══════════════════════════════════════');
console.log('  🔧 ИСПРАВЛЕНИЕ LEVEL ПОЛЬЗОВАТЕЛЯ');
console.log('═══════════════════════════════════════');
console.log('');

fixUserLevel();
