// scripts/fix-easy-constraint.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют переменные окружения SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraint() {
  try {
    console.log('🔧 Исправляем ограничение для поддержки easy...\n');

    // Сначала проверим текущие задачи с easy
    const { data: existingTasks, error: selectError } = await supabase
      .from('custom_tasks')
      .select('id, difficulty')
      .eq('difficulty', 'easy');

    if (selectError) {
      console.log('📝 Задач с difficulty=easy пока нет (что и ожидалось)');
    } else if (existingTasks && existingTasks.length > 0) {
      console.log(`📊 Найдено ${existingTasks.length} задач с difficulty=easy`);
    }

    // Попробуем создать тестовую задачу с easy
    console.log('\n🧪 Пробуем создать тестовую задачу с easy...');
    
    const { data: testTask, error: insertError } = await supabase
      .from('custom_tasks')
      .insert([{
        telegram_id: 0, // системная задача для теста
        title: 'TEST_EASY_TASK',
        description: 'Test task to verify easy difficulty',
        category: 'personal',
        difficulty: 'easy',
        estimated_time: 5,
        is_active: false // неактивная, чтобы не мешала
      }])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Не удалось создать задачу с easy:', insertError.message);
      console.log('\n⚠️ ВАЖНО: Необходимо вручную обновить ограничение в базе данных!');
      console.log('\n📋 Выполните этот SQL в Supabase SQL Editor:');
      console.log('==================================================');
      console.log(`
-- Удаляем старое ограничение
ALTER TABLE custom_tasks 
DROP CONSTRAINT IF EXISTS custom_tasks_difficulty_check;

-- Добавляем новое ограничение с поддержкой 'easy'
ALTER TABLE custom_tasks 
ADD CONSTRAINT custom_tasks_difficulty_check 
CHECK (difficulty IN ('easy', 'standard', 'hard', 'magic'));
      `);
      console.log('==================================================');
      console.log('\nПосле выполнения SQL перезапустите бота.');
      return false;
    }

    console.log('✅ Тестовая задача успешно создана!');
    
    // Удаляем тестовую задачу
    const { error: deleteError } = await supabase
      .from('custom_tasks')
      .delete()
      .eq('title', 'TEST_EASY_TASK');

    if (!deleteError) {
      console.log('🧹 Тестовая задача удалена');
    }

    console.log('\n🎉 Ограничение успешно поддерживает easy!');
    return true;

  } catch (error) {
    console.error('❌ Ошибка:', error);
    return false;
  }
}

// Запускаем проверку
fixConstraint().then(success => {
  process.exit(success ? 0 : 1);
});