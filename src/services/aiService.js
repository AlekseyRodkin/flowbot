// src/services/aiService.js
const OpenAI = require('openai');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Генерировать задачи для пользователя (теперь использует только статические списки)
  async generateTasks(taskConfig, user) {
    const startTime = Date.now();
    console.log(`📋 Генерируем статические задачи для уровня ${user.level}: ${taskConfig.easy}E + ${taskConfig.standard}S + ${taskConfig.hard}H + 1M`);
    
    // Используем статические задачи с умной логикой выбора
    const tasks = this.getStaticTasks(taskConfig, user);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ Статическая генерация завершена за ${processingTime}ms: получено ${tasks.length} уникальных задач`);
    
    return tasks;
  }

  // Построить промпт для генерации задач
  buildTaskPrompt(taskConfig, user) {
    const { easy, standard, hard } = taskConfig;
    
    let prompt = `Создай УНИКАЛЬНЫЙ и РАЗНООБРАЗНЫЙ список задач для техники Flow List.

Контекст:
- Пользователь на дне ${user.level} из 30-дневной программы
- Уровень: ${user.level <= 5 ? 'Начинающий (разгон)' : user.level <= 10 ? 'Средний (усложнение)' : 'Продвинутый (поток)'}

СТРОГИЕ ТРЕБОВАНИЯ:
1. КАЖДАЯ задача должна быть УНИКАЛЬНОЙ - никаких повторов!
2. Максимальное РАЗНООБРАЗИЕ - физические, ментальные, творческие, социальные активности
3. Задачи должны быть КОНКРЕТНЫМИ и ВЫПОЛНИМЫМИ
4. Избегай общих формулировок типа "заняться спортом" - пиши конкретно "сделать 15 приседаний"

Нужно создать:
- ${easy} простых задач (1-2 минуты на выполнение)
- ${standard} средних задач (5-15 минут на выполнение)  
- ${hard} сложных задач (30+ минут на выполнение)
- 1 магическую задачу (зависит от удачи/внешних факторов)

КАТЕГОРИИ для разнообразия (обязательно включи задачи из разных категорий):

ПРОСТЫЕ задачи (выбери из разных категорий):
- Физические: выпить стакан воды, потянуться 30 сек, сделать 10 прыжков, зевнуть 5 раз
- Ментальные: назвать 5 благодарностей, помедитировать 2 минуты, вспомнить приятное воспоминание
- Творческие: нарисовать смайлик, придумать рифму к слову "день", сфотографировать что-то красивое
- Социальные: улыбнуться незнакомцу, отправить комплимент другу, поблагодарить кого-то
- Бытовые: протереть телефон, полить цветок, застелить кровать, открыть окно

СРЕДНИЕ задачи (микс категорий):
- Физические: прогулка 10 минут, растяжка, подняться по лестнице, танцевать под музыку
- Ментальные: прочитать статью, изучить 10 новых слов, решить головоломку, планирование
- Творческие: придумать стишок, нарисовать портрет, сочинить мелодию, создать коллаж
- Социальные: позвонить бабушке, написать отзыв, познакомиться с коллегой
- Продуктивные: навести порядок в одной папке, спланировать завтра, ответить на письма

СЛОЖНЫЕ задачи (для продвинутого уровня):
- Проектные: завершить важную часть проекта, создать детальный план, изучить новую технологию
- Карьерные: обновить резюме, подготовить питч, изучить рынок конкурентов
- Личные: составить бюджет на месяц, начать новое хобби, записаться к специалисту
- Обучающие: пройти урок курса, освоить новый навык, изучить 50 иностранных слов

МАГИЧЕСКИЕ задачи (случайные события):
- Найти деньги/монетку, получить неожиданный подарок, встретить старого знакомого, услышать любимую песню, увидеть необычное животное, получить комплимент от незнакомца

КРИТИЧЕСКИ ВАЖНО:
- НИКАКИХ повторяющихся или похожих формулировок!
- ИЗБЕГАЙ банальных задач - будь креативным и вдохновляющим!
- Обеспечь баланс всех категорий в итоговом списке
- Задачи должны мотивировать и приносить удовольствие от выполнения

Ответ в формате JSON массива:
[
  {"text": "Текст задачи", "type": "easy"},
  {"text": "Текст задачи", "type": "standard"},
  {"text": "Текст задачи", "type": "hard"},
  {"text": "Текст магической задачи", "type": "magic"}
]`;

    return prompt;
  }

  // Валидация и очистка дублей задач
  validateAndCleanTasks(tasks, taskConfig) {
    if (!Array.isArray(tasks)) return this.getFallbackTasks(taskConfig);
    
    const uniqueTasks = [];
    const seenTexts = new Set();
    const { easy, standard, hard } = taskConfig;
    
    // Группируем задачи по типам
    const tasksByType = {
      easy: tasks.filter(t => t.type === 'easy'),
      standard: tasks.filter(t => t.type === 'standard'), 
      hard: tasks.filter(t => t.type === 'hard'),
      magic: tasks.filter(t => t.type === 'magic')
    };
    
    // Проверяем уникальность в каждой категории
    const addUniqueTask = (task) => {
      if (!task.text || !task.type) return false;
      
      // Нормализуем текст для сравнения
      const normalizedText = task.text.toLowerCase()
        .replace(/[^\w\s]/g, '') // убираем знаки препинания
        .replace(/\s+/g, ' ')    // нормализуем пробелы
        .trim();
      
      // Проверяем на дубли (похожий текст)
      for (const seenText of seenTexts) {
        if (this.calculateSimilarity(normalizedText, seenText) > 0.7) {
          return false; // Слишком похожая задача
        }
      }
      
      seenTexts.add(normalizedText);
      uniqueTasks.push(task);
      return true;
    };
    
    // Добавляем уникальные задачи по типам
    tasksByType.easy.slice(0, easy).forEach(addUniqueTask);
    tasksByType.standard.slice(0, standard).forEach(addUniqueTask);  
    tasksByType.hard.slice(0, hard).forEach(addUniqueTask);
    tasksByType.magic.slice(0, 1).forEach(addUniqueTask);
    
    // Если не хватает задач - дополняем из fallback
    const needed = easy + standard + hard + 1;
    if (uniqueTasks.length < needed) {
      const fallbackTasks = this.getFallbackTasks(taskConfig);
      
      for (let i = 0; i < fallbackTasks.length && uniqueTasks.length < needed; i++) {
        if (addUniqueTask(fallbackTasks[i])) {
          // Задача добавлена
        }
      }
    }
    
    return uniqueTasks;
  }
  
  // Вычислить схожесть двух текстов (0-1, где 1 = идентично)
  calculateSimilarity(text1, text2) {
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    let commonWords = 0;
    const maxLength = Math.max(words1.length, words2.length);
    
    for (const word of words1) {
      if (words2.includes(word) && word.length > 2) { // игнорируем короткие слова
        commonWords++;
      }
    }
    
    return commonWords / maxLength;
  }

  // Получить статические задачи с умной логикой выбора
  getStaticTasks(taskConfig, user) {
    const tasks = [];
    
    // База простых задач (80 элементов) - быстрые действия 1-2 минуты
    const easyTasks = [
      // Физические движения (20 задач)
      "Выпить стакан воды", "Сделать 5 глубоких вдохов", "Потянуться на 30 секунд", 
      "Сделать 10 прыжков на месте", "Встать и сесть 5 раз", "Повращать шеей и плечами", 
      "Сжать и разжать кулаки 10 раз", "Походить по комнате 2 минуты", "Сделать 10 приседаний",
      "Покачать головой влево-вправо", "Потрясти руками и ногами", "Зевнуть 5 раз подряд",
      "Сделать планку 30 секунд", "Покрутить кистями рук", "Сделать 5 отжиманий от стены",
      "Помассажировать виски", "Потереть ладони друг о друга", "Сделать 3 наклона вперед",
      "Постоять на одной ноге 30 секунд", "Сделать круговые движения плечами",
      
      // Ментальные упражнения (20 задач)
      "Назвать 5 благодарностей", "Вспомнить хорошее воспоминание детства", "Помедитировать 1 минуту",
      "Сказать себе 3 комплимента", "Подумать о завтрашних планах", "Вспомнить любимое место",
      "Посчитать от 100 до 1 через 7", "Назвать 10 городов на букву С", "Вспомнить любимое блюдо",
      "Подумать о трех хороших событиях вчера", "Представить идеальный выходной", "Вспомнить смешную историю",
      "Назвать 5 цветов радуги", "Подумать о любимом фильме", "Вспомнить школьного друга",
      "Представить себя через 5 лет", "Подумать об интересной книге", "Вспомнить приятный запах",
      "Назвать 3 своих сильных качества", "Подумать о мечте",
      
      // Творческие действия (15 задач)
      "Нарисовать смайлик на бумаге", "Сфотографировать что-то красивое", "Придумать рифму к своему имени",
      "Напеть любимую мелодию", "Написать одно предложение-историю", "Сложить оригами журавлика",
      "Нарисовать домик с трубой", "Сочинить двустишие о погоде", "Изобразить животное жестами",
      "Написать имя красивыми буквами", "Придумать название для кафе", "Нарисовать сердечко",
      "Сочинить короткую песенку", "Изобразить эмоцию мимикой", "Придумать стишок из 2-х строчек",
      
      // Социальные действия (10 задач)
      "Улыбнуться себе в зеркале", "Отправить смайлик близкому", "Поблагодарить кого-то мысленно",
      "Помахать рукой отражению", "Сказать 'доброе утро' вслух", "Послать воздушный поцелуй",
      "Обнять домашнее животное или подушку", "Сказать комплимент растению", "Поблагодарить свой телефон",
      "Улыбнуться фотографии близкого человека",
      
      // Бытовые мини-дела (15 задач)
      "Протереть экран телефона", "Поставить что-то на зарядку", "Открыть окно на 1 минуту",
      "Застелить кровать", "Полить растение", "Посмотреть на часы",
      "Включить приятную музыку", "Выключить ненужный свет", "Поправить одну вещь на столе",
      "Почистить зубы", "Расчесать волосы", "Проверить погоду за окном",
      "Протереть одну поверхность", "Сложить одну вещь на место", "Выбросить один ненужный предмет"
    ];
    
    // База средних задач (60 элементов) - активности 5-15 минут
    const standardTasks = [
      // Физические (15 задач)
      "Сделать 15-минутную зарядку", "Прогуляться 10 минут на свежем воздухе", "Сделать полную растяжку", 
      "Подняться по лестнице 3 этажа", "Потанцевать под 3 любимые песни", "Сделать планку 2 минуты",
      "Выполнить комплекс упражнений для спины", "Сделать 50 приседаний", "Попрыгать на скакалке 5 минут",
      "Сделать йога-комплекс 'Приветствие солнцу'", "Выполнить дыхательную гимнастику", "Сделать упражнения для глаз",
      "Покататься на велосипеде 15 минут", "Поплавать или принять контрастный душ", "Сделать массаж рук и ног",
      
      // Ментальные/Образовательные (15 задач)
      "Прочитать одну главу интересной книги", "Изучить 20 новых слов иностранного языка", "Решить 10 логических задач",
      "Посмотреть TED-видео на интересную тему", "Написать подробный план на завтра", "Изучить что-то новое в Wikipedia",
      "Пройти урок онлайн-курса", "Выучить стихотворение наизусть", "Решить кроссворд или судоку",
      "Изучить новую технологию 15 минут", "Почитать статьи по интересующей теме", "Повторить таблицу умножения",
      "Изучить историю одного изобретения", "Почитать биографию известной личности", "Изучить новые функции телефона",
      
      // Творческие (15 задач)
      "Нарисовать пейзаж из окна акварелью", "Написать короткое стихотворение о настроении", "Сочинить мелодию на инструменте", 
      "Создать коллаж из старых журналов", "Написать рассказ на 200 слов", "Сделать поделку из природных материалов",
      "Сфотографировать 10 красивых моментов", "Записать голосовое сообщение-песню", "Нарисовать портрет домашнего питомца",
      "Сделать оригами сложной фигуры", "Написать письмо в будущее", "Создать презентацию о своем хобби",
      "Снять короткое видео о дне", "Написать обзор любимого фильма", "Создать плейлист под настроение",
      
      // Социальные (15 задач)
      "Позвонить родственнику и поговорить 15 минут", "Написать длинное письмо старому другу", "Оставить 5 позитивных комментариев",
      "Познакомиться с новым человеком", "Помочь кому-то решить задачу", "Организовать видеозвонок с друзьями",
      "Написать благодарственное письмо учителю", "Поделиться полезной информацией в соцсетях", "Найти и написать новому интересному человеку",
      "Записаться волонтером на мероприятие", "Похвалить коллегу за работу", "Организовать совместную прогулку",
      "Подарить неожиданный комплимент незнакомцу", "Написать отзыв о хорошем сервисе", "Поддержать друга в трудной ситуации"
    ];

    // Сложные задачи теперь только пользовательские (не генерируются автоматически)
    const hardTasks = [];

    // База магических задач (20 элементов) - события зависящие от удачи
    const magicTasks = [
      "Найти деньги или монетку на дороге", "Получить искренний комплимент от незнакомца", 
      "Встретить старого знакомого в неожиданном месте", "Услышать любимую песню по радио или в общественном месте", 
      "Увидеть радугу, красивый закат или необычное природное явление", "Получить хорошие новости по телефону или сообщению",
      "Найти давно потерянную вещь", "Получить неожиданный подарок или сюрприз", "Увидеть редкое или необычное животное",
      "Познакомиться с интересным и приятным человеком", "Получить скидку или бонус в магазине", 
      "Выиграть приз в лотерее или розыгрыше", "Получить бескорыстную помощь от незнакомца", "Увидеть падающую звезду или самолет в небе",
      "Получить место в транспорте когда очень устал", "Попасть на зеленый свет на всех перекрестках", "Встретить человека в точно такой же одежде",
      "Найти идеальную парковку в нужном месте", "Получить неожиданное приглашение на интересное мероприятие", "Увидеть двойную радугу"
    ];
    
    // Умный выбор задач с балансом категорий
    const selectedTasks = this.selectBalancedTasks(
      { easyTasks, standardTasks, hardTasks, magicTasks },
      taskConfig,
      user
    );
    
    return selectedTasks;
  }

  // Умная логика выбора задач с балансом категорий
  selectBalancedTasks(taskPools, taskConfig, user) {
    const tasks = [];
    const userLevel = user.level || 1;
    
    // Категории для баланса
    const categories = {
      physical: 'физически',
      mental: 'ментальны',
      creative: 'творчески',
      social: 'социальны',
      household: 'бытовы'
    };
    
    // Выбираем простые задачи с балансом
    const easySelection = this.selectTasksWithBalance(
      taskPools.easyTasks, 
      taskConfig.easy, 
      'easy',
      categories,
      userLevel
    );
    tasks.push(...easySelection);
    
    // Выбираем средние задачи
    const standardSelection = this.selectTasksWithBalance(
      taskPools.standardTasks,
      taskConfig.standard,
      'standard', 
      categories,
      userLevel
    );
    tasks.push(...standardSelection);

    // Для дней 11+ добавляем метазадачу планирования как первую сложную задачу
    if (userLevel >= 11 && taskConfig.hard > 0) {
      const planningTask = {
        text: '📝 Составить и записать список из 5-10 сложных задач на сегодня',
        type: 'hard'
      };
      tasks.push(planningTask);
    }

    // Выбираем сложные задачи (для дней 11+ это уже не используется, т.к. hard tasks добавляет пользователь)
    const hardSelection = this.selectTasksWithBalance(
      taskPools.hardTasks,
      taskConfig.hard - (userLevel >= 11 ? 1 : 0), // Вычитаем метазадачу планирования для дней 11+
      'hard',
      categories,
      userLevel
    );
    tasks.push(...hardSelection);

    // Добавляем магическую задачу только для дней 16+ (эксперимент с чудом)
    if (userLevel >= 16 && taskConfig.magic) {
      const magicTask = this.selectRandomTask(taskPools.magicTasks, 'magic');
      if (magicTask) tasks.push(magicTask);
    }
    
    // Финальная дедупликация по названию задачи
    const uniqueTasks = [];
    const seenTexts = new Set();
    
    for (const task of tasks) {
      const normalizedText = task.text.toLowerCase().trim();
      if (!seenTexts.has(normalizedText)) {
        seenTexts.add(normalizedText);
        uniqueTasks.push(task);
      }
    }
    
    // Если после дедупликации не хватает задач, добавляем из резерва
    // НЕ учитываем hard tasks если пул пустой (они добавляются пользователем)
    const totalNeeded = (taskConfig.easy || 0) + (taskConfig.standard || 0) +
      (taskPools.hardTasks.length > 0 ? (taskConfig.hard || 0) : 0) +
      (taskConfig.magic ? 1 : 0);
    if (uniqueTasks.length < totalNeeded) {
      // Собираем все доступные задачи в один пул
      const allAvailable = [
        ...taskPools.easyTasks.map(text => ({ text, type: 'easy' })),
        ...taskPools.standardTasks.map(text => ({ text, type: 'standard' })),
        ...taskPools.hardTasks.map(text => ({ text, type: 'hard' }))
      ];
      
      // Добавляем недостающие уникальные задачи
      for (const task of allAvailable) {
        if (uniqueTasks.length >= totalNeeded) break;
        
        const normalizedText = task.text.toLowerCase().trim();
        if (!seenTexts.has(normalizedText)) {
          seenTexts.add(normalizedText);
          uniqueTasks.push(task);
        }
      }
    }
    
    return uniqueTasks;
  }
  
  // Выбор задач с балансом категорий
  selectTasksWithBalance(taskPool, count, type, categories, userLevel) {
    if (count === 0 || taskPool.length === 0) return [];
    
    const selectedTasks = [];
    const shuffledPool = [...taskPool].sort(() => Math.random() - 0.5);
    
    // Определяем категорию для каждой задачи
    const tasksWithCategories = shuffledPool.map(task => ({
      text: task,
      type: type,
      category: this.detectTaskCategory(task, categories)
    }));
    
    // Пытаемся выбрать задачи из разных категорий
    const categoryKeys = Object.keys(categories);
    let categoryIndex = 0;
    
    for (let i = 0; i < count && selectedTasks.length < count; i++) {
      // Ищем задачу из текущей категории
      const targetCategory = categoryKeys[categoryIndex % categoryKeys.length];
      
      const taskFromCategory = tasksWithCategories.find(task => 
        task.category === targetCategory && 
        !selectedTasks.some(selected => selected.text === task.text)
      );
      
      if (taskFromCategory) {
        selectedTasks.push(taskFromCategory);
      } else {
        // Если не нашли в текущей категории, берем любую доступную
        const anyAvailable = tasksWithCategories.find(task => 
          !selectedTasks.some(selected => selected.text === task.text)
        );
        
        if (anyAvailable) {
          selectedTasks.push(anyAvailable);
        }
      }
      
      categoryIndex++;
    }
    
    // Дополняем до нужного количества случайными задачами
    while (selectedTasks.length < count && selectedTasks.length < tasksWithCategories.length) {
      const remaining = tasksWithCategories.filter(task => 
        !selectedTasks.some(selected => selected.text === task.text)
      );
      
      if (remaining.length > 0) {
        const randomTask = remaining[Math.floor(Math.random() * remaining.length)];
        selectedTasks.push(randomTask);
      } else {
        break;
      }
    }
    
    return selectedTasks.slice(0, count);
  }
  
  // Определение категории задачи по ключевым словам
  detectTaskCategory(taskText, categories) {
    const text = taskText.toLowerCase();
    
    // Физические ключевые слова
    const physicalKeywords = [
      'выпить', 'сделать', 'потянуть', 'прыж', 'встать', 'повращать', 'сжать', 'походить', 
      'присед', 'планк', 'отжим', 'массаж', 'зарядк', 'прогул', 'растяжк', 'танцев', 'бег', 'велосипед', 'плавать', 'душ'
    ];
    
    // Ментальные ключевые слова
    const mentalKeywords = [
      'назвать', 'вспомнить', 'медит', 'комплимент', 'подумать', 'считать',
      'прочитать', 'изучить', 'решить', 'видео', 'план', 'курс', 'стих', 'кроссворд', 'судоку', 'слов', 'благодарност'
    ];
    
    // Творческие ключевые слова
    const creativeKeywords = [
      'нарисовать', 'написать', 'сочинить', 'сфотографировать', 'придумать', 'оригами', 
      'мелодия', 'рифма', 'коллаж', 'рассказ', 'поделка', 'акварель', 'стихотворение', 'снять', 'обзор', 'плейлист', 'смайлик', 'рисовать'
    ];
    
    // Социальные ключевые слова
    const socialKeywords = [
      'позвонить', 'написать', 'отправить', 'познакомиться', 'помочь', 'организовать', 
      'встреча', 'друг', 'друзья', 'коллега', 'родственник', 'комментарий', 'письмо', 'улыбнуться', 'обнять', 'поблагодарить'
    ];
    
    // Бытовые ключевые слова
    const householdKeywords = [
      'протереть', 'поставить', 'открыть', 'застелить', 'полить', 'включить', 'выключить', 'поправить',
      'почистить', 'расчесать', 'погода', 'дом', 'комната', 'покупки', 'уборка', 'порядок', 'сложить', 'выбросить'
    ];
    
    // Проверяем каждую категорию
    if (physicalKeywords.some(keyword => text.includes(keyword))) {
      return 'physical';
    }
    if (mentalKeywords.some(keyword => text.includes(keyword))) {
      return 'mental';
    }
    if (creativeKeywords.some(keyword => text.includes(keyword))) {
      return 'creative';
    }
    if (socialKeywords.some(keyword => text.includes(keyword))) {
      return 'social';
    }
    if (householdKeywords.some(keyword => text.includes(keyword))) {
      return 'household';
    }
    
    // По умолчанию - ментальная
    return 'mental';
  }
  
  // Выбор случайной задачи
  selectRandomTask(taskPool, type) {
    if (taskPool.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * taskPool.length);
    return {
      text: taskPool[randomIndex],
      type: type
    };
  }

  // Легаси метод для обратной совместимости
  getFallbackTasks(taskConfig) {
    console.log('🗒️ Используем легаси метод getFallbackTasks, перенаправляем на getStaticTasks');
    return this.getStaticTasks(taskConfig, { level: 1 });
  }
}

module.exports = { AIService };
