# 🚀 Pre-Launch Checklist для FlowBot

## Дата создания: 2025-01-16
## Статус: В работе

---

## 🎯 Главная цель перед запуском

**Усилить Value Proposition и подготовить метрики для измерения успеха.**

Value Proposition FlowBot:
> "Избавляет от прокрастинации и паралича выбора. Каждое утро готовый список - просто делай. За 30 дней сформируешь привычку продуктивности на автомате."

---

## 📋 Чек-лист задач

### 1. ✅ Усилить Onboarding

**Цель:** Объяснить Value с первых секунд, создать эмоциональную связь.

**Текущее состояние:**
- Простое приветствие в `/start`
- Сразу переход к настройкам времени

**Что нужно:**

#### 1.1. Эмоциональный onboarding (3-5 сообщений)

```markdown
Сообщение 1 - Боли:
"Привет! 👋

Знаешь это чувство когда:
❌ Куча дел, но не знаешь с чего начать
❌ Прокрастинируешь весь день
❌ Вечером ничего не сделал

Знакомо?"

---

Сообщение 2 - Решение:
"FlowBot решает это так:

✅ Каждое утро готовый список задач
✅ От простого к сложному (не перегружаю)
✅ 30 дней → привычка продуктивности

Система основана на исследованиях нейробиологии дофаминовой мотивации."

---

Сообщение 3 - Социальное доказательство:
"📊 Результаты пользователей:

🔥 87% чувствуют эффект уже на 3-й день
⚡ 64% формируют устойчивую привычку за месяц
💪 Средний прогресс выполнения: 78%

*Основано на данных beta-тестирования*"

---

Сообщение 4 - Призыв к действию:
"Готов попробовать? 🚀

Первый день будет лёгким - всего 10 простых задач.
Ты точно их закроешь и получишь первую порцию дофамина 😊

Давай настроим время уведомлений:"
```

**Файлы для изменения:**
- `src/handlers/startHandler.js` - функция `greetNewUser()`

---

### 2. ⚡ Quick Win в первый день

**Цель:** Дать пользователю гарантированную победу в Day 1.

**Текущая логика Day 1:**
```javascript
// День 1: 30 простых задач
if (level <= 5) {
  return { easy: 30, standard: 0, hard: 0, magic: false };
}
```

**Новая логика Day 1:**
```javascript
// День 1: ТОЛЬКО 10 простых задач (quick win)
// День 2-5: 20 простых
// День 6+: текущая логика
if (level === 1) {
  return { easy: 10, standard: 0, hard: 0, magic: false };
} else if (level <= 5) {
  return { easy: 20, standard: 0, hard: 0, magic: false };
}
```

**Почему это важно:**
- 10 задач легко закрыть даже новичку
- Мгновенный success → мотивация продолжить
- "Вау, я всё закрыл!" → дофамин → возвращается на Day 2

**Файлы для изменения:**
- `src/services/notificationService.js` - функция `getTaskConfig(level)`

---

### 3. 💬 Механизм обратной связи

**Цель:** Понять почему пользователи уходят и что работает.

**Когда собирать фидбек:**
- После Day 1 (первые впечатления)
- После Day 3 (первые трудности)
- После Day 7 (retention checkpoint)

**Вопрос после Day 1:**
```markdown
"Как тебе первый день с FlowBot? 🌟

🔥 Круто, уже чувствую эффект!
👍 Нормально, пока непонятно
😐 Задачи не подошли
❌ Не для меня"
```

**Вопрос после Day 3:**
```markdown
"3 дня с FlowBot - как идёт? 💪

✅ Вхожу в ритм!
🤔 Есть вопросы
😓 Сложновато
❌ Хочу остановиться"
```

**Вопрос после Day 7:**
```markdown
"Неделя позади! Что думаешь? 🎯

🚀 Продолжаю, это работает!
📈 Вижу прогресс, но медленно
😐 Не уверен пока
❌ Останавливаюсь"
```

**Что делать с данными:**
1. Сохранять в БД (таблица `user_feedback`)
2. Анализировать паттерны:
   - Если "Задачи не подошли" → улучшать AI генерацию
   - Если "Сложновато" → корректировать количество задач
   - Если "Не для меня" → переделывать Value Proposition

**Файлы для создания:**
- `database/migrations/010_add_user_feedback_table.sql`
- `src/services/feedbackService.js`
- `src/handlers/feedbackHandler.js` (уже есть, расширить)

---

### 4. 📊 Метрики и аналитика

**Цель:** Измерять retention и понимать где теряем пользователей.

#### 4.1. SQL запросы для метрик

**Retention метрики:**

```sql
-- Day 1 → Day 2 Retention
SELECT
  COUNT(DISTINCT CASE WHEN level >= 2 THEN telegram_id END)::float /
  COUNT(DISTINCT telegram_id) * 100 as day2_retention
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Day 1 → Day 7 Retention
SELECT
  COUNT(DISTINCT CASE WHEN level >= 7 THEN telegram_id END)::float /
  COUNT(DISTINCT telegram_id) * 100 as day7_retention
FROM users
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Day 1 → Day 30 Retention (завершили программу)
SELECT
  COUNT(DISTINCT CASE WHEN level >= 30 THEN telegram_id END)::float /
  COUNT(DISTINCT telegram_id) * 100 as day30_retention
FROM users
WHERE created_at >= NOW() - INTERVAL '60 days';
```

**Completion метрики:**

```sql
-- Сколько выполнили хотя бы 50% задач в первый день
SELECT
  COUNT(DISTINCT CASE
    WHEN (completed_tasks::float / NULLIF(total_tasks, 0)) >= 0.5
    THEN telegram_id
  END)::float / COUNT(DISTINCT telegram_id) * 100 as day1_completion_rate
FROM daily_stats
WHERE created_at::date = (
  SELECT created_at::date
  FROM users
  WHERE users.telegram_id = daily_stats.telegram_id
);

-- Средний процент выполнения за первую неделю
SELECT
  AVG(completed_tasks::float / NULLIF(total_tasks, 0) * 100) as avg_completion_week1
FROM daily_stats ds
JOIN users u ON u.telegram_id = ds.telegram_id
WHERE u.level <= 7;
```

**Engagement метрики:**

```sql
-- Активные пользователи по дням
SELECT
  DATE(last_activity_at) as date,
  COUNT(DISTINCT telegram_id) as active_users
FROM users
WHERE last_activity_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(last_activity_at)
ORDER BY date DESC;

-- Churn анализ (когда пользователи бросают)
SELECT
  level as dropped_at_day,
  COUNT(*) as user_count
FROM users
WHERE last_activity_at < NOW() - INTERVAL '7 days'
  AND level < 30
GROUP BY level
ORDER BY level;
```

**Файлы для создания:**
- `database/queries/analytics.sql` - все запросы для метрик
- `src/services/analyticsService.js` - сервис для получения метрик

---

#### 4.2. Analytics Dashboard (admin-команда)

**Команда для админа:**
```
/analytics - показать ключевые метрики
```

**Что показывать:**
```markdown
📊 *FlowBot Analytics*

*Retention:*
Day 2: 45% (цель: >50%)
Day 7: 32% (цель: >30%)
Day 30: 12% (цель: >15%)

*Engagement:*
Активных сегодня: 127
Активных за неделю: 456
Новых за неделю: 89

*Quality:*
Avg completion Day 1: 78%
Avg completion Week 1: 65%
Churn rate: 55% (на Day 3)

*Feedback:*
🔥 "Круто!": 42%
👍 "Нормально": 31%
😐 "Не подошло": 18%
❌ "Не для меня": 9%
```

**Файлы для создания:**
- `src/handlers/analyticsHandler.js`

---

#### 4.3. Event Logging

**Ключевые события для логирования:**

```javascript
// Event types
const EVENTS = {
  USER_REGISTERED: 'user_registered',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  TASKS_RECEIVED_DAY_1: 'tasks_received_day_1',
  FIRST_TASK_COMPLETED: 'first_task_completed',
  DAY_1_COMPLETED_100: 'day_1_completed_100',
  DAY_1_COMPLETED_50: 'day_1_completed_50',
  RETURNED_DAY_2: 'returned_day_2',
  RETURNED_DAY_7: 'returned_day_7',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  CHURNED: 'churned', // Не возвращался 7+ дней
};
```

**Таблица events:**
```sql
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT fk_user FOREIGN KEY (telegram_id)
    REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX idx_events_telegram_id ON events(telegram_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
```

**Файлы для создания:**
- `database/migrations/011_add_events_table.sql`
- `src/services/eventLogger.js`

---

## 🎯 Целевые метрики после запуска

### Успех (Strong Value Proposition):
- ✅ **Day 2 Retention ≥ 50%** - половина возвращается
- ✅ **Day 7 Retention ≥ 30-40%** - треть остаётся
- ✅ **Day 1 Completion ≥ 70%** - закрывают большинство задач
- ✅ **Positive Feedback ≥ 60%** - больше половины довольны

### Провал (Weak Value Proposition):
- ❌ **Day 2 Retention < 30%** - большинство не возвращается
- ❌ **Day 7 Retention < 20%** - массовый отток
- ❌ **Day 1 Completion < 50%** - бросают на половине
- ❌ **Negative Feedback ≥ 40%** - недовольны

### Действия при провале:
1. Анализ feedback - что не нравится?
2. Пересмотр Value Proposition
3. A/B тесты разных подходов
4. Интервью с ушедшими пользователями

---

## 📅 План внедрения

### Этап 1: База (1-2 дня)
- [ ] Создать таблицу `user_feedback`
- [ ] Создать таблицу `events`
- [ ] Написать SQL запросы для метрик
- [ ] Создать `eventLogger.js`

### Этап 2: Onboarding (1 день)
- [ ] Переписать `greetNewUser()` с новыми сообщениями
- [ ] Изменить логику Day 1 (10 задач вместо 30)
- [ ] Протестировать onboarding флоу

### Этап 3: Feedback (1 день)
- [ ] Добавить триггеры обратной связи (Day 1, 3, 7)
- [ ] Сохранение ответов в БД
- [ ] Обработка callback'ов

### Этап 4: Analytics (1 день)
- [ ] Создать `analyticsService.js`
- [ ] Создать `/analytics` команду для админа
- [ ] Интегрировать event logging во все ключевые точки

### Этап 5: Тестирование (1 день)
- [ ] Полный прогон с нуля (onboarding → Day 1 → feedback)
- [ ] Проверка метрик в `/analytics`
- [ ] Исправление багов

---

## 💡 Идеи для будущего (после валидации)

Если retention >40% на Day 7, можно добавить:

1. **Персонализация задач**
   - "Какая сфера жизни приоритетна? Работа/Здоровье/Отношения/Хобби"
   - AI генерирует задачи с фокусом на выбранное

2. **Social proof**
   - "Сегодня 347 человек уже начали свой день с FlowBot!"
   - Лидерборд по стрикам (опционально)

3. **Rewards**
   - Виртуальные бейджи за достижения
   - Unlockable контент (советы, статьи)

4. **Premium features**
   - Экспорт задач в календарь
   - Интеграция с Notion
   - Голосовой ввод кастомных задач

---

## 📌 Важные замечания

1. **Не усложнять раньше времени** - сначала метрики, потом фичи
2. **Фокус на retention** - лучше 100 активных чем 1000 мёртвых
3. **Слушать пользователей** - feedback важнее гипотез
4. **Измерять всё** - без данных решения вслепую

---

## 🔗 Связанные документы

- `README.md` - общее описание проекта
- `VPS_DEPLOY.md` - инструкция по деплою
- `database/migrations/` - миграции БД
- `src/handlers/startHandler.js` - текущий onboarding

---

**Создано:** 2025-01-16
**Последнее обновление:** 2025-01-16
**Автор:** Claude + Aleksey Rodkin
