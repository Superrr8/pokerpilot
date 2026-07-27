'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');
const { loadMultiwayEquity } = require('./app-function-loader.cjs');

const C = loadPokerCore();
const cards = text => text.split(/\s+/).map(C.parseCard);
const plain = value => JSON.parse(JSON.stringify(value));
const closeTo = (actual, expected, epsilon = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
};
const seededRandom = seed => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

test('best7 выбирает старший фулл-хаус из двух сетов', () => {
  assert.deepEqual(
    Array.from(C.best7(cards('As Ad Ac Kh Kd Kc 2s'))),
    [6, 14, 13]
  );
});

test('best7 выбирает две старшие пары и лучший кикер из трёх пар', () => {
  assert.deepEqual(
    Array.from(C.best7(cards('As Ad Kh Kd Qc Qd Js'))),
    [2, 14, 13, 12]
  );
});

test('best7 выбирает пять старших карт из шести карт одной масти', () => {
  assert.deepEqual(
    Array.from(C.best7(cards('As Ks 9s 7s 5s 3s 2d'))),
    [5, 14, 13, 9, 7, 5]
  );
});

test('best7 предпочитает стрит до шестёрки колесу', () => {
  assert.deepEqual(
    Array.from(C.best7(cards('As 2d 3c 4h 5s 6d Kc'))),
    [4, 6]
  );
});

test('rangeCombos даёт стандартное число комбинаций парного диапазона', () => {
  assert.equal(C.rangeCombos('TT+').length, 30);
});

test('rangeCombos даёт стандартное число suited и offsuit комбинаций', () => {
  assert.equal(C.rangeCombos('AKs').length, 4);
  assert.equal(C.rangeCombos('AKo').length, 12);
});

test('rangeCombos применяет suited плюс без дублирования классов', () => {
  assert.equal(C.rangeCombos('AQs+').length, 8);
  assert.equal(C.rangeCombos('AA,AA').length, 6);
});

test('rangeCombos исключает блокеры героя и доски', () => {
  assert.equal(C.rangeCombos('AJs', cards('As 2d 3c')).length, 3);
  assert.equal(C.rangeCombos('AA', cards('As Ah')).length, 1);
});

test('potMath различает ставку соперника и оставшуюся сумму колла', () => {
  const result = C.potMath({ potBefore: 120, bet: 60, call: 40 });
  assert.deepEqual(
    plain(result),
    {
      potBefore: 120,
      bet: 60,
      call: 40,
      potNow: 180,
      finalPot: 220,
      requiredEquity: 40 / 220
    }
  );
});

test('callEV возвращает положительный EV при equity выше required equity', () => {
  const result = C.callEV({
    equity: 0.3,
    potBefore: 120,
    bet: 60,
    call: 40
  });
  closeTo(result.ev, 26);
});

test('callEV возвращает нулевой EV на пороге required equity', () => {
  const requiredEquity = 40 / 220;
  const result = C.callEV({
    equity: requiredEquity,
    potBefore: 120,
    bet: 60,
    call: 40
  });
  closeTo(result.ev, 0);
});

test('equityVsRange точно перебирает все риверы с тёрна', () => {
  const result = C.equityVsRange({
    hero: cards('As Ad'),
    board: cards('Ah Kc 2d 3s'),
    range: 'KK'
  });
  assert.equal(result.exact, true);
  assert.equal(result.samples, 132);
  assert.equal(result.win, 129 / 132);
  assert.equal(result.lose, 3 / 132);
  assert.equal(result.equity, 43 / 44);
});

test('equityVsRange точно перебирает диапазон на готовом ривере', () => {
  const result = C.equityVsRange({
    hero: cards('As Ks'),
    board: cards('Qs Js Ts 2d 3c'),
    range: 'QQ,JJ'
  });
  assert.equal(result.exact, true);
  assert.equal(result.samples, 6);
  assert.equal(result.equity, 1);
});

test('Monte Carlo equity воспроизводится с фиксированным seed', () => {
  const run = () => {
    const rng = seededRandom(0xC0FFEE);
    const core = loadPokerCore({ random: rng });
    return plain(core.equityVsRange({
      hero: cards('As Ks'),
      board: cards('Qs 7s 2d'),
      range: '22+,AJs+,KQs,AQo+',
      trials: 2_000,
      exactLimit: 0,
      rng
    }));
  };
  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.equal(first.method, 'montecarlo');
  assert.equal(first.samples, 2_000);
});

test('multiway equity делит общий банк между тремя игроками при общей руке', () => {
  const rng = seededRandom(12345);
  const core = loadPokerCore({ random: rng });
  const multiwayEquity = loadMultiwayEquity({ core, random: rng });
  const result = multiwayEquity({
    hero: cards('2c 3d'),
    board: cards('As Ks Qs Js Ts'),
    range: '44,55,66',
    opponents: 2,
    trials: 400
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.samples, 234);
  assert.equal(result.tie, 1);
  closeTo(result.equity, 1 / 3);
});

test('multiway Monte Carlo воспроизводится с фиксированным seed', () => {
  const run = () => {
    const rng = seededRandom(987654321);
    const core = loadPokerCore({ random: rng });
    const multiwayEquity = loadMultiwayEquity({ core, random: rng });
    return plain(multiwayEquity({
      hero: cards('As Ks'),
      board: cards('Qs 7s 2d'),
      range: '22+,AJs+,KQs,AQo+',
      opponents: 2,
      trials: 500,
      rng
    }));
  };
  assert.deepEqual(run(), run());
});

test('analyzeOuts классифицирует натсовое флеш-дро и оверкарты', () => {
  const result = C.analyzeOuts(cards('As Ks'), cards('Qs 7s 2d'));
  assert.equal(result.strongOuts, 9);
  assert.equal(result.conditionalOuts, 6);
  assert.equal(result.rawOuts, 15);
  closeTo(result.strongNextCard, 9 / 47);
  closeTo(result.strongByRiver, 1 - (38 / 47) * (37 / 46));
});

test('analyzeOuts не считает дважды ауты двустороннего стрит-дро', () => {
  const result = C.analyzeOuts(cards('8s 7d'), cards('6c 5h Ks'));
  assert.equal(result.strongOuts, 8);
  assert.equal(result.conditionalOuts, 0);
  assert.equal(result.groups.find(group => group.key === 'straight').outs, 8);
});

test('parseCard отклоняет неверный ранг и неверную масть', () => {
  assert.throws(() => C.parseCard('1s'), /Invalid card/);
  assert.throws(() => C.parseCard('Aq'), /Invalid card/);
});

test('eval5 и best7 отклоняют неверное количество карт', () => {
  assert.throws(() => C.eval5(cards('As Ks Qs Js')), /exactly 5 cards/);
  assert.throws(() => C.best7(cards('As Ks Qs Js')), /5 to 7 cards/);
  assert.throws(() => C.best7(cards('As Ks Qs Js Ts 9d 8c 7h')), /5 to 7 cards/);
});

test('диапазоны отклоняют неподдерживаемый и перевёрнутый формат', () => {
  assert.throws(() => C.expandRange('AK'), /Unsupported range token/);
  assert.throws(() => C.expandRange('KAs'), /high-card first/);
});

test('операции с руками отклоняют повторяющиеся карты', () => {
  assert.throws(() => C.eval5(cards('As As Qs Js Ts')), /Duplicate card/);
  assert.throws(
    () => C.equityVsRange({
      hero: cards('As Ks'),
      board: cards('As Qs Js'),
      range: 'QQ'
    }),
    /Duplicate card/
  );
});
