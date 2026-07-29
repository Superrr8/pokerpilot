'use strict';

(function attachTranslations(root) {
  const strings = Object.freeze({
    'nav.home': 'Главная',
    'nav.learning': 'Обучение',
    'nav.training': 'Тренировка',
    'nav.analysis': 'Разбор',
    'nav.profile': 'Профиль',
    'action.continue': 'Продолжить',
    'action.startLearning': 'Начать обучение',
    'action.startTraining': 'Начать тренировку',
    'action.analyzeHand': 'Разобрать раздачу',
    'live.saveHand': '💾 Save Hand',
    'live.savedSuccess': 'Hand saved successfully',
    'analysis.savedHands': 'Сохранённые раздачи',
    'profile.insufficientData': 'Недостаточно решений для оценки',
    'profile.notCalculated': 'Не рассчитан',
    'profile.notCalculatedFeminine': 'Не рассчитана',
    'profile.unrated': 'Без рейтинга',
    'profile.unranked': 'Без ранга',
    'profile.saved': 'Профиль сохранён',
    'profile.saveError': 'Не удалось сохранить профиль на устройстве'
  });

  function t(key, fallback = key) {
    return Object.prototype.hasOwnProperty.call(strings, key) ? strings[key] : fallback;
  }

  const api = Object.freeze({ strings, t });
  root.PokerPilotI18n = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
