'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let ProgressConfig;
let ProgressSystem;
let loadError = null;
try {
  ProgressConfig = require('../src/progress/progress-config.js');
  ProgressSystem = require('../src/progress/progress-system.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(ProgressConfig);
  assert.ok(ProgressSystem);
  return ProgressSystem;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

class FakeStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial));
    this.operations = [];
    this.failWrites = false;
  }

  getItem(key) {
    this.operations.push(['getItem', key]);
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    this.operations.push(['setItem', key, value]);
    if (this.failWrites) throw new Error('quota');
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.operations.push(['removeItem', key]);
    this.data.delete(key);
  }
}

const NOW = '2026-07-31T12:00:00.000Z';

function decisionRecord(id, score = 85, {
  street = 'flop',
  confidence = 'high',
  marginal = false,
  timestamp = NOW
} = {}) {
  return {
    decisionId: id,
    date: timestamp,
    street,
    decisionMode: 'TRAINING',
    trainerSnapshot: {
      actionClass: 'CALL',
      confidence,
      isMarginal: marginal
    },
    decisionQuality: {
      schemaVersion: 1,
      score,
      classification: score >= 90 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : 'ACCEPTABLE',
      confidence,
      isRated: true,
      modelVersion: 'dq-1.0.0',
      evaluatedAt: timestamp
    }
  };
}

function event(id, type, payload = {}, timestamp = NOW) {
  return { id, type, timestamp, source: 'test', payload };
}

test('ProgressSystem экспортирует малый публичный API и единый storage key', () => {
  const system = api();
  assert.equal(ProgressConfig.STORAGE_KEY, 'pokerpilot_progress_system');
  for (const name of [
    'createDefaultProgressState', 'parseProgressState', 'migrateProgressState',
    'validateProgressState', 'deriveLevel', 'deriveRank',
    'evaluateDecisionQuality', 'updatePokerIq', 'applyProgressEvent',
    'createSnapshot', 'create', 'load', 'getSnapshot', 'recordEvent',
    'resetForTesting', 'export', 'import', 'subscribe'
  ]) assert.equal(typeof system[name], 'function', name);
});

test('default progress state разделяет авторитетные входы и derived metrics', () => {
  const system = api();
  const state = system.createDefaultProgressState({
    now: NOW,
    playerId: 'player-test'
  });
  assert.equal(state.schemaVersion, ProgressConfig.SCHEMA_VERSION);
  assert.equal(state.playerId, 'player-test');
  assert.equal(state.lifetimeXp, 0);
  assert.deepEqual(state.decisionRecords, []);
  assert.deepEqual(state.streak, { current: 0, best: 0, lastQualifiedDate: null });
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.processedEventIds, []);
  assert.equal(Object.hasOwn(state, 'level'), false);
  assert.equal(Object.hasOwn(state, 'pokerIq'), false);
  assert.equal(Object.hasOwn(state, 'rank'), false);
  assert.deepEqual(Object.keys(state.skills), ProgressConfig.SKILL_IDS);
});

test('повреждённый JSON безопасно возвращает defaults', () => {
  const system = api();
  const parsed = system.parseProgressState('{broken', {
    now: NOW,
    playerId: 'safe-player'
  });
  assert.equal(parsed.playerId, 'safe-player');
  assert.equal(parsed.lifetimeXp, 0);
  assert.equal(system.validateProgressState(parsed).valid, true);
});

test('старый progress state мигрирует и нормализует отрицательные значения', () => {
  const system = api();
  const migrated = system.migrateProgressState({
    schemaVersion: 0,
    playerId: 'legacy',
    xp: -50,
    currentStreak: 3,
    bestStreak: 5
  }, { now: NOW });
  assert.equal(migrated.schemaVersion, ProgressConfig.SCHEMA_VERSION);
  assert.equal(migrated.lifetimeXp, 0);
  assert.equal(migrated.streak.current, 3);
  assert.equal(migrated.streak.best, 5);
});

test('legacy Profile XP и decision history импортируются один раз без удаления старых ключей', () => {
  const system = api();
  const oldValue = JSON.stringify({ decisions: 1 });
  const storage = new FakeStorage({ pokerpilot_v1_6_progress: oldValue });
  const store = system.create({
    storage,
    now: () => NOW,
    createPlayerId: () => 'generated',
    legacyProfile: {
      id: 'profile-id',
      progression: { totalXp: 1250 }
    },
    legacyProgress: {
      history: [decisionRecord('legacy-decision', 90)]
    }
  });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.playerId, 'profile-id');
  assert.equal(snapshot.lifetimeXp, 1250);
  assert.equal(snapshot.level.level, 3);
  assert.equal(snapshot.pokerIq.ratedDecisions, 1);
  assert.equal(storage.getItem('pokerpilot_v1_6_progress'), oldValue);
  assert.ok(storage.getItem(ProgressConfig.STORAGE_KEY));

  const reloaded = system.create({
    storage,
    now: () => '2026-08-01T12:00:00.000Z',
    legacyProfile: { progression: { totalXp: 999999 } },
    legacyProgress: { history: [decisionRecord('should-not-import', 10)] }
  });
  assert.equal(reloaded.getSnapshot().lifetimeXp, 1250);
  assert.equal(reloaded.getSnapshot().pokerIq.ratedDecisions, 1);
});

test('event processing идемпотентен и duplicate ID не выдаёт XP повторно', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const first = system.applyProgressEvent(initial, event(
    'lesson-1',
    'LESSON_COMPLETED',
    { lessonId: 'holdem-goal', localDate: '2026-07-31' }
  ));
  const duplicate = system.applyProgressEvent(first.state, event(
    'lesson-1',
    'LESSON_COMPLETED',
    { lessonId: 'holdem-goal', localDate: '2026-07-31' }
  ));
  assert.equal(first.applied, true);
  assert.equal(first.rewards.xp, ProgressConfig.XP_REWARDS.LESSON_COMPLETED);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.rewards.xp, 0);
  assert.equal(duplicate.state.lifetimeXp, first.state.lifetimeXp);
});

test('централизованные rewards применяются ко всем allowlisted meaningful events', () => {
  const system = api();
  const fixtures = [
    ['LESSON_COMPLETED', { lessonId: 'l1' }],
    ['EXAM_COMPLETED', { moduleId: 'm1', score: 80 }],
    ['TRAINING_DECISION_RECORDED', { decisionRecord: decisionRecord('reward-decision', 80) }],
    ['TRAINING_SCENARIO_COMPLETED', { scenarioId: 'flop-nfd', decisionId: 'reward-decision' }],
    ['TRAINING_SESSION_COMPLETED', { sessionId: 'training-1' }],
    ['HAND_REVIEW_COMPLETED', { handId: 'hand-1' }],
    ['DAILY_HAND_COMPLETED', { challengeId: 'daily-1' }],
    ['LIVE_SESSION_REVIEWED', { sessionId: 'live-1' }],
    ['SKILL_CHECK_COMPLETED', { skillId: 'pokerMath', score: 75 }]
  ];
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'reward-player' });
  let expectedXp = 0;
  fixtures.forEach(([type, payload], index) => {
    const result = system.applyProgressEvent(state, event(
      `reward-${index}`,
      type,
      { ...payload, localDate: '2026-07-31' }
    ));
    assert.equal(result.applied, true, type);
    assert.equal(result.rewards.xp, ProgressConfig.XP_REWARDS[type], type);
    expectedXp += ProgressConfig.XP_REWARDS[type];
    state = result.state;
  });
  assert.equal(state.lifetimeXp, expectedXp);
});

test('unknown и malformed events не меняют state', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  for (const invalid of [
    event('unknown', 'OPENED_APP'),
    event('lesson-missing', 'LESSON_COMPLETED', {}),
    { id: '', type: 'LESSON_COMPLETED', timestamp: NOW, payload: { lessonId: 'x' } },
    null
  ]) {
    const result = system.applyProgressEvent(initial, invalid);
    assert.equal(result.applied, false);
    assert.deepEqual(plain(result.state), plain(initial));
  }
});

test('XP никогда не уменьшается и Level curve совпадает с существующими границами', () => {
  const system = api();
  assert.equal(system.deriveLevel(-1).totalXp, 0);
  assert.equal(system.deriveLevel(0).level, 1);
  assert.equal(system.deriveLevel(499).level, 1);
  assert.equal(system.deriveLevel(500).level, 2);
  assert.equal(system.deriveLevel(1249).level, 2);
  assert.equal(system.deriveLevel(1250).level, 3);
  assert.doesNotThrow(() => system.deriveLevel(Number.MAX_VALUE));
  assert.ok(Number.isSafeInteger(system.deriveLevel(Number.MAX_VALUE).totalXp));
  const initial = system.migrateProgressState({ lifetimeXp: 100 }, { now: NOW });
  const applied = system.applyProgressEvent(initial, event(
    'session-1',
    'TRAINING_SESSION_COMPLETED',
    { sessionId: 's1', localDate: '2026-07-31' }
  ));
  assert.ok(applied.state.lifetimeXp >= initial.lifetimeXp);
});

test('Rank полностью и без разрывов выводится из существующего Poker IQ config', () => {
  const system = api();
  for (const rank of ProgressConfig.RANKS) {
    assert.equal(system.deriveRank(rank.minScore).id, rank.id);
    assert.equal(system.deriveRank(rank.maxScore).id, rank.id);
  }
  for (let score = 1000; score <= 3000; score += 1) {
    assert.notEqual(system.deriveRank(score).id, 'UNRANKED', String(score));
  }
});

test('Decision Quality adapter использует существующий engine для точного correct action', () => {
  const system = api();
  const result = system.evaluateDecisionQuality({
    userAction: { actionClass: 'CALL' },
    trainer: {
      actionClass: 'CALL',
      confidence: 'high',
      isMarginal: false,
      callEV: 10,
      callEVMethod: 'exact',
      alternatives: []
    },
    context: { street: 'turn', pot: 100 },
    evaluatedAt: NOW
  });
  assert.equal(result.isRated, true);
  assert.ok(result.score >= 90);
  assert.equal(result.classification, 'EXCELLENT');
});

test('Decision Quality adapter сохраняет строгий штраф для clear mistake', () => {
  const system = api();
  const result = system.evaluateDecisionQuality({
    userAction: { actionClass: 'FOLD' },
    trainer: {
      actionClass: 'CALL',
      confidence: 'high',
      isMarginal: false,
      callEV: 20,
      callEVMethod: 'exact',
      alternatives: []
    },
    context: { street: 'river', pot: 100 },
    evaluatedAt: NOW
  });
  assert.ok(result.score < 50);
  assert.equal(result.classification, 'BLUNDER');
});

test('Decision Quality marginal alternative не штрафуется как clear mistake', () => {
  const system = api();
  const result = system.evaluateDecisionQuality({
    userAction: { actionClass: 'FOLD' },
    trainer: {
      actionClass: 'CALL',
      confidence: 'medium',
      isMarginal: true,
      callEV: 0,
      callEVMethod: 'exact',
      alternatives: [{ actionClass: 'FOLD', amount: null, reason: 'Пограничная альтернатива' }]
    },
    context: { street: 'river', pot: 100 },
    evaluatedAt: NOW
  });
  assert.equal(result.isRated, true);
  assert.ok(result.score >= 70);
  assert.notEqual(result.classification, 'BLUNDER');
});

test('Decision Quality missing EV использует документированный fallback без ложного нуля', () => {
  const system = api();
  const result = system.evaluateDecisionQuality({
    userAction: { actionClass: 'CALL' },
    trainer: {
      actionClass: 'CALL',
      confidence: 'medium',
      isMarginal: false,
      callEV: null,
      alternatives: []
    },
    context: { street: 'flop', pot: 100 },
    evaluatedAt: NOW
  });
  assert.equal(result.components.evQuality, null);
  assert.ok(result.score >= 80);
});

test('Poker IQ adapter не использует XP и дедуплицирует decision IDs', () => {
  const system = api();
  const record = decisionRecord('dq-1', 90);
  const first = system.updatePokerIq([], record);
  const duplicate = system.updatePokerIq([record], plain(record));
  assert.equal(first.current.ratedDecisions, 1);
  assert.equal(duplicate.current.ratedDecisions, 1);

  const lowXp = system.createSnapshot(system.migrateProgressState({
    lifetimeXp: 0,
    decisionRecords: [record]
  }, { now: NOW }));
  const highXp = system.createSnapshot(system.migrateProgressState({
    lifetimeXp: 999999,
    decisionRecords: [record]
  }, { now: NOW }));
  assert.equal(lowXp.pokerIq.score, highXp.pokerIq.score);
  assert.notEqual(lowXp.level.level, highXp.level.level);
});

test('UNRATED decision не влияет на Poker IQ, Skill Map или day streak', () => {
  const system = api();
  const unrated = decisionRecord('unrated', 80);
  unrated.decisionQuality.score = null;
  unrated.decisionQuality.isRated = false;
  unrated.decisionQuality.classification = 'UNRATED';
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const result = system.applyProgressEvent(initial, event(
    'unrated-event',
    'TRAINING_DECISION_RECORDED',
    {
      decisionRecord: unrated,
      skillId: 'preflop',
      localDate: '2026-07-31'
    }
  ));
  assert.equal(result.applied, true);
  assert.equal(result.state.skills.preflop.attempts, 0);
  assert.equal(result.state.streak.current, 0);
  assert.equal(system.createSnapshot(result.state).pokerIq.ratedDecisions, 0);
});

test('одно decisionId нельзя повторно применить под другим event ID', () => {
  const system = api();
  const record = decisionRecord('same-decision', 90);
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const first = system.applyProgressEvent(state, event(
    'decision-event-a',
    'TRAINING_DECISION_RECORDED',
    { decisionRecord: record, skillId: 'preflop', localDate: '2026-07-31' }
  ));
  const duplicate = system.applyProgressEvent(first.state, event(
    'decision-event-b',
    'TRAINING_DECISION_RECORDED',
    { decisionRecord: plain(record), skillId: 'preflop', localDate: '2026-07-31' }
  ));
  assert.equal(first.applied, true);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, 'DUPLICATE_DECISION');
  assert.equal(duplicate.state.decisionRecords.length, 1);
  assert.equal(duplicate.state.skills.preflop.attempts, 1);
});

test('rated decision обновляет allowlisted skill с видимой sample confidence', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  state = system.applyProgressEvent(state, event(
    'decision-1',
    'TRAINING_DECISION_RECORDED',
    {
      decisionRecord: decisionRecord('decision-1', 90),
      skillId: 'preflop',
      localDate: '2026-07-31'
    }
  )).state;
  assert.equal(state.skills.preflop.attempts, 1);
  assert.equal(state.skills.preflop.score, 90);
  assert.equal(state.skills.preflop.confidence, 'insufficient');

  for (let index = 2; index <= 10; index += 1) {
    state = system.applyProgressEvent(state, event(
      `decision-${index}`,
      'TRAINING_DECISION_RECORDED',
      {
        decisionRecord: decisionRecord(`decision-${index}`, 80 + index),
        skillId: 'preflop',
        localDate: '2026-07-31'
      }
    )).state;
  }
  assert.equal(state.skills.preflop.attempts, 10);
  assert.equal(state.skills.preflop.confidence, 'medium');
  assert.ok(Number.isFinite(state.skills.preflop.score));
});

test('unknown skill topic не создаёт произвольный ключ и не портит decision event', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const result = system.applyProgressEvent(initial, event(
    'unknown-topic',
    'TRAINING_DECISION_RECORDED',
    {
      decisionRecord: decisionRecord('unknown-topic', 80),
      topic: '__proto__',
      localDate: '2026-07-31'
    }
  ));
  assert.equal(result.applied, true);
  assert.equal(Object.hasOwn(result.state.skills, '__proto__'), false);
  assert.deepEqual(Object.keys(result.state.skills), ProgressConfig.SKILL_IDS);
});

test('существующий weakness tag использует централизованную allowlisted skill mapping', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const result = system.applyProgressEvent(initial, event(
    'mapped-topic',
    'TRAINING_DECISION_RECORDED',
    {
      decisionRecord: decisionRecord('mapped-topic', 55),
      topic: 'too_tight',
      localDate: '2026-07-31'
    }
  ));
  assert.equal(result.applied, true);
  assert.equal(result.state.skills.discipline.attempts, 1);
  assert.equal(result.state.skills.discipline.score, 55);
});

test('same-day qualifying events увеличивают streak только один раз', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  state = system.applyProgressEvent(state, event(
    'lesson-a', 'LESSON_COMPLETED',
    { lessonId: 'a', localDate: '2026-07-30' }
  )).state;
  state = system.applyProgressEvent(state, event(
    'lesson-b', 'LESSON_COMPLETED',
    { lessonId: 'b', localDate: '2026-07-30' }
  )).state;
  assert.deepEqual(state.streak, {
    current: 1,
    best: 1,
    lastQualifiedDate: '2026-07-30'
  });
});

test('consecutive day увеличивает streak, missed day сбрасывает current и сохраняет best', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  for (const [id, localDate] of [
    ['a', '2026-07-28'],
    ['b', '2026-07-29'],
    ['c', '2026-07-31']
  ]) {
    state = system.applyProgressEvent(state, event(
      `lesson-${id}`, 'LESSON_COMPLETED',
      { lessonId: id, localDate }
    )).state;
  }
  assert.deepEqual(state.streak, {
    current: 1,
    best: 2,
    lastQualifiedDate: '2026-07-31'
  });
});

test('malformed timestamp не квалифицирует streak, но безопасный event может примениться', () => {
  const system = api();
  const initial = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  const result = system.applyProgressEvent(initial, event(
    'bad-date',
    'LESSON_COMPLETED',
    { lessonId: 'a' },
    'not-a-date'
  ));
  assert.equal(result.applied, true);
  assert.equal(result.state.streak.current, 0);
});

test('history ограничена, содержит event linkage и не копирует trainer scenario', () => {
  const system = api();
  let state = system.createDefaultProgressState({ now: NOW, playerId: 'p' });
  for (let index = 0; index < ProgressConfig.HISTORY_LIMIT + 5; index += 1) {
    state = system.applyProgressEvent(state, event(
      `history-${index}`,
      'LESSON_COMPLETED',
      { lessonId: `lesson-${index}`, localDate: '2026-07-31', hugeScenario: 'x'.repeat(1000) }
    )).state;
  }
  state = system.applyProgressEvent(state, event(
    'bounded-summary',
    'LESSON_COMPLETED',
    { lessonId: 'l'.repeat(1000), localDate: '2026-07-31' }
  )).state;
  assert.equal(state.history.length, ProgressConfig.HISTORY_LIMIT);
  assert.equal(typeof state.history[0].eventId, 'string');
  assert.equal(Object.hasOwn(state.history[0], 'hugeScenario'), false);
  assert.ok(state.history[0].summary.length <= 240);
});

test('export/import round trip нормализует данные и не отдаёт mutable state', () => {
  const system = api();
  const storage = new FakeStorage();
  const store = system.create({
    storage,
    now: () => NOW,
    createPlayerId: () => 'roundtrip'
  });
  store.recordEvent(event(
    'exam-1',
    'EXAM_COMPLETED',
    { moduleId: 'holdem-foundations', score: 80, localDate: '2026-07-31' }
  ));
  const exported = store.export();
  exported.lifetimeXp = 999999;
  assert.notEqual(store.getSnapshot().lifetimeXp, 999999);

  const second = system.create({
    storage: new FakeStorage(),
    now: () => NOW,
    createPlayerId: () => 'second'
  });
  assert.equal(second.import(store.export()).imported, true);
  assert.deepEqual(second.export(), store.export());
});

test('invalid import отклоняется и не стирает существующее состояние', () => {
  const system = api();
  const store = system.create({
    storage: new FakeStorage(),
    now: () => NOW,
    createPlayerId: () => 'import-safe'
  });
  store.recordEvent(event(
    'review-before-invalid-import',
    'HAND_REVIEW_COMPLETED',
    { handId: 'h1', localDate: '2026-07-31' }
  ));
  const before = store.export();
  assert.equal(store.import('{broken').imported, false);
  assert.equal(store.import(['not', 'a', 'state']).imported, false);
  assert.deepEqual(store.export(), before);
});

test('storage parse/quota errors не роняют in-memory API', () => {
  const system = api();
  const malformed = new FakeStorage({
    [ProgressConfig.STORAGE_KEY]: '{bad'
  });
  malformed.failWrites = true;
  const store = system.create({
    storage: malformed,
    now: () => NOW,
    createPlayerId: () => 'safe'
  });
  assert.doesNotThrow(() => store.getSnapshot());
  assert.doesNotThrow(() => store.recordEvent(event(
    'review-1',
    'HAND_REVIEW_COMPLETED',
    { handId: 'h1', localDate: '2026-07-31' }
  )));
  assert.equal(store.getStatus().persisted, false);
  assert.ok(store.getStatus().error);
});

test('один applied event вызывает ровно одно уведомление subscriber', () => {
  const system = api();
  const store = system.create({
    storage: new FakeStorage(),
    now: () => NOW,
    createPlayerId: () => 'subscriber'
  });
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.recordEvent(event(
    'review-1',
    'HAND_REVIEW_COMPLETED',
    { handId: 'h1', localDate: '2026-07-31' }
  ));
  store.recordEvent(event(
    'review-1',
    'HAND_REVIEW_COMPLETED',
    { handId: 'h1', localDate: '2026-07-31' }
  ));
  unsubscribe();
  assert.equal(calls, 1);
});

test('Home progress adapter принимает новый snapshot и сохраняет прежний fallback', () => {
  const system = api();
  const Dashboard = require('../src/ui/dashboard.js');
  const state = system.createDefaultProgressState({ now: NOW, playerId: 'home' });
  const snapshot = system.createSnapshot(system.migrateProgressState({
    ...state,
    lifetimeXp: 500,
    streak: { current: 3, best: 5, lastQualifiedDate: '2026-07-31' },
    decisionRecords: [decisionRecord('home-decision', 90)]
  }, { now: NOW }));
  const adapted = Dashboard.getHomeProgressSnapshot({
    progressSnapshot: snapshot,
    profile: { progression: { totalXp: 0 } },
    pokerIQ: { score: null, isRated: false },
    statistics: {}
  });
  assert.equal(adapted.level.value, '2');
  assert.equal(adapted.streak.value, '3');
  assert.notEqual(adapted.pokerIQ.value, '—');

  const emptyDayStreak = Dashboard.getHomeProgressSnapshot({
    progressSnapshot: {
      ...snapshot,
      streak: { current: 0, best: 5, lastQualifiedDate: null }
    },
    progress: { streak: 12 },
    profile: { progression: { totalXp: 0 } },
    statistics: { currentDecisionStreak: 12 }
  });
  assert.equal(emptyDayStreak.streak.value, '0');

  const fallback = Dashboard.getHomeProgressSnapshot({
    profile: { progression: { level: 1, xpIntoLevel: 0, xpToNextLevel: 500 } },
    pokerIQ: { score: null, isRated: false },
    statistics: {}
  });
  assert.equal(fallback.level.value, '1');
  assert.equal(fallback.pokerIQ.value, '—');
});

test('browser wiring загружает Progress System до ProfileStore и использует snapshot adapter', () => {
  api();
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const configIndex = html.indexOf('src/progress/progress-config.js');
  const profileIndex = html.indexOf('src/profile/profile-store.js');
  const systemIndex = html.indexOf('src/progress/progress-system.js');
  const integrationIndex = html.indexOf('src/progress/progress-integration.js');
  const appIndex = html.indexOf('const C = window.PokerCore;');
  assert.ok(configIndex > 0 && configIndex < profileIndex);
  assert.ok(systemIndex > profileIndex && systemIndex < appIndex);
  assert.ok(integrationIndex > systemIndex && integrationIndex < appIndex);
  assert.match(html, /ProgressSystem\.load\(\{\s*legacyProfile:/);
  assert.match(html, /PokerPilotProgressIntegration\.create\(\{/);
  assert.match(html, /progressIntegration\.recordTrainingDecision\(\{/);
  assert.match(html, /progressSnapshot:\s*ProgressSystem\.getSnapshot\(\)/);
});
