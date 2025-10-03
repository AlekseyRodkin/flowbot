#!/bin/bash

# FlowBot Deployment Script
# Обновление бота на production без downtime

set -e

echo "🚀 Starting FlowBot deployment..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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
cp -r bot/ src/ $BACKUP_DIR/
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

# Reload PM2 без downtime
echo -e "${YELLOW}🔄 Reloading PM2...${NC}"
if pm2 list | grep -q "flowbot"; then
    pm2 reload ecosystem.config.js --update-env
    echo -e "${GREEN}✅ PM2 reloaded successfully${NC}"
else
    echo -e "${YELLOW}🆕 First deployment, starting PM2...${NC}"
    pm2 start ecosystem.config.js
    pm2 save
    echo -e "${GREEN}✅ PM2 started and saved${NC}"
fi

# Проверка статуса
sleep 3
echo -e "${YELLOW}🔍 Checking status...${NC}"
pm2 status flowbot

# Показать логи
echo -e "${YELLOW}📋 Recent logs:${NC}"
pm2 logs flowbot --lines 20 --nostream

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📊 Monitor: pm2 monit${NC}"
echo -e "${GREEN}📋 Logs: pm2 logs flowbot${NC}"
