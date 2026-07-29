'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRecords, STREETS } = require('./fixtures/poker-iq-fixtures.cjs');
require('../src/poker-iq/poker-iq-config.js');
const PokerIQ = require('../src/poker-iq/poker-iq-engine.js');

function append(records, score, overrides = {}) {
  return [...records, ...makeRecords(1, {
    score,
    streets: STREETS,
    start: Date.UTC(2027, 0, records.length + 1),
    ...overrides
  })];
}

test('established player: одно excellent решение даёт небольшой рост', () => {
  const records = makeRecords(100, { score: 80, streets: STREETS });
  const delta = PokerIQ.evaluate(append(records, 100)).score - PokerIQ.evaluate(records).score;
  assert.ok(delta >= 0 && delta <= 8, delta);
});

test('established player: один blunder даёт небольшое снижение', () => {
  const records = makeRecords(100, { score: 80, streets: STREETS });
  const delta = PokerIQ.evaluate(append(records, 0)).score - PokerIQ.evaluate(records).score;
  assert.ok(delta <= 0 && delta >= -12, delta);
});

test('provisional player двигается заметнее established', () => {
  const provisional = makeRecords(3, { score: 80 });
  const established = makeRecords(100, { score: 80, streets: STREETS });
  const provisionalDelta = Math.abs(PokerIQ.evaluate(append(provisional, 100)).score - PokerIQ.evaluate(provisional).score);
  const establishedDelta = Math.abs(PokerIQ.evaluate(append(established, 100)).score - PokerIQ.evaluate(established).score);
  assert.ok(provisionalDelta > establishedDelta);
});

test('десять excellent решений дают умеренный рост', () => {
  const records = makeRecords(100, { score: 80, streets: STREETS });
  const next = [...records, ...makeRecords(10, { score: 100, streets: STREETS, start: Date.UTC(2027, 0, 1) })];
  const delta = PokerIQ.evaluate(next).score - PokerIQ.evaluate(records).score;
  assert.ok(delta > 0 && delta < 100, delta);
});

test('десять blunders дают умеренное снижение', () => {
  const records = makeRecords(100, { score: 80, streets: STREETS });
  const next = [...records, ...makeRecords(10, { score: 0, streets: STREETS, start: Date.UTC(2027, 0, 1) })];
  const delta = PokerIQ.evaluate(next).score - PokerIQ.evaluate(records).score;
  assert.ok(delta < 0 && delta > -150, delta);
});

test('одна экстремальная оценка не ломает рейтинг', () => {
  const result = PokerIQ.evaluate(append(makeRecords(100, { score: 85, streets: STREETS }), 0));
  assert.ok(result.score >= 1000 && result.score <= 3000);
});

test('разница стабильного и волатильного профиля разумно ограничена', () => {
  const stable = PokerIQ.evaluate(makeRecords(100, { score: 90, streets: STREETS }));
  const volatile = PokerIQ.evaluate(makeRecords(100, { scores: [100, 80], streets: STREETS }));
  assert.ok(stable.score > volatile.score);
  assert.ok(stable.score - volatile.score <= 80);
});

test('profit/loss не меняет Poker IQ', () => {
  const records = makeRecords(40, { score: 85, streets: STREETS });
  const changed = records.map((record, index) => ({ ...record, profit: index % 2 ? 1000 : -1000 }));
  assert.deepEqual(PokerIQ.evaluate(records), PokerIQ.evaluate(changed));
});

test('board runout/result не меняет Poker IQ', () => {
  const records = makeRecords(40, { score: 85, streets: STREETS });
  const changed = records.map(record => ({ ...record, winner: 'Hero', result: 'won', board: ['As', 'Ks', 'Qs', 'Js', '10s'] }));
  assert.deepEqual(PokerIQ.evaluate(records), PokerIQ.evaluate(changed));
});

test('serialization/reload не меняет Poker IQ', () => {
  const records = makeRecords(40, { score: 85, streets: STREETS });
  assert.deepEqual(PokerIQ.evaluate(records), PokerIQ.evaluate(JSON.parse(JSON.stringify(records))));
});
