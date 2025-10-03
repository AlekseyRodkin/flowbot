#!/bin/bash

echo "🎯 FlowBot Setup Script"
echo "======================="
echo ""

# Проверка Node.js
echo "📦 Checking Node.js version..."
node_version=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Проверка версии Node.js
major_version=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')
if [ $major_version -lt 18 ]; then
    echo "❌ Node.js version is $node_version. Please upgrade to Node.js 18+"
    exit 1
fi
echo "✅ Node.js $node_version found"

# Установка зависимостей
echo ""
echo "📦 Installing dependencies..."
npm install

# Создание .env файла если его нет
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Создание директорий для логов
echo ""
echo "📁 Creating log directories..."
mkdir -p logs
mkdir -p data

# Проверка настроек
echo ""
echo "🔍 Checking configuration..."
echo ""
echo "Please make sure you have:"
echo "  1. Created a Telegram bot via @BotFather"
echo "  2. Set up a Supabase project"
echo "  3. Obtained OpenAI API key"
echo "  4. Updated the .env file with your credentials"
echo ""

# Опциональный запуск миграций
echo "Would you like to display the database migration SQL? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    echo ""
    echo "📋 Database Migration SQL:"
    echo "=========================="
    cat database/migrations/001_initial_schema.sql
    echo ""
    echo "📋 Seed Data SQL:"
    echo "================"
    cat database/migrations/002_seed_achievements.sql
    echo ""
    echo "Copy and run these in your Supabase SQL Editor."
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the bot:"
echo "  npm run dev  # Development mode"
echo "  npm start    # Production mode"
echo ""
echo "Happy flowing! 🚀"
