#!/usr/bin/env node

/**
 * Анализатор изменений перед деплоем
 *
 * Проверяет git diff и находит потенциальные проблемы:
 * - Новые зависимости без передачи в конструктор
 * - Async функции без await
 * - Новые process.env без добавления в .env
 * - Изменения в логике cron/времени
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Цвета для вывода
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '='.repeat(60));
  log('cyan', `  ${title}`);
  console.log('='.repeat(60));
}

// Получить git diff
function getGitDiff() {
  try {
    return execSync('git diff HEAD', { encoding: 'utf-8' });
  } catch (error) {
    log('red', '❌ Ошибка получения git diff');
    return '';
  }
}

// Получить список изменённых файлов
function getChangedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(f => f);
  } catch (error) {
    return [];
  }
}

// Проверка 1: Новые импорты
function checkNewImports(diff) {
  section('🔍 Проверка новых импортов');

  const requirePattern = /^\+.*require\(['"](.+)['"]\)/gm;
  const newImports = [];
  let match;

  while ((match = requirePattern.exec(diff)) !== null) {
    newImports.push(match[1]);
  }

  if (newImports.length === 0) {
    log('green', '✅ Новых импортов не найдено');
    return true;
  }

  log('yellow', `⚠️  Найдено новых импортов: ${newImports.length}`);
  newImports.forEach(imp => {
    console.log(`   - require('${imp}')`);
  });

  log('blue', '\n💡 Проверьте:');
  console.log('   - Все ли зависимости переданы в конструктор?');
  console.log('   - Обновлён ли bot/index.js для создания экземпляров?');

  return false;
}

// Проверка 2: Новые process.env
function checkNewEnvVars(diff) {
  section('🔍 Проверка переменных окружения');

  const envPattern = /^\+.*process\.env\.(\w+)/gm;
  const newEnvVars = new Set();
  let match;

  while ((match = envPattern.exec(diff)) !== null) {
    newEnvVars.add(match[1]);
  }

  if (newEnvVars.size === 0) {
    log('green', '✅ Новых переменных окружения не найдено');
    return true;
  }

  // Читаем .env файл
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';
  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch (error) {
    log('red', '❌ Не удалось прочитать .env файл');
    return false;
  }

  const missingVars = [];
  newEnvVars.forEach(varName => {
    if (!envContent.includes(`${varName}=`)) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    log('red', `❌ Переменные отсутствуют в .env:`);
    missingVars.forEach(v => console.log(`   - ${v}`));
    return false;
  }

  log('yellow', `⚠️  Новые переменные окружения (уже в .env):`);
  newEnvVars.forEach(v => console.log(`   - ${v}`));

  log('blue', '\n💡 Не забудьте:');
  console.log('   - Передать эти переменные в Timeweb через envs объект!');

  return false;
}

// Проверка 3: Async/await
function checkAsyncAwait(diff) {
  section('🔍 Проверка async/await');

  // Ищем async функции
  const asyncPattern = /^\+.*async\s+(\w+)\s*\(/gm;
  const asyncFunctions = [];
  let match;

  while ((match = asyncPattern.exec(diff)) !== null) {
    asyncFunctions.push(match[1]);
  }

  if (asyncFunctions.length === 0) {
    log('green', '✅ Новых async функций не найдено');
    return true;
  }

  log('yellow', `⚠️  Найдено новых async функций: ${asyncFunctions.length}`);
  asyncFunctions.forEach(fn => {
    console.log(`   - async ${fn}()`);
  });

  log('blue', '\n💡 Проверьте:');
  console.log('   - Все ли вызовы этих функций используют await?');
  console.log('   - Есть ли обработка ошибок (try/catch или .catch())?');

  return false;
}

// Проверка 4: Изменения в конструкторах
function checkConstructors(diff) {
  section('🔍 Проверка конструкторов');

  const constructorPattern = /^\+\s*constructor\s*\(([^)]*)\)/gm;
  const constructors = [];
  let match;

  while ((match = constructorPattern.exec(diff)) !== null) {
    const params = match[1].split(',').map(p => p.trim()).filter(p => p);
    constructors.push(params);
  }

  if (constructors.length === 0) {
    log('green', '✅ Изменений в конструкторах не найдено');
    return true;
  }

  log('yellow', `⚠️  Найдено изменений в конструкторах: ${constructors.length}`);
  constructors.forEach((params, i) => {
    console.log(`   ${i + 1}. constructor(${params.join(', ')})`);
  });

  log('blue', '\n💡 Проверьте:');
  console.log('   - Все ли параметры передаются при создании экземпляра?');
  console.log('   - Обновлён ли bot/index.js?');

  return false;
}

// Проверка 5: Изменения связанные со временем
function checkTimeRelatedChanges(diff) {
  section('🔍 Проверка изменений связанных со временем');

  const timeKeywords = [
    'cron',
    'schedule',
    'moment',
    'Date',
    'timezone',
    'morning',
    'evening',
    'level',
  ];

  const foundKeywords = [];
  timeKeywords.forEach(keyword => {
    const pattern = new RegExp(`^\\+.*${keyword}`, 'gmi');
    if (pattern.test(diff)) {
      foundKeywords.push(keyword);
    }
  });

  if (foundKeywords.length === 0) {
    log('green', '✅ Изменений связанных со временем не найдено');
    return true;
  }

  log('yellow', `⚠️  Найдены изменения связанные со временем:`);
  foundKeywords.forEach(kw => console.log(`   - ${kw}`));

  log('blue', '\n💡 КРИТИЧНО - проверьте:');
  console.log('   - Полный цикл: утро → день → вечер → утро');
  console.log('   - Увеличивается ли level в правильный момент?');
  console.log('   - Не дублируется ли логика?');

  return false;
}

// Основная функция
function main() {
  log('magenta', '\n🔍 Анализ изменений перед деплоем на Timeweb\n');

  const diff = getGitDiff();
  const changedFiles = getChangedFiles();

  if (!diff || changedFiles.length === 0) {
    log('green', '✅ Нет изменений для анализа');
    log('blue', '\n💡 Убедитесь что все изменения закоммичены!');
    return;
  }

  log('blue', `📝 Изменённых файлов: ${changedFiles.length}`);
  changedFiles.forEach(f => console.log(`   - ${f}`));

  // Запускаем все проверки
  const checks = [
    checkNewImports(diff),
    checkNewEnvVars(diff),
    checkAsyncAwait(diff),
    checkConstructors(diff),
    checkTimeRelatedChanges(diff),
  ];

  // Итоги
  section('📊 Итоги');

  const warnings = checks.filter(c => !c).length;

  if (warnings === 0) {
    log('green', '✅ Все проверки пройдены!');
    log('green', '✅ Код готов к деплою');
  } else {
    log('yellow', `⚠️  Найдено предупреждений: ${warnings}`);
    log('blue', '\n💡 Рекомендации:');
    console.log('   1. Проверьте все предупреждения выше');
    console.log('   2. Протестируйте изменения локально');
    console.log('   3. Прочитайте .claude/pre-deploy-checklist.md');
    console.log('   4. Обновите переменные окружения в Timeweb');
  }

  console.log('\n' + '='.repeat(60));
  log('cyan', '  📚 Полный чеклист: .claude/pre-deploy-checklist.md');
  log('cyan', '  📖 Инструкция деплоя: TIMEWEB_DEPLOY.md');
  console.log('='.repeat(60) + '\n');
}

// Запуск
main();
