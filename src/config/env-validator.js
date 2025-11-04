// src/config/env-validator.js
/**
 * Валидатор переменных окружения
 * Проверяет наличие всех необходимых переменных при старте приложения
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

/**
 * Список обязательных переменных окружения
 */
const REQUIRED_ENV_VARS = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
];

/**
 * Список опциональных переменных с значениями по умолчанию
 */
const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  PORT: '3001',
  API_PORT: '3001',
  LOG_LEVEL: 'info',
  DEFAULT_TIMEZONE: 'Europe/Moscow',
  ENABLE_AI_GENERATION: 'true',
  ENABLE_PAYMENTS: 'false',
  ENABLE_ANALYTICS: 'false',
  MAX_DAILY_TASKS: '30',
};

/**
 * Список переменных, которые желательно иметь (предупреждения)
 */
const RECOMMENDED_ENV_VARS = [
  'OPENAI_API_KEY',
  'ADMIN_TELEGRAM_ID',
];

/**
 * Валидация переменных окружения
 * @returns {boolean} true если все обязательные переменные присутствуют
 */
function validateEnv() {
  let isValid = true;
  const missing = [];
  const warnings = [];

  // Проверяем обязательные переменные
  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
      isValid = false;
    }
  }

  // Устанавливаем значения по умолчанию для опциональных
  for (const [varName, defaultValue] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!process.env[varName]) {
      process.env[varName] = defaultValue;
      logger.info(`ℹ️  Using default value for ${varName}: ${defaultValue}`);
    }
  }

  // Проверяем рекомендуемые переменные
  for (const varName of RECOMMENDED_ENV_VARS) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  // Выводим результаты
  if (!isValid) {
    logger.error('❌ Missing required environment variables:');
    missing.forEach(varName => logger.error(`   - ${varName}`));
    logger.error('\n💡 Please check your .env file');
    return false;
  }

  if (warnings.length > 0) {
    logger.warn('⚠️  Missing recommended environment variables:');
    warnings.forEach(varName => logger.warn(`   - ${varName}`));
    logger.warn('   Some features may not work properly\n');
  }

  logger.info('✅ Environment variables validated successfully\n');
  return true;
}

/**
 * Получить переменную окружения с проверкой типа
 * @param {string} varName - Имя переменной
 * @param {*} defaultValue - Значение по умолчанию
 * @returns {*} Значение переменной
 */
function getEnv(varName, defaultValue = undefined) {
  return process.env[varName] || defaultValue;
}

/**
 * Получить boolean переменную окружения
 * @param {string} varName - Имя переменной
 * @param {boolean} defaultValue - Значение по умолчанию
 * @returns {boolean} Значение переменной
 */
function getEnvBoolean(varName, defaultValue = false) {
  const value = process.env[varName];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1';
}

/**
 * Получить number переменную окружения
 * @param {string} varName - Имя переменной
 * @param {number} defaultValue - Значение по умолчанию
 * @returns {number} Значение переменной
 */
function getEnvNumber(varName, defaultValue = 0) {
  const value = process.env[varName];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Получить массив из переменной окружения (через запятую)
 * @param {string} varName - Имя переменной
 * @param {Array} defaultValue - Значение по умолчанию
 * @returns {Array} Массив значений
 */
function getEnvArray(varName, defaultValue = []) {
  const value = process.env[varName];
  if (!value) return defaultValue;
  return value.split(',').map(v => v.trim()).filter(v => v);
}

module.exports = {
  validateEnv,
  getEnv,
  getEnvBoolean,
  getEnvNumber,
  getEnvArray,
};
