'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');

const C = loadPokerCore();

test('eval5 распределяет все 2 598 960 пятикарточных рук по стандартным категориям', () => {
  const deck = C.fullDeck();
  const counts = Array(9).fill(0);
  let total = 0;

  for (let a = 0; a < 48; a += 1) {
    for (let b = a + 1; b < 49; b += 1) {
      for (let c = b + 1; c < 50; c += 1) {
        for (let d = c + 1; d < 51; d += 1) {
          for (let e = d + 1; e < 52; e += 1) {
            counts[C.eval5([deck[a], deck[b], deck[c], deck[d], deck[e]])[0]] += 1;
            total += 1;
          }
        }
      }
    }
  }

  assert.equal(total, 2_598_960);
  assert.deepEqual(counts, [
    1_302_540,
    1_098_240,
    123_552,
    54_912,
    10_200,
    5_108,
    3_744,
    624,
    40
  ]);
});
