const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugUser() {
  try {
    // Получаем структуру таблицы users
    console.log('🔍 Проверяем структуру таблицы users...\n');
    
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Ошибка:', error);
      return;
    }

    if (users.length === 0) {
      console.log('❌ Пользователей в базе нет');
      return;
    }

    console.log('👥 Пользователи в базе:');
    users.forEach((user, index) => {
      console.log(`\n--- Пользователь ${index + 1} ---`);
      Object.entries(user).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });
    });

    // Найдем конкретного пользователя по telegram_id если есть
    const { data: specificUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!userError && specificUser.length > 0) {
      console.log('\n🔍 Последний созданный пользователь:');
      const user = specificUser[0];
      console.log(`ID: ${user.id}`);
      console.log(`Telegram ID: ${user.telegram_id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Level: ${user.level}`);
      console.log(`Onboarding: ${user.onboarding_completed}`);
      console.log(`Created: ${user.created_at}`);
      console.log(`Updated: ${user.updated_at}`);
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  }
}

debugUser();