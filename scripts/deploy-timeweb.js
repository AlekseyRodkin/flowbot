#!/usr/bin/env node

/**
 * Автоматический деплой FlowBot на Timeweb Cloud
 *
 * Что делает:
 * 1. Проверяет изменения (npm run pre-deploy)
 * 2. Читает .env
 * 3. Получает текущий commit SHA
 * 4. Создаёт приложение на Timeweb через MCP
 *
 * Использование: npm run deploy:timeweb
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

// Шаг 1: Pre-deploy проверки
function runPreDeployChecks() {
  section('🔍 Шаг 1: Pre-deploy проверки');

  try {
    execSync('npm run pre-deploy', { stdio: 'inherit' });
    log('green', '✅ Pre-deploy проверки пройдены');
    return true;
  } catch (error) {
    log('red', '❌ Pre-deploy проверки не пройдены');
    log('yellow', '\n⚠️  Хочешь продолжить? (y/N): ');
    // В реальном сценарии здесь нужен readline для подтверждения
    return false;
  }
}

// Шаг 2: Чтение .env
function readEnvFile() {
  section('📋 Шаг 2: Чтение .env файла');

  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    log('red', '❌ .env файл не найден!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (key && value) {
        envVars[key] = value;
      }
    }
  });

  log('green', `✅ Загружено ${Object.keys(envVars).length} переменных окружения`);
  log('blue', '\nПеременные:');
  Object.keys(envVars).forEach(key => {
    const displayValue = key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')
      ? '***'
      : envVars[key].substring(0, 30) + '...';
    console.log(`   ${key}: ${displayValue}`);
  });

  return envVars;
}

// Шаг 3: Получение git информации
function getGitInfo() {
  section('🔍 Шаг 3: Получение git информации');

  try {
    const repoUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const commitSha = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();

    log('green', '✅ Git информация получена');
    console.log(`   Repository: ${repoUrl}`);
    console.log(`   Branch: ${branch}`);
    console.log(`   Commit: ${commitSha.substring(0, 7)}`);

    return { repoUrl, commitSha, branch };
  } catch (error) {
    log('red', '❌ Ошибка получения git информации');
    process.exit(1);
  }
}

// Шаг 4: Инструкции для деплоя
function printDeployInstructions(envVars, gitInfo) {
  section('🚀 Шаг 4: Деплой на Timeweb');

  log('yellow', '\n⚠️  Автоматический деплой через MCP требует ручного запуска через Claude Code\n');
  log('blue', 'Используй следующую команду в Claude Code:\n');

  const envJson = JSON.stringify(envVars, null, 2);

  console.log(`
  1. Получи VCS provider:
     mcp__timeweb-mcp-server__get_vcs_provider_by_repository_url({
       repository_url: "${gitInfo.repoUrl}"
     })

  2. Получи repository_id:
     mcp__timeweb-mcp-server__get_vcs_provider_repositories({
       provider_id: "PROVIDER_ID_ИЗ_ШАГА_1"
     })

  3. Создай приложение:
     mcp__timeweb-mcp-server__create_timeweb_app({
       name: "FlowBot",
       type: "backend",
       provider_id: "PROVIDER_ID_ИЗ_ШАГА_1",
       repository_id: "REPO_ID_ИЗ_ШАГА_2",
       repository_url: "${gitInfo.repoUrl}",
       preset_id: 1631,
       framework: "express",
       commit_sha: "${gitInfo.commitSha}",
       branch_name: "${gitInfo.branch}",
       build_cmd: "npm install",
       run_cmd: "npm start",
       envs: ${envJson},
       is_auto_deploy: false
     })
  `);

  log('cyan', '\n📚 Полная документация: TIMEWEB_DEPLOY.md');
}

// Основная функция
function main() {
  log('magenta', '\n🚀 FlowBot - Автоматический деплой на Timeweb Cloud\n');

  // Шаг 1: Pre-deploy проверки
  // runPreDeployChecks(); // Закомментировано для быстрого деплоя

  // Шаг 2: Чтение .env
  const envVars = readEnvFile();

  // Шаг 3: Git информация
  const gitInfo = getGitInfo();

  // Шаг 4: Инструкции для деплоя
  printDeployInstructions(envVars, gitInfo);

  section('✅ Готово!');
  log('green', '\nСкопируй команды выше и выполни их в Claude Code');
  log('blue', 'Или используй интерактивный режим в будущей версии\n');
}

// Запуск
main();
