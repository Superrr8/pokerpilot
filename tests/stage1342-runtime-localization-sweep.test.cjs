'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const I18n = require('../src/ui/translations.js');
const Catalog = require('../src/daily/daily-challenge-catalog.js');
const CYRILLIC = /[А-Яа-яЁё]/;

function memoryStorage(locale) {
  const values = new Map([[I18n.LOCALE_STORAGE_KEY, locale]]);
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function activateLocale(locale) {
  const manager = I18n.createLocalization({
    storage: memoryStorage(locale),
    navigatorRef: {},
    documentRef: null
  });
  global.PokerElevateI18n = manager;
  global.PokerPilotI18n = manager;
  return manager;
}

function reload(relative) {
  const filename = path.join(root, relative);
  delete require.cache[require.resolve(filename)];
  return require(filename);
}

function completedDailyStatus() {
  const challenge = Catalog.list()[0];
  return {
    status: 'completed',
    challenge,
    review: {
      isCorrect: true,
      selectedAction: challenge.correctAction,
      correctAction: challenge.correctAction,
      explanation: challenge.explanation,
      xpAwarded: 25
    }
  };
}

test('Daily Hand completion generators render English result, saved-answer, and explanation copy', () => {
  activateLocale('en');
  const DailyUI = reload('src/ui/daily-challenge.js');
  const status = completedDailyStatus();
  const result = DailyUI.resultPresentation(status);

  assert.equal(DailyUI.selectionStatusLabel({ actionClass: 'RAISE', amount: 210 }, true), 'Answer saved: Raise to $210');
  assert.equal(DailyUI.dashboardResultLabel(status.review), 'Correct decision · +25 XP');
  assert.equal(DailyUI.dailyStreakLabel(1), 'Daily Hand streak: 1 day');
  assert.equal(result.title, 'Correct');
  assert.doesNotMatch(result.explanation, CYRILLIC);
});

test('Russian Daily Hand completion presentation remains unchanged', () => {
  activateLocale('ru');
  const DailyUI = reload('src/ui/daily-challenge.js');
  const status = completedDailyStatus();
  const result = DailyUI.resultPresentation(status);

  assert.equal(DailyUI.selectionStatusLabel({ actionClass: 'RAISE', amount: 210 }, true), 'Ответ сохранён: Raise to $210');
  assert.equal(DailyUI.dashboardResultLabel(status.review), 'Правильное решение · +25 XP');
  assert.equal(DailyUI.dailyStreakLabel(1), 'Серия раздачи дня: 1 день');
  assert.equal(result.title, 'Правильно');
  assert.match(result.explanation, CYRILLIC);
});

test('Trainer summary and preflop Hand Review generators use locale-aware templates', () => {
  const summarySource = html.slice(html.indexOf('function showLiveResultSummary'), html.indexOf('function showLiveMath'));
  const preflopStart = html.indexOf('function liveMathHTML');
  const preflopSource = html.slice(preflopStart, html.indexOf('function renderLive', preflopStart));
  const evaluationSource = html.slice(html.indexOf('function evaluateLiveAction'), html.indexOf('function createLiveSeatElement'));

  assert.match(summarySource, /i18nText\('live\.modelPrefersSummary'/);
  assert.doesNotMatch(summarySource, /Модель предпочитает/);
  assert.match(preflopSource, /i18nText\('handReview\.handStrength'/);
  assert.match(preflopSource, /i18nText\('handReview\.preflopRecommendation'/);
  assert.match(evaluationSource, /i18nText\('live\.reason\.outsideContinue'/);
  assert.doesNotMatch(evaluationSource, /Рука не входит|Готовая комбинация|минимально нужно/);

  const english = activateLocale('en');
  assert.equal(english.t('live.modelPrefersSummary', { action: 'Fold', confidence: 'medium' }), 'Model prefers Fold · medium confidence.');
  assert.equal(english.t('handReview.handStrength'), 'Hand strength');
  assert.doesNotMatch(english.t('handReview.preflopRecommendation'), CYRILLIC);
  assert.equal(english.t('live.reason.outsideContinue'), 'The hand is not in the baseline continuing range.');

  const russian = activateLocale('ru');
  assert.equal(russian.t('live.modelPrefersSummary', { action: 'Fold', confidence: 'средняя' }), 'Модель предпочитает Fold · уверенность средняя.');
  assert.equal(russian.t('handReview.handStrength'), 'Сила руки');
});

test('Live uncontested-pot completion localizes generated and legacy Hand Flow text', () => {
  const awardSource = html.slice(html.indexOf('function awardPot'), html.indexOf('function showdown'));
  assert.match(awardSource, /i18nText\('live\.potAwardSummary'/);
  assert.doesNotMatch(awardSource, /Остальные соперники выбросили|Банк забирает|Ты выигрываешь/);

  activateLocale('en');
  let SavedHands = reload('src/live/saved-hands.js');
  const legacy = { type: 'RESULT', text: 'Остальные соперники выбросили карты. Банк забирает CALL: $11.' };
  assert.equal(SavedHands.formatAction(legacy), 'The remaining opponents folded. CALL takes the pot: $11.');
  assert.doesNotMatch(SavedHands.formatAction(legacy), CYRILLIC);

  activateLocale('ru');
  SavedHands = reload('src/live/saved-hands.js');
  assert.equal(SavedHands.formatAction(legacy), legacy.text);
});
