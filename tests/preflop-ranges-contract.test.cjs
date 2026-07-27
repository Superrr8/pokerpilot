'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');
const {
  RANGE_NAMES,
  loadPreflopRanges
} = require('./preflop-ranges-loader.cjs');

const C = loadPokerCore();
const ranges = loadPreflopRanges();
const EXPECTED_CONTENT_SHA256 =
  'f9f445e9ef961414a2befffdf9aba32cd1af381ce931ec4c47d78a08c81f9eac';

test('контракт сохраняет пять имён и 20 статических префлоп-диапазонов', () => {
  assert.deepEqual(Object.keys(ranges), RANGE_NAMES);
  assert.equal(
    Object.values(ranges).reduce(
      (count, structure) => count + Object.keys(structure).length,
      0
    ),
    20
  );
});

test('позиции и категории диапазонов сохраняют допустимый состав и порядок', () => {
  assert.deepEqual(
    Object.keys(ranges.OPEN_RANGES),
    ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB']
  );
  assert.deepEqual(
    Object.keys(ranges.ISO_RANGES),
    ['UTG', 'MP', 'HJ', 'CO', 'BTN', 'SB']
  );
  for (const name of ['DEFEND_VS_EARLY', 'DEFEND_VS_LATE', 'VS_3BET']) {
    assert.deepEqual(Object.keys(ranges[name]), ['raise', 'call'], name);
  }

  const validPositions = new Set([
    'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'
  ]);
  for (const name of ['OPEN_RANGES', 'ISO_RANGES']) {
    for (const position of Object.keys(ranges[name])) {
      assert.ok(validPositions.has(position), `${name}: ${position}`);
      assert.notEqual(position, 'BB', `${name}: BB cannot open or isolate`);
    }
  }
});

test('все токены рук, строки диапазонов и их порядок неизменны', () => {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(ranges))
    .digest('hex');
  assert.equal(digest, EXPECTED_CONTENT_SHA256);

  for (const [structureName, structure] of Object.entries(ranges)) {
    for (const [key, text] of Object.entries(structure)) {
      assert.ok(C.expandRange(text).size > 0, `${structureName}.${key}`);
    }
  }
});

test('раскрытие пар, suited, offsuit и диапазонов с + остаётся корректным', () => {
  assert.equal(C.rangeCombos('AA').length, 6);
  assert.equal(C.rangeCombos('AKs').length, 4);
  assert.equal(C.rangeCombos('AKo').length, 12);
  assert.deepEqual(
    Array.from(C.expandRange('QQ+')).sort(),
    ['AA', 'KK', 'QQ']
  );
  assert.deepEqual(
    Array.from(C.expandRange('AJs+')).sort(),
    ['AJs', 'AKs', 'AQs']
  );
  assert.deepEqual(
    Array.from(C.expandRange('22-JJ')).sort(),
    ['22', '33', '44', '55', '66', '77', '88', '99', 'JJ', 'TT']
  );
});

test('занятые карты исключаются из комбинаций диапазона', () => {
  const cards = text => text.split(' ').map(C.parseCard);
  assert.equal(C.rangeCombos('AJs', cards('As')).length, 3);
  assert.equal(C.rangeCombos('AA', cards('As Ah')).length, 1);
  for (const combo of C.rangeCombos('AKo', cards('As Kd'))) {
    const keys = combo.map(card => `${card.r}${card.s}`);
    assert.ok(!keys.includes('14s'), JSON.stringify(combo));
    assert.ok(!keys.includes('13d'), JSON.stringify(combo));
  }
});
