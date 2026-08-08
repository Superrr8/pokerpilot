'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(ROOT, 'src/daily/daily-challenge-history.js');
const Storage = require('../src/daily/daily-challenge-storage.js');
const DateUtils = require('../src/daily/daily-date.js');
const Catalog = require('../src/daily/daily-challenge-catalog.js');
const History = fs.existsSync(HISTORY_PATH) ? require(HISTORY_PATH) : {};

function memoryStorage(initial = null) {
  const values = new Map();
  if (initial !== null) values.set(Storage.STORAGE_KEY, JSON.stringify(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return values.get(Storage.STORAGE_KEY) || null; }
  };
}

function completion(overrides = {}) {
  return {
    challengeId: 'daily-river-aj-bluffcatch',
    scheduleVersion: 1,
    selectedAction: 'CALL',
    correctAction: 'CALL',
    isCorrect: true,
    completedAt: '2026-08-04T18:30:00.000Z',
    progress: {
      status: 'recorded',
      eventId: 'daily_challenge:v1:2026-08-04:daily-river-aj-bluffcatch',
      rewardVersion: 1,
      xpAwarded: 25,
      recordedAt: '2026-08-04T18:30:01.000Z'
    },
    ...overrides
  };
}

function createService(completions = {}, options = {}) {
  assert.equal(typeof History.create, 'function', 'Daily Challenge History API is missing');
  const raw = { schemaVersion: 2, completions };
  const localStorage = options.localStorage || memoryStorage(raw);
  const store = Storage.create({ storage: localStorage });
  return {
    api: History.create({
      storage: store,
      catalog: options.catalog || Catalog,
      now: options.now || (() => new Date(2026, 7, 10, 12, 0, 0))
    }),
    localStorage
  };
}

test('History module exposes a small read-only public API', () => {
  assert.equal(typeof History.create, 'function');
});

test('empty storage returns empty history', () => {
  assert.deepEqual(createService().api.getCompletionHistory(), []);
});

test('valid completions are sorted by date descending', () => {
  const { api } = createService({
    '2026-08-04': completion(),
    '2026-08-06': completion({ completedAt: '2026-08-06T18:00:00.000Z' }),
    '2026-08-05': completion({ completedAt: '2026-08-05T18:00:00.000Z' })
  });
  assert.deepEqual(api.getCompletionHistory().map(item => item.dateKey), [
    '2026-08-06', '2026-08-05', '2026-08-04'
  ]);
});

test('storage insertion order does not affect history order', () => {
  const first = createService({
    '2026-08-05': completion(), '2026-08-04': completion()
  }).api.getCompletionHistory();
  const second = createService({
    '2026-08-04': completion(), '2026-08-05': completion()
  }).api.getCompletionHistory();
  assert.deepEqual(first.map(item => item.dateKey), second.map(item => item.dateKey));
});

test('returned history is a safe copy', () => {
  const { api } = createService({ '2026-08-04': completion() });
  const first = api.getCompletionHistory();
  first[0].selectedAction = 'FOLD';
  first[0].challenge.heroCards[0] = '2s';
  const second = api.getCompletionHistory();
  assert.equal(second[0].selectedAction, 'CALL');
  assert.notEqual(second[0].challenge.heroCards[0], '2s');
});

test('reading history does not mutate Daily Challenge storage', () => {
  const { api, localStorage } = createService({ '2026-08-04': completion() });
  const before = localStorage.snapshot();
  api.getCompletionHistory();
  api.getDailyChallengeStats();
  api.getRecentCalendarDays(7);
  assert.equal(localStorage.snapshot(), before);
});

test('reading history does not reference ProgressSystem', () => {
  const source = fs.readFileSync(HISTORY_PATH, 'utf8');
  assert.doesNotMatch(source, /ProgressSystem|recordCompletionProgress|reconcilePendingProgress/);
});

test('invalid completion is skipped safely', () => {
  const { api } = createService({ '2026-08-04': { challengeId: '' } });
  assert.deepEqual(api.getCompletionHistory(), []);
});

test('one invalid completion does not hide valid completions', () => {
  const { api } = createService({
    'bad-date': completion(),
    '2026-08-04': completion()
  });
  assert.equal(api.getCompletionHistory().length, 1);
});

test('unknown challengeId remains readable with safe fallback', () => {
  const unknown = completion({ challengeId: 'retired-challenge' });
  const { api } = createService({ '2026-08-04': unknown });
  const item = api.getCompletionHistory()[0];
  assert.equal(item.challengeAvailable, false);
  assert.equal(item.title, 'Раздача дня');
});

test('schema v1 legacy completion remains readable', () => {
  const legacy = completion({ progress: undefined });
  const { api } = createService({ '2026-08-04': legacy });
  assert.equal(api.getCompletionHistory()[0].creditStatus, 'legacy');
});

test('getCompletionByDate returns only the requested valid day', () => {
  const { api } = createService({ '2026-08-04': completion() });
  assert.equal(api.getCompletionByDate('2026-08-04').dateKey, '2026-08-04');
  assert.equal(api.getCompletionByDate('2026-08-05'), null);
});

test('invalid date lookup returns null', () => {
  assert.equal(createService().api.getCompletionByDate('not-a-date'), null);
});

test('total completed is derived from valid completions', () => {
  const { api } = createService({
    '2026-08-04': completion(),
    '2026-08-05': completion({ selectedAction: 'FOLD', isCorrect: false })
  });
  assert.equal(api.getDailyChallengeStats().total, 2);
});

test('correct count is calculated correctly', () => {
  const { api } = createService({ '2026-08-04': completion() });
  assert.equal(api.getDailyChallengeStats().correct, 1);
});

test('incorrect count is calculated correctly', () => {
  const { api } = createService({
    '2026-08-04': completion({ selectedAction: 'FOLD', isCorrect: false })
  });
  assert.equal(api.getDailyChallengeStats().incorrect, 1);
});

test('accuracy is calculated as correct divided by total', () => {
  const { api } = createService({
    '2026-08-04': completion(),
    '2026-08-05': completion({ selectedAction: 'FOLD', isCorrect: false })
  });
  assert.equal(api.getDailyChallengeStats().accuracy, 50);
});

test('zero total gives safe zero accuracy', () => {
  assert.equal(createService().api.getDailyChallengeStats().accuracy, 0);
});

test('XP sums only recorded receipts', () => {
  const { api } = createService({
    '2026-08-04': completion(),
    '2026-08-05': completion({ progress: { status: 'pending' } }),
    '2026-08-06': completion({ progress: { status: 'legacy_uncredited' } })
  });
  assert.equal(api.getDailyChallengeStats().earnedXp, 25);
});

test('pending XP is not counted as earned', () => {
  const { api } = createService({
    '2026-08-04': completion({ progress: { status: 'pending', rewardVersion: 1 } })
  });
  assert.equal(api.getDailyChallengeStats().earnedXp, 0);
});

test('legacy uncredited XP is not invented', () => {
  const { api } = createService({
    '2026-08-04': completion({ progress: { status: 'legacy_uncredited' } })
  });
  assert.equal(api.getDailyChallengeStats().earnedXp, 0);
});

test('one calendar date cannot be double-counted', () => {
  const duplicateKey = { '2026-08-04': completion(), '2026-08-04': completion() };
  assert.equal(createService(duplicateKey).api.getDailyChallengeStats().total, 1);
});

test('statistics are not persisted', () => {
  const { api, localStorage } = createService({ '2026-08-04': completion() });
  const before = localStorage.snapshot();
  api.getDailyChallengeStats();
  assert.equal(localStorage.snapshot(), before);
});

test('recent result comes from the newest valid completion', () => {
  const { api } = createService({
    '2026-08-04': completion(),
    '2026-08-05': completion({ selectedAction: 'FOLD', isCorrect: false })
  });
  assert.equal(api.getDailyChallengeStats().recent.isCorrect, false);
});

test('seven-day strip returns exactly seven local calendar days', () => {
  assert.equal(createService().api.getRecentCalendarDays(7).length, 7);
});

test('seven-day strip identifies today using local date', () => {
  const days = createService().api.getRecentCalendarDays(7);
  assert.equal(days.at(-1).dateKey, '2026-08-10');
  assert.equal(days.at(-1).isToday, true);
});

test('date utility source does not derive local date through toISOString', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/daily/daily-date.js'), 'utf8');
  assert.doesNotMatch(source, /toISOString\(\).*slice|toISOString\(\).*split/);
});

test('DST boundary does not skip a calendar day', () => {
  const { api } = createService({}, { now: () => new Date(2026, 2, 10, 12) });
  assert.deepEqual(api.getRecentCalendarDays(7).map(item => item.dateKey), [
    '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07',
    '2026-03-08', '2026-03-09', '2026-03-10'
  ]);
});

for (const [name, progress, expected] of [
  ['correct', completion().progress, 'correct'],
  ['incorrect', completion({ selectedAction: 'FOLD', isCorrect: false }).progress, 'incorrect'],
  ['pending', { status: 'pending' }, 'pending'],
  ['legacy', { status: 'legacy_uncredited' }, 'legacy']
]) {
  test(`seven-day strip renders ${name} completion status`, () => {
    const value = completion({
      selectedAction: name === 'incorrect' ? 'FOLD' : 'CALL',
      isCorrect: name !== 'incorrect',
      progress
    });
    const day = createService({ '2026-08-10': value }).api.getRecentCalendarDays(7).at(-1);
    assert.equal(day.status, expected);
  });
}

test('missing past day is not playable', () => {
  const day = createService().api.getRecentCalendarDays(7)[0];
  assert.equal(day.status, 'not_completed');
  assert.equal(day.openable, false);
});

test('missing today is available but not historical review', () => {
  const day = createService().api.getRecentCalendarDays(7).at(-1);
  assert.equal(day.status, 'today_available');
  assert.equal(day.openable, false);
});

test('future dates are never emitted by recent calendar days', () => {
  assert.equal(createService().api.getRecentCalendarDays(7).some(day => day.dateKey > '2026-08-10'), false);
});

test('calendar day status has accessible date and outcome label', () => {
  const day = createService({ '2026-08-10': completion() }).api.getRecentCalendarDays(7).at(-1);
  assert.match(day.ariaLabel, /10\.08\.2026/);
  assert.match(day.ariaLabel, /правильно/i);
});

test('historical review is explicitly read-only', () => {
  const review = createService({ '2026-08-04': completion() }).api.getHistoricalReview('2026-08-04');
  assert.equal(review.readOnly, true);
});

test('historical review preserves original selected and correct actions', () => {
  const review = createService({ '2026-08-04': completion() }).api.getHistoricalReview('2026-08-04');
  assert.equal(review.selectedAction, 'CALL');
  assert.equal(review.correctAction, 'CALL');
});

test('historical review uses stored receipt XP', () => {
  const review = createService({ '2026-08-04': completion() }).api.getHistoricalReview('2026-08-04');
  assert.equal(review.xpAwarded, 25);
});

test('historical review exposes known challenge cards and explanation', () => {
  const review = createService({ '2026-08-04': completion() }).api.getHistoricalReview('2026-08-04');
  assert.equal(review.challengeAvailable, true);
  assert.equal(review.heroCards.length, 2);
  assert.ok(review.explanation.length > 0);
});

test('unknown historical challenge returns a safe limited review', () => {
  const review = createService({
    '2026-08-04': completion({ challengeId: 'retired-challenge' })
  }).api.getHistoricalReview('2026-08-04');
  assert.equal(review.challengeAvailable, false);
  assert.deepEqual(review.heroCards, []);
  assert.match(review.unavailableMessage, /недоступны/i);
});

test('missing historical review returns null', () => {
  assert.equal(createService().api.getHistoricalReview('2026-08-04'), null);
});

test('history and review calls leave storage byte-for-byte unchanged', () => {
  const { api, localStorage } = createService({ '2026-08-04': completion() });
  const before = localStorage.snapshot();
  api.getHistoricalReview('2026-08-04');
  api.getCompletionByDate('2026-08-04');
  assert.equal(localStorage.snapshot(), before);
});

test('history module contains no mutation, XP or reward calls', () => {
  const source = fs.readFileSync(HISTORY_PATH, 'utf8');
  assert.doesNotMatch(source, /saveCompletion|saveProgress|addXp|submitAnswer|xpForOutcome/);
});
