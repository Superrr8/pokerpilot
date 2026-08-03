'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let ProgressConfig = null;
let AchievementConfig = null;
let AchievementSystem = null;
let ProgressSystem = null;
let loadError = null;
try {
  ProgressConfig = require('../src/progress/progress-config.js');
  AchievementConfig = require('../src/progress/achievement-config.js');
  AchievementSystem = require('../src/progress/achievement-system.js');
  ProgressSystem = require('../src/progress/progress-system.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(ProgressSystem);
  assert.ok(AchievementSystem);
  return ProgressSystem;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const NOW = '2026-08-03T12:00:00.000Z';

function event(id, type, payload = {}, timestamp = NOW) {
  return { id, type, timestamp, source: 'test', payload };
}

function scenario(index, localDate = '2026-08-03') {
  return event(`scenario-${index}`, 'TRAINING_SCENARIO_COMPLETED', {
    scenarioId: `spot-${index}`,
    decisionId: `decision-${index}`,
    localDate
  });
}

function decisionRecord(id, score = 90, timestamp = NOW) {
  return {
    decisionId: id,
    date: timestamp,
    street: 'flop',
    decisionMode: 'TRAINING',
    trainerSnapshot: { confidence: 'high', isMarginal: false },
    decisionQuality: {
      schemaVersion: 1,
      score,
      classification: score >= 90 ? 'EXCELLENT' : 'GOOD',
      confidence: 'high',
      isRated: true,
      isMarginal: false,
      modelVersion: 'dq-1.0.0',
      evaluatedAt: timestamp
    }
  };
}

function decision(index, score = 90) {
  return event(`decision-event-${index}`, 'TRAINING_DECISION_RECORDED', {
    decisionRecord: decisionRecord(`decision-record-${index}`, score),
    topic: 'postflop',
    localDate: '2026-08-03'
  });
}

function unlockedIds(result) {
  return result.transition.achievements.newlyUnlocked.map(item => item.id);
}

class FakeStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.data.get(key) ?? null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }
}

test('новое состояние содержит counters и пустую achievement history', () => {
  const system = api();
  const state = system.createDefaultProgressState({ now: NOW, playerId: 'ach-player' });
  assert.equal(state.schemaVersion, ProgressConfig.SCHEMA_VERSION);
  assert.deepEqual(state.counters, {
    trainingScenarios: 0,
    trainerDecisions: 0,
    exams: 0
  });
  assert.deepEqual(state.achievements, { unlocked: {}, history: [] });
});

test('FIRST_STEP открывается после первого accepted scenario и не повторяется', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const first = system.applyProgressEvent(initial, scenario(1));
  const second = system.applyProgressEvent(first.state, scenario(2));
  assert.ok(unlockedIds(first).includes('FIRST_STEP'));
  assert.equal(second.transition.achievements.newlyUnlocked.some(item => item.id === 'FIRST_STEP'), false);
  assert.equal(second.state.achievements.history.filter(item => item.id === 'FIRST_STEP').length, 1);
});

test('QUICK_LEARNER открывается ровно на 10 training completions', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  for (let index = 1; index <= 9; index += 1) {
    const result = system.applyProgressEvent(state, scenario(index));
    assert.equal(unlockedIds(result).includes('QUICK_LEARNER'), false);
    state = result.state;
  }
  const tenth = system.applyProgressEvent(state, scenario(10));
  assert.ok(unlockedIds(tenth).includes('QUICK_LEARNER'));
  assert.equal(tenth.state.counters.trainingScenarios, 10);
});

test('DECISION_MAKER открывается на 25 valid trainer decisions без XP', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  let result = null;
  for (let index = 1; index <= 25; index += 1) {
    result = system.applyProgressEvent(state, decision(index));
    state = result.state;
  }
  assert.ok(unlockedIds(result).includes('DECISION_MAKER'));
  assert.equal(state.counters.trainerDecisions, 25);
  assert.equal(state.lifetimeXp, 0);
});

test('SHARP_MIND и HIGH_ACHIEVER используют Poker IQ и rank из существующего engine', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  let result = system.applyProgressEvent(state, decision(1, 100));
  assert.ok(unlockedIds(result).includes('SHARP_MIND'));
  state = result.state;
  for (let index = 2; index <= 100; index += 1) {
    result = system.applyProgressEvent(state, decision(index, 100));
    state = result.state;
  }
  assert.ok(system.createSnapshot(state).rank.minScore > 1400);
  assert.equal(state.achievements.history.filter(item => item.id === 'HIGH_ACHIEVER').length, 1);
});

test('POKER_STUDENT и CENTURY_CLUB оцениваются по Level и lifetime XP', () => {
  const system = api();
  const initial = system.migrateProgressState({
    playerId: 'p',
    lifetimeXp: 3490
  }, { now: NOW });
  const result = system.applyProgressEvent(initial, scenario('level-five'));
  assert.equal(system.createSnapshot(result.state).level.level, 5);
  assert.ok(unlockedIds(result).includes('POKER_STUDENT'));
  assert.ok(unlockedIds(result).includes('CENTURY_CLUB'));
});

test('ON_A_ROLL и DEDICATED открываются на 3 и 7 последовательных днях', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  let result = null;
  for (let day = 1; day <= 7; day += 1) {
    const localDate = `2026-08-${String(day).padStart(2, '0')}`;
    result = system.applyProgressEvent(state, scenario(`day-${day}`, localDate));
    state = result.state;
    if (day === 3) assert.ok(unlockedIds(result).includes('ON_A_ROLL'));
  }
  assert.ok(unlockedIds(result).includes('DEDICATED'));
  assert.equal(state.streak.current, 7);
});

test('EXAM_READY открывается после первого exam и exam counter идемпотентен', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const exam = event('exam-1', 'EXAM_COMPLETED', {
    moduleId: 'positions', score: 80, localDate: '2026-08-03'
  });
  const first = system.applyProgressEvent(initial, exam);
  const duplicate = system.applyProgressEvent(first.state, exam);
  assert.ok(unlockedIds(first).includes('EXAM_READY'));
  assert.equal(first.state.counters.exams, 1);
  assert.equal(duplicate.state.counters.exams, 1);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.transition.achievements.newlyUnlocked, []);
});

test('один accepted event может открыть несколько достижений без bonus XP', () => {
  const system = api();
  const initial = system.migrateProgressState({ lifetimeXp: 90 }, { now: NOW });
  const result = system.applyProgressEvent(initial, scenario('multi'));
  assert.deepEqual(unlockedIds(result).sort(), ['CENTURY_CLUB', 'FIRST_STEP']);
  assert.equal(result.rewards.xp, 15);
  assert.equal(result.state.lifetimeXp, 105);
});

test('старое состояние мигрирует, восстанавливает counters и переживает malformed achievement data', () => {
  const system = api();
  const migrated = system.migrateProgressState({
    schemaVersion: 1,
    playerId: 'legacy',
    lifetimeXp: 75,
    history: [
      { eventId: 's1', type: 'TRAINING_SCENARIO_COMPLETED', timestamp: NOW, source: 'study', xp: 15 },
      { eventId: 'e1', type: 'EXAM_COMPLETED', timestamp: NOW, source: 'learning', xp: 60 }
    ],
    decisionRecords: [decisionRecord('legacy-decision', 80)],
    achievements: { unlocked: 'bad', history: [{ id: 'UNKNOWN_OLD', unlockedAt: 'bad' }] },
    counters: null
  }, { now: NOW });
  assert.equal(migrated.counters.trainingScenarios, 1);
  assert.equal(migrated.counters.trainerDecisions, 1);
  assert.equal(migrated.counters.exams, 1);
  assert.doesNotThrow(() => system.createSnapshot(migrated));
  assert.equal(migrated.lifetimeXp, 75);
});

test('достижения сохраняются после reload и unknown stored IDs не ломают snapshot', () => {
  const system = api();
  const storage = new FakeStorage();
  const firstStore = system.create({ storage, now: () => NOW, createPlayerId: () => 'p' });
  firstStore.recordEvent(scenario('persist'));
  const exported = firstStore.export();
  exported.achievements.unlocked.UNKNOWN_OLD = {
    unlockedAt: NOW,
    sourceEventId: 'old-event'
  };
  storage.setItem(ProgressConfig.STORAGE_KEY, JSON.stringify(exported));
  const reloaded = system.create({ storage, now: () => NOW, createPlayerId: () => 'p' });
  const snapshot = reloaded.getSnapshot();
  assert.equal(snapshot.achievements.unlockedCount, 1);
  assert.equal(snapshot.achievements.items.some(item => item.id === 'UNKNOWN_OLD'), false);
  assert.equal(reloaded.export().achievements.history.filter(item => item.id === 'FIRST_STEP').length, 1);
});

test('structured result возвращает XP, Level, Rank, unlocks и duplicate status', () => {
  const system = api();
  const initial = system.migrateProgressState({ lifetimeXp: 490 }, { now: NOW });
  const applied = system.applyProgressEvent(initial, scenario('transition'));
  assert.deepEqual(applied.transition.xp, { gained: 15, previous: 490, current: 505 });
  assert.equal(applied.transition.level.previous, 1);
  assert.equal(applied.transition.level.current, 2);
  assert.equal(applied.transition.level.leveledUp, true);
  assert.equal(typeof applied.transition.rank.rankedUp, 'boolean');
  assert.ok(applied.transition.achievements.newlyUnlocked.length >= 1);
  assert.equal(applied.duplicate, false);
  assert.deepEqual(applied.rewards, { xp: 15 });
  assert.ok(Array.isArray(applied.changes));

  const duplicate = system.applyProgressEvent(applied.state, scenario('transition'));
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.transition.xp.gained, 0);
});

test('structured result фиксирует реальный rank-up после первого rated decision', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'rank-player' });
  const result = system.applyProgressEvent(initial, decision('rank-transition', 100));
  assert.equal(result.transition.rank.previous.id, 'UNRANKED');
  assert.notEqual(result.transition.rank.current.id, 'UNRANKED');
  assert.equal(result.transition.rank.rankedUp, true);
});

test('уже удовлетворённое условие безопасно открывается на следующем accepted event', () => {
  const system = api();
  const migrated = system.migrateProgressState({ lifetimeXp: 120 }, { now: NOW });
  const result = system.applyProgressEvent(migrated, decision('migration-evaluation', 80));
  assert.ok(unlockedIds(result).includes('CENTURY_CLUB'));
});
