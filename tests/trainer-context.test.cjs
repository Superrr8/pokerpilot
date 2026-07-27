'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTrainer } = require('./trainer-loader.cjs');

const trainer = loadTrainer({ seed: 0x63c0ffee });
const { C } = trainer;
const cards = text => text.split(/\s+/).map(C.parseCard);

function assertOnlyChanged(left, right, key) {
  const changed = Object.keys({ ...left, ...right })
    .filter(name => JSON.stringify(left[name]) !== JSON.stringify(right[name]));
  assert.deepEqual(changed, [key], `ожидалось изменение только параметра ${key}`);
}

function preflop(overrides = {}) {
  return {
    street: 'preflop',
    position: 'CO',
    opponentPosition: 'UTG',
    situation: 'vs_raise_early',
    hero: cards('Kh Qd'),
    board: [],
    pot: 19,
    bet: 12,
    stack: 300,
    opponents: 1,
    villain: 'reg',
    customRange: '',
    notes: '',
    ...overrides
  };
}

function postflop(overrides = {}) {
  return {
    street: 'river',
    position: 'CO',
    opponentPosition: 'BTN',
    situation: 'after_check',
    hero: cards('Ah Jh'),
    board: cards('Jd 8c 4s 9h 2d'),
    pot: 160,
    bet: 80,
    stack: 240,
    opponents: 1,
    villain: 'reg',
    customRange: 'JJ,99,88,44,22,J9s,KJs,QJs,JTs',
    notes: '',
    ...overrides
  };
}

function compare(inputA, inputB, analyze) {
  return [analyze(inputA), analyze(inputB)];
}

test('префлоп: одна рука меняет решение между ранней позицией и BTN', () => {
  const early = preflop({
    position: 'UTG',
    opponentPosition: null,
    situation: 'firstin',
    hero: cards('Kh 9d'),
    bet: 0
  });
  const button = { ...early, position: 'BTN' };
  assertOnlyChanged(early, button, 'position');

  const [earlyResult, buttonResult] = compare(
    early, button, trainer.analyzerPreflop
  );
  assert.equal(earlyResult.actionClass, 'FOLD');
  assert.equal(buttonResult.actionClass, 'RAISE');
  assert.match(buttonResult.explanation, /позици/i);
});

test('префлоп: пограничная рука защищается шире против loose, чем против tight', () => {
  const tight = preflop({ villain: 'nit' });
  const loose = { ...tight, villain: 'wild' };
  assertOnlyChanged(tight, loose, 'villain');

  const [tightResult, looseResult] = compare(
    tight, loose, trainer.analyzerPreflop
  );
  assert.equal(tightResult.actionClass, 'FOLD');
  assert.equal(looseResult.actionClass, 'CALL');
  assert.equal(looseResult.isMarginal, true);
  assert.notEqual(looseResult.confidence, 'high');
  assert.match(looseResult.explanation, /тип соперника|широк/i);
});

test('префлоп: несколько соперников делают пограничный изолейт осторожнее', () => {
  trainer.setPreflopContext({ limpers: 1 });
  const headsUp = preflop({
    position: 'HJ',
    opponentPosition: null,
    situation: 'limpers',
    hero: cards('Kh Th'),
    pot: 10,
    bet: 0,
    opponents: 1,
    villain: 'passive'
  });
  const multiway = { ...headsUp, opponents: 3 };
  assertOnlyChanged(headsUp, multiway, 'opponents');

  const headsUpResult = trainer.analyzerPreflop(headsUp);
  const multiwayResult = trainer.analyzerPreflop(multiway);
  assert.equal(headsUpResult.actionClass, 'RAISE');
  assert.equal(multiwayResult.actionClass, 'CALL');
  assert.equal(multiwayResult.isMarginal, true);
  assert.match(multiwayResult.explanation, /нескольк|multiway|мульти/i);
});

test('префлоп: effective stack 20/50/100 BB меняет короткое решение, но не глубокие', () => {
  const stack20 = preflop({
    position: 'CO',
    opponentPosition: null,
    situation: 'vs_3bet',
    hero: cards('Ah Qh'),
    pot: 45,
    bet: 30,
    stack: 60
  });
  const stack50 = { ...stack20, stack: 150 };
  const stack100 = { ...stack20, stack: 300 };

  const r20 = trainer.analyzerPreflop(stack20);
  const r50 = trainer.analyzerPreflop(stack50);
  const r100 = trainer.analyzerPreflop(stack100);
  assert.equal(r20.actionClass, 'ALL_IN');
  assert.equal(r20.amount, 60);
  assert.equal(r50.actionClass, 'CALL');
  assert.equal(r100.actionClass, 'CALL');
  assert.match(r20.explanation, /коротк|стек/i);
});

test('префлоп: размер изолейта растёт от одного лимпера к нескольким', () => {
  const one = preflop({
    position: 'CO',
    opponentPosition: null,
    situation: 'limpers',
    hero: cards('Ah Jh'),
    pot: 10,
    bet: 0,
    opponents: 1,
    villain: 'passive'
  });
  trainer.setPreflopContext({ limpers: 1 });
  const oneResult = trainer.analyzerPreflop(one);
  trainer.setPreflopContext({ limpers: 3 });
  const severalResult = trainer.analyzerPreflop(one);
  assert.equal(oneResult.actionClass, 'RAISE');
  assert.equal(severalResult.actionClass, 'RAISE');
  assert.ok(severalResult.amount > oneResult.amount);
});

test('префлоп: BB защищает KQo против BTN, но не против UTG', () => {
  trainer.setPreflopContext({ opener: 'late' });
  const early = preflop({
    position: 'BB',
    opponentPosition: 'UTG',
    situation: 'blind_defense'
  });
  const late = { ...early, opponentPosition: 'BTN' };
  assertOnlyChanged(early, late, 'opponentPosition');

  const [earlyResult, lateResult] = compare(
    early, late, trainer.analyzerPreflop
  );
  assert.equal(earlyResult.actionClass, 'FOLD');
  assert.equal(lateResult.actionClass, 'CALL');
  assert.match(lateResult.explanation, /позиц/i);
});

test('префлоп: неизвестный тип соперника получает нейтральный профиль reg', () => {
  const regular = preflop({ villain: 'reg' });
  const unknown = { ...regular, villain: 'mystery-player' };
  assertOnlyChanged(regular, unknown, 'villain');

  const [regularResult, unknownResult] = compare(
    regular, unknown, trainer.analyzerPreflop
  );
  assert.equal(unknownResult.actionClass, regularResult.actionClass);
  assert.equal(unknownResult.confidence, regularResult.confidence);
  assert.ok(
    unknownResult.assumptions.some(item => /нейтраль|reg/i.test(item))
  );
});

test('постфлоп: одна рука ставит в позиции и чекает без позиции', () => {
  const inPosition = postflop({
    street: 'flop',
    position: 'BTN',
    opponentPosition: 'CO',
    situation: 'checked_to',
    hero: cards('As Ks'),
    board: cards('Qs 7s 2d'),
    pot: 61,
    bet: 0,
    stack: 210,
    customRange: 'QQ,77,22,KQs,QJs,JJ-TT'
  });
  const outOfPosition = { ...inPosition, position: 'BB' };
  assertOnlyChanged(inPosition, outOfPosition, 'position');

  const [ipResult, oopResult] = compare(
    inPosition, outOfPosition, trainer.analyzerPostflop
  );
  assert.equal(ipResult.actionClass, 'BET');
  assert.equal(oopResult.actionClass, 'CHECK');
  assert.match(ipResult.explanation, /позици/i);
  assert.match(oopResult.explanation, /без позиции/i);
});

test('постфлоп: позиция соперника также определяет IP/OOP контекст', () => {
  const inPosition = postflop({
    street: 'flop',
    position: 'CO',
    opponentPosition: 'HJ',
    situation: 'checked_to',
    hero: cards('As Ks'),
    board: cards('Qs 7s 2d'),
    pot: 61,
    bet: 0,
    stack: 210,
    customRange: 'QQ,77,22,KQs,QJs,JJ-TT'
  });
  const outOfPosition = { ...inPosition, opponentPosition: 'BTN' };
  assertOnlyChanged(inPosition, outOfPosition, 'opponentPosition');

  const [ipResult, oopResult] = compare(
    inPosition, outOfPosition, trainer.analyzerPostflop
  );
  assert.equal(ipResult.actionClass, 'BET');
  assert.equal(oopResult.actionClass, 'CHECK');
});

test('постфлоп: top pair ставит heads-up и контролирует банк multiway', () => {
  const headsUp = postflop({
    street: 'flop',
    position: 'BTN',
    opponentPosition: 'BB',
    situation: 'checked_to',
    hero: cards('Ah Qh'),
    board: cards('Qd 7c 2s'),
    pot: 60,
    bet: 0,
    stack: 300,
    customRange: 'KQs,QJs,QTs,JJ-99,77,22'
  });
  const multiway = { ...headsUp, opponents: 2 };
  assertOnlyChanged(headsUp, multiway, 'opponents');

  const [headsUpResult, multiwayResult] = compare(
    headsUp, multiway, trainer.analyzerPostflop
  );
  assert.equal(headsUpResult.actionClass, 'BET');
  assert.equal(multiwayResult.actionClass, 'CHECK');
  assert.equal(multiwayResult.isMarginal, true);
  assert.match(multiwayResult.explanation, /multiway|нескольк|мульти/i);
});

test('постфлоп: tight/passive и aggressive/loose меняют bluff-catch', () => {
  const base = postflop();
  const results = Object.fromEntries(
    ['nit', 'passive', 'aggro', 'wild'].map(villain => [
      villain,
      trainer.analyzerPostflop({ ...base, villain })
    ])
  );

  assert.equal(results.nit.actionClass, 'FOLD');
  assert.equal(results.passive.actionClass, 'FOLD');
  assert.equal(results.aggro.actionClass, 'CALL');
  assert.equal(results.wild.actionClass, 'CALL');
  assert.equal(results.aggro.isMarginal, true);
  assert.notEqual(results.aggro.confidence, 'high');
  assert.match(results.aggro.explanation, /тип соперника|агрессив/i);
});

test('постфлоп: неизвестный тип соперника совпадает с нейтральным reg', () => {
  const regular = postflop({ villain: 'reg' });
  const unknown = { ...regular, villain: 'unknown-profile' };
  assertOnlyChanged(regular, unknown, 'villain');

  const [regularResult, unknownResult] = compare(
    regular, unknown, trainer.analyzerPostflop
  );
  assert.equal(unknownResult.actionClass, regularResult.actionClass);
  assert.equal(unknownResult.confidence, regularResult.confidence);
  assert.equal(unknownResult.isMarginal, regularResult.isMarginal);
});

test('постфлоп: низкий, средний и высокий SPR меняют безопасный value-размер', () => {
  const base = postflop({
    position: 'BTN',
    opponentPosition: 'BB',
    situation: 'checked_to',
    hero: cards('Kh Kd'),
    board: cards('Ts 7d 3c 4h 2s'),
    pot: 100,
    bet: 0,
    villain: 'reg',
    customRange: '22-99,ATs,KTs,QTs,JTs,ATo,KTo,QTo,JTo'
  });
  const low = trainer.analyzerPostflop({ ...base, stack: 80 });
  const medium = trainer.analyzerPostflop({ ...base, stack: 300 });
  const high = trainer.analyzerPostflop({ ...base, stack: 800 });

  assert.equal(low.math.equity.equity, medium.math.equity.equity);
  assert.equal(medium.math.equity.equity, high.math.equity.equity);
  assert.equal(low.actionClass, 'ALL_IN');
  assert.equal(medium.actionClass, 'BET');
  assert.equal(high.actionClass, 'BET');
  assert.ok(medium.amount > high.amount);
  assert.match(low.explanation, /SPR/i);
  assert.match(high.explanation, /SPR/i);
});

test('постфлоп: малая, средняя и крупная ставка меняют цену bluff-catch', () => {
  const base = postflop();
  const small = trainer.analyzerPostflop({ ...base, bet: 40 });
  const medium = trainer.analyzerPostflop({ ...base, bet: 80 });
  const large = trainer.analyzerPostflop({ ...base, bet: 160 });

  assert.equal(small.actionClass, 'CALL');
  assert.equal(medium.actionClass, 'CALL');
  assert.equal(large.actionClass, 'FOLD');
  assert.ok(small.math.required < medium.math.required);
  assert.ok(medium.math.required < large.math.required);
  assert.match(small.explanation, /маленьк|банк/i);
  assert.match(large.explanation, /крупн|банк/i);
});

test('постфлоп: calling station допускает thin value, tight соперник — check', () => {
  const station = postflop({
    position: 'BTN',
    opponentPosition: 'BB',
    situation: 'checked_to',
    hero: cards('Ah Jd'),
    board: cards('Js 8c 4s 9h 2d'),
    pot: 120,
    bet: 0,
    stack: 240,
    villain: 'station',
    customRange: 'KJs,QJs,JTs,TT-77,A8s,A9s,JJ,99,88,44,22,J9s'
  });
  const tight = { ...station, villain: 'nit' };
  assertOnlyChanged(station, tight, 'villain');

  const [stationResult, tightResult] = compare(
    station, tight, trainer.analyzerPostflop
  );
  assert.equal(stationResult.actionClass, 'BET');
  assert.equal(tightResult.actionClass, 'CHECK');
  assert.equal(stationResult.isMarginal, true);
  assert.match(stationResult.explanation, /тип соперника|шире плат/i);
});

test('постфлоп: близкий EV-call меняет confidence по типу соперника', () => {
  const regular = postflop({ villain: 'reg' });
  const aggressive = { ...regular, villain: 'aggro' };
  assertOnlyChanged(regular, aggressive, 'villain');

  const [regularResult, aggressiveResult] = compare(
    regular, aggressive, trainer.analyzerPostflop
  );
  assert.equal(regularResult.actionClass, 'CALL');
  assert.equal(aggressiveResult.actionClass, 'CALL');
  assert.equal(regularResult.isMarginal, true);
  assert.equal(aggressiveResult.isMarginal, true);
  assert.notEqual(regularResult.confidence, aggressiveResult.confidence);
  assert.ok(Number.isFinite(aggressiveResult.callEV));
});

test('постфлоп: assumptions и explanation фиксируют весь использованный контекст', () => {
  const input = postflop({
    position: 'BB',
    opponentPosition: 'BTN',
    opponents: 3,
    villain: 'aggro',
    stack: 240,
    pot: 160,
    bet: 80
  });
  const result = trainer.analyzerPostflop(input);
  const assumptions = result.assumptions.join(' ');

  assert.match(assumptions, /BB/);
  assert.match(assumptions, /BTN/);
  assert.match(assumptions, /aggro|агрессив/i);
  assert.match(assumptions, /3|multiway|мульти/i);
  assert.match(assumptions, /SPR/i);
  assert.match(assumptions, /ставк|банк/i);
  assert.match(result.explanation, /контекст|позици|multiway|тип соперника|SPR/i);
  assert.ok(Array.isArray(result.alternatives));
  assert.ok(result.alternatives.every(item => typeof item.actionClass === 'string'));
});
