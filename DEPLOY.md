# 🚀 FlowBot - Инструкция по деплою на VPS

## Подготовка VPS

### 1. Подключение к серверу
```bash
ssh root@your-server-ip
```

### 2. Установка Node.js 18+
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt update
sudo apt install -y nodejs git
```

### 3. Установка PM2
```bash
npm install -g pm2
```

### 4. Создание пользователя для бота (опционально, для безопасности)
```bash
adduser flowbot
usermod -aG sudo flowbot
su - flowbot
```

---

## Первый деплой

### 1. Клонирование проекта
```bash
cd ~
git clone https://github.com/yourusername/flowbot.git
cd flowbot
```

### 2. Установка зависимостей
```bash
npm install --production
```

### 3. Настройка переменных окружения
```bash
nano .env
```

**Обязательные переменные:**
```env
# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# OpenAI
OPENAI_API_KEY=your_openai_key

# Server
PORT=3000
NODE_ENV=production

# Redis (опционально)
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 4. Запуск бота через PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Скопируй и выполни команду, которую выдаст `pm2 startup`

### 5. Проверка статуса
```bash
pm2 status
pm2 logs flowbot
```

---

## Обновление бота (Zero-downtime)

### Автоматическое обновление через скрипт
```bash
cd ~/flowbot
chmod +x deploy.sh
./deploy.sh
```

### Ручное обновление
```bash
cd ~/flowbot
git pull origin main
npm install --production
pm2 reload flowbot --update-env
```

---

## Мониторинг и управление

### Просмотр логов
```bash
pm2 logs flowbot           # В реальном времени
pm2 logs flowbot --lines 100  # Последние 100 строк
pm2 logs flowbot --err     # Только ошибки
```

### Мониторинг производительности
```bash
pm2 monit                  # Интерактивный монитор
pm2 status                 # Статус процессов
```

### Перезапуск
```bash
pm2 reload flowbot         # Graceful reload (рекомендуется)
pm2 restart flowbot        # Жесткий рестарт
```

### Остановка
```bash
pm2 stop flowbot           # Остановить
pm2 delete flowbot         # Удалить из PM2
```

---

## Настройка автозапуска

PM2 автоматически перезапустит бота при:
- Крашах приложения
- Превышении лимита памяти (500MB)
- Перезагрузке сервера

Убедись, что выполнил:
```bash
pm2 save
pm2 startup
```

---

## Настройка Nginx (опционально, для webhook mode)

Если планируешь использовать webhook вместо long polling:

### 1. Установка Nginx
```bash
sudo apt install nginx
```

### 2. Конфигурация
```bash
sudo nano /etc/nginx/sites-available/flowbot
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/flowbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. SSL сертификат (Let's Encrypt)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Troubleshooting

### Бот не запускается
```bash
# Проверь логи
pm2 logs flowbot --err

# Проверь переменные окружения
cat .env

# Проверь порт
netstat -tuln | grep 3000
```

### Высокое использование памяти
```bash
# Уменьши количество инстансов в ecosystem.config.js
instances: 1  # Вместо 2

# Перезапусти
pm2 reload flowbot
```

### Ошибки подключения к Supabase
```bash
# Проверь доступность
curl -I https://your-project.supabase.co

# Проверь переменные
echo $SUPABASE_URL
```

---

## Полезные команды

```bash
# Логи за последний час
pm2 logs flowbot --timestamp --lines 1000

# Информация о процессе
pm2 describe flowbot

# Restart всех процессов
pm2 reload all

# Очистка старых логов
pm2 flush

# Обновление PM2
npm install -g pm2@latest
pm2 update
```

---

## Бэкапы

Скрипт `deploy.sh` автоматически создает бэкапы перед обновлением в папке `backups/`.

Восстановление из бэкапа:
```bash
cd ~/flowbot
cp -r backups/20241002_120000/* .
pm2 reload flowbot
```

---

## Мониторинг в production

### PM2 Plus (бесплатно для 1 сервера)
```bash
pm2 link your-secret-key your-public-key
```

Регистрация: https://app.pm2.io

### Простой скрипт для проверки
Создай `/etc/cron.d/flowbot-health`:
```bash
*/5 * * * * flowbot curl -f http://localhost:3000/health || pm2 restart flowbot
```

---

## Безопасность

1. **Firewall**
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

2. **Защита .env**
```bash
chmod 600 .env
```

3. **Регулярные обновления**
```bash
sudo apt update
sudo apt upgrade -y
```

---

## Контакты

- GitHub: https://github.com/yourusername/flowbot
- Telegram: @flowbot_support
- Issues: https://github.com/yourusername/flowbot/issues
