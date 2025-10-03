#!/bin/bash
# scripts/quick-start.sh
# Быстрый запуск FlowBot за 5 минут

echo "🚀 FlowBot Quick Start"
echo "======================"
echo ""

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo "Установите Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js найден: $(node -v)"
echo ""

# Проверяем наличие npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не установлен!"
    exit 1
fi

echo "✅ npm найден: $(npm -v)"
echo ""

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo ""
    echo "📋 Создаем .env файл..."
    cp .env.example .env
    echo "✅ .env файл создан"
    echo ""
    echo "⚠️  ВАЖНО: Откройте .env файл и добавьте ваши ключи:"
    echo ""
    echo "1. TELEGRAM_BOT_TOKEN - получите от @BotFather"
    echo "2. SUPABASE_URL и SUPABASE_SERVICE_KEY - из вашего проекта Supabase"
    echo "3. OPENAI_API_KEY - из platform.openai.com"
    echo ""
    echo "После добавления ключей запустите: npm start"
    exit 0
fi

# Проверяем заполнены ли ключи
if grep -q "your_telegram_bot_token" .env; then
    echo ""
    echo "⚠️  Похоже, вы еще не настроили .env файл"
    echo "Откройте .env и добавьте ваши ключи"
    exit 1
fi

echo "✅ .env файл найден и настроен"
echo ""

# Проверяем подключение к Supabase
echo "🔍 Проверяем подключение к базе данных..."
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
supabase.from('users').select('count').limit(1).then(({error}) => {
  if (error) {
    console.log('❌ Ошибка подключения к базе данных:', error.message);
    process.exit(1);
  } else {
    console.log('✅ База данных подключена');
  }
});
"

echo ""
echo "🎯 Все готово! Запускаем бота..."
echo ""

# Запускаем бота
npm start
