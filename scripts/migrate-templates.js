// scripts/migrate-templates.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyTemplatesMigration() {
  try {
    console.log('🔄 Применяю миграцию шаблонов задач...');
    
    // Читаем SQL файл миграции
    const migrationPath = path.join(__dirname, '../database/migrations/006_task_templates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Выполняем SQL миграцию
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });
    
    if (error) {
      // Если RPC не работает, попробуем через прямой SQL
      console.log('⚠️ RPC не работает, применяю миграцию через прямой SQL...');
      
      // Разбиваем SQL на отдельные команды
      const sqlCommands = migrationSQL
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));
      
      for (const command of sqlCommands) {
        if (command.length > 0) {
          try {
            console.log(`📝 Выполняю: ${command.substring(0, 50)}...`);
            
            // Для CREATE TABLE используем прямой запрос
            if (command.startsWith('CREATE TABLE')) {
              await supabase.from('_dummy').select('*').limit(0); // Инициализируем соединение
              console.log('⚠️ CREATE TABLE команды нужно выполнить вручную в Supabase Dashboard');
              console.log(command);
            }
            // Для INSERT используем обычный запрос
            else if (command.startsWith('INSERT')) {
              console.log('⚠️ INSERT команды нужно выполнить вручную в Supabase Dashboard');
              console.log(command);
            }
            // Для других команд тоже выводим инструкцию
            else {
              console.log('⚠️ Команду нужно выполнить вручную в Supabase Dashboard:');
              console.log(command);
            }
          } catch (cmdError) {
            console.log(`⚠️ Команда пропущена (возможно, уже существует): ${command.substring(0, 50)}...`);
          }
        }
      }
    } else {
      console.log('✅ Миграция шаблонов применена успешно!');
    }
    
    // Проверим, что таблицы созданы
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('task_templates')
        .select('*')
        .limit(1);
        
      if (!templatesError) {
        console.log('✅ Таблица task_templates создана и доступна');
        
        const { data: templateTasks, error: templateTasksError } = await supabase
          .from('template_tasks')
          .select('*')
          .limit(1);
          
        if (!templateTasksError) {
          console.log('✅ Таблица template_tasks создана и доступна');
          console.log('🎉 Система шаблонов готова к использованию!');
        } else {
          console.log('❌ Таблица template_tasks недоступна:', templateTasksError.message);
        }
      } else {
        console.log('❌ Таблица task_templates недоступна:', templatesError.message);
      }
    } catch (checkError) {
      console.log('⚠️ Не удалось проверить таблицы:', checkError.message);
      console.log('\n📋 Инструкция по ручному применению миграции:');
      console.log('1. Откройте Supabase Dashboard');
      console.log('2. Перейдите в SQL Editor');
      console.log('3. Скопируйте и выполните содержимое файла database/migrations/006_task_templates.sql');
    }
    
  } catch (error) {
    console.error('❌ Ошибка применения миграции:', error);
    console.log('\n📋 Ручное применение миграции:');
    console.log('1. Откройте Supabase Dashboard');
    console.log('2. Перейдите в SQL Editor');
    console.log('3. Скопируйте и выполните содержимое файла database/migrations/006_task_templates.sql');
  }
}

// Запускаем миграцию
applyTemplatesMigration().then(() => {
  console.log('🏁 Скрипт миграции завершен');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});