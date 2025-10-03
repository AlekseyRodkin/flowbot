#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testNotifications() {
  console.log('🧪 Тестирование системы уведомлений\n');

  const currentHour = moment().tz('Europe/Moscow').hour();
  console.log(`⏰ Текущее время: ${moment().tz('Europe/Moscow').format('HH:mm')}`);
  console.log(`📊 Текущий час: ${currentHour}\n`);

  // Проверяем пользователей с morning_hour = текущий час
  const { data: morningUsers, error: morningError } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, morning_hour, onboarding_completed')
    .eq('morning_hour', currentHour)
    .eq('onboarding_completed', true);

  if (morningError) {
    console.error('❌ Ошибка при получении пользователей для утренних задач:', morningError);
  } else {
    console.log(`📨 Пользователей для утренних задач (hour=${currentHour}): ${morningUsers.length}`);
    morningUsers.forEach(user => {
      console.log(`  - ${user.first_name || user.username} (${user.telegram_id}): morning_hour=${user.morning_hour}`);
    });
    console.log();
  }

  // Проверяем пользователей с evening_hour = текущий час
  const { data: eveningUsers, error: eveningError } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, evening_hour, onboarding_completed')
    .eq('evening_hour', currentHour)
    .eq('onboarding_completed', true);

  if (eveningError) {
    console.error('❌ Ошибка при получении пользователей для вечерней рефлексии:', eveningError);
  } else {
    console.log(`🌙 Пользователей для вечерней рефлексии (hour=${currentHour}): ${eveningUsers.length}`);
    eveningUsers.forEach(user => {
      console.log(`  - ${user.first_name || user.username} (${user.telegram_id}): evening_hour=${user.evening_hour}`);
    });
    console.log();
  }

  // Показываем всех активных пользователей
  const { data: allUsers, error: allError } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, morning_hour, evening_hour, onboarding_completed')
    .eq('onboarding_completed', true);

  if (allError) {
    console.error('❌ Ошибка при получении всех пользователей:', allError);
  } else {
    console.log(`👥 Всего активных пользователей: ${allUsers.length}`);
    allUsers.forEach(user => {
      console.log(`  - ${user.first_name || user.username} (${user.telegram_id}): morning=${user.morning_hour}:00, evening=${user.evening_hour}:00`);
    });
  }
}

testNotifications().then(() => {
  console.log('\n✅ Тест завершён');
  process.exit(0);
}).catch(error => {
  console.error('❌ Ошибка:', error);
  process.exit(1);
});
