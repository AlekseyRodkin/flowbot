// src/utils/genderUtils.js
// Утилита для гендерных обращений к пользователю

/**
 * Возвращает правильную форму слова в зависимости от пола пользователя
 * @param {Object} user - объект пользователя с полем gender
 * @param {string} maleForm - форма для мужского рода (выполнил, готов, молодец)
 * @param {string} femaleForm - форма для женского рода (выполнила, готова, молодец)
 * @returns {string} - правильная форма слова
 */
const g = (user, maleForm, femaleForm) => {
  // Если пол не указан, используем мужской род по умолчанию
  if (!user || !user.gender) {
    return maleForm;
  }

  return user.gender === 'female' ? femaleForm : maleForm;
};

/**
 * Возвращает правильное местоимение в зависимости от пола
 * @param {Object} user - объект пользователя с полем gender
 * @param {string} form - какая форма нужна ('subject' - он/она, 'possessive' - его/её)
 * @returns {string} - правильное местоимение
 */
const getPronoun = (user, form = 'subject') => {
  const isFemale = user && user.gender === 'female';

  switch (form) {
    case 'subject': // он/она
      return isFemale ? 'она' : 'он';
    case 'possessive': // его/её
      return isFemale ? 'её' : 'его';
    case 'dative': // ему/ей
      return isFemale ? 'ей' : 'ему';
    case 'instrumental': // им/ею
      return isFemale ? 'ею' : 'им';
    default:
      return isFemale ? 'она' : 'он';
  }
};

/**
 * Возвращает правильное обращение
 * @param {Object} user - объект пользователя с полем gender
 * @returns {string} - обращение (парень/девушка)
 */
const getAddressing = (user) => {
  const isFemale = user && user.gender === 'female';
  return isFemale ? 'девушка' : 'парень';
};

/**
 * Набор часто используемых слов с правильными склонениями
 */
const GENDERED_WORDS = {
  // Глаголы прошедшего времени
  'выполнил': { male: 'выполнил', female: 'выполнила' },
  'справился': { male: 'справился', female: 'справилась' },
  'начал': { male: 'начал', female: 'начала' },
  'сделал': { male: 'сделал', female: 'сделала' },
  'прошел': { male: 'прошел', female: 'прошла' },
  'достиг': { male: 'достиг', female: 'достигла' },
  'стал': { male: 'стал', female: 'стала' },
  'получил': { male: 'получил', female: 'получила' },
  'решил': { male: 'решил', female: 'решила' },
  'завершил': { male: 'завершил', female: 'завершила' },

  // Прилагательные
  'готов': { male: 'готов', female: 'готова' },
  'рад': { male: 'рад', female: 'рада' },
  'уверен': { male: 'уверен', female: 'уверена' },
  'должен': { male: 'должен', female: 'должна' },
  'способен': { male: 'способен', female: 'способна' },
  'достоин': { male: 'достоин', female: 'достойна' },
  'доволен': { male: 'доволен', female: 'довольна' },

  // Существительные
  'молодец': { male: 'молодец', female: 'молодец' }, // одинаково
  'герой': { male: 'герой', female: 'героиня' },
  'победитель': { male: 'победитель', female: 'победительница' },
  'чемпион': { male: 'чемпион', female: 'чемпионка' },
  'легенда': { male: 'легенда', female: 'легенда' }, // одинаково
  'мастер': { male: 'мастер', female: 'мастер' }, // одинаково
};

/**
 * Получить слово по ключу из набора часто используемых
 * @param {Object} user - объект пользователя
 * @param {string} key - ключ слова из GENDERED_WORDS
 * @returns {string} - правильная форма слова
 */
const getWord = (user, key) => {
  const word = GENDERED_WORDS[key];
  if (!word) {
    console.warn(`Gender word not found: ${key}`);
    return key;
  }

  const isFemale = user && user.gender === 'female';
  return isFemale ? word.female : word.male;
};

module.exports = {
  g,
  getPronoun,
  getAddressing,
  getWord,
  GENDERED_WORDS
};
