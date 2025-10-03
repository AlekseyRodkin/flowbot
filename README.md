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

### Heroku
```bash
heroku create flowbot-app
heroku addons:create heroku-redis:hobby-dev
git push heroku main
```

### Docker
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
