'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const DailyStorage = require('../src/daily/daily-challenge-storage.js');
const DailySystem = require('../src/daily/daily-challenge-system.js');
const DailyCatalog = require('../src/daily/daily-challenge-catalog.js');
const ProgressSystem = require('../src/progress/progress-system.js');
const ProgressIntegration = require('../src/progress/progress-integration.js');
const ProgressConfig = require('../src/progress/progress-config.js');

let RewardPolicy = null;
let DailyProgress = null;
let loadError = null;
try {
  RewardPolicy = require('../src/daily/daily-challenge-reward.js');
  DailyProgress = require('../src/daily/daily-challenge-progress.js');
} catch (error) {
  loadError = error;
}

const TODAY = new Date(2026, 7, 4, 12, 0);
const TODAY_KEY = '2026-08-04';
const NOW_ISO = '2026-08-04T19:00:00.000Z';

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  snapshot() { return Object.fromEntries(this.values); }
}

function available() {
  assert.ifError(loadError);
  assert.ok(RewardPolicy);
  assert.ok(DailyProgress);
}

function createEnvironment(initial = {}, date = TODAY) {
  available();
  const storage = new MemoryStorage(initial);
  const progressSystem = ProgressSystem.create({
    storage,
    now: () => NOW_ISO,
    createPlayerId: () => 'daily-player'
  });
  const progressIntegration = ProgressIntegration.create({
    system: progressSystem,
    now: () => NOW_ISO,
    timezoneOffsetMinutes: () => date.getTimezoneOffset()
  });
  const dailyStorage = DailyStorage.create({ storage });
  const dailyProgress = DailyProgress.create({
    storage: dailyStorage,
    progressIntegration,
    now: () => date
  });
  const dailySystem = DailySystem.create({
    storage: dailyStorage,
    progress: dailyProgress,
    now: () => date
  });
  return { storage, progressSystem, progressIntegration, dailyStorage, dailyProgress, dailySystem };
}

function challengeFor(system) {
  const challenge = system.getTodayChallenge();
  assert.ok(challenge);
  return challenge;
}

function completion(challenge, selectedAction = challenge.correctAction) {
  return {
    challengeId: challenge.id,
    scheduleVersion: 1,
    selectedAction,
    correctAction: challenge.correctAction,
    isCorrect: selectedAction === challenge.correctAction,
    completedAt: NOW_ISO,
    progress: { status: 'pending' }
  };
}

test('Reward Model v1 централизован: correct 25 XP, incorrect 10 XP', () => {
  available();
  assert.deepEqual(RewardPolicy.POLICY, { version: 1, correctXp: 25, incorrectXp: 10 });
  assert.equal(RewardPolicy.xpForOutcome(true, 1), 25);
  assert.equal(RewardPolicy.xpForOutcome(false, 1), 10);
});

test('canonical event type и deterministic ID стабильны без timestamp/random', () => {
  available();
  assert.equal(DailyProgress.EVENT_TYPE, 'DAILY_CHALLENGE_COMPLETED');
  const first = DailyProgress.eventId({ dateKey: TODAY_KEY, scheduleVersion: 1, challengeId: 'daily-river-aj-bluffcatch' });
  const second = DailyProgress.eventId({ dateKey: TODAY_KEY, scheduleVersion: 1, challengeId: 'daily-river-aj-bluffcatch' });
  assert.equal(first, second);
  assert.equal(first, 'daily_challenge:v1:2026-08-04:daily-river-aj-bluffcatch');
  assert.notEqual(first, DailyProgress.eventId({ dateKey: '2026-08-05', scheduleVersion: 1, challengeId: 'daily-river-aj-bluffcatch' }));
  assert.notEqual(first, DailyProgress.eventId({ dateKey: TODAY_KEY, scheduleVersion: 1, challengeId: 'different' }));
  assert.doesNotMatch(String(DailyProgress.eventId), /Math\.random|Date\.now/);
});

test('correct completion начисляет ровно 25 XP, одно history event и receipt v1', () => {
  const env = createEnvironment();
  const before = env.progressSystem.getSnapshot();
  const challenge = challengeFor(env.dailySystem);
  const result = env.dailySystem.submitAnswer(challenge.correctAction);
  const after = env.progressSystem.getSnapshot();
  assert.equal(result.accepted, true);
  assert.equal(after.lifetimeXp - before.lifetimeXp, 25);
  assert.equal(env.progressSystem.export().history.length, 1);
  assert.equal(after.streak.current, 1);
  assert.equal(result.completion.progress.status, 'recorded');
  assert.equal(result.completion.progress.rewardVersion, 1);
  assert.equal(result.completion.progress.xpAwarded, 25);
});

test('incorrect completion начисляет ровно 10 XP и квалифицирует общий streak', () => {
  const env = createEnvironment();
  const challenge = challengeFor(env.dailySystem);
  const wrong = challenge.actions.find(item => item.actionClass !== challenge.correctAction).actionClass;
  const result = env.dailySystem.submitAnswer(wrong);
  const snapshot = env.progressSystem.getSnapshot();
  assert.equal(snapshot.lifetimeXp, 10);
  assert.equal(snapshot.streak.current, 1);
  assert.equal(result.completion.progress.xpAwarded, 10);
  assert.equal(result.completion.progress.status, 'recorded');
});

test('event metadata минимальна, outcome общий, rating и Poker IQ не меняются', () => {
  const env = createEnvironment();
  const before = env.progressSystem.getSnapshot();
  const challenge = challengeFor(env.dailySystem);
  env.dailySystem.submitAnswer(challenge.correctAction);
  const after = env.progressSystem.getSnapshot();
  const row = env.progressSystem.export().history[0];
  assert.equal(row.type, 'DAILY_CHALLENGE_COMPLETED');
  assert.equal(row.source, 'daily_challenge');
  assert.equal(row.metadata.outcome, 'correct');
  assert.equal(row.metadata.dateKey, TODAY_KEY);
  assert.equal(row.metadata.challengeId, challenge.id);
  assert.equal(row.metadata.scheduleVersion, 1);
  assert.equal(row.metadata.rewardVersion, 1);
  assert.equal('challenge' in row.metadata, false);
  assert.deepEqual(after.rank, before.rank);
  assert.deepEqual(after.pokerIq, before.pokerIq);
});

test('Daily Challenge не добавляет точку в существующую Poker IQ history', () => {
  const env = createEnvironment();
  env.progressSystem.recordEvent({
    id: 'rated-before-daily', type: 'TRAINING_DECISION_RECORDED', timestamp: NOW_ISO, source: 'training',
    payload: {
      localDate: TODAY_KEY,
      timezoneOffsetMinutes: 0,
      decisionRecord: {
        decisionId: 'rated-before-daily', date: NOW_ISO, street: 'river', decisionMode: 'TRAINING',
        trainerSnapshot: { confidence: 'high', isMarginal: false },
        decisionQuality: {
          schemaVersion: 1, score: 90, classification: 'EXCELLENT', confidence: 'high',
          isRated: true, evaluatedAt: NOW_ISO
        }
      }
    }
  });
  const before = env.progressSystem.getSnapshot();
  const beforeSeries = env.progressSystem.getAnalyticsSnapshot({ period: 'all', now: NOW_ISO, timezoneOffsetMinutes: 0 }).series.pokerIq;
  const challenge = challengeFor(env.dailySystem);
  env.dailySystem.submitAnswer(challenge.correctAction);
  const after = env.progressSystem.getSnapshot();
  const afterSeries = env.progressSystem.getAnalyticsSnapshot({ period: 'all', now: NOW_ISO, timezoneOffsetMinutes: 0 }).series.pokerIq;
  assert.deepEqual(after.pokerIq, before.pokerIq);
  assert.deepEqual(after.rank, before.rank);
  assert.deepEqual(afterSeries, beforeSeries);
  assert.equal(env.progressSystem.export().history[0].pokerIqAfter, null);
});

test('duplicate submit, review и reload не меняют XP, history или первый action', () => {
  const env = createEnvironment();
  const challenge = challengeFor(env.dailySystem);
  const first = env.dailySystem.submitAnswer(challenge.correctAction);
  const fixed = env.progressSystem.getSnapshot();
  const duplicate = env.dailySystem.submitAnswer(challenge.actions[0].actionClass);
  env.dailySystem.getReviewState();
  const reloaded = createEnvironment(env.storage.snapshot());
  const reloadStatus = reloaded.dailySystem.getTodayStatus();
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.completion.selectedAction, first.completion.selectedAction);
  assert.equal(reloaded.progressSystem.getSnapshot().lifetimeXp, fixed.lifetimeXp);
  assert.equal(reloaded.progressSystem.export().history.length, 1);
  assert.equal(reloadStatus.completion.progress.xpAwarded, 25);
});

test('crash window A: pending completion без event reconciles ровно один раз', () => {
  const seed = createEnvironment();
  const challenge = challengeFor(seed.dailySystem);
  seed.dailyStorage.saveCompletion(TODAY_KEY, completion(challenge));
  const recovered = createEnvironment(seed.storage.snapshot());
  const first = recovered.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  const second = recovered.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  assert.equal(first.recorded, 1);
  assert.equal(second.recorded, 0);
  assert.equal(recovered.progressSystem.getSnapshot().lifetimeXp, 25);
  assert.equal(recovered.progressSystem.export().history.length, 1);
  assert.equal(recovered.dailyStorage.getCompletion(TODAY_KEY).progress.status, 'recorded');
});

test('crash window B: accepted event без receipt reconciles duplicate и сохраняет receipt', () => {
  const env = createEnvironment();
  const challenge = challengeFor(env.dailySystem);
  const pending = completion(challenge);
  env.dailyStorage.saveCompletion(TODAY_KEY, pending);
  const direct = env.progressIntegration.completeDailyChallenge({ dateKey: TODAY_KEY, ...pending, ...challenge });
  assert.equal(direct.applied, true);
  assert.equal(env.dailyStorage.getCompletion(TODAY_KEY).progress.status, 'pending');
  const reconciled = env.dailyProgress.recordCompletionProgress(TODAY_KEY, env.dailyStorage.getCompletion(TODAY_KEY), challenge);
  assert.equal(reconciled.recorded, true);
  assert.equal(reconciled.duplicate, true);
  assert.equal(env.progressSystem.getSnapshot().lifetimeXp, 25);
  assert.equal(env.progressSystem.export().history.length, 1);
  assert.equal(env.dailyStorage.getCompletion(TODAY_KEY).progress.status, 'recorded');
});

test('schema v1 today мигрирует и получает reward один раз', () => {
  const challenge = DailyCatalog.getById('daily-river-aj-bluffcatch');
  const raw = JSON.stringify({ schemaVersion: 1, completions: {
    [TODAY_KEY]: { ...completion(challenge), progress: undefined }
  } });
  const env = createEnvironment({ [DailyStorage.STORAGE_KEY]: raw });
  env.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  env.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  assert.equal(env.progressSystem.getSnapshot().lifetimeXp, 25);
  assert.equal(env.progressSystem.export().history.length, 1);
  assert.equal(env.dailyStorage.load().schemaVersion, 2);
  assert.equal(env.dailyStorage.getCompletion(TODAY_KEY).selectedAction, challenge.correctAction);
  assert.equal(env.dailyStorage.getCompletion(TODAY_KEY).completedAt, NOW_ISO);
});

test('schema v1 past completion остаётся review и становится legacy_uncredited без XP/streak', () => {
  const challenge = DailyCatalog.getById('daily-river-aj-bluffcatch');
  const pastKey = '2026-08-03';
  const raw = JSON.stringify({ schemaVersion: 1, completions: {
    [pastKey]: { ...completion(challenge), completedAt: '2026-08-03T19:00:00.000Z', progress: undefined }
  } });
  const env = createEnvironment({ [DailyStorage.STORAGE_KEY]: raw });
  env.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  assert.equal(env.progressSystem.getSnapshot().lifetimeXp, 0);
  assert.equal(env.progressSystem.getSnapshot().streak.current, 0);
  assert.equal(env.dailyStorage.getCompletion(pastKey).progress.status, 'legacy_uncredited');
});

test('schema v1 today с валидным, но не назначенным challenge ID не получает reward', () => {
  const wrongChallenge = DailyCatalog.getById('daily-flop-kk-value');
  const raw = JSON.stringify({ schemaVersion: 1, completions: {
    [TODAY_KEY]: { ...completion(wrongChallenge), progress: undefined }
  } });
  const env = createEnvironment({ [DailyStorage.STORAGE_KEY]: raw });
  const status = env.dailySystem.getTodayStatus();
  assert.equal(status.status, 'unavailable');
  assert.equal(status.reason, 'COMPLETION_MISMATCH');
  assert.equal(env.progressSystem.getSnapshot().lifetimeXp, 0);
  assert.equal(env.progressSystem.export().history.length, 0);
});

test('progress failure сохраняет pending, блокирует второй ответ и безопасно повторяется позже', () => {
  available();
  const storage = new MemoryStorage();
  const dailyStorage = DailyStorage.create({ storage });
  const failedProgress = DailyProgress.create({
    storage: dailyStorage,
    progressIntegration: { completeDailyChallenge: () => ({ applied: false, reason: 'TEMPORARY_FAILURE' }) },
    now: () => TODAY
  });
  const system = DailySystem.create({ storage: dailyStorage, progress: failedProgress, now: () => TODAY });
  const challenge = challengeFor(system);
  const first = system.submitAnswer(challenge.correctAction);
  const duplicate = system.submitAnswer(challenge.actions[0].actionClass);
  assert.equal(first.accepted, true);
  assert.equal(first.completion.progress.status, 'pending');
  assert.equal(duplicate.duplicate, true);
  assert.equal(system.getTodayStatus().review.progressStatus, 'pending');
});

test('same-day Daily Challenge не увеличивает общий streak дважды, соседний день использует прежнюю формулу', () => {
  const system = ProgressSystem.create({ storage: null, now: () => NOW_ISO, createPlayerId: () => 'streak-daily' });
  system.recordEvent({
    id: 'lesson-same-day', type: 'LESSON_COMPLETED', timestamp: NOW_ISO, source: 'learning',
    payload: { lessonId: 'l1', localDate: TODAY_KEY, timezoneOffsetMinutes: 0 }
  });
  const integration = ProgressIntegration.create({ system, now: () => NOW_ISO, timezoneOffsetMinutes: () => 0 });
  integration.completeDailyChallenge({
    dateKey: TODAY_KEY, challengeId: 'daily-river-aj-bluffcatch', scheduleVersion: 1, rewardVersion: 1,
    selectedAction: 'CALL', correctAction: 'CALL', isCorrect: true, completedAt: NOW_ISO,
    street: 'river', difficulty: 'advanced'
  });
  assert.equal(system.getSnapshot().streak.current, 1);
  system.recordEvent({
    id: 'lesson-next-day', type: 'LESSON_COMPLETED', timestamp: '2026-08-05T19:00:00.000Z', source: 'learning',
    payload: { lessonId: 'l2', localDate: '2026-08-05', timezoneOffsetMinutes: 0 }
  });
  assert.equal(system.getSnapshot().streak.current, 2);
});

test('corrupted receipt безопасно становится pending и duplicate boundary предотвращает повторный XP', () => {
  const env = createEnvironment();
  const challenge = challengeFor(env.dailySystem);
  const first = env.dailySystem.submitAnswer(challenge.correctAction);
  const state = env.dailyStorage.load();
  state.completions[TODAY_KEY].progress = { status: 'recorded', eventId: 'wrong', xpAwarded: 999 };
  env.storage.setItem(DailyStorage.STORAGE_KEY, JSON.stringify(state));
  const recovered = createEnvironment(env.storage.snapshot());
  recovered.dailyProgress.reconcilePendingProgress(TODAY_KEY, id => DailyCatalog.getById(id));
  assert.equal(recovered.progressSystem.getSnapshot().lifetimeXp, 25);
  assert.equal(recovered.progressSystem.export().history.length, 1);
  assert.equal(recovered.dailyStorage.getCompletion(TODAY_KEY).progress.eventId, first.completion.progress.eventId);
  assert.equal(recovered.dailyStorage.getCompletion(TODAY_KEY).progress.xpAwarded, 25);
});

test('stored receipt сохраняет фактический XP независимо от последующего чтения policy', () => {
  const env = createEnvironment();
  const challenge = challengeFor(env.dailySystem);
  env.dailySystem.submitAnswer(challenge.correctAction);
  const receipt = env.dailyStorage.getCompletion(TODAY_KEY).progress;
  assert.equal(receipt.xpAwarded, 25);
  assert.equal(receipt.rewardVersion, 1);
  assert.equal(env.dailySystem.getTodayStatus().review.xpAwarded, 25);
});

test('HISTORY_LIMIT и ProgressSystem schema остаются без изменений', () => {
  assert.equal(ProgressConfig.SCHEMA_VERSION, 3);
  assert.equal(ProgressConfig.HISTORY_LIMIT, 2000);
});
