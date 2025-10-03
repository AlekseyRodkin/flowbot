// src/utils/sessionStore.js

/**
 * Supabase Session Store для Telegraf
 * Хранит сессии в базе данных Supabase
 */
class SupabaseSessionStore {
  constructor(supabase) {
    this.supabase = supabase;
    this.tableName = 'bot_sessions';
  }

  /**
   * Получить сессию из базы
   */
  async get(key) {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('session_data')
        .eq('session_key', key)
        .single();

      if (error || !data) {
        return undefined;
      }

      return data.session_data;
    } catch (error) {
      console.error('Error getting session:', error);
      return undefined;
    }
  }

  /**
   * Сохранить сессию в базу
   */
  async set(key, session) {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .upsert({
          session_key: key,
          session_data: session,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_key'
        });

      if (error) {
        console.error('Error saving session:', error);
      }
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Удалить сессию из базы
   */
  async delete(key) {
    try {
      await this.supabase
        .from(this.tableName)
        .delete()
        .eq('session_key', key);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }
}

/**
 * Middleware для Telegraf с Supabase хранилищем
 */
function supabaseSession(supabase, options = {}) {
  const store = new SupabaseSessionStore(supabase);
  const getSessionKey = options.getSessionKey || ((ctx) => {
    if (!ctx.from || !ctx.chat) {
      return;
    }
    return `${ctx.from.id}:${ctx.chat.id}`;
  });

  return async (ctx, next) => {
    const key = getSessionKey(ctx);

    if (!key) {
      return next();
    }

    // Загружаем сессию из хранилища
    let session = await store.get(key);

    if (!session) {
      session = {};
    }

    // Добавляем сессию в контекст
    Object.defineProperty(ctx, 'session', {
      get: function () { return session; },
      set: function (newValue) { session = newValue; }
    });

    // Выполняем обработчик
    await next();

    // Сохраняем сессию обратно в хранилище
    if (session == null) {
      await store.delete(key);
    } else {
      await store.set(key, session);
    }
  };
}

module.exports = {
  SupabaseSessionStore,
  supabaseSession
};
