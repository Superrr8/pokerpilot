'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRecords } = require('./fixtures/poker-iq-fixtures.cjs');
require('../src/poker-iq/poker-iq-config.js');
require('../src/poker-iq/poker-iq-engine.js');
const Stats = require('../src/poker-iq/poker-iq-stats.js');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data)
  };
}

test('corrupt cache безопасно игнорируется', () => {
  const storage = memoryStorage({ [Stats.STORAGE_KEY]: '{broken' });
  assert.ok(Number.isFinite(Stats.create({ storage }).getSummary(makeRecords(30)).score));
});

test('cache инвалидируется при смене modelVersion', () => {
  const storage = memoryStorage({ [Stats.STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, modelVersion: 'old', sourceFingerprint: 'x', summary: { score: 2999 } }) });
  assert.notEqual(Stats.create({ storage }).getSummary(makeRecords(30)).score, 2999);
});

test('cache инвалидируется при изменении источника', () => {
  const storage = memoryStorage();
  const stats = Stats.create({ storage });
  const first = stats.getSummary(makeRecords(30, { score: 70 }));
  const second = stats.getSummary(makeRecords(30, { score: 90 }));
  assert.notEqual(first.score, second.score);
});

test('одинаковый source fingerprint использует тот же summary', () => {
  const storage = memoryStorage();
  const stats = Stats.create({ storage });
  const records = makeRecords(30);
  assert.deepEqual(stats.getSummary(records), stats.getSummary(structuredClone(records)));
});

test('localStorage unavailable не ломает вычисление', () => {
  assert.ok(Number.isFinite(Stats.create({ storage: null }).getSummary(makeRecords(30)).score));
});

test('quota error не ломает вычисление', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const stats = Stats.create({ storage });
  assert.ok(Number.isFinite(stats.getSummary(makeRecords(30)).score));
  assert.equal(stats.getStatus().persisted, false);
});
