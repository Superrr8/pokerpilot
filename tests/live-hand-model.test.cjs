'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadModel() {
  return require('../src/live/saved-hands.js');
}

function fixture(overrides = {}) {
  return {
    sessionId: 'session-2026-07-28',
    handNumber: 7,
    timestamp: '2026-07-28T12:00:00.000Z',
    source: 'Live Session',
    table: {
      size: 6,
      style: 'normal',
      blinds: { small: 1, big: 3, label: '$1/$3' }
    },
    hero: {
      playerId: 0,
      position: 'BTN',
      holeCards: [{ r: 14, s: 's' }, { r: 13, s: 's' }],
      startingStack: 300,
      endingStack: 372
    },
    players: [
      { playerId: 0, name: 'YOU', position: 'BTN', startingStack: 300, endingStack: 372 },
      { playerId: 1, name: 'REG', position: 'SB', startingStack: 300, endingStack: 228 }
    ],
    communityCards: [
      { r: 12, s: 's' },
      { r: 11, s: 's' },
      { r: 2, s: 'd' },
      { r: 10, s: 's' },
      { r: 4, s: 'c' }
    ],
    potSize: 144,
    effectiveStack: 300,
    actions: [
      { sequence: 1, street: 'preflop', playerId: 1, playerName: 'REG', position: 'SB', type: 'RAISE', amount: 12, toAmount: 12 },
      { sequence: 2, street: 'preflop', playerId: 0, playerName: 'YOU', position: 'BTN', type: 'CALL', amount: 12 },
      { sequence: 3, street: 'flop', playerId: 1, playerName: 'REG', position: 'SB', type: 'BET', amount: 20 },
      { sequence: 4, street: 'flop', playerId: 0, playerName: 'YOU', position: 'BTN', type: 'CALL', amount: 20 }
    ],
    winner: { playerId: 0, name: 'YOU', position: 'BTN' },
    result: { heroNet: 72, summary: 'YOU wins $144' },
    ...overrides
  };
}

test('сохранённая Live-раздача имеет версионированную модель для Hand Lab и Coach', () => {
  const { createHandRecord } = loadModel();
  const hand = createHandRecord(fixture());

  assert.equal(hand.schemaVersion, 1);
  assert.equal(hand.source, 'Live Session');
  assert.equal(hand.id, 'live-session-2026-07-28-7');
  assert.deepEqual(hand.hero.holeCards, ['14s', '13s']);
  assert.deepEqual(hand.communityCards, ['12s', '11s', '2d', '10s', '4c']);
  assert.deepEqual(hand.table.blinds, { small: 1, big: 3, label: '$1/$3' });
  assert.equal(hand.effectiveStack, 300);
  assert.equal(hand.potSize, 144);
  assert.equal(hand.analysis.status, 'not-analyzed');
  assert.equal(hand.coach.status, 'pending');
  assert.equal(hand.favorite, false);
  assert.equal(hand.notes, '');
});

test('модель сохраняет позиции, стеки, победителя, результат и полную историю действий', () => {
  const { createHandRecord } = loadModel();
  const hand = createHandRecord(fixture());

  assert.deepEqual(hand.players.map(player => player.position), ['BTN', 'SB']);
  assert.deepEqual(hand.players.map(player => player.startingStack), [300, 300]);
  assert.deepEqual(hand.players.map(player => player.endingStack), [372, 228]);
  assert.deepEqual(hand.winner, { playerId: 0, name: 'YOU', position: 'BTN' });
  assert.deepEqual(hand.result, { heroNet: 72, summary: 'YOU wins $144' });
  assert.equal(hand.actions.length, 4);
  assert.deepEqual(hand.actions.map(action => action.sequence), [1, 2, 3, 4]);
});

test('createHandRecord не мутирует исходный снимок раздачи', () => {
  const { createHandRecord } = loadModel();
  const input = fixture();
  const before = JSON.parse(JSON.stringify(input));

  createHandRecord(input);

  assert.deepEqual(input, before);
});

test('повторное сохранение той же раздачи блокируется по id и fingerprint', () => {
  const { createHandRecord, saveUnique } = loadModel();
  const hand = createHandRecord(fixture());
  const first = saveUnique([], hand);
  const duplicateById = saveUnique(first.hands, { ...hand });
  const duplicateByFingerprint = saveUnique(first.hands, {
    ...hand,
    id: 'another-id'
  });

  assert.equal(first.saved, true);
  assert.equal(duplicateById.saved, false);
  assert.equal(duplicateByFingerprint.saved, false);
  assert.equal(duplicateByFingerprint.hands.length, 1);
});

test('история действий группируется по улицам в хронологическом порядке', () => {
  const { groupActions } = loadModel();
  const groups = groupActions(fixture().actions);

  assert.deepEqual(groups.map(group => group.street), ['preflop', 'flop']);
  assert.deepEqual(groups.map(group => group.label), ['Preflop', 'Flop']);
  assert.deepEqual(groups[0].actions.map(action => action.sequence), [1, 2]);
  assert.deepEqual(groups[1].actions.map(action => action.sequence), [3, 4]);
});

test('визуальные подписи действий различают CALL, BET, RAISE TO, FOLD и ALL-IN', () => {
  const { formatAction } = loadModel();

  assert.equal(formatAction({ type: 'CHECK' }), 'CHECK');
  assert.equal(formatAction({ type: 'CALL', amount: 12 }), 'CALL $12');
  assert.equal(formatAction({ type: 'BET', amount: 20 }), 'BET $20');
  assert.equal(formatAction({ type: 'RAISE', toAmount: 45 }), 'RAISE TO $45');
  assert.equal(formatAction({ type: 'FOLD' }), 'FOLD');
  assert.equal(formatAction({ type: 'ALL_IN', amount: 100 }), 'ALL-IN $100');
});

test('неполный или повреждённый снимок нормализуется без падения', () => {
  const { createHandRecord } = loadModel();
  const hand = createHandRecord({
    sessionId: 'damaged',
    handNumber: 1,
    hero: { holeCards: [{ r: 14, s: 'x' }, null] },
    communityCards: 'broken',
    players: null,
    actions: [{ street: 'unknown', type: 'fold' }]
  });

  assert.deepEqual(hand.hero.holeCards, []);
  assert.deepEqual(hand.communityCards, []);
  assert.deepEqual(hand.players, []);
  assert.equal(hand.actions[0].street, 'preflop');
  assert.equal(hand.actions[0].type, 'FOLD');
});
