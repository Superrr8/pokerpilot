'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let Config = null;
let Center = null;
let loadError = null;
try {
  Config = require('../src/progress/achievement-config.js');
  Center = require('../src/ui/achievement-center.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(Config);
  assert.ok(Center);
  return Center;
}

function snapshot(overrides = {}) {
  return {
    lifetimeXp: 75,
    counters: { trainingScenarios: 6, trainerDecisions: 17, exams: 0 },
    pokerIq: { score: 48, isRated: true },
    level: { level: 3 },
    streak: { current: 2 },
    rank: { id: 'INTERMEDIATE', label: 'Средний уровень' },
    achievements: { items: [], history: [] },
    ...overrides
  };
}

function progress(id, currentSnapshot = snapshot(), overrides = {}) {
  const definition = { ...Config.BY_ID[id], ...overrides };
  return api().getAchievementPresentationProgress(definition, currentSnapshot);
}

test('presentation progress покрывает training scenario и trainer decisions', () => {
  assert.deepEqual(progress('QUICK_LEARNER'), {
    available: true, current: 6, target: 10, percent: 60, label: '6 / 10 сценариев'
  });
  assert.deepEqual(progress('DECISION_MAKER'), {
    available: true, current: 17, target: 25, percent: 68, label: '17 / 25 решений Trainer'
  });
});

test('presentation progress покрывает Poker IQ, Level, streak, exam и lifetime XP', () => {
  assert.equal(progress('SHARP_MIND').label, 'Poker IQ 48 / 60');
  assert.equal(progress('POKER_STUDENT').label, 'Level 3 / 5');
  assert.equal(progress('ON_A_ROLL').label, '2 / 3 дня');
  assert.equal(progress('EXAM_READY').label, '0 / 1 экзамен');
  assert.equal(progress('CENTURY_CLUB').label, '75 / 100 XP');
});

test('rank progress показывает текущий и необходимый rank для открытого condition metadata', () => {
  const result = progress('HIGH_ACHIEVER', snapshot(), { hidden: false });
  assert.equal(result.available, true);
  assert.equal(result.label, 'Средний уровень → Продвинутый');
  assert.equal(result.target, 4);
  assert.equal(result.current, 3);
});

test('числовой progress clamp-ится и не показывает отрицательные, NaN или Infinity', () => {
  assert.deepEqual(progress('QUICK_LEARNER', snapshot({
    counters: { trainingScenarios: 999, trainerDecisions: NaN, exams: Infinity }
  })), {
    available: true, current: 10, target: 10, percent: 100, label: '10 / 10 сценариев'
  });
  assert.equal(progress('DECISION_MAKER', snapshot({
    counters: { trainingScenarios: 0, trainerDecisions: -5, exams: 0 }
  })).current, 0);
  assert.equal(progress('EXAM_READY', snapshot({
    counters: { trainingScenarios: 0, trainerDecisions: 0, exams: Infinity }
  })).current, 0);
});

test('unknown condition и hidden locked achievement получают безопасный fallback', () => {
  assert.deepEqual(api().getAchievementPresentationProgress({
    id: 'UNKNOWN', condition: { metric: 'wat', comparator: 'unknown', target: 4 }
  }, snapshot()), { available: false, current: 0, target: 0, percent: 0, label: null });
  assert.equal(progress('HIGH_ACHIEVER').available, false);
});

test('presentation helper и catalog не мутируют snapshot или authoritative config', () => {
  const current = snapshot();
  const before = JSON.stringify(current);
  const catalog = Config.getAchievementCatalog();
  const model = api().createViewModel({ catalog, snapshot: current, filter: 'all' });
  model.items[0].title = 'Внешняя мутация';
  assert.equal(JSON.stringify(current), before);
  assert.equal(Config.BY_ID.FIRST_STEP.title, 'Первый шаг');
});
