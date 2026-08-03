'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Config = require('../src/progress/progress-config.js');
const System = require('../src/progress/progress-system.js');

const NOW = '2026-08-03T18:00:00.000Z';

function event(id, type = 'TRAINING_SCENARIO_COMPLETED', timestamp = NOW) {
  const payload = type === 'TRAINING_DECISION_RECORDED'
    ? {
      localDate: timestamp.slice(0, 10),
      timezoneOffsetMinutes: 0,
      decisionRecord: {
        decisionId: id,
        date: timestamp,
        street: 'flop',
        decisionMode: 'TRAINING',
        trainerSnapshot: { confidence: 'high', isMarginal: false },
        decisionQuality: {
          schemaVersion: 1,
          score: 90,
          classification: 'EXCELLENT',
          confidence: 'high',
          isRated: true,
          evaluatedAt: timestamp
        }
      }
    }
    : { scenarioId: 'fixture', decisionId: id, localDate: timestamp.slice(0, 10), timezoneOffsetMinutes: 0 };
  return { id, type, timestamp, source: 'test', payload };
}

test('Stage 9.7 использует schema v3 и увеличенный детерминированный retention', () => {
  assert.equal(Config.SCHEMA_VERSION, 3);
  assert.equal(Config.HISTORY_LIMIT, 2000);
});

test('accepted event создаёт одну нормализованную analytics history entry', () => {
  const initial = System.createDefaultProgressState({ now: NOW, playerId: 'history-player' });
  const result = System.applyProgressEvent(initial, event('scenario-1'));
  assert.equal(result.applied, true);
  assert.equal(result.state.history.length, 1);
  assert.deepEqual(Object.keys(result.state.history[0]).sort(), [
    'eventId', 'levelAfter', 'lifetimeXpAfter', 'localDate', 'metadata', 'pokerIqAfter',
    'rankAfter', 'source', 'streakAfter', 'summary', 'timestamp', 'timezoneOffsetMinutes',
    'type', 'xp'
  ]);
  assert.equal(result.state.history[0].lifetimeXpAfter, 15);
  assert.equal(result.state.history[0].levelAfter, 1);
  assert.equal(result.state.history[0].localDate, '2026-08-03');
});

test('duplicate и rejected events не создают history entries', () => {
  const initial = System.createDefaultProgressState({ now: NOW, playerId: 'history-player' });
  const first = System.applyProgressEvent(initial, event('scenario-duplicate'));
  const duplicate = System.applyProgressEvent(first.state, event('scenario-duplicate'));
  const rejected = System.applyProgressEvent(first.state, { id: 'bad', type: 'UNKNOWN', timestamp: NOW, payload: {} });
  assert.equal(duplicate.state.history.length, 1);
  assert.equal(rejected.state.history.length, 1);
});

test('replay после reload остаётся идемпотентным', () => {
  const storage = {
    value: null,
    getItem() { return this.value; },
    setItem(_key, value) { this.value = value; }
  };
  const first = System.create({ storage, now: () => NOW, createPlayerId: () => 'p' });
  first.recordEvent(event('persisted-event'));
  const second = System.create({ storage, now: () => NOW, createPlayerId: () => 'p' });
  const duplicate = second.recordEvent(event('persisted-event'));
  assert.equal(duplicate.applied, false);
  assert.equal(second.export().history.length, 1);
});

test('history сортируется детерминированно и duplicate IDs дедуплицируются', () => {
  const migrated = System.migrateProgressState({
    schemaVersion: 3,
    history: [
      { eventId: 'b', type: 'EXAM_COMPLETED', timestamp: '2026-08-02T12:00:00Z', xp: 60 },
      { eventId: 'a', type: 'LESSON_COMPLETED', timestamp: '2026-08-03T12:00:00Z', xp: 30 },
      { eventId: 'a', type: 'LESSON_COMPLETED', timestamp: '2026-08-01T12:00:00Z', xp: 30 }
    ]
  }, { now: NOW, playerId: 'p' });
  assert.deepEqual(migrated.history.map(item => item.eventId), ['a', 'b']);
});

test('v2 мигрирует идемпотентно без fake daily events и сохраняет totals/achievements', () => {
  const legacy = {
    schemaVersion: 2,
    playerId: 'legacy',
    lifetimeXp: 900,
    counters: { trainingScenarios: 30, trainerDecisions: 4, exams: 2 },
    achievements: { unlocked: { FIRST_STEP: { unlockedAt: NOW, sourceEventId: 'old' } }, history: [] },
    history: []
  };
  const first = System.migrateProgressState(legacy, { now: NOW, playerId: 'fallback' });
  const second = System.migrateProgressState(first, { now: '2026-08-04T00:00:00Z', playerId: 'fallback' });
  assert.equal(first.schemaVersion, 3);
  assert.equal(first.lifetimeXp, 900);
  assert.equal(first.history.length, 0);
  assert.equal(first.analyticsCoverage.isPartial, true);
  assert.equal(first.analyticsCoverage.reason, 'LEGACY_TOTALS_WITHOUT_DETAILED_HISTORY');
  assert.deepEqual(second, first);
  assert.ok(first.achievements.unlocked.FIRST_STEP);
});

test('повреждённая history не ломает миграцию и invalid timestamps не становятся fake dates', () => {
  const migrated = System.migrateProgressState({
    schemaVersion: 2,
    lifetimeXp: 10,
    history: [null, { eventId: 'bad-time', type: 'LESSON_COMPLETED', timestamp: 'broken', xp: 30 }]
  }, { now: NOW, playerId: 'p' });
  assert.equal(migrated.history.length, 1);
  assert.equal(migrated.history[0].timestamp, null);
  assert.equal(migrated.history[0].localDate, null);
});

test('history и analytics snapshot возвращаются defensive copies', () => {
  const store = System.create({ storage: null, now: () => NOW, createPlayerId: () => 'p' });
  store.recordEvent(event('copy-event'));
  const exported = store.export();
  exported.history[0].xp = 9999;
  const analytics = store.getAnalyticsSnapshot({ period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  analytics.series.dailyXp[0].value = 9999;
  assert.equal(store.export().history[0].xp, 15);
  assert.notEqual(store.getAnalyticsSnapshot({ period: '7d', now: NOW, timezoneOffsetMinutes: 0 }).series.dailyXp[0].value, 9999);
});

test('новая decision history фиксирует реальный pokerIqAfter, но не реконструирует старый', () => {
  const initial = System.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const result = System.applyProgressEvent(initial, event('decision-history', 'TRAINING_DECISION_RECORDED'));
  assert.equal(result.applied, true);
  assert.equal(result.state.history[0].pokerIqAfter, System.createSnapshot(result.state).pokerIq.score);
  const legacy = System.migrateProgressState({
    schemaVersion: 2,
    history: [{ eventId: 'old', type: 'TRAINING_DECISION_RECORDED', timestamp: NOW, xp: 0 }]
  }, { now: NOW, playerId: 'p' });
  assert.equal(legacy.history[0].pokerIqAfter, null);
});
