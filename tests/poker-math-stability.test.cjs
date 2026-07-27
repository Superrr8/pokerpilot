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

function exactHeadsUpOracle({ hero, board, range }) {
  const known = [...hero, ...board];
  const villains = C.rangeCombos(range, known);
  const missing = 5 - board.length;
  let wins = 0;
  let ties = 0;
  let losses = 0;
  let samples = 0;

  for (const villain of villains) {
    const deck = C.removeKnown(C.fullDeck(), [...known, ...villain]);
    const runouts = missing === 0
      ? [[]]
      : missing === 1
        ? deck.map(card => [card])
        : C.combinations(deck, 2);
    for (const runout of runouts) {
      const heroEval = C.best7([...hero, ...board, ...runout]);
      const villainEval = C.best7([...villain, ...board, ...runout]);
      const comparison = C.compareEval(heroEval, villainEval);
      if (comparison > 0) wins += 1;
      else if (comparison === 0) ties += 1;
      else losses += 1;
      samples += 1;
    }
  }
  return {
    equity: (wins + ties * 0.5) / samples,
    win: wins / samples,
    tie: ties / samples,
    lose: losses / samples,
    samples
  };
}

test('pot odds и required equity используют сумму оставшегося колла', () => {
  const result = C.potMath({ potBefore: 90, bet: 60, call: 40 });
  assert.equal(result.potNow, 150);
  assert.equal(result.finalPot, 190);
  closeTo(result.requiredEquity, 40 / 190);
});

test('EV колла положителен выше порога required equity', () => {
  const result = C.callEV({
    equity: 0.3,
    potBefore: 90,
    bet: 60,
    call: 40
  });
  closeTo(result.ev, 17);
});

test('EV колла отрицателен ниже порога required equity', () => {
  const result = C.callEV({
    equity: 0.15,
    potBefore: 90,
    bet: 60,
    call: 40
  });
  closeTo(result.ev, -11.5);
});

test('натсовое флеш-дро имеет девять strong outs', () => {
  const result = C.analyzeOuts(cards('As 9s'), cards('Ks 4s 2d'));
  assert.equal(result.strongOuts, 9);
  assert.equal(result.conditionalOuts, 3);
  assert.equal(result.rawOuts, 12);
  assert.equal(result.groups.find(group => group.key === 'flush').quality, 'strong');
});

test('ненатсовое флеш-дро имеет девять conditional outs', () => {
  const result = C.analyzeOuts(cards('9s 8s'), cards('Ks 4s 2d'));
  assert.equal(result.strongOuts, 0);
  assert.equal(result.conditionalOuts, 9);
  assert.equal(result.rawOuts, 9);
  assert.equal(result.groups.find(group => group.key === 'flush').quality, 'conditional');
});

test('открытый стрит-дро имеет восемь уникальных strong outs', () => {
  const result = C.analyzeOuts(cards('8s 7d'), cards('6c 5h Ks'));
  assert.equal(result.strongOuts, 8);
  assert.equal(result.rawOuts, 8);
});

test('gutshot имеет четыре strong outs', () => {
  const result = C.analyzeOuts(cards('Ah Kh'), cards('Qd Js 4c'));
  assert.equal(result.strongOuts, 4);
  assert.equal(result.conditionalOuts, 6);
  assert.equal(result.rawOuts, 10);
});

test('combo draw объединяет пересекающиеся flush и straight outs', () => {
  const result = C.analyzeOuts(cards('Js Ts'), cards('9s 8d 2s'));
  assert.equal(result.strongOuts, 8);
  assert.equal(result.conditionalOuts, 13);
  assert.equal(result.rawOuts, 21);
});

test('аут, завершающий сразу flush и straight, не считается дважды', () => {
  const result = C.analyzeOuts(cards('Js Ts'), cards('9s 8d 2s'));
  const grouped = result.groups
    .filter(group => group.key === 'flush' || group.key === 'straight')
    .reduce((sum, group) => sum + group.outs, 0);
  assert.equal(grouped, 17);
  assert.equal(result.rawOuts, 21);
  assert.equal(
    result.rawOuts,
    result.strongOuts + result.conditionalOuts + (result.dirtyOuts || 0)
  );
});

test('флеш-ауты на парной доске классифицируются как dirty', () => {
  const result = C.analyzeOuts(cards('Ks Qs'), cards('As Ah 2s'));
  assert.equal(result.strongOuts, 0);
  assert.equal(result.conditionalOuts, 0);
  assert.equal(result.dirtyOuts, 9);
  assert.equal(result.rawOuts, 9);
  assert.equal(result.groups.find(group => group.key === 'flush').quality, 'dirty');
});

test('dirty out может усилить героя до флеша, но оставить позади фулл-хауса', () => {
  const hero = cards('Ks Qs');
  const board = cards('As Ah 2s 3s');
  const villain = cards('Ac 2d');
  const heroEval = C.best7([...hero, ...board]);
  const villainEval = C.best7([...villain, ...board]);
  assert.equal(C.handName(heroEval), 'Флеш');
  assert.equal(C.handName(villainEval), 'Фулл-хаус');
  assert.equal(C.compareEval(heroEval, villainEval), -1);
});

test('вероятности strong outs точны на следующей карте и к риверу', () => {
  const result = C.analyzeOuts(cards('8s 7d'), cards('6c 5h Ks'));
  closeTo(result.strongNextCard, 8 / 47);
  closeTo(result.strongByRiver, 1 - (39 / 47) * (38 / 46));
});

test('turn equity совпадает с независимым точным перебором одной карты', () => {
  const input = {
    hero: cards('As Ad'),
    board: cards('Ah Kc 2d 3s'),
    range: 'KK'
  };
  const expected = exactHeadsUpOracle(input);
  const actual = C.equityVsRange(input);
  assert.equal(actual.method, 'exact');
  assert.deepEqual(
    plain({
      equity: actual.equity,
      win: actual.win,
      tie: actual.tie,
      lose: actual.lose,
      samples: actual.samples
    }),
    expected
  );
});

test('flop equity совпадает с независимым точным перебором двух карт', () => {
  const input = {
    hero: cards('As Ks'),
    board: cards('Qs 7s 2d'),
    range: 'QQ'
  };
  const expected = exactHeadsUpOracle(input);
  const actual = C.equityVsRange(input);
  assert.equal(actual.method, 'exact');
  assert.deepEqual(
    plain({
      equity: actual.equity,
      win: actual.win,
      tie: actual.tie,
      lose: actual.lose,
      samples: actual.samples
    }),
    expected
  );
});

test('heads-up equity учитывает блокеры при точном переборе', () => {
  const result = C.equityVsRange({
    hero: cards('As Ks'),
    board: cards('Qs Js Ts 2d 3c'),
    range: 'QQ,JJ,TT'
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.combos, 9);
  assert.equal(result.equity, 1);
});

test('точная ничья даёт equity 50 процентов', () => {
  const result = C.equityVsRange({
    hero: cards('2c 3d'),
    board: cards('As Ks Qs Js Ts'),
    range: '44'
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.tie, 1);
  assert.equal(result.equity, 0.5);
});

test('быстрый multiway river рассчитывается точным перебором', () => {
  const rng = seededRandom(1234);
  const core = loadPokerCore({ random: rng });
  const multiwayEquity = loadMultiwayEquity({ core, random: rng });
  const result = multiwayEquity({
    hero: cards('2c 3d'),
    board: cards('As Ks Qs Js Ts'),
    range: '44,55',
    opponents: 2,
    trials: 500,
    rng
  });
  assert.equal(result.method, 'exact');
  assert.equal(result.exact, true);
  assert.equal(result.tie, 1);
  closeTo(result.equity, 1 / 3);
  assert.equal(result.stderr, 0);
  assert.equal(result.ci95, 0);
});

test('Monte Carlo принимает seeded RNG и сообщает статистическую неопределённость', () => {
  const input = {
    hero: cards('As Ks'),
    board: cards('Qs 7s 2d'),
    range: 'QQ'
  };
  const exact = C.equityVsRange({ ...input, exactLimit: Number.MAX_SAFE_INTEGER });
  const run = () => {
    const rng = seededRandom(20260303);
    return plain(C.equityVsRange({
      ...input,
      trials: 8_000,
      exactLimit: 0,
      rng
    }));
  };
  const first = run();
  const second = run();
  assert.deepEqual(first, second);
  assert.equal(first.method, 'montecarlo');
  assert.equal(first.samples, 8_000);
  closeTo(first.stderr, Math.sqrt(first.equity * (1 - first.equity) / first.samples));
  closeTo(first.ci95, 1.96 * first.stderr);
  assert.ok(Math.abs(first.equity - exact.equity) <= first.ci95);
});
