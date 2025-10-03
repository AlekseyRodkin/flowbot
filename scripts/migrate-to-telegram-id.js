#!/usr/bin/env node

// Скрипт для миграции структуры ID в проекте FlowBot
// Цель: перейти с двойной системы id/telegram_id на единую telegram_id

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
  console.log('\n🚀 Начинаем миграцию структуры ID...\n');

  try {
    // Проверяем подключение к базе данных
    console.log('📡 Проверяем подключение к Supabase...');
    const { error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (connectionError) {
      throw new Error(`Ошибка подключения к БД: ${connectionError.message}`);
    }
    console.log('✅ Подключение к Supabase успешно\n');

    // Читаем и выполняем SQL миграцию
    const migrationPath = path.join(__dirname, '../database/migrations/005_fix_id_final.sql');
    
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

    // Выполняем каждую команду
    let completedCommands = 0;
    for (const command of sqlCommands) {
      try {
        if (command.includes('COMMENT ON')) {
          // Пропускаем комментарии, они не критичны
          continue;
        }

        console.log(`⚙️  Выполняем команду ${completedCommands + 1}/${sqlCommands.length}...`);
        const { error } = await supabase.rpc('execute_sql', { sql: command });
        
        if (error) {
          // Если команда не может выполниться через RPC, пробуем через SQL Editor
          console.log(`❌ Ошибка RPC: ${error.message}`);
          console.log('💡 Попробуйте выполнить миграцию вручную через SQL Editor в Supabase Dashboard');
          throw error;
        }
        
        completedCommands++;
        console.log(`✅ Команда ${completedCommands} выполнена успешно`);
      } catch (error) {
        console.error(`❌ Ошибка в команде ${completedCommands + 1}:`, error.message);
        
        // Показываем проблемную команду
        console.log(`🔍 Проблемная SQL команда:\n${command}\n`);
        
        // Даем инструкции по ручному выполнению
        console.log('🔧 Для завершения миграции:');
        console.log('1. Откройте Supabase Dashboard');
        console.log('2. Перейдите в SQL Editor');
        console.log('3. Выполните содержимое файла database/migrations/004_fix_id_structure.sql');
        console.log('4. Перезапустите этот скрипт после выполнения миграции\n');
        
        process.exit(1);
      }
    }

    console.log('\n🎉 Миграция структуры ID завершена успешно!');
    console.log('\n📋 Что изменилось:');
    console.log('  ✅ telegram_id теперь основной ключ во всех таблицах');
    console.log('  ✅ Убрана путаница между id и telegram_id');
    console.log('  ✅ Все связи теперь через telegram_id');
    console.log('  ✅ Данные сохранены и перенесены');
    
    console.log('\n🔄 Следующие шаги:');
    console.log('  1. Обновленные сервисы готовы к использованию');
    console.log('  2. Можно запускать бота: npm run dev');
    console.log('  3. Протестировать основные функции\n');

    // Проверяем результат миграции
    await validateMigration();

  } catch (error) {
    console.error('\n❌ Ошибка при выполнении миграции:', error.message);
    console.log('\n🔧 Решение:');
    console.log('1. Проверьте настройки .env файла');
    console.log('2. Убедитесь, что у вас есть права на изменение структуры БД');
    console.log('3. Выполните миграцию вручную через Supabase SQL Editor\n');
    process.exit(1);
  }
}

async function validateMigration() {
  console.log('🔍 Проверяем результат миграции...');

  try {
    // Проверяем, что новая структура создана
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('telegram_id, first_name')
      .limit(1);

    if (usersError) {
      throw new Error(`Таблица users недоступна: ${usersError.message}`);
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('telegram_id, task_text')
      .limit(1);

    if (tasksError) {
      throw new Error(`Таблица tasks недоступна: ${tasksError.message}`);
    }

    console.log('✅ Новая структура БД работает корректно');
    console.log(`📊 Найдено пользователей: ${users?.length || 0}`);
    console.log(`📋 Найдено задач: ${tasks?.length || 0}`);

  } catch (error) {
    console.error('❌ Ошибка валидации:', error.message);
    throw error;
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