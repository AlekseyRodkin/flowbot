# Timeweb Cloud Deployment Guide

## ⚠️ КРИТИЧЕСКИ ВАЖНО

### Переменные окружения

**ВСЕГДА** передавайте переменные окружения через параметр `envs` как JSON объект при создании приложения!

❌ **НЕПРАВИЛЬНО:**
```javascript
envs: {}  // Пустой объект - приложение НЕ ЗАПУСТИТСЯ
```

✅ **ПРАВИЛЬНО:**
```javascript
envs: {
  "TELEGRAM_BOT_TOKEN": "значение",
  "SUPABASE_URL": "значение",
  "OPENAI_API_KEY": "значение",
  // ... все переменные из .env
}
```

### Алгоритм деплоя FlowBot на Timeweb

**Шаг 0: Проверка перед деплоем**
```bash
# ОБЯЗАТЕЛЬНО запустить перед каждым деплоем!
npm run deploy-check

# Прочитать чеклист
cat .claude/pre-deploy-checklist.md
```

1. **Прочитать .env файл:**
   ```bash
   cat .env
   ```

2. **Получить VCS провайдер:**
   ```javascript
   mcp__timeweb-mcp-server__get_vcs_provider_by_repository_url({
     repository_url: "https://github.com/AlekseyRodkin/flowbot.git"
   })
   // Запомнить: provider_id
   ```

3. **Получить ID репозитория:**
   ```javascript
   mcp__timeweb-mcp-server__get_vcs_provider_repositories({
     provider_id: "полученный_provider_id"
   })
   // Запомнить: repository_id
   ```

4. **Получить текущий коммит:**
   ```bash
   git rev-parse HEAD
   ```

5. **Создать приложение с ОБЯЗАТЕЛЬНОЙ передачей переменных окружения:**
   ```javascript
   mcp__timeweb-mcp-server__create_timeweb_app({
     name: "FlowBot",
     type: "backend",
     provider_id: "из_шага_2",
     repository_id: "из_шага_3",
     repository_url: "https://github.com/AlekseyRodkin/flowbot.git",
     preset_id: 1631,  // 1 CPU, 1GB RAM, 250₽/мес
     framework: "express",
     commit_sha: "из_шага_4",
     branch_name: "main",
     build_cmd: "npm install",
     run_cmd: "npm start",
     envs: {
       // ⚠️ ОБЯЗАТЕЛЬНО ПЕРЕДАТЬ ВСЕ ПЕРЕМЕННЫЕ ИЗ .env
       "TELEGRAM_BOT_TOKEN": "значение_из_.env",
       "TELEGRAM_BOT_USERNAME": "значение_из_.env",
       "SUPABASE_URL": "значение_из_.env",
       "SUPABASE_SERVICE_KEY": "значение_из_.env",
       "SUPABASE_ANON_KEY": "значение_из_.env",
       "OPENAI_API_KEY": "значение_из_.env",
       "OPENAI_MODEL": "значение_из_.env",
       "NODE_ENV": "production",
       "LOG_LEVEL": "info",
       "DEFAULT_TIMEZONE": "Europe/Moscow",
       "ADMIN_TELEGRAM_IDS": "значение_из_.env",
       "ADMIN_TELEGRAM_ID": "значение_из_.env",
       "ENABLE_AI_GENERATION": "true",
       "ENABLE_PAYMENTS": "false",
       "ENABLE_ANALYTICS": "false",
       "MAX_DAILY_TASKS": "30",
       "BOT_USERNAME": "значение_из_.env"
     },
     is_auto_deploy: false
   })
   ```

### Проблемы и решения

#### ❌ Проблема: MCP инструмент возвращает 400 ошибку

**Симптомы:**
- `mcp__timeweb-mcp-server__create_timeweb_app` возвращает ошибку 400
- Сообщение: "Invalid framework for the given app type"

**Возможные причины:**
1. API Timeweb ожидает параметр `framework` (строка), но MCP инструмент может передавать `framework_id`
2. В комментарии (`comment`) использован запрещённый символ (разрешены только: `letters, numbers, , . ) ( - & # [ ] _`)
3. Символ `:` (двоеточие) запрещён в комментариях

**Решение: Использовать прямой curl запрос к API**

1. Создать JSON файл с параметрами (например `/tmp/timeweb-app.json`):
   ```json
   {
     "name": "FlowBot-v5",
     "comment": "FlowBot v5 - описание без двоеточия",
     "type": "backend",
     "provider_id": "ваш_provider_id",
     "repository_id": "ваш_repository_id",
     "preset_id": 1631,
     "framework": "express",
     "commit_sha": "полный_SHA_коммита",
     "branch_name": "main",
     "build_cmd": "npm install",
     "run_cmd": "npm start",
     "is_auto_deploy": false,
     "envs": {
       "TELEGRAM_BOT_TOKEN": "...",
       "SUPABASE_URL": "...",
       // ... все остальные переменные
     }
   }
   ```

2. Отправить через curl:
   ```bash
   curl -X POST "https://api.timeweb.cloud/api/v1/apps" \
     -H "Authorization: Bearer YOUR_TIMEWEB_TOKEN" \
     -H "Content-Type: application/json" \
     -d @/tmp/timeweb-app.json
   ```

**Важно:**
- Параметр должен быть `"framework": "express"`, не `framework_id`
- В `comment` нельзя использовать символ `:`
- Если первый деплой failed с ошибкой Docker, попробуйте ручной редеплой через панель Timeweb

#### ❌ Проблема: "Unable to detect application port"

**Причины:**
1. Отсутствует переменная окружения `PORT` (Timeweb устанавливает её автоматически)
2. Приложение не выводит `Listening on port X` в логи
3. Переменные окружения не переданы → приложение не запускается

**Решение:**
- В `server.js` должно быть:
  ```javascript
  const PORT = process.env.PORT || process.env.API_PORT || 3001;
  console.log(`Listening on port ${PORT}`);  // ⚠️ КРИТИЧНО для детекции
  ```

#### ❌ Проблема: Редеплой не работает

**Факт:** При создании приложение деплоится успешно, но последующие редеплои (через git push) не работают.

**Решение:** Удалить приложение и создать заново через MCP сервер.

#### ✅ Проблема: Invite link показывает "undefined"

**Причина:** `process.env.TELEGRAM_BOT_USERNAME` не передан в переменных окружения.

**Решение:**
1. Убедиться что переменная передана в `envs`
2. Код автоматически получит username через `bot.telegram.getMe()` если переменная отсутствует

### Чек-лист перед деплоем

- [ ] Прочитан .env файл
- [ ] Все секретные ключи из .env подготовлены для передачи
- [ ] VCS провайдер и репозиторий существуют
- [ ] Получен последний commit SHA
- [ ] Параметр `envs` содержит ВСЕ переменные из .env (НЕ пустой объект!)
- [ ] `build_cmd: "npm install"`
- [ ] `run_cmd: "npm start"`
- [ ] `is_auto_deploy: false`

### Конфигурация

**Рекомендуемый preset:** 1631 (1 CPU, 1GB RAM, 250₽/мес)

**Framework:** express

**Node.js версия:** Используется версия из package.json engines или последняя LTS

### Мониторинг деплоя

После создания приложения проверить логи в панели Timeweb:
1. `npm install` должен установить зависимости
2. `npm start` должен запустить приложение
3. В логах должно появиться: `Listening on port XXXX`
4. Timeweb детектирует порт и запустит проверку HTTP 200
5. Статус: "Deployment successfully completed"

---

**Дата создания:** 2025-10-03
**Последнее обновление:** 2025-10-15
**Проект:** FlowBot - Telegram bot для продуктивности
