'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'src', 'profile', 'profile-statistics.js');

function loadApi() {
  if (!fs.existsSync(modulePath)) return {};
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('адаптер отображает только реальные существующие statistics/progress данные', () => {
  const api = loadApi();
  assert.equal(typeof api.fromProgress, 'function', 'fromProgress отсутствует');
  const model = api.fromProgress({
    decisions: 12,
    scorePoints: 25,
    maxPoints: 36,
    sessions: 3,
    streak: 2,
    bestStreak: 7,
    savedHands: [{ id: 'one' }, { id: 'two' }],
    history: [
      { mode: 'session', title: 'Live Cash $1/$3 • 18 рук', grade: 'good' },
      { mode: 'study', grade: 'best' },
      { mode: 'study', grade: 'mistake' }
    ],
    learning: {
      modules: {
        basics: { examAttempts: [{ score: 70 }, { score: 90 }] }
      }
    }
  });
  assert.equal(model.sessionsPlayed, 3);
  assert.equal(model.handsPlayed, 18);
  assert.equal(model.savedHands, 2);
  assert.equal(model.decisionsMade, 12);
  assert.equal(model.correctDecisions, 1);
  assert.equal(model.decisionAccuracy, 69);
  assert.equal(model.bestResult, 90);
  assert.equal(model.currentDecisionStreak, 2);
  assert.equal(model.bestDecisionStreak, 7);
  assert.equal(model.currentStreakDays, null);
});

test('при отсутствии статистики адаптер возвращает честное пустое состояние', () => {
  const api = loadApi();
  const model = api.fromProgress(null);
  assert.equal(model.isEmpty, true);
  assert.equal(model.sessionsPlayed, 0);
  assert.equal(model.handsPlayed, 0);
  assert.equal(model.decisionsMade, 0);
  assert.equal(model.correctDecisions, 0);
  assert.equal(model.decisionAccuracy, null);
  assert.equal(model.bestResult, null);
  assert.equal(model.currentStreakDays, null);
});

test('адаптер не мутирует существующий progress storage', () => {
  const api = loadApi();
  const progress = {
    decisions: 2,
    history: [{ mode: 'session', title: 'Live Cash $1/$3 • 4 рук' }],
    savedHands: []
  };
  const before = JSON.stringify(progress);
  api.fromProgress(progress);
  assert.equal(JSON.stringify(progress), before);
});
