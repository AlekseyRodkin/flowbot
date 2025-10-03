-- database/migrations/006_task_templates.sql
-- Создание системы шаблонов задач для пользователей

-- Шаблоны задач
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Задачи в шаблоне
CREATE TABLE IF NOT EXISTS template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
    task_text TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'standard', -- easy, standard, hard, magic
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_task_templates_telegram_id ON task_templates(telegram_id);
CREATE INDEX idx_task_templates_active ON task_templates(telegram_id, is_active);
CREATE INDEX idx_template_tasks_template_id ON template_tasks(template_id);
CREATE INDEX idx_template_tasks_position ON template_tasks(template_id, position);

-- Триггер для обновления updated_at
CREATE TRIGGER update_task_templates_updated_at BEFORE UPDATE ON task_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) политики
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_tasks ENABLE ROW LEVEL SECURITY;

-- Создание базовых шаблонов для всех пользователей
INSERT INTO task_templates (telegram_id, name, description, is_default) VALUES 
(0, 'Продуктивный день', 'Универсальный шаблон для продуктивного дня', true),
(0, 'Работа из дома', 'Шаблон для эффективной работы из дома', true),
(0, 'Здоровый образ жизни', 'Фокус на здоровье и спорте', true),
(0, 'Обучение и развитие', 'Для саморазвития и изучения нового', true);

-- Задачи для шаблона "Продуктивный день"
INSERT INTO template_tasks (template_id, task_text, task_type, position) VALUES
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Выпить стакан воды', 'easy', 1),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Сделать зарядку 10 минут', 'easy', 2),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Позавтракать без телефона', 'easy', 3),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Составить план на день', 'standard', 4),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Выполнить главную задачу дня', 'hard', 5),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Проверить и ответить на почту', 'standard', 6),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Сделать перерыв и прогуляться', 'easy', 7),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Завершить 2 мелкие задачи', 'standard', 8),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Подготовиться к завтрашнему дню', 'standard', 9),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Продуктивный день'), 'Сделать что-то приятное для себя', 'magic', 10);

-- Задачи для шаблона "Работа из дома"
INSERT INTO template_tasks (template_id, task_text, task_type, position) VALUES
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Одеться как для офиса', 'easy', 1),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Подготовить рабочее место', 'easy', 2),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Проверить календарь на день', 'easy', 3),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Провести утреннее совещание', 'standard', 4),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Поработать над проектом 2 часа', 'hard', 5),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Сделать перерыв на обед', 'easy', 6),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Ответить на сообщения коллег', 'standard', 7),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Закрыть 3 задачи из списка', 'standard', 8),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Провести итоговый звонок', 'standard', 9),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Работа из дома'), 'Выключить рабочий режим в 19:00', 'magic', 10);

-- Задачи для шаблона "Здоровый образ жизни"
INSERT INTO template_tasks (template_id, task_text, task_type, position) VALUES
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Выпить воду натощак', 'easy', 1),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Сделать растяжку', 'easy', 2),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Позавтракать правильно', 'easy', 3),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Потренироваться 30 минут', 'standard', 4),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Приготовить здоровый обед', 'standard', 5),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Прогуляться на свежем воздухе', 'easy', 6),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Выпить 2 литра воды', 'standard', 7),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Поспать 8 часов', 'hard', 8),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Помедитировать 10 минут', 'standard', 9),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Здоровый образ жизни'), 'Побаловать себя без вреда здоровью', 'magic', 10);

-- Задачи для шаблона "Обучение и развитие"
INSERT INTO template_tasks (template_id, task_text, task_type, position) VALUES
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Прочитать 10 страниц книги', 'easy', 1),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Послушать подкаст', 'easy', 2),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Изучить новое слово', 'easy', 3),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Пройти урок онлайн-курса', 'standard', 4),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Написать конспект изученного', 'standard', 5),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Практиковать новый навык 1 час', 'hard', 6),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Поделиться знаниями с другими', 'standard', 7),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Составить план изучения на завтра', 'standard', 8),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Поразмышлять о прогрессе', 'standard', 9),
((SELECT id FROM task_templates WHERE telegram_id = 0 AND name = 'Обучение и развитие'), 'Вдохновиться чем-то новым', 'magic', 10);