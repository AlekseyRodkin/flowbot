// src/services/taskService.js
const moment = require('moment-timezone');
const { CustomTaskService } = require('./customTaskService');
const { EventLogger, EVENT_TYPES } = require('./eventLogger');

class TaskService {
  constructor(supabase) {
    this.supabase = supabase;
    this.customTaskService = new CustomTaskService(supabase);
  }

  // Создать задачи для пользователя
  async createTasks(telegramId, tasks) {
    try {
      return await this.saveDailyTasks(telegramId, tasks);
    } catch (error) {
      console.error('Error in createTasks:', error);
      throw error;
    }
  }

  // Проверить, есть ли у пользователя задачи на сегодня
  async hasTasksToday(telegramId) {
    try {
      const tasks = await this.getTodayTasks(telegramId);
      return tasks.length > 0;
    } catch (error) {
      console.error('Error in hasTasksToday:', error);
      return false;
    }
  }

  // Получить задачи пользователя на сегодня
  async getTodayTasks(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      return await this.getUserTasksForDate(telegramId, today);
    } catch (error) {
      console.error('Error in getTodayTasks:', error);
      return [];
    }
  }

  // Получить задачи пользователя на дату
  async getUserTasksForDate(telegramId, date) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('date', date)
        .order('position', { ascending: true });
      
      if (error) {
        console.error('Error getting user tasks:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getUserTasksForDate:', error);
      return [];
    }
  }

  // Сохранить задачи на день
  async saveDailyTasks(telegramId, tasks) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      
      // Удаляем старые задачи на сегодня (если есть)
      await this.supabase
        .from('tasks')
        .delete()
        .eq('telegram_id', telegramId)
        .eq('date', today);
      
      // Форматируем задачи для вставки
      const tasksToInsert = tasks.map((task, index) => ({
        telegram_id: telegramId,
        date: today,
        task_text: task.text || task.task_text,
        task_type: task.type || task.task_type,
        position: index + 1,
        completed: false,
        ai_generated: true,
        created_at: new Date().toISOString()
      }));
      
      // Вставляем новые задачи
      const { data, error } = await this.supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select();
      
      if (error) {
        console.error('Error saving daily tasks:', error);
        throw error;
      }
      
      // Создаем или обновляем запись статистики дня
      await this.createOrUpdateDailyStats(telegramId, today, tasksToInsert.length);
      
      return data;
    } catch (error) {
      console.error('Error in saveDailyTasks:', error);
      throw error;
    }
  }

  // Отметить задачу как выполненную
  async completeTask(taskId) {
    try {
      // Получаем задачу
      const { data: task, error: getError } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (getError || !task) {
        console.error('Task not found:', getError);
        return null;
      }

      // Обновляем статус задачи
      const { data: updatedTask, error: updateError } = await this.supabase
        .from('tasks')
        .update({
          completed: true,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (updateError) {
        console.error('Error completing task:', updateError);
        return null;
      }

      // Параллельное выполнение: статистика + стрик (независимые операции)
      await Promise.all([
        this.updateDailyStats(task.telegram_id, task.date, task.task_type, 'complete'),
        this.checkAndUpdateStreak(task.telegram_id, task.date)
      ]);

      // Проверка достижений в фоне (не блокируем ответ)
      this.checkAchievements(task.telegram_id).catch(err =>
        console.error('Error checking achievements:', err)
      );

      return updatedTask;
    } catch (error) {
      console.error('Error in completeTask:', error);
      return null;
    }
  }

  // Переключить статус задачи
  async toggleTask(taskId) {
    try {
      // Получаем текущий статус задачи
      const { data: task, error: getError } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (getError || !task) {
        return null;
      }
      
      // Переключаем статус
      const newStatus = !task.completed;
      const { data: updatedTask, error: updateError } = await this.supabase
        .from('tasks')
        .update({
          completed: newStatus,
          completed_at: newStatus ? new Date().toISOString() : null
        })
        .eq('id', taskId)
        .select()
        .single();
      
      if (updateError) {
        return null;
      }
      
      // Обновляем статистику
      const action = newStatus ? 'complete' : 'uncomplete';
      await this.updateDailyStats(task.telegram_id, task.date, task.task_type, action);
      
      return updatedTask;
    } catch (error) {
      console.error('Error in toggleTask:', error);
      return null;
    }
  }

  // Получить статистику дня
  async getDailyStats(telegramId, date = null) {
    try {
      const targetDate = date || moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      
      // Получаем статистику из БД
      const { data: stats, error } = await this.supabase
        .from('daily_stats')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('date', targetDate)
        .single();
      
      if (error && error.code !== 'PGRST116') { // Игнорируем ошибку "не найдено"
        console.error('Error getting daily stats:', error);
        return this.getEmptyStats();
      }
      
      if (!stats) {
        return this.getEmptyStats();
      }
      
      // Получаем информацию о стрике
      const { data: streak } = await this.supabase
        .from('streaks')
        .select('current_streak, longest_streak')
        .eq('telegram_id', telegramId)
        .single();
      
      return {
        ...stats,
        streak: streak?.current_streak || 0,
        longest_streak: streak?.longest_streak || 0
      };
    } catch (error) {
      console.error('Error in getDailyStats:', error);
      return this.getEmptyStats();
    }
  }

  // Создать или обновить статистику дня
  async createOrUpdateDailyStats(telegramId, date, totalTasks) {
    try {
      const { data: existing } = await this.supabase
        .from('daily_stats')
        .select('id')
        .eq('telegram_id', telegramId)
        .eq('date', date)
        .single();
      
      if (existing) {
        // Обновляем существующую запись и СБРАСЫВАЕМ все счетчики
        await this.supabase
          .from('daily_stats')
          .update({
            total_tasks: totalTasks,
            completed_tasks: 0,
            easy_completed: 0,
            standard_completed: 0,
            hard_completed: 0,
            magic_completed: false,
            flow_score: 0,
            productivity_index: 0,
            created_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        // Создаем новую запись
        await this.supabase
          .from('daily_stats')
          .insert([{
            telegram_id: telegramId,
            date: date,
            total_tasks: totalTasks,
            completed_tasks: 0,
            easy_completed: 0,
            standard_completed: 0,
            hard_completed: 0,
            magic_completed: false,
            flow_score: 0,
            created_at: new Date().toISOString()
          }]);
      }
    } catch (error) {
      console.error('Error creating/updating daily stats:', error);
    }
  }

  // Обновить статистику дня
  async updateDailyStats(telegramId, date, taskType, action) {
    try {
      // Получаем текущую статистику
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('*')
        .eq('telegram_id', telegramId)
        .eq('date', date)
        .single();
      
      if (!stats) {
        // Создаем новую запись если её нет
        await this.createOrUpdateDailyStats(telegramId, date, 30);
        return;
      }
      
      // Подготавливаем обновления
      const updates = {};
      
      if (action === 'complete') {
        updates.completed_tasks = (stats.completed_tasks || 0) + 1;
        
        switch(taskType) {
          case 'easy':
            updates.easy_completed = (stats.easy_completed || 0) + 1;
            break;
          case 'standard':
            updates.standard_completed = (stats.standard_completed || 0) + 1;
            break;
          case 'hard':
            updates.hard_completed = (stats.hard_completed || 0) + 1;
            break;
          case 'magic':
            updates.magic_completed = true;
            break;
        }
      } else if (action === 'uncomplete') {
        updates.completed_tasks = Math.max(0, (stats.completed_tasks || 0) - 1);
        
        switch(taskType) {
          case 'easy':
            updates.easy_completed = Math.max(0, (stats.easy_completed || 0) - 1);
            break;
          case 'standard':
            updates.standard_completed = Math.max(0, (stats.standard_completed || 0) - 1);
            break;
          case 'hard':
            updates.hard_completed = Math.max(0, (stats.hard_completed || 0) - 1);
            break;
          case 'magic':
            updates.magic_completed = false;
            break;
        }
      }
      
      // Рассчитываем flow_score (исключаем магическую задачу из подсчёта)
      // Получаем реальное количество задач без магической
      const { data: allTasks } = await this.supabase
        .from('tasks')
        .select('task_type, completed')
        .eq('telegram_id', telegramId)
        .eq('date', date);

      const regularTasks = allTasks ? allTasks.filter(t => t.task_type !== 'magic') : [];
      const totalRegularTasks = regularTasks.length;
      const completedRegularTasks = regularTasks.filter(t => t.completed).length;

      updates.flow_score = totalRegularTasks > 0
        ? Math.round((completedRegularTasks / totalRegularTasks) * 100)
        : 0;
      
      // Рассчитываем productivity_index
      const easyWeight = 1;
      const standardWeight = 2;
      const hardWeight = 3;
      const magicBonus = 10;
      
      const easyScore = (updates.easy_completed || stats.easy_completed || 0) * easyWeight;
      const standardScore = (updates.standard_completed || stats.standard_completed || 0) * standardWeight;
      const hardScore = (updates.hard_completed || stats.hard_completed || 0) * hardWeight;
      const magicScore = (updates.magic_completed || stats.magic_completed) ? magicBonus : 0;
      
      updates.productivity_index = easyScore + standardScore + hardScore + magicScore;
      
      // Обновляем запись
      await this.supabase
        .from('daily_stats')
        .update(updates)
        .eq('telegram_id', telegramId)
        .eq('date', date);
      
    } catch (error) {
      console.error('Error updating daily stats:', error);
    }
  }

  // Проверить и обновить стрик
  async checkAndUpdateStreak(telegramId, date) {
    try {
      // Получаем текущий стрик
      const { data: streak, error } = await this.supabase
        .from('streaks')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error || !streak) {
        // Создаем новую запись стрика
        await this.supabase
          .from('streaks')
          .insert([{
            telegram_id: telegramId,
            current_streak: 1,
            longest_streak: 1,
            total_days: 1,
            last_completed_date: date,
            created_at: new Date().toISOString()
          }]);
        return;
      }
      
      // Проверяем, выполнено ли достаточно задач сегодня
      const { data: todayStats } = await this.supabase
        .from('daily_stats')
        .select('completed_tasks')
        .eq('telegram_id', telegramId)
        .eq('date', date)
        .single();
      
      if (!todayStats || todayStats.completed_tasks < 15) {
        // Недостаточно задач для стрика
        return;
      }
      
      const lastDate = streak.last_completed_date 
        ? moment(streak.last_completed_date) 
        : null;
      const currentDate = moment(date);
      
      let newStreak = streak.current_streak;
      let newLongest = streak.longest_streak;
      let newTotal = streak.total_days;
      
      if (!lastDate) {
        // Первый день стрика
        newStreak = 1;
        newTotal = 1;
      } else if (currentDate.diff(lastDate, 'days') === 1) {
        // Продолжение стрика
        newStreak = streak.current_streak + 1;
        newTotal = streak.total_days + 1;
      } else if (currentDate.diff(lastDate, 'days') === 0) {
        // Тот же день, ничего не меняем
        return;
      } else {
        // Стрик прерван
        newStreak = 1;
        newTotal = streak.total_days + 1;
      }
      
      // Обновляем longest_streak если нужно
      if (newStreak > newLongest) {
        newLongest = newStreak;
      }
      
      // Обновляем запись
      await this.supabase
        .from('streaks')
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
          total_days: newTotal,
          last_completed_date: date,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId);
      
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  }

  // Проверить достижения
  async checkAchievements(telegramId) {
    try {
      // Получаем статистику пользователя
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('date', { ascending: false })
        .limit(1)
        .single();
      
      const { data: streak } = await this.supabase
        .from('streaks')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      const { data: totalStats } = await this.supabase
        .from('tasks')
        .select('id', { count: 'exact' })
        .eq('telegram_id', telegramId)
        .eq('completed', true);
      
      // Список достижений для проверки
      const achievementsToCheck = [];
      
      // Проверяем достижения по стрикам
      if (streak) {
        if (streak.current_streak >= 3) achievementsToCheck.push('streak_3');
        if (streak.current_streak >= 7) achievementsToCheck.push('streak_7');
        if (streak.current_streak >= 15) achievementsToCheck.push('streak_15');
        if (streak.current_streak >= 30) achievementsToCheck.push('streak_30');
      }
      
      // Проверяем достижения по задачам за день
      if (stats) {
        if (stats.completed_tasks >= 10) achievementsToCheck.push('task_10');
        if (stats.completed_tasks >= 20) achievementsToCheck.push('task_20');
        if (stats.completed_tasks >= 30) achievementsToCheck.push('task_30');
        if (stats.hard_completed >= 1) achievementsToCheck.push('hard_1');
        if (stats.magic_completed) achievementsToCheck.push('magic_1');
      }
      
      // Проверяем достижения по общему количеству
      const totalCompleted = totalStats?.length || 0;
      if (totalCompleted >= 100) achievementsToCheck.push('task_100');
      if (totalCompleted >= 500) achievementsToCheck.push('task_500');
      if (totalCompleted >= 1000) achievementsToCheck.push('task_1000');
      
      // Разблокируем новые достижения
      for (const achievementCode of achievementsToCheck) {
        await this.unlockAchievement(telegramId, achievementCode);
      }
      
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }

  // Разблокировать достижение
  async unlockAchievement(telegramId, achievementCode) {
    try {
      // Проверяем, есть ли уже это достижение
      const { data: existing } = await this.supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('telegram_id', telegramId)
        .eq('achievements.code', achievementCode)
        .single();
      
      if (existing) {
        return; // Достижение уже разблокировано
      }
      
      // Получаем ID достижения
      const { data: achievement } = await this.supabase
        .from('achievements')
        .select('id')
        .eq('code', achievementCode)
        .single();
      
      if (!achievement) {
        return; // Достижение не найдено
      }
      
      // Добавляем достижение пользователю
      await this.supabase
        .from('user_achievements')
        .insert([{
          telegram_id: telegramId,
          achievement_id: achievement.id,
          unlocked_at: new Date().toISOString()
        }]);
      
      console.log(`Achievement unlocked: ${achievementCode} for user ${telegramId}`);
      
    } catch (error) {
      // Игнорируем ошибку дубликата
      if (error.code !== '23505') {
        console.error('Error unlocking achievement:', error);
      }
    }
  }

  // Получить пустую статистику
  getEmptyStats() {
    return {
      total_tasks: 0,
      completed_tasks: 0,
      easy_completed: 0,
      standard_completed: 0,
      hard_completed: 0,
      magic_completed: false,
      flow_score: 0,
      productivity_index: 0,
      streak: 0,
      longest_streak: 0
    };
  }

  // Сохранить настроение пользователя
  async saveMood(telegramId, date, mood) {
    try {
      await this.supabase
        .from('daily_stats')
        .update({ mood })
        .eq('telegram_id', telegramId)
        .eq('date', date);
    } catch (error) {
      console.error('Error saving mood:', error);
    }
  }

  // Сохранить рефлексию дня
  async saveReflection(telegramId, date, reflection) {
    try {
      const { data, error } = await this.supabase
        .from('reflections')
        .insert([{
          telegram_id: telegramId,
          date: date,
          what_worked: reflection.what_worked,
          what_didnt: reflection.what_didnt,
          tomorrow_focus: reflection.tomorrow_focus,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      return data;
    } catch (error) {
      console.error('Error saving reflection:', error);
      return null;
    }
  }

  // Удалить все задачи пользователя на сегодня
  async deleteTodayTasks(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      
      const { error } = await this.supabase
        .from('tasks')
        .delete()
        .eq('telegram_id', telegramId)
        .eq('date', today);

      if (error) {
        console.error('Error deleting today tasks:', error);
        return false;
      }

      console.log(`✅ Удалены все задачи на ${today} для пользователя ${telegramId}`);
      return true;
    } catch (error) {
      console.error('Error deleting today tasks:', error);
      return false;
    }
  }

  // Удалить все задачи пользователя
  async deleteAllUserTasks(telegramId) {
    try {
      const { error } = await this.supabase
        .from('tasks')
        .delete()
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('Error deleting all user tasks:', error);
        return false;
      }

      console.log(`✅ Удалены все задачи пользователя ${telegramId}`);
      return true;
    } catch (error) {
      console.error('Error deleting all user tasks:', error);
      return false;
    }
  }

  // Получить доступ к CustomTaskService
  getCustomTaskService() {
    return this.customTaskService;
  }

  // Создать пользовательскую задачу
  async createCustomTask(telegramId, taskData) {
    return await this.customTaskService.createCustomTask(telegramId, taskData);
  }

  // Получить пользовательские задачи
  async getUserCustomTasks(telegramId, filters = {}) {
    return await this.customTaskService.getUserCustomTasks(telegramId, filters);
  }

  // Получить случайные пользовательские задачи для дневного списка
  async getRandomCustomTasks(telegramId, difficulty, count = 5) {
    return await this.customTaskService.getRandomCustomTasks(telegramId, difficulty, count);
  }

  // Обновить текст задачи
  async updateTaskText(taskId, newText) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update({ task_text: newText })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating task text:', error);
      throw error;
    }
  }

  // Обновить пользовательскую задачу
  async updateCustomTask(taskId, telegramId, updates) {
    return await this.customTaskService.updateCustomTask(taskId, telegramId, updates);
  }

  // Удалить пользовательскую задачу
  async deleteCustomTask(taskId, telegramId) {
    return await this.customTaskService.deleteCustomTask(taskId, telegramId);
  }

  // Получить статистику пользовательских задач
  async getCustomTasksStats(telegramId) {
    return await this.customTaskService.getCustomTasksStats(telegramId);
  }

  // Проверить наличие пользовательских задач определенной сложности
  async hasCustomTasks(telegramId, difficulty) {
    return await this.customTaskService.hasCustomTasks(telegramId, difficulty);
  }

  // Получить задачу по ID
  async getTaskById(taskId) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) {
        console.error('Error getting task by ID:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getTaskById:', error);
      return null;
    }
  }

  // Заменить задачу новой
  async replaceTask(taskId, newTaskData) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update({
          task_text: newTaskData.text,
          task_type: newTaskData.type
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error replacing task:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in replaceTask:', error);
      throw error;
    }
  }

  // Удалить задачу по ID
  async deleteTask(taskId) {
    try {
      const { error } = await this.supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('Error deleting task:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in deleteTask:', error);
      throw error;
    }
  }

  // Переименовать задачу
  async renameTask(taskId, newText) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update({ task_text: newText })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error renaming task:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in renameTask:', error);
      throw error;
    }
  }

  // Изменить тип задачи
  async changeTaskType(taskId, newType) {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .update({ task_type: newType })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error changing task type:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in changeTaskType:', error);
      throw error;
    }
  }

  // Массово отметить все задачи как выполненные
  async bulkCompleteAllTasks(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      const { data, error } = await this.supabase
        .from('tasks')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('telegram_id', telegramId)
        .eq('date', today)
        .select();

      if (error) {
        console.error('Error bulk completing tasks:', error);
        throw error;
      }

      // Пересчитываем статистику для каждого типа задач
      for (const task of data) {
        await this.updateDailyStats(telegramId, today, task.task_type, 'complete');
      }

      return data;
    } catch (error) {
      console.error('Error in bulkCompleteAllTasks:', error);
      throw error;
    }
  }

  // Массово снять отметки со всех задач
  async bulkUncompleteAllTasks(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      const { data, error } = await this.supabase
        .from('tasks')
        .update({ completed: false, completed_at: null })
        .eq('telegram_id', telegramId)
        .eq('date', today)
        .select();

      if (error) {
        console.error('Error bulk uncompleting tasks:', error);
        throw error;
      }

      // Пересчитываем статистику для каждого типа задач
      for (const task of data) {
        await this.updateDailyStats(telegramId, today, task.task_type, 'uncomplete');
      }

      return data;
    } catch (error) {
      console.error('Error in bulkUncompleteAllTasks:', error);
      throw error;
    }
  }

  // Удалить все выполненные задачи
  async bulkDeleteCompletedTasks(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      const { data, error } = await this.supabase
        .from('tasks')
        .delete()
        .eq('telegram_id', telegramId)
        .eq('date', today)
        .eq('completed', true)
        .select();

      if (error) {
        console.error('Error bulk deleting completed tasks:', error);
        throw error;
      }

      // Пересчитываем статистику - удаляем задачи из подсчета
      for (const task of data) {
        await this.updateDailyStats(telegramId, today, task.task_type, 'uncomplete');
      }

      return data;
    } catch (error) {
      console.error('Error in bulkDeleteCompletedTasks:', error);
      throw error;
    }
  }

  // Изменить тип всех задач на определенный
  async bulkChangeTaskType(telegramId, newType) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
      
      const { data, error } = await this.supabase
        .from('tasks')
        .update({ task_type: newType })
        .eq('telegram_id', telegramId)
        .eq('date', today)
        .select();

      if (error) {
        console.error('Error bulk changing task type:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in bulkChangeTaskType:', error);
      throw error;
    }
  }

  // Перемешать порядок задач
  async shuffleTasksOrder(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      // Получаем все задачи
      const tasks = await this.getUserTasksForDate(telegramId, today);

      if (tasks.length === 0) {
        return [];
      }

      // Создаем новый случайный порядок
      const shuffledPositions = [...Array(tasks.length).keys()].map(i => i + 1);
      for (let i = shuffledPositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPositions[i], shuffledPositions[j]] = [shuffledPositions[j], shuffledPositions[i]];
      }

      // Обновляем позиции в базе данных
      const updates = tasks.map((task, index) =>
        this.supabase
          .from('tasks')
          .update({ position: shuffledPositions[index] })
          .eq('id', task.id)
      );

      await Promise.all(updates);

      // Возвращаем обновленный список
      return await this.getUserTasksForDate(telegramId, today);
    } catch (error) {
      console.error('Error in shuffleTasksOrder:', error);
      throw error;
    }
  }

  // Обновить стрик при завершении ВСЕХ задач дня
  async updateStreak(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      console.log(`🔥 Updating streak for user ${telegramId} on ${today}`);

      // Получаем текущий стрик
      const { data: streak, error } = await this.supabase
        .from('streaks')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error || !streak) {
        // Создаём новую запись стрика (первое завершение дня)
        console.log('🆕 Creating first streak record');
        await this.supabase
          .from('streaks')
          .insert([{
            telegram_id: telegramId,
            current_streak: 1,
            longest_streak: 1,
            total_days: 1,
            last_completed_date: today,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);
        return;
      }

      // Проверяем last_completed_date
      const lastDate = streak.last_completed_date
        ? moment(streak.last_completed_date)
        : null;
      const currentDate = moment(today);

      let newStreak = streak.current_streak;
      let newLongest = streak.longest_streak;
      let newTotal = streak.total_days;

      if (!lastDate) {
        // Первый день (не должно случиться, но на всякий случай)
        console.log('🎯 First completed day');
        newStreak = 1;
        newTotal = 1;
      } else {
        const daysDiff = currentDate.diff(lastDate, 'days');

        if (daysDiff === 0) {
          // Уже засчитали сегодня - игнорируем
          console.log('⏭️ Already counted today, skipping');
          return;
        } else if (daysDiff === 1) {
          // Вчера был завершён - продолжаем стрик
          console.log(`🔥 Streak continues: ${newStreak} → ${newStreak + 1}`);
          newStreak = streak.current_streak + 1;
          newTotal = streak.total_days + 1;
        } else {
          // Пропущены дни - сбрасываем стрик
          console.log(`💔 Streak broken (gap: ${daysDiff} days), resetting to 1`);
          newStreak = 1;
          newTotal = streak.total_days + 1;
        }
      }

      // Обновляем longest_streak если текущий стрик побил рекорд
      if (newStreak > newLongest) {
        console.log(`🏆 New record! ${newLongest} → ${newStreak}`);
        newLongest = newStreak;
      }

      // Сохраняем обновлённый стрик
      await this.supabase
        .from('streaks')
        .update({
          current_streak: newStreak,
          longest_streak: newLongest,
          total_days: newTotal,
          last_completed_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId);

      console.log(`✅ Streak updated: current=${newStreak}, longest=${newLongest}, total=${newTotal}`);

      // Event logging for streak milestones
      const eventLogger = new EventLogger(this.supabase);

      if (newStreak === 3) {
        await eventLogger.logStreak3Days(telegramId);
      } else if (newStreak === 7) {
        await eventLogger.logStreak7Days(telegramId);
      } else if (newStreak === 14) {
        await eventLogger.logStreak14Days(telegramId);
      } else if (newStreak === 30) {
        await eventLogger.logStreak30Days(telegramId);
      }

    } catch (error) {
      console.error('Error in updateStreak:', error);
    }
  }
}

module.exports = { TaskService };
