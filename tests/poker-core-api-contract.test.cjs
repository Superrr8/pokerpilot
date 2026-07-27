'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');

const EXPECTED_API = [
  'HAND_NAMES', 'RANKS', 'RANK_TEXT', 'SUITS', 'SUIT_SYMBOL', 'analyzeOuts',
  'best7', 'callEV', 'cardId', 'cardText', 'clamp', 'combinations',
  'compareEval', 'equityVsRange', 'eval5', 'exactHitProbability',
  'expandRange', 'expandRangeToken', 'fullDeck', 'handClass', 'handName',
  'parseCard', 'potMath', 'rangeCombos', 'removeKnown', 'shuffle'
];

const C = loadPokerCore();
const cards = text => text.split(/\s+/).map(C.parseCard);
const plain = value => JSON.parse(JSON.stringify(value));

test('PokerCore сохраняет полный публичный API', () => {
  assert.deepEqual(Object.keys(C).sort(), EXPECTED_API);
});

test('PokerCore сохраняет контрольный отпечаток результатов', () => {
  const pot = C.potMath({ potBefore: 90, bet: 60, call: 40 });
  const outs = C.analyzeOuts(cards('8s 7d'), cards('6c 5h Ks'));
  const equity = C.equityVsRange({
    hero: cards('As Ks'),
    board: cards('Qs Js Ts 2d 3c'),
    range: 'QQ'
  });

  assert.deepEqual(plain({
    royal: C.eval5(cards('As Ks Qs Js Ts')),
    wheel: C.eval5(cards('As 2d 3c 4h 5s')),
    best7: C.best7(cards('As Ad Ac Kh Kd Kc 2s')),
    ranges: [
      C.rangeCombos('TT+').length,
      C.rangeCombos('AKs').length,
      C.rangeCombos('AKo').length
    ],
    pot,
    callEV: C.callEV({
      equity: 0.3,
      potBefore: 90,
      bet: 60,
      call: 40
    }).ev,
    outs: {
      raw: outs.rawOuts,
      strong: outs.strongOuts,
      conditional: outs.conditionalOuts,
      dirty: outs.dirtyOuts,
      next: outs.strongNextCard,
      river: outs.strongByRiver
    },
    equity
  }), {
    royal: [8, 14],
    wheel: [4, 5],
    best7: [6, 14, 13],
    ranges: [30, 4, 12],
    pot: {
      potBefore: 90,
      bet: 60,
      call: 40,
      potNow: 150,
      finalPot: 190,
      requiredEquity: 40 / 190
    },
    callEV: 17,
    outs: {
      raw: 8,
      strong: 8,
      conditional: 0,
      dirty: 0,
      next: 0.17021276595744683,
      river: 1 - (39 / 47) * (38 / 46)
    },
    equity: {
      equity: 1,
      win: 1,
      tie: 0,
      lose: 0,
      samples: 3,
      stderr: 0,
      ci95: 0,
      exact: true,
      method: 'exact',
      combos: 3
    }
  });
});
