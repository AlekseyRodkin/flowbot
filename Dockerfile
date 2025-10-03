# Dockerfile
FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Установка часового пояса
RUN apk add --no-cache tzdata
ENV TZ=Europe/Moscow

# Копирование файлов package
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Создание директорий для логов
RUN mkdir -p logs data

# Пользователь для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Запуск приложения
CMD ["node", "bot/index.js"]
