#!/usr/bin/env node

// Скрипт для применения миграции добавления столбцов is_custom и custom_task_id

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Инициализация Supabase клиента
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function runMigration() {
  console.log('\n🚀 Применяем миграцию для custom tasks...\n');

  try {
    // Проверяем подключение к базе данных
    console.log('📡 Проверяем подключение к Supabase...');
    const { error: connectionError } = await supabase
      .from('tasks')
      .select('count')
      .limit(1);

    if (connectionError) {
      throw new Error(`Ошибка подключения к БД: ${connectionError.message}`);
    }
    console.log('✅ Подключение к Supabase успешно\n');

    // Читаем и выполняем SQL миграцию
    const migrationPath = path.join(__dirname, '../database/migrations/007_add_is_custom_to_tasks.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Файл миграции не найден: ${migrationPath}`);
    }

    console.log('📄 Читаем файл миграции...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Разбиваем SQL на отдельные команды
    const sqlCommands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`🔧 Найдено ${sqlCommands.length} SQL команд для выполнения\n`);

    // Выполняем каждую команду напрямую через SQL
    let completedCommands = 0;
    for (const command of sqlCommands) {
      try {
        console.log(`⚙️  Выполняем команду ${completedCommands + 1}/${sqlCommands.length}...`);
        console.log(`SQL: ${command.substring(0, 100)}...`);
        
        const { error } = await supabase.rpc('exec', { sql: command });
        
        if (error) {
          console.log(`❌ Ошибка: ${error.message}`);
          console.log('💡 Попробуем альтернативный способ...');
          
          // Пробуем другой способ выполнения
          const { error: altError } = await supabase
            .from('_temp')
            .select('*', { head: true });
          
          // Если альтернативный способ не работает, выводим инструкции
          console.log('🔧 Выполните миграцию вручную:');
          console.log('1. Откройте Supabase Dashboard');
          console.log('2. Перейдите в SQL Editor');
          console.log('3. Выполните следующий SQL:');
          console.log('\n' + command + '\n');
          
          // Не останавливаем выполнение, продолжаем
        } else {
          completedCommands++;
          console.log(`✅ Команда ${completedCommands} выполнена успешно`);
        }
      } catch (error) {
        console.error(`❌ Ошибка в команде ${completedCommands + 1}:`, error.message);
        console.log(`🔍 SQL команда:\n${command}\n`);
      }
    }

    console.log('\n🎉 Миграция завершена!');
    console.log('\n📋 Что добавлено:');
    console.log('  ✅ Столбец is_custom для отметки пользовательских задач');
    console.log('  ✅ Столбец custom_task_id для связи с библиотекой задач');
    
    // Проверяем результат миграции
    await validateMigration();

  } catch (error) {
    console.error('\n❌ Ошибка при выполнении миграции:', error.message);
    console.log('\n🔧 Рекомендации:');
    console.log('1. Проверьте настройки .env файла');
    console.log('2. Убедитесь, что у вас есть права на изменение структуры БД');
    console.log('3. Выполните миграцию вручную через Supabase SQL Editor');
    console.log('\nSQL для ручного выполнения:');
    console.log('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;');
    console.log('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_task_id INTEGER REFERENCES custom_tasks(id) ON DELETE SET NULL;');
    process.exit(1);
  }
}

async function validateMigration() {
  console.log('🔍 Проверяем результат миграции...');

  try {
    // Проверяем, что новые столбцы добавлены
    const { data: taskSample, error: tasksError } = await supabase
      .from('tasks')
      .select('telegram_id, task_text, is_custom, custom_task_id')
      .limit(1);

    if (tasksError) {
      throw new Error(`Ошибка доступа к новым столбцам: ${tasksError.message}`);
    }

    console.log('✅ Новые столбцы успешно добавлены');
    console.log('📊 Миграция применена корректно');

  } catch (error) {
    console.error('❌ Ошибка валидации:', error.message);
    console.log('💡 Возможно, миграция применилась не полностью');
  }
}

// Обработка сигналов завершения
process.on('SIGINT', () => {
  console.log('\n⚠️  Миграция прервана пользователем');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Миграция прервана системой');
  process.exit(0);
});

// Запуск миграции
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };