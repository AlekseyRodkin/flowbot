const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugUserDetailed() {
  try {
    // Получаем все данные пользователя с телеграм ID
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id, 
        telegram_id, 
        username, 
        level, 
        difficulty_level,
        onboarding_completed,
        created_at,
        updated_at
      `)
      .limit(10);

    if (error) {
      console.error('❌ Ошибка получения пользователей:', error);
      return;
    }

    console.log('👥 Пользователи в базе данных:');
    users.forEach(user => {
      console.log(`
🔍 User ID: ${user.id}
📱 Telegram ID: ${user.telegram_id}
👤 Username: ${user.username}
📊 Level: ${user.level}
🎯 Difficulty Level: ${user.difficulty_level}
✅ Onboarding Completed: ${user.onboarding_completed}
📅 Created: ${user.created_at}
📅 Updated: ${user.updated_at}
      `);
    });

    // Получаем стрики
    const { data: streaks, error: streaksError } = await supabase
      .from('streaks')
      .select('*')
      .limit(10);

    if (!streaksError && streaks.length > 0) {
      console.log('\n🔥 Стрики пользователей:');
      streaks.forEach(streak => {
        console.log(`User ID: ${streak.user_id}, Current Streak: ${streak.current_streak}`);
      });
    }

    // Получаем задачи пользователей за сегодня
    const today = new Date().toISOString().split('T')[0];
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('user_id, date, completed')
      .eq('date', today);

    if (!tasksError && tasks.length > 0) {
      console.log(`\n📋 Задачи на ${today}:`);
      const tasksByUser = tasks.reduce((acc, task) => {
        if (!acc[task.user_id]) acc[task.user_id] = { total: 0, completed: 0 };
        acc[task.user_id].total++;
        if (task.completed) acc[task.user_id].completed++;
        return acc;
      }, {});
      
      Object.entries(tasksByUser).forEach(([userId, stats]) => {
        console.log(`User ID: ${userId}, Completed: ${stats.completed}/${stats.total}`);
      });
    }

  } catch (error) {
    console.error('💥 Критическая ошибка:', error);
  }
}

debugUserDetailed();