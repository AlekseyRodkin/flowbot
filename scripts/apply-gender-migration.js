#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function applyMigration() {
  console.log('🚀 Применяем миграцию для добавления поля gender...\n');

  try {
    // Читаем SQL из файла миграции
    const migrationPath = path.join(__dirname, '../database/migrations/008_add_gender_field.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 SQL миграции:');
    console.log(migrationSQL);
    console.log('\n');

    // Выполняем миграцию через Supabase
    console.log('⚙️ Выполняем миграцию...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });

    if (error) {
      console.log('⚠️ Не удалось выполнить через RPC, требуется ручное выполнение.');
      console.log('\n💡 ВЫПОЛНИ ЭТУ МИГРАЦИЮ ВРУЧНУЮ в Supabase Dashboard:');
      console.log('1. Открой https://supabase.com/dashboard');
      console.log('2. Выбери проект');
      console.log('3. SQL Editor → New Query');
      console.log('4. Вставь этот SQL:\n');
      console.log('='.repeat(60));
      console.log(migrationSQL);
      console.log('='.repeat(60));
      console.log('\n5. Нажми Run');
      return;
    }

    console.log('✅ Миграция успешно применена!');
    console.log('\nТеперь в таблице users есть поле gender для хранения пола пользователя.');
    console.log('Возможные значения: "male", "female", или NULL');

  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    console.log('\n💡 ВЫПОЛНИ МИГРАЦИЮ ВРУЧНУЮ в Supabase Dashboard');
    console.log('Команда SQL находится в файле: database/migrations/008_add_gender_field.sql');
  }
}

applyMigration();
