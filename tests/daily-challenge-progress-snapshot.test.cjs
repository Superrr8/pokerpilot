'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Storage = require('../src/daily/daily-challenge-storage.js');
const History = require('../src/daily/daily-challenge-history.js');
const Catalog = require('../src/daily/daily-challenge-catalog.js');

function memoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(Storage.STORAGE_KEY, JSON.stringify(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    snapshot() { return values.get(Storage.STORAGE_KEY) || null; }
  };
}

function completion(dateKey, correct = true) {
  return {
    challengeId: 'daily-river-aj-bluffcatch',
    scheduleVersion: 1,
    selectedAction: correct ? 'CALL' : 'FOLD',
    correctAction: 'CALL',
    isCorrect: correct,
    completedAt: `${dateKey}T18:30:00.000Z`,
    progress: {
      status: 'recorded',
      eventId: `daily_challenge:v1:${dateKey}:daily-river-aj-bluffcatch`,
      rewardVersion: 1,
      xpAwarded: correct ? 25 : 10,
      recordedAt: `${dateKey}T18:30:01.000Z`
    }
  };
}

function createFixture(entries = [], options = {}) {
  const completions = Object.fromEntries(entries.map(([dateKey, correct = true]) => [
    dateKey,
    completion(dateKey, correct)
  ]));
  const localStorage = options.localStorage || memoryStorage({ schemaVersion: 2, completions });
  const store = Storage.create({ storage: localStorage });
  const clock = options.clock || { value: new Date(2026, 7, 8, 12, 0, 0) };
  const history = History.create({ storage: store, catalog: Catalog, now: () => clock.value });
  return { history, store, localStorage, clock };
}

test('empty progress snapshot is truthful and finite', () => {
  const snapshot = createFixture().history.getProgressSnapshot();
  assert.deepEqual({
    currentStreak: snapshot.currentStreak,
    bestStreak: snapshot.bestStreak,
    completedCount: snapshot.completedCount,
    correctCount: snapshot.correctCount,
    accuracy: snapshot.accuracy,
    completedToday: snapshot.completedToday
  }, {
    currentStreak: 0,
    bestStreak: 0,
    completedCount: 0,
    correctCount: 0,
    accuracy: 0,
    completedToday: false
  });
  assert.equal(snapshot.recentDays.length, 7);
});
test('single completed day creates a one-day current and best streak', () => {
  const snapshot = createFixture([['2026-08-08', true]]).history.getProgressSnapshot();
  assert.equal(snapshot.currentStreak, 1);
  assert.equal(snapshot.bestStreak, 1);
  assert.equal(snapshot.completedCount, 1);
  assert.equal(snapshot.correctCount, 1);
  assert.equal(snapshot.accuracy, 100);
  assert.equal(snapshot.completedToday, true);
});

test('consecutive completions ending today form the current streak', () => {
  const snapshot = createFixture([
    ['2026-08-06', true], ['2026-08-07', false], ['2026-08-08', true]
  ]).history.getProgressSnapshot();
  assert.equal(snapshot.currentStreak, 3);
  assert.equal(snapshot.bestStreak, 3);
});

test('current streak remains active when it ends yesterday and today is incomplete', () => {
  const snapshot = createFixture([
    ['2026-08-05', true], ['2026-08-06', true], ['2026-08-07', false]
  ]).history.getProgressSnapshot();
  assert.equal(snapshot.completedToday, false);
  assert.equal(snapshot.currentStreak, 3);
});

test('missing a calendar day breaks the current streak', () => {
  const snapshot = createFixture([
    ['2026-08-04', true], ['2026-08-05', true], ['2026-08-08', true]
  ]).history.getProgressSnapshot();
  assert.equal(snapshot.currentStreak, 1);
  assert.equal(snapshot.bestStreak, 2);
});

test('best streak remains greater than a shorter current streak', () => {
  const snapshot = createFixture([
    ['2026-08-01', true], ['2026-08-02', true], ['2026-08-03', false], ['2026-08-04', true],
    ['2026-08-07', false], ['2026-08-08', true]
  ]).history.getProgressSnapshot();
  assert.equal(snapshot.currentStreak, 2);
  assert.equal(snapshot.bestStreak, 4);
});

test('accuracy is derived from unique correct and incorrect calendar dates', () => {
  const snapshot = createFixture([
    ['2026-08-06', true], ['2026-08-07', false], ['2026-08-08', true]
  ]).history.getProgressSnapshot();
  assert.equal(snapshot.completedCount, 3);
  assert.equal(snapshot.correctCount, 2);
  assert.equal(snapshot.accuracy, 67);
});

test('reprocessing the same accepted date does not double-count it', () => {
  const fixture = createFixture([['2026-08-08', true]]);
  const duplicate = fixture.store.saveCompletion('2026-08-08', completion('2026-08-08', false));
  assert.equal(duplicate.duplicate, true);
  assert.equal(fixture.history.getProgressSnapshot().completedCount, 1);
});

test('recentDays is chronological, fixed to seven days and exposes explicit flags', () => {
  const snapshot = createFixture([
    ['2026-08-03', true], ['2026-08-07', false], ['2026-08-08', true]
  ]).history.getProgressSnapshot();
  assert.deepEqual(snapshot.recentDays.map(day => day.date), [
    '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05',
    '2026-08-06', '2026-08-07', '2026-08-08'
  ]);
  assert.deepEqual(snapshot.recentDays.map(day => day.completed), [false, true, false, false, false, true, true]);
  assert.equal(snapshot.recentDays[5].correct, false);
  assert.equal(snapshot.recentDays[0].correct, null);
  assert.equal(snapshot.recentDays.at(-1).isToday, true);
});

test('local midnight rollover changes completedToday without invalidating yesterday streak', () => {
  const fixture = createFixture([['2026-08-08', true]]);
  assert.equal(fixture.history.getProgressSnapshot().completedToday, true);
  fixture.clock.value = new Date(2026, 7, 9, 0, 1, 0);
  const afterMidnight = fixture.history.getProgressSnapshot();
  assert.equal(afterMidnight.completedToday, false);
  assert.equal(afterMidnight.currentStreak, 1);
  assert.equal(afterMidnight.recentDays.at(-1).date, '2026-08-09');
});

test('snapshot is reload-idempotent and never persists derived analytics', () => {
  const localStorage = memoryStorage({
    schemaVersion: 2,
    completions: { '2026-08-08': completion('2026-08-08', true) }
  });
  const first = createFixture([], { localStorage }).history;
  const before = localStorage.snapshot();
  const firstSnapshot = first.getProgressSnapshot();
  const secondSnapshot = createFixture([], { localStorage }).history.getProgressSnapshot();
  assert.deepEqual(secondSnapshot, firstSnapshot);
  assert.equal(localStorage.snapshot(), before);
});
