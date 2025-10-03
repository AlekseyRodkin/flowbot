// src/services/referralService.js
const moment = require('moment-timezone');
const crypto = require('crypto');

class ReferralService {
  constructor(supabase, bot) {
    this.supabase = supabase;
    this.bot = bot;
  }

  // Генерация реферальной ссылки
  generateReferralLink(userId) {
    const referralCode = this.generateReferralCode(userId);
    return `https://t.me/${process.env.BOT_USERNAME}?start=ref_${referralCode}`;
  }

  // Генерация уникального кода
  generateReferralCode(userId) {
    // Можно использовать просто userId или хешировать для красоты
    return crypto.createHash('md5')
      .update(`${userId}-${process.env.REFERRAL_SALT}`)
      .digest('hex')
      .substring(0, 8);
  }

  // Обработка реферальной регистрации
  async processReferral(newUserId, referralCode) {
    try {
      // Находим реферера по коду
      const { data: referrer, error: findError } = await this.supabase
        .from('users')
        .select('id, telegram_id, referral_code')
        .eq('referral_code', referralCode)
        .single();

      if (!referrer || findError) {
        console.log('Invalid referral code:', referralCode);
        return null;
      }

      // Создаем запись о реферале
      const { data: referral, error: createError } = await this.supabase
        .from('referrals')
        .insert([{
          referrer_id: referrer.id,
          referred_id: newUserId,
          status: 'pending', // pending, active, rewarded
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (createError) {
        console.error('Error creating referral:', createError);
        return null;
      }

      // Уведомляем реферера о новом друге
      await this.notifyReferrer(referrer.telegram_id, newUserId);

      return referral;
    } catch (error) {
      console.error('Error processing referral:', error);
      return null;
    }
  }

  // Активация реферала (после 7 дней активности)
  async activateReferral(userId) {
    try {
      // Проверяем, прошел ли пользователь 7 дней
      const { data: stats } = await this.supabase
        .from('daily_stats')
        .select('date')
        .eq('user_id', userId)
        .gte('completed_tasks', 10) // Минимум 10 задач в день
        .order('date', { ascending: false })
        .limit(7);

      if (!stats || stats.length < 7) {
        return false; // Недостаточно активных дней
      }

      // Проверяем последовательность дней
      const dates = stats.map(s => moment(s.date));
      const daysDiff = dates[0].diff(dates[6], 'days');
      
      if (daysDiff > 10) {
        return false; // Дни не последовательны
      }

      // Находим реферальную запись
      const { data: referral } = await this.supabase
        .from('referrals')
        .select('*')
        .eq('referred_id', userId)
        .eq('status', 'pending')
        .single();

      if (!referral) {
        return false;
      }

      // Активируем реферал
      await this.supabase
        .from('referrals')
        .update({
          status: 'active',
          activated_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      // Награждаем обоих пользователей
      await this.rewardUsers(referral.referrer_id, userId);

      return true;
    } catch (error) {
      console.error('Error activating referral:', error);
      return false;
    }
  }

  // Награждение пользователей
  async rewardUsers(referrerId, referredId) {
    try {
      // Отправляем уведомления
      await this.sendRewardNotifications(referrerId, referredId);

      // Проверяем достижения реферера
      await this.checkReferralAchievements(referrerId);

      return true;
    } catch (error) {
      console.error('Error rewarding users:', error);
      return false;
    }
  }

  // Обновление подписки на Pro
  async upgradeUserToPro(userId, endDate) {
    try {
      // Получаем текущую подписку
      const { data: user } = await this.supabase
        .from('users')
        .select('subscription_type, subscription_end')
        .eq('id', userId)
        .single();

      // Если уже есть Pro, продлеваем
      if (user.subscription_type === 'pro' && user.subscription_end) {
        const currentEnd = moment(user.subscription_end);
        const newEnd = currentEnd.isAfter(moment()) 
          ? currentEnd.add(30, 'days')
          : moment().add(30, 'days');
        
        endDate = newEnd.format('YYYY-MM-DD');
      }

      // Обновляем подписку
      await this.supabase
        .from('users')
        .update({
          subscription_type: 'pro',
          subscription_end: endDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      return true;
    } catch (error) {
      console.error('Error upgrading user:', error);
      return false;
    }
  }

  // Проверка реферальных достижений
  async checkReferralAchievements(userId) {
    try {
      // Считаем количество активных рефералов
      const { data: referrals, count } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', userId)
        .in('status', ['active', 'rewarded']);

      const activeCount = count || 0;

      // Достижения за рефералов
      const achievements = [];
      if (activeCount >= 1) achievements.push('referral_1');
      if (activeCount >= 3) achievements.push('referral_3');
      if (activeCount >= 5) achievements.push('referral_5');
      if (activeCount >= 10) achievements.push('referral_10');

      // Специальное достижение для суперреферера
      if (activeCount >= 5) {
        // Даем статус Founding Member
        await this.grantFoundingMember(userId);
        achievements.push('founding_member');
      }

      // Разблокируем достижения
      for (const code of achievements) {
        await this.unlockAchievement(userId, code);
      }

      return achievements;
    } catch (error) {
      console.error('Error checking achievements:', error);
      return [];
    }
  }

  // Founding Member для суперрефереров
  async grantFoundingMember(userId) {
    try {
      await this.supabase
        .from('users')
        .update({
          is_founding_member: true
        })
        .eq('id', userId);

      // Отправляем особое уведомление
      const { data: user } = await this.supabase
        .from('users')
        .select('telegram_id')
        .eq('id', userId)
        .single();

      if (user) {
        await this.bot.telegram.sendMessage(
          user.telegram_id,
          `🎉 *ПОЗДРАВЛЯЕМ!*\n\n` +
          `Ты стал *Founding Member* FlowBot!\n\n` +
          `👑 Особый статус в сообществе\n` +
          `🏆 Специальный значок в профиле\n` +
          `💎 Ранний доступ к новым функциям\n` +
          `❤️ Наша вечная благодарность\n\n` +
          `Ты помог ${5}+ людям стать продуктивнее!\n` +
          `Спасибо, что помогаешь развивать FlowBot!`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Error granting Founding Member:', error);
    }
  }

  // Статистика реферальной программы
  async getReferralStats(userId) {
    try {
      // Общее количество приглашенных
      const { count: totalInvited } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', userId);

      // Активные рефералы
      const { count: activeReferrals } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', userId)
        .in('status', ['active', 'rewarded']);

      // Ожидающие активации
      const { count: pendingReferrals } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact' })
        .eq('referrer_id', userId)
        .eq('status', 'pending');

      // Список друзей с их статистикой
      const { data: friends } = await this.supabase
        .from('referrals')
        .select(`
          status,
          created_at,
          activated_at,
          users!referred_id (
            first_name,
            level,
            subscription_type
          ),
          daily_stats!referred_id (
            completed_tasks,
            date
          )
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      // Позиция в рейтинге рефереров
      const { data: topReferrers } = await this.supabase
        .rpc('get_top_referrers', { limit: 100 });

      const userPosition = topReferrers?.findIndex(r => r.user_id === userId) + 1 || 0;

      return {
        totalInvited: totalInvited || 0,
        activeReferrals: activeReferrals || 0,
        pendingReferrals: pendingReferrals || 0,
        friends: friends || [],
        leaderboardPosition: userPosition,
        daysOfProEarned: (activeReferrals || 0) * 30,
        isPermanentPro: activeReferrals >= 5
      };
    } catch (error) {
      console.error('Error getting referral stats:', error);
      return null;
    }
  }

  // Уведомления
  async notifyReferrer(referrerTelegramId, newUserId) {
    try {
      const { data: newUser } = await this.supabase
        .from('users')
        .select('first_name')
        .eq('id', newUserId)
        .single();

      await this.bot.telegram.sendMessage(
        referrerTelegramId,
        `🎉 *Отличные новости!*\n\n` +
        `${newUser?.first_name || 'Твой друг'} присоединился к FlowBot по твоей ссылке!\n\n` +
        `Теперь он на пути к продуктивности благодаря тебе! 💪\n\n` +
        `Следи за прогрессом друга и поддерживай!`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error notifying referrer:', error);
    }
  }

  async sendRewardNotifications(referrerId, referredId) {
    try {
      // Получаем данные пользователей
      const { data: users } = await this.supabase
        .from('users')
        .select('id, telegram_id, first_name')
        .in('id', [referrerId, referredId]);

      const referrer = users.find(u => u.id === referrerId);
      const referred = users.find(u => u.id === referredId);

      // Уведомление рефереру
      if (referrer) {
        await this.bot.telegram.sendMessage(
          referrer.telegram_id,
          `🏆 *Поздравляем!*\n\n` +
          `${referred?.first_name} прошел 7 дней в FlowBot!\n\n` +
          `✅ Ты помог другу стать продуктивнее!\n` +
          `✅ +1 к статистике активных рефералов\n\n` +
          `Продолжай помогать друзьям:\n` +
          `• 3 друга = Бейдж "Амбассадор"\n` +
          `• 5 друзей = Бейдж "Founding Member" 👑\n\n` +
          `Твой прогресс: /referral_stats`,
          { parse_mode: 'Markdown' }
        );
      }

      // Уведомление приглашенному
      if (referred) {
        await this.bot.telegram.sendMessage(
          referred.telegram_id,
          `🎊 *Поздравляем с первой неделей продуктивности!*\n\n` +
          `Ты прошел 7 дней и это большое достижение!\n\n` +
          `Теперь помоги своим друзьям:\n` +
          `💚 Поделись FlowBot с теми, кому это поможет\n` +
          `🚀 Помоги им войти в состояние потока\n\n` +
          `Отправь команду /invite чтобы получить ссылку!`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  }

  // Разблокировка достижения
  async unlockAchievement(userId, code) {
    try {
      // Проверяем, есть ли уже достижение
      const { data: achievement } = await this.supabase
        .from('achievements')
        .select('id')
        .eq('code', code)
        .single();

      if (!achievement) return;

      // Добавляем достижение пользователю
      await this.supabase
        .from('user_achievements')
        .upsert([{
          user_id: userId,
          achievement_id: achievement.id,
          unlocked_at: new Date().toISOString()
        }]);
    } catch (error) {
      // Игнорируем ошибку дубликата
      if (error.code !== '23505') {
        console.error('Error unlocking achievement:', error);
      }
    }
  }

  // Глобальная статистика для мотивации
  async getGlobalStats() {
    try {
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact' });

      const { data: totalTasksResult } = await this.supabase
        .from('tasks')
        .select('id', { count: 'exact' })
        .eq('completed', true);

      const totalTasks = totalTasksResult?.length || 0;

      // Цель сообщества
      const communityGoal = 1000;
      const progress = Math.min(100, Math.round((totalUsers / communityGoal) * 100));

      return {
        totalUsers: totalUsers || 0,
        totalTasksCompleted: totalTasks,
        communityGoal: communityGoal,
        progressPercent: progress,
        daysUntilMonetization: Math.max(0, communityGoal - totalUsers)
      };
    } catch (error) {
      console.error('Error getting global stats:', error);
      return null;
    }
  }
}

module.exports = { ReferralService };
