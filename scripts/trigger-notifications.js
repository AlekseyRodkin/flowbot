#!/usr/bin/env node

/**
 * Скрипт для ручного запуска уведомлений (для тестирования)
 *
 * Использование:
 *   node scripts/trigger-notifications.js                    - отправить уведомления для текущего часа
 *   node scripts/trigger-notifications.js --hour 11          - отправить для конкретного часа
 *   node scripts/trigger-notifications.js --user 272559647   - отправить конкретному пользователю
 */

require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const moment = require('moment-timezone');
const { TaskService } = require('../src/services/taskService');
const { AIService } = require('../src/services/aiService');
const { NotificationService } = require('../src/services/notificationService');

// Parse arguments
const args = process.argv.slice(2);
const hourArg = args.find(arg => arg.startsWith('--hour'));
const userArg = args.find(arg => arg.startsWith('--user'));

const targetHour = hourArg ? parseInt(hourArg.split('=')[1]) : moment().tz('Europe/Moscow').hour();
const targetUserId = userArg ? userArg.split('=')[1] : null;

console.log('\n🧪 ═══════════════════════════════════════════════');
console.log('🧪 MANUAL NOTIFICATION TRIGGER');
console.log('🧪 ═══════════════════════════════════════════════\n');
console.log(`⏰ Target hour: ${targetHour}:00`);
if (targetUserId) {
  console.log(`👤 Target user: ${targetUserId}`);
} else {
  console.log(`👥 Target: All users with morning_hour or evening_hour = ${targetHour}`);
}
console.log('');

// Initialize services
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const taskService = new TaskService(supabase);
const aiService = new AIService();
const notificationService = new NotificationService(bot, supabase, taskService, aiService);

async function triggerNotifications() {
  try {
    if (targetUserId) {
      // Отправка конкретному пользователю
      console.log(`📤 Fetching user ${targetUserId}...`);

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', targetUserId)
        .single();

      if (error || !user) {
        console.error('❌ User not found:', error);
        process.exit(1);
      }

      console.log(`✅ Found user: ${user.first_name || user.username}`);
      console.log(`   Morning hour: ${user.morning_hour}`);
      console.log(`   Evening hour: ${user.evening_hour}`);
      console.log('');

      // Определяем что отправлять
      if (user.morning_hour === targetHour) {
        console.log('🌅 Sending morning tasks...\n');
        await notificationService.sendTasksToUser(user);
        console.log('\n✅ Morning tasks sent successfully!');
      } else if (user.evening_hour === targetHour) {
        console.log('🌙 Sending evening reflection...\n');
        await notificationService.sendReflectionToUser(user);
        console.log('\n✅ Evening reflection sent successfully!');
      } else {
        console.log(`⚠️  User's schedule doesn't match target hour ${targetHour}`);
        console.log(`   Use --hour=${user.morning_hour} for morning tasks`);
        console.log(`   Use --hour=${user.evening_hour} for evening reflection`);
      }
    } else {
      // Отправка всем пользователям на этот час
      console.log('🌅 Checking for morning tasks...\n');
      await notificationService.sendMorningTasks();

      console.log('\n🌙 Checking for evening reflections...\n');
      await notificationService.sendEveningReflection();

      console.log('\n✅ All notifications processed!');
    }

    console.log('\n🧪 ═══════════════════════════════════════════════');
    console.log('🧪 DONE');
    console.log('🧪 ═══════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Временно переопределяем sendMorningTasks и sendEveningReflection
// чтобы использовать targetHour вместо текущего времени
const originalSendMorningTasks = notificationService.sendMorningTasks.bind(notificationService);
const originalSendEveningReflection = notificationService.sendEveningReflection.bind(notificationService);

notificationService.sendMorningTasks = async function() {
  const currentHour = targetHour;

  console.log(`🌅 ─────────────────────────────────────`);
  console.log(`🌅 Checking MORNING tasks for ${currentHour}:00`);
  console.log(`🌅 Query: morning_hour = ${currentHour} AND onboarding_completed = true`);

  const { data: users, error } = await this.supabase
    .from('users')
    .select('*')
    .eq('morning_hour', currentHour)
    .eq('onboarding_completed', true);

  if (error) {
    console.error('❌ Error fetching users for morning tasks:', error);
    return;
  }

  console.log(`✅ Found ${users?.length || 0} user(s) for morning tasks at ${currentHour}:00`);

  if (users && users.length > 0) {
    users.forEach(u => {
      console.log(`   - ${u.first_name || u.username} (ID: ${u.telegram_id}, morning_hour: ${u.morning_hour})`);
    });
  }

  for (const user of users || []) {
    try {
      console.log(`📤 Sending tasks to user ${user.telegram_id} (${user.first_name || user.username})`);
      await this.sendTasksToUser(user);
    } catch (error) {
      console.error(`❌ Error sending tasks to user ${user.telegram_id}:`, error);
    }
  }
};

notificationService.sendEveningReflection = async function() {
  const currentHour = targetHour;

  console.log(`🌙 ─────────────────────────────────────`);
  console.log(`🌙 Checking EVENING reflection for ${currentHour}:00`);
  console.log(`🌙 Query: evening_hour = ${currentHour} AND onboarding_completed = true`);

  const { data: users, error } = await this.supabase
    .from('users')
    .select('*')
    .eq('evening_hour', currentHour)
    .eq('onboarding_completed', true);

  if (error) {
    console.error('❌ Error fetching users for evening reflection:', error);
    return;
  }

  console.log(`✅ Found ${users?.length || 0} user(s) for evening reflection at ${currentHour}:00`);

  if (users && users.length > 0) {
    users.forEach(u => {
      console.log(`   - ${u.first_name || u.username} (ID: ${u.telegram_id}, evening_hour: ${u.evening_hour})`);
    });
  }

  for (const user of users || []) {
    try {
      console.log(`📤 Sending reflection to user ${user.telegram_id} (${user.first_name || user.username})`);
      await this.sendReflectionToUser(user);
    } catch (error) {
      console.error(`❌ Error sending reflection to user ${user.telegram_id}:`, error);
    }
  }
};

triggerNotifications();
