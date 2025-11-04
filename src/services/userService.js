// src/services/userService.js
const moment = require('moment-timezone');

class UserService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  // Получить или создать пользователя
  async getOrCreateUser(telegramUser) {
    try {
      const { id, username, first_name, last_name } = telegramUser;
      
      // Пробуем найти существующего пользователя
      const { data: existingUser, error: findError } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', id)
        .single();
      
      if (existingUser && !findError) {
        // Пользователь существует, обновляем last_seen
        await this.updateLastSeen(id);
        return await this.enrichUserData(existingUser);
      }
      
      // Создаем нового пользователя
      const newUser = {
        telegram_id: id,
        username: username || null,
        first_name: first_name || 'Пользователь',
        last_name: last_name || null,
        gender: null, // Будет установлено при онбординге
        level: 1,
        subscription_type: 'free',
        morning_hour: 8,
        evening_hour: 21,
        timezone: 'Europe/Moscow',
        language: 'ru',
        onboarding_completed: false,
        created_at: new Date().toISOString()
      };
      
      const { data: createdUser, error: createError } = await this.supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      
      // Создаем запись стрика для нового пользователя
      await this.createInitialStreak(createdUser.telegram_id);
      
      return await this.enrichUserData(createdUser);
      
    } catch (error) {
      console.error('Error in getOrCreateUser:', error);
      throw error;
    }
  }

  // Обновить данные пользователя
  async updateUser(telegramId, updates) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating user:', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error;
    }
  }

  // Получить пользователя по Telegram ID (алиас)
  async getUser(telegramId) {
    return this.getUserByTelegramId(telegramId);
  }

  // Создать нового пользователя (алиас)
  async createUser(userData) {
    return this.getOrCreateUser(userData);
  }

  // Получить пользователя по Telegram ID (основной метод)
  async getUserByTelegramId(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (error) {
        console.error('Error getting user by telegram id:', error);
        return null;
      }

      return await this.enrichUserData(data);
    } catch (error) {
      console.error('Error in getUserByTelegramId:', error);
      return null;
    }
  }

  // Алиас для обратной совместимости
  async getUserById(telegramId) {
    return this.getUserByTelegramId(telegramId);
  }

  // Получить статистику пользователя
  async getUserStats(telegramId) {
    try {
      // Получаем общую статистику
      const { data: stats, error: statsError } = await this.supabase
        .from('daily_stats')
        .select('*')
        .eq('telegram_id', telegramId)
        .order('date', { ascending: false })
        .limit(30);
      
      if (statsError) {
        console.error('Error getting user stats:', statsError);
        return null;
      }
      
      // Получаем информацию о стриках
      const { data: streak, error: streakError } = await this.supabase
        .from('streaks')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      // Получаем достижения
      const { data: achievements, error: achievementsError } = await this.supabase
        .from('user_achievements')
        .select(`
          achievement_id,
          unlocked_at,
          achievements (
            name,
            description,
            icon,
            points
          )
        `)
        .eq('telegram_id', telegramId);
      
      // Считаем агрегированные метрики
      const totalTasks = stats.reduce((sum, day) => sum + (day.completed_tasks || 0), 0);
      const totalDays = stats.filter(day => day.completed_tasks > 0).length;
      const averageTasks = totalDays > 0 ? Math.round(totalTasks / totalDays) : 0;
      const completionRate = stats.length > 0 
        ? Math.round((stats.filter(s => s.completed_tasks >= 15).length / stats.length) * 100)
        : 0;
      
      return {
        totalTasks,
        totalDays,
        averageTasks,
        completionRate,
        currentStreak: streak?.current_streak || 0,
        longestStreak: streak?.longest_streak || 0,
        achievements: achievements || [],
        recentDays: stats.slice(0, 7),
        monthlyStats: stats
      };
      
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return null;
    }
  }

  // Обновить время последнего визита
  async updateLastSeen(telegramId) {
    try {
      await this.supabase
        .from('users')
        .update({ 
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId);
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  // Создать начальную запись стрика
  async createInitialStreak(telegramId) {
    try {
      await this.supabase
        .from('streaks')
        .insert([{
          telegram_id: telegramId,
          current_streak: 0,
          longest_streak: 0,
          total_days: 0,
          created_at: new Date().toISOString()
        }]);
    } catch (error) {
      console.error('Error creating initial streak:', error);
    }
  }

  // Обогащение данных пользователя
  async enrichUserData(user) {
    if (!user) return null;
    
    // Получаем информацию о стриках
    let streak = null;
    try {
      const { data } = await this.supabase
        .from('streaks')
        .select('*')
        .eq('telegram_id', user.telegram_id)
        .single();
      
      streak = data;
    } catch (error) {
      console.error('Error getting streak:', error);
    }
    
    // Добавляем вычисляемые поля
    return {
      ...user,
      id: user.telegram_id, // Алиас для совместимости
      current_streak: streak?.current_streak || 0,
      longest_streak: streak?.longest_streak || 0,
      total_days: streak?.total_days || 0,
      level: user.level || 1,
      display_name: user.first_name || user.username || 'Пользователь'
    };
  }

  // Получить пользователей для утренней рассылки
  async getUsersForMorningTasks(hour) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('morning_hour', hour)
        .eq('onboarding_completed', true)
        .in('subscription_type', ['free', 'pro', 'team']);
      
      if (error) {
        console.error('Error getting users for morning tasks:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getUsersForMorningTasks:', error);
      return [];
    }
  }

  // Получить пользователей для вечерней рефлексии
  async getUsersForEveningReflection(hour) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('evening_hour', hour)
        .eq('onboarding_completed', true);
      
      if (error) {
        console.error('Error getting users for evening reflection:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getUsersForEveningReflection:', error);
      return [];
    }
  }

  // Проверить подписку пользователя
  async checkSubscription(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('subscription_type, subscription_end')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error || !data) {
        return { active: false, type: 'free' };
      }
      
      const now = moment();
      const endDate = data.subscription_end ? moment(data.subscription_end) : null;
      
      if (data.subscription_type === 'free') {
        return { active: true, type: 'free' };
      }
      
      if (endDate && endDate.isAfter(now)) {
        return { active: true, type: data.subscription_type };
      }
      
      // Подписка истекла, сбрасываем на free
      await this.updateUser(telegramId, {
        subscription_type: 'free',
        subscription_end: null
      });
      
      return { active: false, type: 'free' };
    } catch (error) {
      console.error('Error checking subscription:', error);
      return { active: false, type: 'free' };
    }
  }

  // Сбросить прогресс пользователя (уровень на 1, обнулить статистики)
  async resetUserProgress(telegramId) {
    try {
      // Сбрасываем уровень пользователя на 1
      const { data, error } = await this.supabase
        .from('users')
        .update({
          level: 1,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error resetting user progress:', error);
        return false;
      }

      // Сбрасываем стрики если таблица streaks существует  
      try {
        await this.supabase
          .from('streaks')
          .delete()
          .eq('telegram_id', telegramId);
      } catch (streakError) {
        console.log('Streaks table not found or already empty');
      }

      // Сбрасываем статистику если таблица daily_stats существует
      try {
        await this.supabase
          .from('daily_stats')
          .delete()
          .eq('telegram_id', telegramId);
      } catch (statsError) {
        console.log('Daily stats table not found or already empty');
      }

      console.log(`✅ Прогресс пользователя ${telegramId} сброшен`);
      return data;
    } catch (error) {
      console.error('Error resetting user progress:', error);
      return false;
    }
  }

  // Полностью удалить пользователя
  async deleteUser(telegramId) {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('Error deleting user:', error);
        return false;
      }

      console.log(`✅ Пользователь ${telegramId} полностью удален`);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Получить всех активных пользователей для рассылки
  async getActiveUsers() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('onboarding_completed', true)
        .not('telegram_id', 'is', null);
      
      if (error) {
        console.error('Error getting active users:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error in getActiveUsers:', error);
      return [];
    }
  }

  // Получить пользователя по внутреннему ID (для webhooks и других случаев)
  async getUserByInternalId(id) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error getting user by internal id:', error);
        return null;
      }

      return await this.enrichUserData(data);
    } catch (error) {
      console.error('Error in getUserByInternalId:', error);
      return null;
    }
  }
}

module.exports = { UserService };
