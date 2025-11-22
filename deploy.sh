#!/bin/bash

# FlowBot Deployment Script
# Обновление бота на production

set -e

echo "🚀 Starting FlowBot deployment..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Загружаем NVM если доступен
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Переходим в директорию проекта
cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

echo -e "${YELLOW}📁 Project directory: $PROJECT_DIR${NC}"
echo -e "${YELLOW}🔧 Node version: $(node --version 2>/dev/null || echo 'not found')${NC}"

# Проверка изменений в git
echo -e "${YELLOW}📡 Checking for updates...${NC}"
git fetch origin

LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✅ Already up to date${NC}"
    exit 0
fi

# Бэкап текущей версии
echo -e "${YELLOW}💾 Creating backup...${NC}"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
cp -r bot/ src/ $BACKUP_DIR/ 2>/dev/null || echo "Some files not backed up"
echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"

# Обновление кода
echo -e "${YELLOW}⬇️  Pulling latest changes...${NC}"
git pull origin main

# Установка зависимостей
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install --production

# Проверка конфигурации
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

# Поиск и остановка текущего процесса
echo -e "${YELLOW}🔍 Finding running bot process...${NC}"
BOT_PID=$(ps aux | grep "node.*bot/index.js" | grep -v grep | awk '{print $2}' | head -1)

if [ -n "$BOT_PID" ]; then
    echo -e "${YELLOW}🛑 Stopping bot (PID: $BOT_PID)...${NC}"
    kill $BOT_PID
    sleep 2

    # Проверяем, что процесс действительно остановлен
    if kill -0 $BOT_PID 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Process still running, force killing...${NC}"
        kill -9 $BOT_PID
        sleep 1
    fi
    echo -e "${GREEN}✅ Bot stopped${NC}"
else
    echo -e "${YELLOW}ℹ️  No running bot process found${NC}"
fi

# Запуск нового процесса
echo -e "${YELLOW}🚀 Starting bot...${NC}"
cd "$PROJECT_DIR"
nohup node bot/index.js > logs/bot.log 2>&1 &
NEW_PID=$!

echo -e "${GREEN}✅ Bot started (PID: $NEW_PID)${NC}"

# Проверка что процесс запустился
sleep 3
if kill -0 $NEW_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Bot is running${NC}"

    # Показать последние логи
    echo -e "${YELLOW}📋 Recent logs:${NC}"
    tail -20 logs/bot.log 2>/dev/null || echo "No logs yet"
else
    echo -e "${RED}❌ Bot failed to start${NC}"
    tail -50 logs/bot.log 2>/dev/null
    exit 1
fi

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📊 Monitor: tail -f logs/bot.log${NC}"
echo -e "${GREEN}🔍 Check process: ps aux | grep 'node.*bot/index.js'${NC}"
