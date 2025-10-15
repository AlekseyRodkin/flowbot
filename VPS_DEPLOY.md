# VPS Deployment Guide - FlowBot на Ubuntu 22.04

## 📦 Инфраструктура

**VPS сервер:** 5.129.224.93
**OS:** Ubuntu 22.04.5 LTS
**Process Manager:** PM2 (2 instances в cluster mode)
**Auto-deploy:** GitHub webhook через src/api/webhooks.js
**Доступ:** SSH root@5.129.224.93 (пароль: eyT@w7pZQ7sEzr)

## 🚀 Процесс деплоя

### Автоматический деплой (рекомендуется)

```
Git push на main → GitHub webhook → автоматический деплой на VPS
```

**Webhook URL:** http://5.129.224.93:3001/api/webhooks/github-deploy

**Что происходит:**
1. Пуш в GitHub на ветку main
2. GitHub отправляет webhook на VPS
3. Скрипт запускает `deploy.sh`
4. PM2 перезагружает бота без downtime

### Ручной деплой

```bash
# Подключиться к VPS
ssh root@5.129.224.93

# Перейти в директорию проекта
cd /root/flowbot

# Запустить скрипт деплоя
./deploy.sh
```

## 📂 Структура проекта на VPS

```
/root/flowbot/
├── bot/                    # Telegram bot код
├── src/                    # Сервисы и хендлеры
│   ├── api/               # Webhook API
│   │   ├── server.js      # Express сервер
│   │   └── webhooks.js    # Webhook endpoints
│   ├── handlers/          # Обработчики команд
│   ├── services/          # Бизнес логика
│   └── utils/             # Утилиты
├── logs/                   # PM2 логи
├── backups/               # Автоматические бэкапы
├── .env                   # Переменные окружения
├── ecosystem.config.js    # PM2 конфигурация
├── deploy.sh             # Скрипт деплоя
└── package.json
```

## ⚙️ Компоненты системы

### 1. PM2 Configuration (ecosystem.config.js)

```javascript
{
  name: 'flowbot',
  script: 'bot/index.js',
  instances: 2,              // 2 инстанса для отказоустойчивости
  exec_mode: 'cluster',      // Cluster mode
  max_memory_restart: '500M',
  autorestart: true,
  error_file: 'logs/pm2-error.log',
  out_file: 'logs/pm2-out.log'
}
```

**Особенности:**
- 2 процесса работают параллельно
- Автоматический перезапуск при падении
- Ограничение памяти: 500MB на процесс
- Логи пишутся в `logs/`

### 2. Deploy Script (deploy.sh)

```bash
#!/bin/bash
# Автоматический деплой без downtime

1. Создает бэкап текущей версии → backups/YYYYMMDD_HHMMSS/
2. Делает git pull origin main
3. Устанавливает зависимости: npm install --production
4. Перезагружает PM2: pm2 reload ecosystem.config.js
5. Показывает статус и последние логи
```

**Преимущества:**
- Zero downtime (PM2 reload)
- Автоматические бэкапы перед деплоем
- Проверка наличия .env файла
- Логи процесса деплоя

### 3. Webhook API (src/api/webhooks.js)

API для автоматизации и интеграций:

```
POST /api/webhooks/github-deploy     # GitHub webhook для автодеплоя
POST /api/webhooks/send-morning-tasks # Отправка утренних задач
POST /api/webhooks/send-evening-reflection # Вечерняя рефлексия
GET  /api/webhooks/active-users       # Список активных пользователей
POST /api/webhooks/update-user-level  # Обновление уровня пользователя
GET  /api/webhooks/health             # Health check
```

**Аутентификация:** API Key через заголовок `X-API-Key` или query параметр `?api_key=...`

**Пример использования:**
```bash
curl -X POST "http://5.129.224.93:3001/api/webhooks/health" \
  -H "X-API-Key: flowbot_webhook_secret_key_2024"
```

### 4. Environment Variables (.env на сервере)

```bash
# Расположение: /root/flowbot/.env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=FlowList_Bot
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
OPENAI_API_KEY=...
NODE_ENV=production
PORT=3001
DEFAULT_TIMEZONE=Europe/Moscow
ADMIN_TELEGRAM_IDS=272559647
...
```

**ВАЖНО:** Все переменные загружаются через `dotenv` при старте бота

## 📊 Мониторинг и управление

### Команды PM2

```bash
# Статус всех процессов
pm2 status

# Логи в реальном времени
pm2 logs flowbot

# Последние 50 строк логов
pm2 logs flowbot --lines 50

# Интерактивный монитор (CPU, memory)
pm2 monit

# Перезапуск бота
pm2 reload flowbot

# Остановка бота
pm2 stop flowbot

# Запуск бота
pm2 start ecosystem.config.js

# Полная перезагрузка
pm2 restart flowbot
```

### Проверка здоровья бота

```bash
# Health check через API
curl http://5.129.224.93:3001/api/webhooks/health

# Проверка процесса
ps aux | grep flowbot

# Проверка портов
netstat -tlnp | grep 3001

# Логи последних 100 строк
pm2 logs flowbot --lines 100 --nostream
```

### Логи

```bash
# PM2 логи
/root/flowbot/logs/pm2-out.log    # Стандартный вывод
/root/flowbot/logs/pm2-error.log  # Ошибки

# Application логи
/root/flowbot/error.log           # Winston error log
/root/flowbot/combined.log        # Winston combined log
```

## 🔧 Частые операции

### Обновление бота вручную

```bash
ssh root@5.129.224.93
cd /root/flowbot
./deploy.sh
```

### Откат к предыдущей версии

```bash
cd /root/flowbot
ls backups/                    # Список бэкапов
cp -r backups/20250115_140530/* .  # Восстановление
pm2 reload flowbot
```

### Просмотр переменных окружения

```bash
cd /root/flowbot
cat .env
```

### Обновление .env файла

```bash
ssh root@5.129.224.93
cd /root/flowbot
nano .env                      # Редактируем
pm2 reload flowbot --update-env  # Применяем изменения
```

### Чистка старых бэкапов

```bash
cd /root/flowbot
rm -rf backups/*               # Удалить все
# или
find backups/ -mtime +7 -delete  # Старше 7 дней
```

## 🚨 Troubleshooting

### Бот не отвечает

```bash
# 1. Проверить статус PM2
pm2 status flowbot

# 2. Проверить логи
pm2 logs flowbot --lines 100

# 3. Перезапустить
pm2 restart flowbot

# 4. Если не помогло - полный перезапуск
pm2 delete flowbot
pm2 start ecosystem.config.js
```

### Высокое потребление памяти

```bash
# Проверить потребление
pm2 monit

# Принудительный перезапуск если > 500MB
pm2 reload flowbot
```

### Webhook не работает

```bash
# Проверить доступность API
curl http://5.129.224.93:3001/api/webhooks/health

# Проверить порт 3001
netstat -tlnp | grep 3001

# Проверить логи API
pm2 logs flowbot | grep "API server"
```

### Git конфликты при деплое

```bash
cd /root/flowbot
git status
git stash                    # Сохранить локальные изменения
git pull origin main
./deploy.sh
```

## 📝 Настройка GitHub Webhook

### В GitHub репозитории:

1. Settings → Webhooks → Add webhook
2. Payload URL: `http://5.129.224.93:3001/api/webhooks/github-deploy`
3. Content type: `application/json`
4. Secret: (оставить пустым)
5. Events: Just the push event
6. Active: ✅

### Проверка webhook:

```bash
# В GitHub → Settings → Webhooks → Recent Deliveries
# Статус должен быть: ✅ 200 OK
```

## 🔐 Безопасность

1. **SSH доступ:** Только по паролю (рекомендуется добавить SSH ключи)
2. **API ключи:** Хранятся в .env, не коммитятся в git
3. **Webhook:** Открыт для GitHub, защищен API ключом для других эндпоинтов
4. **Firewall:** Открыты порты 22 (SSH), 3001 (API)

## 📚 Дополнительные ресурсы

- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Старая документация по Timeweb Cloud Apps](docs/legacy/TIMEWEB_CLOUD_APPS.md)
- [Конфигурация pre-deploy checklist](.claude/pre-deploy-checklist.md)

---

**Последнее обновление:** 2025-10-15
**Автор:** FlowBot Team
**VPS:** Timeweb Cloud
