#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('🚀 Применяем миграцию напрямую...\n');

  try {
    // SQL команды из миграции
    const alterTable = `
      ALTER TABLE tasks 
      ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL;
    `;

    const createIndex1 = `CREATE INDEX IF NOT EXISTS idx_tasks_is_custom ON tasks(is_custom);`;
    const createIndex2 = `CREATE INDEX IF NOT EXISTS idx_tasks_custom_task_id ON tasks(custom_task_id);`;

    console.log('📝 Добавляем новые столбцы...');
    
    // Выполняем через PostgreSQL REST API напрямую
    const response1 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: alterTable })
    });

    if (!response1.ok) {
      console.log('⚠️ Не удалось выполнить через API, выполняем альтернативным способом...');
      
      // Альтернативный способ - пробуем через простой запрос
      const { error: error1 } = await supabase
        .from('_supabase_admin_schemas')
        .select('*')
        .limit(0);

      console.log('💡 Требуется ручное выполнение миграции в Supabase Dashboard:');
      console.log('\n=== SQL КОД ДЛЯ ВЫПОЛНЕНИЯ ===');
      console.log(alterTable);
      console.log(createIndex1);
      console.log(createIndex2);
      console.log('==============================\n');
      
      console.log('📋 Инструкции:');
      console.log('1. Откройте https://supabase.com/dashboard');
      console.log('2. Выберите ваш проект');
      console.log('3. Перейдите в SQL Editor');
      console.log('4. Скопируйте и выполните SQL код выше');
      console.log('5. Перезапустите бота после выполнения\n');
      
      return;
    }

    console.log('✅ Столбцы добавлены');

    console.log('📝 Создаем индексы...');
    
    const response2 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createIndex1 })
    });

    const response3 = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: createIndex2 })
    });

    console.log('✅ Индексы созданы');

    // Проверяем результат
    console.log('🔍 Проверяем новые столбцы...');
    const { data, error } = await supabase
      .from('tasks')
      .select('telegram_id, is_custom, custom_task_id')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('✅ Миграция успешно применена!');
    console.log('🎉 Новые столбцы is_custom и custom_task_id добавлены в таблицу tasks');

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('\n💡 Требуется ручное выполнение в Supabase Dashboard');
    console.log('SQL для выполнения:');
    console.log(`
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_is_custom ON tasks(is_custom);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_task_id ON tasks(custom_task_id);
    `);
  }
}

applyMigration();