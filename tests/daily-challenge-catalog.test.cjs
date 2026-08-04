'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Catalog = require('../src/daily/daily-challenge-catalog.js');

const CARD = /^(?:[2-9TJQKA])[shdc]$/;
const BOARD_LENGTH = { preflop: 0, flop: 3, turn: 4, river: 5 };

test('первоначальный каталог содержит минимум семь полноценных challenges', () => {
  assert.ok(Catalog.list().length >= 7);
});

test('все challenge IDs уникальны и стабильны', () => {
  const ids = Catalog.list().map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^daily-[a-z0-9-]+$/.test(id)));
});

test('все карты валидны и не повторяются', () => {
  Catalog.list().forEach(challenge => {
    const cards = [...challenge.heroCards, ...challenge.board];
    assert.ok(cards.every(card => CARD.test(card)), challenge.id);
    assert.equal(new Set(cards).size, cards.length, challenge.id);
  });
});

test('board соответствует street', () => {
  Catalog.list().forEach(challenge => {
    assert.equal(challenge.board.length, BOARD_LENGTH[challenge.street], challenge.id);
  });
});

test('correct action присутствует среди доступных actions', () => {
  Catalog.list().forEach(challenge => {
    assert.ok(challenge.actions.some(action => action.actionClass === challenge.correctAction), challenge.id);
  });
});

test('каждая раздача содержит объяснение и source scenario', () => {
  Catalog.list().forEach(challenge => {
    assert.ok(challenge.explanation.length >= 20, challenge.id);
    assert.ok(challenge.sourceScenarioId, challenge.id);
  });
});

test('числовые poker inputs валидны', () => {
  Catalog.list().forEach(challenge => {
    assert.ok(Number.isFinite(challenge.pot) && challenge.pot >= 0, challenge.id);
    assert.ok(Number.isFinite(challenge.amountToCall) && challenge.amountToCall >= 0, challenge.id);
    assert.ok(Number.isFinite(challenge.effectiveStack) && challenge.effectiveStack > 0, challenge.id);
    assert.ok(Number.isInteger(challenge.opponentCount) && challenge.opponentCount >= 1, challenge.id);
  });
});

test('action set физически допустим для текущей ставки', () => {
  Catalog.list().forEach(challenge => {
    const classes = challenge.actions.map(action => action.actionClass);
    if (challenge.amountToCall > 0) {
      assert.ok(!classes.includes('CHECK'));
      assert.ok(classes.some(action => ['FOLD', 'CALL', 'RAISE', 'ALL_IN'].includes(action)));
    } else {
      assert.ok(classes.includes('CHECK'));
      assert.ok(!classes.includes('CALL'));
    }
  });
});

test('catalog API безопасно обрабатывает неизвестный ID', () => {
  assert.equal(Catalog.getById('daily-unknown'), null);
});

test('catalog validation подтверждает весь опубликованный набор', () => {
  assert.deepEqual(Catalog.validateCatalog(), { valid: true, errors: [] });
});
