#!/bin/bash
# Скрипт для очистки webhook и запуска бота

echo "🧹 Очистка webhook..."

# Загружаем переменные окружения
source .env

# Удаляем webhook если он установлен
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" > /dev/null

echo "✅ Webhook очищен"
echo "🚀 Запуск бота..."

# Запускаем бота
node working-bot.js
