#!/usr/bin/env node

// Простой скрипт для применения миграции через pg
require('dotenv').config();

async function applyMigration() {
  console.log('🚀 Применяем миграцию через postgresql...\n');
  
  try {
    // Пробуем импортировать pg
    let pg;
    try {
      pg = require('pg');
    } catch (e) {
      console.log('❌ Библиотека pg не найдена');
      console.log('💡 Установите её командой: npm install pg');
      console.log('\n🔧 Альтернатива - выполните миграцию вручную:');
      showManualInstructions();
      return;
    }

    // Парсим URL Supabase для подключения к PostgreSQL
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Не найдены SUPABASE_URL или SUPABASE_SERVICE_KEY в .env');
    }

    // Извлекаем project_id из URL
    const projectId = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
    if (!projectId) {
      throw new Error('Не удалось извлечь project_id из SUPABASE_URL');
    }

    console.log('📡 Подключаемся к PostgreSQL...');
    
    // Формируем строку подключения для PostgreSQL
    const connectionString = `postgresql://postgres.${projectId}:${serviceKey}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
    
    const client = new pg.Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await client.connect();
    console.log('✅ Подключение установлено');

    // SQL команды из миграции
    const commands = [
      `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_is_custom ON tasks(is_custom)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_custom_task_id ON tasks(custom_task_id)`
    ];

    console.log('📝 Выполняем команды миграции...');
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`⚙️ Команда ${i + 1}/${commands.length}: ${command.substring(0, 50)}...`);
      
      try {
        await client.query(command);
        console.log(`✅ Команда ${i + 1} выполнена`);
      } catch (error) {
        console.log(`⚠️ Команда ${i + 1} вызвала ошибку: ${error.message}`);
        
        // Если столбцы уже существуют, это нормально
        if (error.message.includes('already exists') || error.message.includes('уже существует')) {
          console.log('💡 Столбцы уже существуют, продолжаем...');
        } else {
          throw error;
        }
      }
    }

    // Проверяем результат
    console.log('🔍 Проверяем новые столбцы...');
    const result = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name IN ($2, $3)', 
      ['tasks', 'is_custom', 'custom_task_id']);
    
    console.log(`✅ Найдено столбцов: ${result.rows.length}`);
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });

    await client.end();
    
    if (result.rows.length >= 2) {
      console.log('\n🎉 Миграция успешно применена!');
      console.log('🔄 Теперь можно перезапустить бота');
    } else {
      console.log('\n⚠️ Миграция применена частично');
      showManualInstructions();
    }

  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.log('\n🔧 Выполните миграцию вручную:');
    showManualInstructions();
  }
}

function showManualInstructions() {
  console.log('\n=== ИНСТРУКЦИИ ДЛЯ РУЧНОГО ВЫПОЛНЕНИЯ ===');
  console.log('1. Откройте https://supabase.com/dashboard');
  console.log('2. Выберите ваш проект FlowBot');
  console.log('3. Перейдите в SQL Editor (левое меню)');
  console.log('4. Создайте новый запрос и выполните этот SQL:');
  console.log('\n--- SQL КОД ---');
  console.log(`ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_is_custom ON tasks(is_custom);
CREATE INDEX IF NOT EXISTS idx_tasks_custom_task_id ON tasks(custom_task_id);`);
  console.log('--- КОНЕЦ SQL ---\n');
  console.log('5. Нажмите RUN для выполнения');
  console.log('6. После успешного выполнения перезапустите бота');
  console.log('==========================================\n');
}

applyMigration();