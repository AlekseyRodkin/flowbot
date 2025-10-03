#!/usr/bin/env node
// start-bot.js - Простой запуск бота без nodemon

console.log('🚀 Запуск FlowList_Bot...\n');

// Проверяем наличие .env
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Файл .env не найден! Скопируйте .env.example в .env и настройте ключи.');
  process.exit(1);
}

// Загружаем переменные окружения
require('dotenv').config();

// Проверяем критические переменные
const required = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL', 
  'SUPABASE_SERVICE_KEY',
  'OPENAI_API_KEY'
];

let missing = [];
for (const key of required) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error('❌ Отсутствуют переменные окружения:');
  missing.forEach(key => console.error(`   - ${key}`));
  process.exit(1);
}

console.log('✅ Все ключи настроены\n');

// Запускаем бота
try {
  require('./bot/index.js');
} catch (error) {
  console.error('❌ Ошибка запуска бота:', error.message);
  console.error(error.stack);
  process.exit(1);
}
