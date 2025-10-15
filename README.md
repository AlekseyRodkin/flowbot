# 🎯 FlowBot - Telegram Bot для повышения продуктивности

> Научно обоснованная система входа в состояние потока за 30 дней

## 📋 О проекте

FlowBot - это Telegram-бот, использующий технику Flow List для повышения личной продуктивности. Основан на исследованиях нейробиологии дофаминовой мотивации и теории потока Михая Чиксентмихайи.

### 🎯 Ключевые особенности

- **30-дневная программа** постепенного входа в состояние потока
- **AI-генерация задач** персонализированных под уровень пользователя
- **Геймификация** со стриками и достижениями
- **Аналитика продуктивности** с ежедневными инсайтами
- **Интеграции** с Notion, Google Calendar (в разработке)

## 🚀 Быстрый старт

### Предварительные требования

- Node.js 18+
- PostgreSQL (через Supabase)
- Redis (опционально)
- Telegram Bot Token
- OpenAI API Key

### Установка

1. **Клонируйте репозиторий**
```bash
git clone https://github.com/yourusername/flowbot.git
cd flowbot
```

2. **Установите зависимости**
```bash
npm install
```

3. **Настройте переменные окружения**
```bash
cp .env.example .env
# Отредактируйте .env файл с вашими ключами
```

4. **Настройте базу данных Supabase**
```bash
# Создайте проект на https://supabase.com
# Выполните миграции в SQL Editor:
# 1. database/migrations/001_initial_schema.sql
# 2. database/migrations/002_seed_achievements.sql
```

5. **Запустите бота**
```bash
# Production
npm start

# Development (с hot-reload)
npm run dev
```

## ⚙️ Конфигурация

### Создание Telegram бота

1. Откройте [@BotFather](https://t.me/botfather)
2. Отправьте `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте токен в `.env` файл

### Настройка Supabase

1. Создайте аккаунт на [Supabase](https://supabase.com)
2. Создайте новый проект
3. Перейдите в SQL Editor
4. Выполните скрипты миграции из папки `database/migrations/`
5. Скопируйте URL и ключи в `.env`

### Получение OpenAI API Key

1. Зарегистрируйтесь на [OpenAI](https://platform.openai.com)
2. Создайте API ключ
3. Добавьте ключ в `.env`

## 📁 Структура проекта

```
flowbot/
├── bot/                  # Основная логика бота
│   ├── index.js         # Точка входа
│   ├── handlers/        # Обработчики команд
│   ├── keyboards/       # Клавиатуры
│   └── utils/          # Утилиты
├── src/
│   ├── services/       # Бизнес-логика
│   │   ├── aiService.js
│   │   ├── taskService.js
│   │   ├── userService.js
│   │   └── notificationService.js  # Cron-based notifications
│   ├── handlers/       # Обработчики событий
│   └── api/           # API endpoints для webhooks
├── database/           # Миграции и схема БД
├── config/            # Конфигурационные файлы
├── tests/            # Тесты
└── docs/            # Документация
```

## 🤖 Команды бота

- `/start` - Начать работу с ботом
- `/tasks` - Показать задачи на сегодня
- `/stats` - Статистика продуктивности
- `/settings` - Настройки уведомлений
- `/help` - Справка

## 📊 Система уровней

### Дни 1-5: Разгон
- 25 простых задач + 5 средних
- Активация дофаминовой системы
- Формирование привычки

### Дни 6-10: Усложнение
- 15 простых + 10 средних + 5 сложных
- Укрепление паттерна продуктивности
- Рост уверенности

### Дни 11-30: Поток (4 пятидневки)
- 10 простых + 10 средних + 10 сложных
- Устойчивое состояние потока
- Каждые 5 дней (11-15, 16-20, 21-25, 26-30) повторяется один и тот же паттерн сложности
- Максимальная продуктивность

### День 31+: Продолжение пути
- Возможность продолжать использовать бота
- Сохраняется паттерн дней 11-30
- Поддержание продуктивности

## 💎 Достижения

Система включает 30+ достижений:
- 🎯 **Первый шаг** - Выполнить все задачи в первый день
- 🔥 **Неделя в потоке** - 7 дней подряд
- 🚀 **Легенда дня** - Выполнить все 30 задач
- 👑 **Мастер потока** - Завершить 30-дневную программу

## 🔧 Разработка

### Запуск тестов
```bash
npm test
```

### Линтинг
```bash
npm run lint
```

### Форматирование
```bash
npm run format
```

## 🚀 Деплой

### VPS (рекомендуется)

Бот развёрнут на VPS с автоматическим деплоем через GitHub webhooks.

**Текущий деплой:**
- VPS: Ubuntu 22.04.5 LTS (5.129.224.93)
- Node.js 18.20.8 (через nvm)
- PM2 6.0.13 для управления процессами
- GitHub webhook для автоматического обновления

**Структура на VPS:**
```
/root/flowbot/           # Репозиторий
/root/flowbot/ecosystem.config.js  # PM2 конфигурация
/root/webhook/           # Webhook listener
```

**Процессы PM2:**
- `flowbot` - основной бот-процесс
- `webhook` - слушатель GitHub webhooks на порту 3000

#### Первоначальная настройка VPS

1. **Установите Node.js через nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 18
nvm use 18
nvm alias default 18
```

2. **Установите PM2 и Git**
```bash
npm install -g pm2
apt-get update && apt-get install -y git
```

3. **Клонируйте репозиторий**
```bash
cd /root
git clone https://github.com/AlekseyRodkin/flowbot.git
cd flowbot
npm install
```

4. **Создайте ecosystem.config.js**
```javascript
module.exports = {
  apps: [{
    name: 'flowbot',
    script: 'bot/index.js',
    cwd: '/root/flowbot',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      TELEGRAM_BOT_TOKEN: 'ваш_токен',
      TELEGRAM_BOT_USERNAME: 'FlowList_Bot',
      SUPABASE_URL: 'ваш_supabase_url',
      SUPABASE_SERVICE_KEY: 'ваш_service_key',
      SUPABASE_ANON_KEY: 'ваш_anon_key',
      OPENAI_API_KEY: 'ваш_openai_key',
      OPENAI_MODEL: 'gpt-4o-mini',
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      DEFAULT_TIMEZONE: 'Europe/Moscow',
      ADMIN_TELEGRAM_IDS: 'ваш_telegram_id',
      ADMIN_TELEGRAM_ID: 'ваш_telegram_id',
      ENABLE_AI_GENERATION: 'true',
      ENABLE_PAYMENTS: 'false',
      ENABLE_ANALYTICS: 'false',
      MAX_DAILY_TASKS: '30',
      BOT_USERNAME: 'FlowList_Bot'
    }
  }]
};
```

5. **Создайте webhook listener**
```bash
mkdir -p /root/webhook
cd /root/webhook
npm init -y
npm install express
```

Создайте `/root/webhook/index.js`:
```javascript
const express = require("express");
const { exec } = require("child_process");
const app = express();

app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("📥 Received GitHub webhook:", new Date().toISOString());

  const command = "cd /root/flowbot && git pull && export NVM_DIR=\"$HOME/.nvm\" && [ -s \"$NVM_DIR/nvm.sh\" ] && . \"$NVM_DIR/nvm.sh\" && npm install && pm2 restart ecosystem.config.js";

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Deployment error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    console.log("✅ Deployment successful");
    res.json({ success: true, message: "Deployment completed" });
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Webhook listener running on port ${PORT}`);
});
```

6. **Запустите процессы через PM2**
```bash
cd /root/flowbot
pm2 start ecosystem.config.js

cd /root/webhook
pm2 start index.js --name webhook

pm2 save
pm2 startup
```

#### Настройка GitHub Webhook

1. Откройте настройки репозитория на GitHub
2. Перейдите в **Settings → Webhooks → Add webhook**
3. Настройте webhook:
   - **Payload URL:** `http://your-vps-ip:3000/webhook`
   - **Content type:** `application/json`
   - **Events:** Выберите "Just the push event"
   - **Active:** ✓

#### Автоматический деплой

После настройки каждый `git push` в main ветку автоматически:
1. Отправляет webhook на VPS
2. Выполняет `git pull` для получения изменений
3. Устанавливает новые зависимости (`npm install`)
4. Перезапускает бота через PM2 с правильными переменными окружения

**Важно:** ecosystem.config.js решает проблему с dotenv - переменные окружения загружаются PM2 напрямую, а не через .env файл.

#### Управление PM2

```bash
# Проверить статус
pm2 status

# Просмотр логов
pm2 logs flowbot
pm2 logs webhook

# Перезапуск
pm2 restart flowbot
pm2 restart webhook

# Остановка
pm2 stop flowbot
```

#### Доступ к VPS через MCP (Model Context Protocol)

Для удобного управления VPS через Claude Code настроен SSH MCP сервер.

**Что такое MCP:**
- MCP (Model Context Protocol) - стандарт для подключения AI-ассистентов к внешним системам
- Позволяет Claude напрямую выполнять команды на удалённых серверах
- Используется для автоматизации деплоя, мониторинга и отладки

**Используемый MCP сервер:**
- **ssh-mcp** от [tufantunc](https://github.com/tufantunc/ssh-mcp)
- Обеспечивает безопасное SSH-подключение к VPS
- Поддерживает выполнение команд и чтение файлов

**Конфигурация для Claude Desktop:**

Файл `~/.claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "ssh-vps": {
      "command": "npx",
      "args": [
        "-y",
        "ssh-mcp",
        "--host=5.129.224.93",
        "--port=22",
        "--user=root",
        "--password=eyT@w7pZQ7sEzr",
        "--timeout=60000"
      ]
    }
  }
}
```

**Конфигурация для Claude Code:**

MCP серверы НЕ синхронизируются автоматически между Claude Desktop и Claude Code. Для добавления в Claude Code используйте команду:

```bash
claude mcp add --transport stdio ssh-vps -- npx -y ssh-mcp \
  --host=5.129.224.93 \
  --port=22 \
  --user=root \
  --password=eyT@w7pZQ7sEzr \
  --timeout=60000
```

**Возможности через MCP:**
- Выполнение команд на VPS (через `sshpass`)
- Проверка статуса PM2 процессов
- Просмотр логов в реальном времени
- Обновление конфигурации
- Мониторинг состояния сервера

**Альтернативные способы подключения:**

Если MCP не настроен, можно использовать стандартный SSH:
```bash
ssh root@5.129.224.93
# или
sshpass -p 'eyT@w7pZQ7sEzr' ssh root@5.129.224.93
```

**Примеры использования через MCP:**

Claude Code может выполнять команды напрямую через MCP:
```bash
# Проверить статус
pm2 status

# Просмотр логов последнего деплоя
pm2 logs webhook --lines 50 --nostream

# Проверить использование ресурсов
top -bn1 | head -20

# Проверить версию Node.js
node --version
```

**Безопасность:**

⚠️ **Важно:** Пароль хранится в конфигурации MCP. Для production рекомендуется:
1. Использовать SSH-ключи вместо пароля
2. Ограничить доступ по IP через firewall
3. Настроить sudo вместо root-доступа
4. Использовать отдельного пользователя для деплоя

### Heroku (альтернатива)
```bash
heroku create flowbot-app
heroku addons:create heroku-redis:hobby-dev
git push heroku main
```

### Docker (альтернатива)
```bash
docker build -t flowbot .
docker run -d --env-file .env flowbot
```

## 📈 Мониторинг

Бот автоматически логирует:
- Все команды и взаимодействия
- Ошибки и исключения
- Метрики производительности
- Статистику использования

Логи сохраняются в:
- `error.log` - ошибки
- `combined.log` - все события
- PM2 логи на VPS: `/root/.pm2/logs/`

## 🔧 Решение проблем

### Telegram 401 Unauthorized после обновления токена

**Проблема:** После обновления `TELEGRAM_BOT_TOKEN` в `.env` файле бот продолжает показывать ошибку 401.

**Причина:** `dotenv` загружает переменные окружения только один раз при запуске процесса. PM2 restart не подхватывает новые значения из `.env`.

**Решение:** Используйте `ecosystem.config.js` для явного указания переменных окружения:

1. Создайте файл `ecosystem.config.js` (см. раздел Деплой)
2. Укажите все переменные в секции `env`
3. Перезапустите через PM2:
```bash
pm2 delete flowbot
pm2 start ecosystem.config.js
pm2 save
```

### Telegram 409 Conflict: terminated by other getUpdates

**Проблема:** Бот показывает ошибку "Conflict: terminated by other getUpdates request".

**Причина:** Другой экземпляр бота с тем же токеном уже запущен (например, на другом сервере).

**Решение:**
1. Проверьте все запущенные экземпляры бота
2. Остановите старые экземпляры
3. Удалите webhook (если был настроен):
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook?drop_pending_updates=true"
```
4. Как крайняя мера - создайте новый бот через @BotFather и обновите токен

### PM2 процесс не перезапускается после обновления

**Проблема:** После `git pull` изменения не применяются.

**Решение:** Убедитесь, что webhook выполняет:
```bash
pm2 restart ecosystem.config.js  # НЕ просто "pm2 restart flowbot"
```

Это гарантирует, что PM2 перечитает конфигурацию с переменными окружения.

## 🤝 Вклад в проект

Мы приветствуем любой вклад в развитие проекта!

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📝 Лицензия

Распространяется под лицензией MIT. Смотрите `LICENSE` для подробностей.

## 💬 Поддержка

- Telegram: [@flowbot_support](https://t.me/flowbot_support)
- Email: support@flowbot.ai
- GitHub Issues: [Создать issue](https://github.com/yourusername/flowbot/issues)

## 🙏 Благодарности

- [Mihaly Csikszentmihalyi](https://en.wikipedia.org/wiki/Mihaly_Csikszentmihalyi) - за теорию потока
- [BJ Fogg](https://www.bjfogg.com/) - за методологию Tiny Habits
- [OpenAI](https://openai.com) - за GPT API
- [Supabase](https://supabase.com) - за отличный BaaS

---

**Made with ❤️ by Aleksey Rodkin**
