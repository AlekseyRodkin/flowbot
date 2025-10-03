// src/api/webhooks.js
const express = require('express');
const { userService } = require('../services/userService');
const { taskService } = require('../services/taskService');
const { taskHandler } = require('../handlers/taskHandler');
const moment = require('moment-timezone');

const router = express.Router();

// Middleware для проверки API ключа
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const validApiKey = process.env.WEBHOOK_API_KEY || 'flowbot_webhook_secret_key_2024';

  if (apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  next();
};

// Применяем middleware ко всем маршрутам
router.use(authenticateApiKey);

// Эндпоинт для отправки утренних задач пользователю
router.post('/send-morning-tasks', async (req, res) => {
  try {
    const { user_id, telegram_id } = req.body;
    
    if (!user_id && !telegram_id) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'Either user_id or telegram_id is required' 
      });
    }
    
    // Получаем пользователя
    let user;
    if (telegram_id) {
      user = await userService.getUserByTelegramId(telegram_id);
    } else {
      user = await userService.getUserById(user_id);
    }
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found', 
        message: 'User does not exist' 
      });
    }
    
    // Проверяем, есть ли уже задачи на сегодня
    const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
    const existingTasks = await taskService.getUserTasksForDate(user.telegram_id, today);
    
    if (existingTasks && existingTasks.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Tasks already exist for today',
        task_count: existingTasks.length
      });
    }
    
    // Генерируем задачи для пользователя
    const level = user.level || 1;
    let taskConfig = {};

    // Дни 1-5: Разгон (30 простых)
    // Дни 6-10: Усложнение (15 простых + 10 средних + 5 сложных)
    // Дни 11-30+: Поток (10 простых + 10 средних + 10 сложных, повторяется)
    if (level <= 5) {
      taskConfig = { easy: 30, standard: 0, hard: 0 };
    } else if (level <= 10) {
      taskConfig = { easy: 15, standard: 10, hard: 5 };
    } else {
      // Для дней 11 и далее используем одинаковую конфигурацию
      taskConfig = { easy: 10, standard: 10, hard: 10 };
    }
    
    const tasks = await taskService.generateStaticTasks(taskConfig, {
      level: level,
      preferences: user.preferences || [],
      antiPatterns: user.anti_patterns || []
    });
    
    await taskService.createTasks(user.telegram_id, tasks);
    
    res.json({ 
      success: true, 
      message: 'Morning tasks generated successfully',
      task_count: tasks.length,
      user_level: level
    });
    
  } catch (error) {
    console.error('Error in send-morning-tasks webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Эндпоинт для отправки вечерней рефлексии
router.post('/send-evening-reflection', async (req, res) => {
  try {
    const { user_id, telegram_id } = req.body;
    
    if (!user_id && !telegram_id) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'Either user_id or telegram_id is required' 
      });
    }
    
    // Получаем пользователя
    let user;
    if (telegram_id) {
      user = await userService.getUserByTelegramId(telegram_id);
    } else {
      user = await userService.getUserById(user_id);
    }
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found', 
        message: 'User does not exist' 
      });
    }
    
    // Получаем статистику дня
    const today = moment().tz('Europe/Moscow').format('YYYY-MM-DD');
    const tasks = await taskService.getUserTasksForDate(user.telegram_id, today);
    const completed = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    res.json({ 
      success: true, 
      message: 'Evening reflection data ready',
      stats: {
        completed_tasks: completed,
        total_tasks: total,
        completion_percentage: percentage,
        date: today
      },
      user_level: user.level,
      current_streak: user.current_streak || 0
    });
    
  } catch (error) {
    console.error('Error in send-evening-reflection webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Эндпоинт для получения всех активных пользователей для рассылки
router.get('/active-users', async (req, res) => {
  try {
    const users = await userService.getActiveUsers();
    
    const userData = users.map(user => ({
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      level: user.level,
      onboarding_completed: user.onboarding_completed,
      morning_hour: user.morning_hour || 8,
      evening_hour: user.evening_hour || 21,
      current_streak: user.current_streak || 0
    }));
    
    res.json({ 
      success: true, 
      users: userData,
      total_count: userData.length 
    });
    
  } catch (error) {
    console.error('Error in active-users webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Эндпоинт для обновления уровня пользователя
router.post('/update-user-level', async (req, res) => {
  try {
    const { user_id, telegram_id, new_level } = req.body;
    
    if (!user_id && !telegram_id) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'Either user_id or telegram_id is required' 
      });
    }
    
    if (!new_level || new_level < 1) {
      return res.status(400).json({
        error: 'Invalid level',
        message: 'Level must be >= 1'
      });
    }
    
    // Получаем пользователя
    let user;
    if (telegram_id) {
      user = await userService.getUserByTelegramId(telegram_id);
    } else {
      user = await userService.getUserById(user_id);
    }
    
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found', 
        message: 'User does not exist' 
      });
    }
    
    // Обновляем уровень
    await userService.updateUser(user.telegram_id, { level: new_level });
    
    res.json({ 
      success: true, 
      message: 'User level updated successfully',
      user_id: user.id,
      telegram_id: user.telegram_id,
      old_level: user.level,
      new_level: new_level
    });
    
  } catch (error) {
    console.error('Error in update-user-level webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Эндпоинт для получения статуса работы бота
router.get('/health', async (req, res) => {
  try {
    const stats = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      timezone: 'Europe/Moscow',
      current_time: moment().tz('Europe/Moscow').format('YYYY-MM-DD HH:mm:ss')
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error in health webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

module.exports = router;