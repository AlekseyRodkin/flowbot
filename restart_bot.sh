#!/bin/bash

echo "🔄 Перезапуск FlowBot с исправлениями..."

# Переход в директорию проекта
cd /Users/alekseyrodkin/Library/CloudStorage/GoogleDrive-alekseyrodkin@gmail.com/Мой\ диск/00_АКТИВНЫЕ_ПРОЕКТЫ/Flowbot

# Остановка всех процессов node
echo "⏹️ Остановка старых процессов..."
pkill -f "node.*bot" 2>/dev/null

# Применение миграции в Supabase (если нужно)
echo "🗄️ Примените миграцию 004_fix_user_progress.sql в Supabase"
echo "Файл: database/migrations/004_fix_user_progress.sql"

# Установка зависимостей
echo "📦 Проверка зависимостей..."
npm install --silent

# Запуск бота
echo "🚀 Запуск FlowBot..."
npm run dev

echo "✅ Бот запущен! Проверьте в Telegram: @FlowList_Bot"
