'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../src/daily/daily-challenge-storage.js');
const System = require('../src/daily/daily-challenge-system.js');

const TODAY = new Date(2026, 7, 4, 12, 0);

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); this.operations = []; }
  getItem(key) { this.operations.push(['getItem', key]); return this.values.get(key) ?? null; }
  setItem(key, value) { this.operations.push(['setItem', key]); this.values.set(key, String(value)); }
  snapshot() { return Object.fromEntries(this.values); }
}

function create(initial = {}) {
  const localStorage = new MemoryStorage(initial);
  const storage = Storage.create({ storage: localStorage });
  const system = System.create({ storage, now: () => TODAY });
  return { localStorage, storage, system };
}

test('пустой storage создаёт clean versioned state', () => {
  const { storage } = create();
  assert.deepEqual(storage.load(), { schemaVersion: 2, completions: {} });
});

test('повреждённый JSON безопасно восстанавливается', () => {
  const { storage } = create({ [Storage.STORAGE_KEY]: '{broken' });
  assert.deepEqual(storage.load(), { schemaVersion: 2, completions: {} });
});

test('partial invalid completion игнорируется', () => {
  const raw = JSON.stringify({ schemaVersion: 1, completions: { '2026-08-04': { challengeId: 'unknown' } } });
  const { storage } = create({ [Storage.STORAGE_KEY]: raw });
  assert.deepEqual(storage.load().completions, {});
});

test('до submission system не раскрывает правильный ответ и explanation', () => {
  const { system } = create();
  const status = system.getTodayStatus();
  assert.equal(status.status, 'new');
  assert.ok(status.challenge);
  assert.equal('correctAction' in status.challenge, false);
  assert.equal('acceptedActions' in status.challenge, false);
  assert.equal('explanation' in status.challenge, false);
});

test('валидный correct answer сохраняется один раз', () => {
  const { system, storage } = create();
  const challenge = system.getTodayChallenge();
  const result = system.submitAnswer(challenge.correctAction);
  assert.equal(result.accepted, true);
  assert.equal(result.completion.isCorrect, true);
  assert.deepEqual(storage.getCompletion('2026-08-04'), result.completion);
});

test('incorrect answer определяется и сохраняется правильно', () => {
  const { system } = create();
  const challenge = system.getTodayChallenge();
  const wrong = challenge.actions.find(action => action.actionClass !== challenge.correctAction).actionClass;
  const result = system.submitAnswer(wrong);
  assert.equal(result.accepted, true);
  assert.equal(result.completion.isCorrect, false);
  assert.equal(result.completion.selectedAction, wrong);
});

test('completion блокирует второй результат и сохраняет первый action', () => {
  const { system } = create();
  const challenge = system.getTodayChallenge();
  const firstAction = challenge.actions[0].actionClass;
  const secondAction = challenge.actions.at(-1).actionClass;
  const first = system.submitAnswer(firstAction);
  const duplicate = system.submitAnswer(secondAction);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.completion.selectedAction, first.completion.selectedAction);
});

test('refresh восстанавливает read-only review', () => {
  const first = create();
  const challenge = first.system.getTodayChallenge();
  first.system.submitAnswer(challenge.correctAction);
  const refreshed = create(first.localStorage.snapshot());
  const status = refreshed.system.getTodayStatus();
  assert.equal(status.status, 'completed');
  assert.equal(status.review.readOnly, true);
  assert.equal(status.review.correctAction, challenge.correctAction);
  assert.ok(status.review.explanation);
});

test('storage duplicate submit не создаёт вторую запись', () => {
  const { system, storage } = create();
  const challenge = system.getTodayChallenge();
  system.submitAnswer(challenge.actions[0].actionClass);
  system.submitAnswer(challenge.actions.at(-1).actionClass);
  assert.equal(Object.keys(storage.load().completions).length, 1);
});

test('неизвестное или невозможное действие отклоняется без записи', () => {
  const { system, storage } = create();
  assert.equal(system.submitAnswer('DANCE').reason, 'INVALID_ACTION');
  assert.equal(Object.keys(storage.load().completions).length, 0);
});

test('другие localStorage keys не изменяются', () => {
  const initial = {
    pokerpilot_v1_6_progress: '{"decisions":12}',
    pokerpilot_progress_system: '{"schemaVersion":3,"lifetimeXp":500}',
    unrelated: 'keep'
  };
  const { system, localStorage } = create(initial);
  system.submitAnswer(system.getTodayChallenge().actions[0].actionClass);
  const snapshot = localStorage.snapshot();
  Object.entries(initial).forEach(([key, value]) => assert.equal(snapshot[key], value));
});

test('submission не изменяет XP, rating, Poker IQ, streak, history или analytics source', () => {
  const progress = JSON.stringify({
    schemaVersion: 3, lifetimeXp: 525, rating: 1770, pokerIQ: 1688,
    streak: { current: 4, best: 8 }, history: [{ eventId: 'existing' }], achievements: { keep: true }
  });
  const { system, localStorage } = create({ pokerpilot_progress_system: progress });
  system.submitAnswer(system.getTodayChallenge().actions[0].actionClass);
  assert.equal(localStorage.snapshot().pokerpilot_progress_system, progress);
});

test('один update storage вызывает только одну запись daily key', () => {
  const { system, localStorage } = create();
  system.submitAnswer(system.getTodayChallenge().actions[0].actionClass);
  const writes = localStorage.operations.filter(([operation, key]) => operation === 'setItem' && key === Storage.STORAGE_KEY);
  assert.equal(writes.length, 1);
});
