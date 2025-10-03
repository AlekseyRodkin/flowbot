// src/utils/testMode.js
// Тестовый режим для разработки без реальных API

class TestMode {
    constructor() {
        this.enabled = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
        this.testUsers = new Map();
        this.testTasks = new Map();
        
        if (this.enabled) {
            console.log('🧪 ТЕСТОВЫЙ РЕЖИМ АКТИВИРОВАН');
            console.log('   - Без реальных API вызовов');
            console.log('   - Данные хранятся в памяти');
            console.log('   - Мок ответы от AI');
        }
    }

    // Мок для OpenAI
    async generateTasks(level = 1) {
        const tasks = [];
        const config = this.getTaskConfig(level);
        
        // Простые задачи
        const easyTasks = [
            "💧 Выпить стакан воды",
            "😊 Улыбнуться себе в зеркало",
            "🌬️ Сделать 5 глубоких вдохов",
            "🚶 Встать и размяться",
            "📱 Проверить заряд телефона",
            "🪟 Открыть окно для свежего воздуха",
            "☕ Сделать перерыв на чай",
            "🎵 Включить любимую песню",
            "📝 Записать одну мысль",
            "👋 Позвонить близкому человеку"
        ];
        
        // Средние задачи
        const mediumTasks = [
            "📧 Ответить на 3 важных письма",
            "📚 Прочитать 10 страниц книги",
            "🧹 Убрать рабочее место",
            "📋 Составить план на завтра",
            "🏃 Сделать 15-минутную зарядку",
            "🍎 Приготовить здоровый перекус",
            "📞 Провести короткую встречу",
            "💡 Найти решение текущей проблемы",
            "🎯 Определить 3 приоритета на день",
            "📈 Проверить прогресс по целям"
        ];
        
        // Сложные задачи
        const hardTasks = [
            "📊 Подготовить отчет",
            "💻 Написать код для новой функции",
            "📑 Создать презентацию",
            "🎨 Разработать дизайн-концепт",
            "📝 Написать статью или пост",
            "🔍 Провести исследование",
            "💼 Завершить важный проект",
            "📚 Изучить новый навык",
            "🤝 Провести переговоры",
            "🎯 Достичь недельной цели"
        ];
        
        // Генерируем задачи по конфигу
        for (let i = 0; i < config.easy; i++) {
            tasks.push({
                text: easyTasks[i % easyTasks.length],
                type: 'easy',
                position: tasks.length + 1
            });
        }
        
        for (let i = 0; i < config.standard; i++) {
            tasks.push({
                text: mediumTasks[i % mediumTasks.length],
                type: 'standard',
                position: tasks.length + 1
            });
        }
        
        for (let i = 0; i < config.hard; i++) {
            tasks.push({
                text: hardTasks[i % hardTasks.length],
                type: 'hard',
                position: tasks.length + 1
            });
        }
        
        // Добавляем магическую задачу
        tasks.push({
            text: "✨ Найти монетку на удачу",
            type: 'magic',
            position: tasks.length + 1
        });
        
        return tasks;
    }

    // Конфигурация задач по уровням
    getTaskConfig(level) {
        if (level <= 5) {
            return { easy: 29, standard: 0, hard: 0 };
        } else if (level <= 10) {
            return { easy: 19, standard: 10, hard: 0 };
        } else {
            return { easy: 9, standard: 10, hard: 10 };
        }
    }

    // Мок для Supabase
    async mockSupabase() {
        return {
            from: (table) => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: this.getMockUser(), error: null }),
                        data: []
                    }),
                    data: []
                }),
                insert: async (data) => ({ data, error: null }),
                update: async (data) => ({ data, error: null }),
                upsert: async (data) => ({ data, error: null })
            })
        };
    }

    // Мок пользователь
    getMockUser() {
        return {
            id: 1,
            telegram_id: 123456789,
            username: 'test_user',
            first_name: 'Test',
            last_name: 'User',
            level: 1,
            subscription_type: 'pro',
            subscription_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            morning_hour: 8,
            evening_hour: 21,
            timezone: 'Europe/Moscow',
            language: 'ru',
            onboarding_completed: true,
            created_at: new Date()
        };
    }

    // Мок статистика
    getMockStats() {
        return {
            total_tasks: 30,
            completed_tasks: Math.floor(Math.random() * 30),
            current_streak: Math.floor(Math.random() * 15),
            longest_streak: 15,
            total_days: 30,
            achievements_count: Math.floor(Math.random() * 10),
            flow_score: Math.floor(Math.random() * 100)
        };
    }

    // Мок достижения
    getMockAchievements() {
        return [
            {
                name: '🎯 Первый шаг',
                description: 'Выполнить первую задачу',
                unlocked: true
            },
            {
                name: '🔥 В потоке',
                description: 'Выполнить 10 задач подряд',
                unlocked: true
            },
            {
                name: '👑 Король дня',
                description: 'Выполнить все 30 задач',
                unlocked: false
            },
            {
                name: '📈 Стабильность',
                description: '7 дней подряд',
                unlocked: false
            },
            {
                name: '🚀 Легенда',
                description: '15 дней в потоке (и продолжаешь дальше)',
                unlocked: false
            }
        ];
    }

    // Проверка тестового режима
    isEnabled() {
        return this.enabled;
    }

    // Логирование в тестовом режиме
    log(message, data = null) {
        if (this.enabled) {
            console.log(`[TEST MODE] ${message}`);
            if (data) {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }
}

module.exports = new TestMode();