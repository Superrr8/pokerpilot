'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');

const C = loadPokerCore();
const cards = text => text.split(/\s+/).map(C.parseCard);
const closeTo = (actual, expected, epsilon = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
};

const fiveCardCategories = [
  ['старшая карта', 'As Kd 9c 6h 3s', 0, 'Старшая карта'],
  ['пара', 'As Ad 9c 6h 3s', 1, 'Пара'],
  ['две пары', 'As Ad 9c 9h 3s', 2, 'Две пары'],
  ['сет', 'As Ad Ac 6h 3s', 3, 'Сет'],
  ['стрит', '9s 8d 7c 6h 5s', 4, 'Стрит'],
  ['флеш', 'As Js 9s 6s 3s', 5, 'Флеш'],
  ['фулл-хаус', 'As Ad Ac 6h 6s', 6, 'Фулл-хаус'],
  ['каре', 'As Ad Ac Ah 3s', 7, 'Каре'],
  ['стрит-флеш', '9s 8s 7s 6s 5s', 8, 'Стрит-флеш']
];

for (const [label, input, category, name] of fiveCardCategories) {
  test(`eval5 распознаёт: ${label}`, () => {
    const result = C.eval5(cards(input));
    assert.equal(result[0], category);
    assert.equal(C.handName(result), name);
  });
}

test('eval5 распознаёт младший стрит A-2-3-4-5 с пятёркой старшей', () => {
  assert.deepEqual(Array.from(C.eval5(cards('As 2d 3c 4h 5s'))), [4, 5]);
});

test('eval5 распознаёт бродвей 10-J-Q-K-A с тузом старшим', () => {
  assert.deepEqual(Array.from(C.eval5(cards('Ts Jd Qc Kh As'))), [4, 14]);
});

test('best7 выбирает лучшие пять карт из семи', () => {
  const result = C.best7(cards('As Ks Qs Js Ts 2d 2c'));
  assert.deepEqual(Array.from(result), [8, 14]);
});

test('два разных фулл-хауса сравниваются сначала по сету', () => {
  const acesFull = C.eval5(cards('As Ad Ac Kh Ks'));
  const kingsFull = C.eval5(cards('Kc Kd Kh Ah As'));
  assert.equal(C.compareEval(acesFull, kingsFull), 1);
});

test('два разных флеша сравниваются по старшим картам', () => {
  const aceHigh = C.eval5(cards('As Js 9s 6s 3s'));
  const kingHigh = C.eval5(cards('Kh Jh 9h 6h 3h'));
  assert.equal(C.compareEval(aceHigh, kingHigh), 1);
});

test('одинаковые пары сравниваются по кикерам', () => {
  const kingKicker = C.eval5(cards('As Ad Kh 7c 3s'));
  const queenKicker = C.eval5(cards('Ac Ah Qh 7d 3c'));
  assert.equal(C.compareEval(kingKicker, queenKicker), 1);
});

test('полностью одинаковые по силе комбинации дают точную ничью', () => {
  const hearts = C.eval5(cards('Ah Kd Qc Js Ts'));
  const spades = C.eval5(cards('As Kh Qd Jc Th'));
  assert.equal(C.compareEval(hearts, spades), 0);
});

test('PokerCore отклоняет невозможные повторяющиеся карты', () => {
  const duplicateError = /duplicate card/i;
  assert.throws(() => C.eval5(cards('As As Qc Jh Ts')), duplicateError);
  assert.throws(() => C.best7(cards('As As Qc Jh Ts 9d 8c')), duplicateError);
  assert.throws(() => C.handClass(cards('As As')), duplicateError);
  assert.throws(() => C.removeKnown(C.fullDeck(), cards('As As')), duplicateError);
  assert.throws(() => C.rangeCombos('AA', cards('As As')), duplicateError);
  assert.throws(
    () => C.analyzeOuts(cards('As Ks'), cards('As Qs Js')),
    duplicateError
  );
  assert.throws(
    () => C.equityVsRange({
      hero: cards('As Ks'),
      board: cards('As Qs Js Ts 2d'),
      range: 'QQ'
    }),
    duplicateError
  );
});

test('potMath считает pot odds и required equity', () => {
  const result = C.potMath({ potBefore: 100, bet: 50, call: 50 });
  assert.deepEqual(
    {
      potNow: result.potNow,
      finalPot: result.finalPot,
      requiredEquity: result.requiredEquity
    },
    { potNow: 150, finalPot: 200, requiredEquity: 0.25 }
  );
});

test('callEV считает EV колла относительно фолда', () => {
  const result = C.callEV({
    equity: 0.4,
    potBefore: 100,
    bet: 50,
    call: 50
  });
  assert.equal(result.ev, 30);
});

test('exactHitProbability считает попадание на следующей карте', () => {
  closeTo(C.exactHitProbability(9, 47, 1), 9 / 47);
});

test('exactHitProbability считает попадание к риверу с флопа', () => {
  const expected = 1 - (38 / 47) * (37 / 46);
  closeTo(C.exactHitProbability(9, 47, 2), expected);
});

test('equityVsRange точно считает гарантированную победу на готовой доске', () => {
  const result = C.equityVsRange({
    hero: cards('As Ks'),
    board: cards('Qs Js Ts 2d 3c'),
    range: 'QQ'
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.samples, 3);
  assert.equal(result.equity, 1);
  assert.equal(result.win, 1);
});

test('equityVsRange точно считает общую комбинацию на доске как ничью', () => {
  const result = C.equityVsRange({
    hero: cards('2c 3d'),
    board: cards('As Ks Qs Js Ts'),
    range: '44'
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.samples, 6);
  assert.equal(result.equity, 0.5);
  assert.equal(result.tie, 1);
});

test('expandRange раскрывает карманную пару с плюсом', () => {
  assert.deepEqual(
    [...C.expandRange('QQ+')].sort(),
    ['AA', 'KK', 'QQ']
  );
});

test('rangeCombos создаёт четыре suited-комбинации', () => {
  assert.equal(C.rangeCombos('AJs').length, 4);
  assert.ok(C.rangeCombos('AJs').every(combo => combo[0].s === combo[1].s));
});

test('rangeCombos создаёт двенадцать offsuit-комбинаций', () => {
  assert.equal(C.rangeCombos('AJo').length, 12);
  assert.ok(C.rangeCombos('AJo').every(combo => combo[0].s !== combo[1].s));
});

test('expandRange раскрывает непарный suited-диапазон с плюсом', () => {
  assert.deepEqual(
    [...C.expandRange('AJs+')].sort(),
    ['AJs', 'AKs', 'AQs']
  );
});

test('rangeCombos исключает уже занятую карту', () => {
  const combos = C.rangeCombos('AJs', cards('As'));
  assert.equal(combos.length, 3);
  assert.ok(combos.every(combo => combo.every(card => C.cardId(card) !== '14s')));
});
