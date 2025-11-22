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
  async getUserById(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error) {
        console.error('Error getting user by id:', error);
        return null;
      }
      
      return await this.enrichUserData(data);
    } catch (error) {
      console.error('Error in getUserById:', error);
      return null;
    }
  }

  // Получить пользователя по Telegram ID
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

  // Удалить все данные пользователя из всех таблиц
  async deleteAllUserData(telegramId) {
    const deletionReport = {
      success: true,
      tables: {},
      errors: []
    };

    try {
      console.log(`🗑️ Starting complete data deletion for user ${telegramId}`);

      // 1. Удаляем bot_messages
      console.log('🗑️ Deleting bot messages...');
      const { error: botMessagesError, count: botMessagesCount } = await this.supabase
        .from('bot_messages')
        .delete()
        .eq('telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (botMessagesError) {
        deletionReport.errors.push(`bot_messages: ${botMessagesError.message}`);
      } else {
        deletionReport.tables.bot_messages = botMessagesCount || 0;
        console.log(`✅ Deleted ${botMessagesCount || 0} bot messages`);
      }

      // 2. Удаляем custom_tasks
      console.log('🗑️ Deleting custom tasks...');
      const { error: customTasksError, count: customTasksCount } = await this.supabase
        .from('custom_tasks')
        .delete()
        .eq('telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (customTasksError) {
        deletionReport.errors.push(`custom_tasks: ${customTasksError.message}`);
      } else {
        deletionReport.tables.custom_tasks = customTasksCount || 0;
        console.log(`✅ Deleted ${customTasksCount || 0} custom tasks`);
      }

      // 3. Удаляем viral_triggers
      console.log('🗑️ Deleting viral triggers...');
      const { error: viralError, count: viralCount } = await this.supabase
        .from('viral_triggers')
        .delete()
        .eq('user_telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (viralError) {
        deletionReport.errors.push(`viral_triggers: ${viralError.message}`);
      } else {
        deletionReport.tables.viral_triggers = viralCount || 0;
        console.log(`✅ Deleted ${viralCount || 0} viral triggers`);
      }

      // 4. Удаляем tasks
      console.log('🗑️ Deleting tasks...');
      const { error: tasksError, count: tasksCount } = await this.supabase
        .from('tasks')
        .delete()
        .eq('telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (tasksError) {
        deletionReport.errors.push(`tasks: ${tasksError.message}`);
      } else {
        deletionReport.tables.tasks = tasksCount || 0;
        console.log(`✅ Deleted ${tasksCount || 0} tasks`);
      }

      // 5. Удаляем daily_stats
      console.log('🗑️ Deleting daily stats...');
      const { error: statsError, count: statsCount } = await this.supabase
        .from('daily_stats')
        .delete()
        .eq('telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (statsError) {
        deletionReport.errors.push(`daily_stats: ${statsError.message}`);
      } else {
        deletionReport.tables.daily_stats = statsCount || 0;
        console.log(`✅ Deleted ${statsCount || 0} daily stats records`);
      }

      // 6. Удаляем streaks
      console.log('🗑️ Deleting streaks...');
      const { error: streaksError } = await this.supabase
        .from('streaks')
        .delete()
        .eq('telegram_id', telegramId);
      
      if (streaksError) {
        deletionReport.errors.push(`streaks: ${streaksError.message}`);
      } else {
        deletionReport.tables.streaks = 1;
        console.log(`✅ Deleted streak record`);
      }

      // 7. Удаляем user_achievements
      console.log('🗑️ Deleting achievements...');
      const { error: achievementsError, count: achievementsCount } = await this.supabase
        .from('user_achievements')
        .delete()
        .eq('telegram_id', telegramId)
        .select('achievement_id', { count: 'exact', head: true });
      
      if (achievementsError) {
        deletionReport.errors.push(`user_achievements: ${achievementsError.message}`);
      } else {
        deletionReport.tables.user_achievements = achievementsCount || 0;
        console.log(`✅ Deleted ${achievementsCount || 0} achievements`);
      }

      // 8. Удаляем reflections
      console.log('🗑️ Deleting reflections...');
      const { error: reflectionsError, count: reflectionsCount } = await this.supabase
        .from('reflections')
        .delete()
        .eq('telegram_id', telegramId)
        .select('id', { count: 'exact', head: true });
      
      if (reflectionsError) {
        deletionReport.errors.push(`reflections: ${reflectionsError.message}`);
      } else {
        deletionReport.tables.reflections = reflectionsCount || 0;
        console.log(`✅ Deleted ${reflectionsCount || 0} reflections`);
      }

      // 9. Удаляем referral_rewards (проверяем правильное имя колонки)
      console.log('🗑️ Deleting referral rewards...');
      try {
        // Сначала пытаемся найти user_id по telegram_id
        const { data: user } = await this.supabase
          .from('users')
          .select('id')
          .eq('telegram_id', telegramId)
          .single();
        
        if (user && user.id) {
          const { error: rewardsError, count: rewardsCount } = await this.supabase
            .from('referral_rewards')
            .delete()
            .eq('user_id', user.id)
            .select('id', { count: 'exact', head: true });
          
          if (rewardsError) {
            deletionReport.errors.push(`referral_rewards: ${rewardsError.message}`);
          } else {
            deletionReport.tables.referral_rewards = rewardsCount || 0;
            console.log(`✅ Deleted ${rewardsCount || 0} referral rewards`);
          }
        }
      } catch (error) {
        // Таблица может не существовать
        console.log('⚠️ Could not process referral_rewards');
      }

      // 10. Удаляем referrals где пользователь referred
      console.log('🗑️ Deleting referral records where user was referred...');
      try {
        // Сначала пытаемся найти user_id по telegram_id
        const { data: user } = await this.supabase
          .from('users')
          .select('id')
          .eq('telegram_id', telegramId)
          .single();
        
        if (user && user.id) {
          const { error: referralsError, count: referralsCount } = await this.supabase
            .from('referrals')
            .delete()
            .eq('referred_id', user.id)
            .select('id', { count: 'exact', head: true });
          
          if (referralsError) {
            deletionReport.errors.push(`referrals (as referred): ${referralsError.message}`);
          } else {
            deletionReport.tables.referrals_as_referred = referralsCount || 0;
            console.log(`✅ Deleted ${referralsCount || 0} referral records where user was referred`);
          }
          
          // Также удаляем referrals где пользователь был referrer
          const { error: referrerError, count: referrerCount } = await this.supabase
            .from('referrals')
            .delete()
            .eq('referrer_id', user.id)
            .select('id', { count: 'exact', head: true });
          
          if (referrerError) {
            deletionReport.errors.push(`referrals (as referrer): ${referrerError.message}`);
          } else {
            deletionReport.tables.referrals_as_referrer = referrerCount || 0;
            console.log(`✅ Deleted ${referrerCount || 0} referral records where user was referrer`);
          }
        }
      } catch (error) {
        // Таблица может не существовать
        console.log('⚠️ Could not process referrals');
      }

      // 11. Удаляем moods если есть
      console.log('🗑️ Checking for moods table...');
      const { error: moodsError } = await this.supabase
        .from('moods')
        .delete()
        .eq('telegram_id', telegramId);
      
      // Не добавляем в ошибки если таблица не существует
      if (moodsError && 
          !moodsError.message.includes('relation "moods" does not exist') &&
          !moodsError.message.includes('Could not find the table')) {
        deletionReport.errors.push(`moods: ${moodsError.message}`);
      }

      // 12. Удаляем event_logs если есть
      console.log('🗑️ Checking for event_logs table...');
      const { error: eventsError } = await this.supabase
        .from('event_logs')
        .delete()
        .eq('user_telegram_id', telegramId);
      
      // Не добавляем в ошибки если таблица не существует
      if (eventsError && 
          !eventsError.message.includes('relation "event_logs" does not exist') &&
          !eventsError.message.includes('Could not find the table')) {
        deletionReport.errors.push(`event_logs: ${eventsError.message}`);
      }

      if (deletionReport.errors.length > 0) {
        deletionReport.success = false;
        console.warn('⚠️ Some errors occurred during deletion:', deletionReport.errors);
      }

      console.log('📊 Deletion report:', deletionReport);
      return deletionReport;

    } catch (error) {
      console.error('❌ Critical error in deleteAllUserData:', error);
      deletionReport.success = false;
      deletionReport.errors.push(`Critical error: ${error.message}`);
      return deletionReport;
    }
  }

  // Полностью удалить пользователя
  async deleteUser(telegramId) {
    try {
      console.log(`🗑️ Starting complete user deletion for ${telegramId}`);
      
      // Сначала удаляем все связанные данные
      const deletionReport = await this.deleteAllUserData(telegramId);
      
      if (!deletionReport.success) {
        console.error('⚠️ Some data deletion errors occurred, but continuing with user deletion');
      }

      // Затем удаляем самого пользователя
      console.log('🗑️ Deleting user record...');
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('telegram_id', telegramId);

      if (error) {
        console.error('❌ Error deleting user:', error);
        return false;
      }

      console.log(`✅ Пользователь ${telegramId} полностью удален`);
      console.log(`📊 Deleted data from tables:`, deletionReport.tables);
      return true;
    } catch (error) {
      console.error('❌ Error deleting user:', error);
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

  // Получить пользователя по Telegram ID (альтернативный метод для webhooks)
  async getUserByTelegramId(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();
      
      if (error) {
        console.error('Error getting user by telegram_id:', error);
        return null;
      }
      
      return await this.enrichUserData(data);
    } catch (error) {
      console.error('Error in getUserByTelegramId:', error);
      return null;
    }
  }

  // Получить пользователя по ID (для webhooks)
  async getUserById(id) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error getting user by id:', error);
        return null;
      }

      return await this.enrichUserData(data);
    } catch (error) {
      console.error('Error in getUserById:', error);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ ПАУЗОЙ И НЕАКТИВНОСТЬЮ
  // ═══════════════════════════════════════════════════════════════

  // Поставить пользователя на паузу
  async pauseUser(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          is_paused: true,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error pausing user:', error);
        throw error;
      }

      console.log(`✅ User ${telegramId} paused successfully`);
      return data;
    } catch (error) {
      console.error('Error in pauseUser:', error);
      throw error;
    }
  }

  // Снять пользователя с паузы
  async resumeUser(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          is_paused: false,
          inactive_days_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error resuming user:', error);
        throw error;
      }

      console.log(`✅ User ${telegramId} resumed successfully`);
      return data;
    } catch (error) {
      console.error('Error in resumeUser:', error);
      throw error;
    }
  }

  // Сбросить счётчик неактивных дней
  async resetInactiveDays(telegramId) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update({
          inactive_days_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error resetting inactive days:', error);
        throw error;
      }

      console.log(`✅ User ${telegramId} inactive days reset`);
      return data;
    } catch (error) {
      console.error('Error in resetInactiveDays:', error);
      throw error;
    }
  }

  // Отследить взаимодействие пользователя (обновить last_interaction_date)
  async trackInteraction(telegramId) {
    try {
      const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');

      const { data, error } = await this.supabase
        .from('users')
        .update({
          last_interaction_date: today,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single();

      if (error) {
        console.error('Error tracking interaction:', error);
        throw error;
      }

      console.log(`✅ User ${telegramId} interaction tracked for ${today}`);
      return data;
    } catch (error) {
      console.error('Error in trackInteraction:', error);
      throw error;
    }
  }
}

module.exports = { UserService };
