// src/services/customTaskService.js

class CustomTaskService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // Создать новую пользовательскую задачу
  async createCustomTask(telegramId, taskData) {
    try {
      const { title, description, category, difficulty, estimated_time } = taskData;
      
      // Валидация обязательных полей
      if (!title || !category || !difficulty) {
        throw new Error('Не заполнены обязательные поля: название, категория, сложность');
      }

      // Валидация значений
      const validCategories = ['mental', 'physical', 'creative', 'social', 'household', 'personal'];
      const validDifficulties = ['easy', 'standard', 'hard', 'magic'];
      
      if (!validCategories.includes(category)) {
        throw new Error('Неверная категория задачи');
      }
      
      if (!validDifficulties.includes(difficulty)) {
        throw new Error('Неверная сложность задачи');
      }

      const { data, error } = await this.supabase
        .from('custom_tasks')
        .insert([{
          telegram_id: telegramId,
          title: title.trim(),
          description: description?.trim() || null,
          category,
          difficulty,
          estimated_time: estimated_time || 15,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating custom task:', error);
        throw error;
      }

      console.log(`✅ Создана пользовательская задача: ${title} для пользователя ${telegramId}`);
      return data;

    } catch (error) {
      console.error('Error in createCustomTask:', error);
      throw error;
    }
  }

  // Получить все пользовательские задачи пользователя
  async getUserCustomTasks(telegramId, filters = {}) {
    try {
      let query = this.supabase
        .from('custom_tasks')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Применяем фильтры
      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting custom tasks:', error);
        throw error;
      }

      return data || [];

    } catch (error) {
      console.error('Error in getUserCustomTasks:', error);
      return [];
    }
  }

  // Получить случайные пользовательские задачи для генерации дневного списка
  async getRandomCustomTasks(telegramId, difficulty, count = 5) {
    try {
      const { data, error } = await this.supabase
        .from('custom_tasks')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('difficulty', difficulty)
        .eq('is_active', true);

      if (error) {
        console.error('Error getting random custom tasks:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Перемешиваем и берем нужное количество
      const shuffled = data.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, Math.min(count, shuffled.length));

    } catch (error) {
      console.error('Error in getRandomCustomTasks:', error);
      return [];
    }
  }

  // Обновить пользовательскую задачу
  async updateCustomTask(taskId, telegramId, updates) {
    try {
      // Валидация владельца задачи
      const { data: existingTask } = await this.supabase
        .from('custom_tasks')
        .select('telegram_id')
        .eq('id', taskId)
        .single();

      if (!existingTask || existingTask.telegram_id !== telegramId) {
        throw new Error('Задача не найдена или вы не являетесь её владельцем');
      }

      // Валидация обновляемых данных
      if (updates.category) {
        const validCategories = ['mental', 'physical', 'creative', 'social', 'household', 'personal'];
        if (!validCategories.includes(updates.category)) {
          throw new Error('Неверная категория задачи');
        }
      }
      
      if (updates.difficulty) {
        const validDifficulties = ['standard', 'hard', 'magic'];
        if (!validDifficulties.includes(updates.difficulty)) {
          throw new Error('Неверная сложность задачи');
        }
      }

      const { data, error } = await this.supabase
        .from('custom_tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error updating custom task:', error);
        throw error;
      }

      console.log(`✅ Обновлена пользовательская задача ID: ${taskId}`);
      return data;

    } catch (error) {
      console.error('Error in updateCustomTask:', error);
      throw error;
    }
  }

  // Удалить пользовательскую задачу (мягкое удаление)
  async deleteCustomTask(taskId, telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('custom_tasks')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting custom task:', error);
        throw error;
      }

      if (!data) {
        throw new Error('Задача не найдена или вы не являетесь её владельцем');
      }

      console.log(`✅ Удалена пользовательская задача ID: ${taskId}`);
      return true;

    } catch (error) {
      console.error('Error in deleteCustomTask:', error);
      throw error;
    }
  }

  // Получить задачу по ID
  async getCustomTaskById(taskId, telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('custom_tasks')
        .select('*')
        .eq('id', taskId)
        .eq('telegram_id', telegramId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error getting custom task by id:', error);
        return null;
      }

      return data;

    } catch (error) {
      console.error('Error in getCustomTaskById:', error);
      return null;
    }
  }

  // Получить статистику пользовательских задач
  async getCustomTasksStats(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('custom_tasks')
        .select('difficulty, category, is_active')
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('Error getting custom tasks stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          total: 0,
          active: 0,
          byDifficulty: { standard: 0, hard: 0, magic: 0 },
          byCategory: { mental: 0, physical: 0, creative: 0, social: 0, household: 0, personal: 0 }
        };
      }

      const stats = {
        total: data.length,
        active: data.filter(task => task.is_active).length,
        byDifficulty: {
          standard: data.filter(task => task.difficulty === 'standard' && task.is_active).length,
          hard: data.filter(task => task.difficulty === 'hard' && task.is_active).length,
          magic: data.filter(task => task.difficulty === 'magic' && task.is_active).length
        },
        byCategory: {
          mental: data.filter(task => task.category === 'mental' && task.is_active).length,
          physical: data.filter(task => task.category === 'physical' && task.is_active).length,
          creative: data.filter(task => task.category === 'creative' && task.is_active).length,
          social: data.filter(task => task.category === 'social' && task.is_active).length,
          household: data.filter(task => task.category === 'household' && task.is_active).length,
          personal: data.filter(task => task.category === 'personal' && task.is_active).length
        }
      };

      return stats;

    } catch (error) {
      console.error('Error in getCustomTasksStats:', error);
      return null;
    }
  }

  // Проверить, имеет ли пользователь пользовательские задачи определенной сложности
  async hasCustomTasks(telegramId, difficulty) {
    try {
      const { data, error } = await this.supabase
        .from('custom_tasks')
        .select('id')
        .eq('telegram_id', telegramId)
        .eq('difficulty', difficulty)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error checking custom tasks:', error);
        return false;
      }

      return data && data.length > 0;

    } catch (error) {
      console.error('Error in hasCustomTasks:', error);
      return false;
    }
  }

  // Получить категории и их русские названия
  getCategoryLabels() {
    return {
      'mental': '🧠 Умственная',
      'physical': '💪 Физическая',
      'creative': '🎨 Творческая',
      'social': '👥 Социальная',
      'household': '🏠 Домашняя',
      'personal': '⭐ Личная'
    };
  }

  // Получить уровни сложности и их русские названия
  getDifficultyLabels() {
    return {
      'easy': '💚 Простая',
      'standard': '📈 Средняя',
      'hard': '🔥 Сложная',
      'magic': '✨ Волшебная'
    };
  }

  // Добавить пользовательскую задачу в список на сегодня
  async addCustomTaskToToday(telegramId, customTaskId) {
    try {
      // Получаем пользовательскую задачу
      const { data: customTask, error: getError } = await this.supabase
        .from('custom_tasks')
        .select('*')
        .eq('id', customTaskId)
        .eq('telegram_id', telegramId)
        .eq('is_active', true)
        .single();

      if (getError || !customTask) {
        throw new Error('Задача не найдена');
      }

      // Создаем задачу в списке на сегодня
      const today = new Date().toISOString().split('T')[0];
      const { data: newTask, error: insertError } = await this.supabase
        .from('tasks')
        .insert([{
          telegram_id: telegramId,
          date: today,
          task_text: customTask.title,
          task_type: customTask.difficulty,
          is_custom: true,
          custom_task_id: customTaskId,
          completed: false,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Error adding custom task to today:', insertError);
        throw insertError;
      }

      console.log(`✅ Добавлена пользовательская задача в список на сегодня: ${customTask.title}`);
      return newTask;

    } catch (error) {
      console.error('Error in addCustomTaskToToday:', error);
      throw error;
    }
  }

  // Создать и сразу добавить задачу на сегодня
  async createAndAddToToday(telegramId, taskData) {
    try {
      // Сначала создаем задачу
      const customTask = await this.createCustomTask(telegramId, taskData);
      
      // Затем добавляем её на сегодня
      const todayTask = await this.addCustomTaskToToday(telegramId, customTask.id);
      
      return { customTask, todayTask };
    } catch (error) {
      console.error('Error in createAndAddToToday:', error);
      throw error;
    }
  }
}

module.exports = { CustomTaskService };