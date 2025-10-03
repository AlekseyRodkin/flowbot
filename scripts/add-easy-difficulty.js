// scripts/add-easy-difficulty.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют переменные окружения SUPABASE_URL или SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🚀 Начинаем миграцию для добавления поддержки легких задач...\n');

    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_add_easy_difficulty.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('📄 Выполняем SQL миграцию...');
    
    // Разбиваем SQL на отдельные команды по точке с запятой
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (const command of commands) {
      if (command.length > 0) {
        console.log(`\nВыполняем команду:\n${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
        
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: command + ';'
        });
        
        if (error) {
          // Если функция exec_sql не существует, попробуем через прямой SQL запрос
          if (error.message.includes('exec_sql')) {
            console.log('⚠️ Функция exec_sql не найдена. Используем альтернативный подход...');
            
            // Для Supabase нужно будет выполнить миграцию через Dashboard или CLI
            console.log('\n⚠️ ВАЖНО: Выполните следующие SQL команды в Supabase SQL Editor:\n');
            console.log('```sql');
            console.log(migrationSQL);
            console.log('```\n');
            
            console.log('Или используйте Supabase CLI:');
            console.log('supabase db push --db-url "ваш_connection_string"\n');
            
            return;
          }
          throw error;
        }
        
        console.log('✅ Команда выполнена успешно');
      }
    }

    console.log('\n🎉 Миграция успешно завершена!');
    console.log('✅ Теперь можно создавать задачи с уровнем сложности "easy"');

  } catch (error) {
    console.error('❌ Ошибка при выполнении миграции:', error);
    
    if (error.message?.includes('permission denied')) {
      console.log('\n⚠️ У вас нет прав для изменения структуры базы данных.');
      console.log('Выполните SQL команды через Supabase Dashboard:\n');
      
      const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '007_add_easy_difficulty.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf8');
      console.log('```sql');
      console.log(migrationSQL);
      console.log('```');
    }
    
    process.exit(1);
  }
}

// Запускаем миграцию
runMigration();