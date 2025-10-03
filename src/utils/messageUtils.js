// src/utils/messageUtils.js

/**
 * Универсальная функция для отправки или редактирования сообщений
 * Автоматически выбирает между новым сообщением и редактированием существующего
 */
async function sendOrEditMessage(ctx, text, extra = {}) {
  try {
    // Инициализируем сессию если её нет
    if (!ctx.session) {
      ctx.session = {};
    }

    const lastMessageId = ctx.session.lastBotMessageId;
    const isCallbackQuery = !!ctx.callbackQuery;

    console.log(`🔄 sendOrEditMessage: lastMessageId=${lastMessageId}, isCallbackQuery=${isCallbackQuery}, hasSession=${!!ctx.session}`);

    // Если есть предыдущее сообщение от бота и это callback query - редактируем
    if (lastMessageId && isCallbackQuery) {
      console.log(`✏️ Editing message ${lastMessageId}`);
      try {
        const result = await ctx.editMessageText(text, {
          parse_mode: 'Markdown',
          ...extra
        });
        
        // Обновляем ID сообщения в случае успеха
        if (result && result.message_id) {
          ctx.session.lastBotMessageId = result.message_id;
        }
        
        return result;
      } catch (error) {
        // Если редактирование не удалось (сообщение удалено, контент идентичен и т.д.)
        // отправляем новое сообщение
        console.log('⚠️ Failed to edit message, sending new:', error.message);
      }
    }

    // Отправляем новое сообщение
    const result = await ctx.replyWithMarkdown(text, extra);
    
    // Сохраняем ID нового сообщения
    if (result && result.message_id) {
      ctx.session.lastBotMessageId = result.message_id;
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in sendOrEditMessage:', error);
    // В случае ошибки пытаемся отправить простое сообщение
    try {
      return await ctx.reply(text);
    } catch (fallbackError) {
      console.error('❌ Fallback message failed:', fallbackError);
      throw fallbackError;
    }
  }
}

/**
 * Функция для принудительной отправки нового сообщения
 * (не редактирует предыдущее, всегда создает новое)
 */
async function sendNewMessage(ctx, text, extra = {}) {
  try {
    const result = await ctx.replyWithMarkdown(text, extra);
    
    // Сохраняем ID нового сообщения
    if (result && result.message_id && ctx.session) {
      ctx.session.lastBotMessageId = result.message_id;
    }
    
    return result;
  } catch (error) {
    console.error('❌ Error in sendNewMessage:', error);
    throw error;
  }
}

/**
 * Функция для принудительного редактирования сообщения
 */
async function editMessage(ctx, text, extra = {}) {
  try {
    return await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...extra
    });
  } catch (error) {
    console.error('❌ Error in editMessage:', error);
    throw error;
  }
}

/**
 * Очищает ID последнего сообщения из сессии
 * Полезно когда нужно гарантированно отправить новое сообщение
 */
function clearLastMessageId(ctx) {
  if (ctx.session) {
    ctx.session.lastBotMessageId = null;
  }
}

module.exports = {
  sendOrEditMessage,
  sendNewMessage,
  editMessage,
  clearLastMessageId
};