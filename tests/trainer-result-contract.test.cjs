'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTrainer } = require('./trainer-loader.cjs');

const ACTION_CLASSES = new Set([
  'FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN'
]);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const cards = (text, C) => text.split(/\s+/).map(C.parseCard);

function preflopInput(C, overrides = {}) {
  return {
    street: 'preflop',
    position: 'CO',
    situation: 'vs_3bet',
    hero: cards('As Ks', C),
    board: [],
    pot: 45,
    bet: 30,
    stack: 25,
    opponents: 1,
    villain: 'reg',
    customRange: '',
    notes: '',
    ...overrides
  };
}

function postflopInput(C, overrides = {}) {
  return {
    street: 'river',
    position: 'CO',
    situation: 'after_check',
    hero: cards('As Js', C),
    board: cards('Jd 8c 4s 9h 2d', C),
    pot: 217,
    bet: 110,
    stack: 300,
    opponents: 1,
    villain: 'aggro',
    customRange: '99,88,44,22,J9s,AJs,AJo,KJs,QJs,JTs,T8s,76s,65s',
    notes: '',
    ...overrides
  };
}

function assertStructuredResult(result) {
  assert.ok(ACTION_CLASSES.has(result.actionClass));
  assert.ok(result.amount === null || Number.isFinite(result.amount));
  assert.equal(typeof result.amountUnit, result.amount === null ? 'object' : 'string');
  assert.ok(CONFIDENCE.has(result.confidence));
  assert.equal(typeof result.isMarginal, 'boolean');
  assert.ok(result.callEV === null || Number.isFinite(result.callEV));
  assert.ok(Array.isArray(result.alternatives));
  for (const alternative of result.alternatives) {
    assert.ok(ACTION_CLASSES.has(alternative.actionClass));
    assert.ok(alternative.amount === null || Number.isFinite(alternative.amount));
    assert.equal(typeof alternative.reason, 'string');
  }
  assert.ok(Array.isArray(result.assumptions));
  assert.ok(result.assumptions.every(item => typeof item === 'string'));
  assert.equal(typeof result.explanation, 'string');
}

test('короткий стек преобразует физически невозможный 4-bet в ALL_IN', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPreflop(preflopInput(trainer.C));

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'ALL_IN');
  assert.equal(result.amount, 25);
  assert.equal(result.amountUnit, 'to_total');
  assert.notEqual(result.actionClass, 'RAISE');
  assert.doesNotMatch(result.recommendation, /RAISE до \$25/);
});

test('RAISE всегда больше необходимого колла и текущей ставки', () => {
  const trainer = loadTrainer();
  const input = preflopInput(trainer.C, {
    position: 'BTN',
    situation: 'vs_raise_early',
    hero: cards('Qs Qh', trainer.C),
    bet: 12,
    stack: 300
  });
  trainer.setPreflopContext({ opener: 'early' });
  const result = trainer.analyzerPreflop(input);

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'RAISE');
  assert.ok(result.amount > input.bet);
  assert.ok(result.amount <= input.stack);
  assert.equal(result.amountUnit, 'to_total');
});

test('BET и RAISE не достигают effective stack без преобразования в ALL_IN', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPostflop(postflopInput(trainer.C, {
    situation: 'checked_to',
    hero: cards('Kh Kd', trainer.C),
    board: cards('Ts 7d 3c 4h 2s', trainer.C),
    pot: 100,
    bet: 0,
    stack: 30,
    villain: 'passive',
    customRange: '22-99,ATs,KTs,QTs,JTs,ATo,KTo,QTo,JTo'
  }));

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'ALL_IN');
  assert.equal(result.amount, 30);
  assert.equal(result.amountUnit, 'to_total');
});

test('CALL не превышает effective stack и при полном вложении становится ALL_IN', () => {
  const trainer = loadTrainer();
  const input = postflopInput(trainer.C, {
    pot: 100,
    bet: 25,
    stack: 25
  });
  const result = trainer.analyzerPostflop(input);

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'ALL_IN');
  assert.equal(result.amount, input.stack);
  assert.equal(result.amountUnit, 'additional');
});

test('пограничное префлоп-решение имеет medium/low confidence и isMarginal', () => {
  const trainer = loadTrainer();
  trainer.setPreflopContext({ opener: 'early' });
  const result = trainer.analyzerPreflop(preflopInput(trainer.C, {
    position: 'CO',
    situation: 'vs_raise_early',
    hero: cards('Ah Qh', trainer.C),
    bet: 12,
    stack: 300,
    villain: 'nit'
  }));

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'CALL');
  assert.notEqual(result.confidence, 'high');
  assert.equal(result.isMarginal, true);
});

test('диапазонозависимое постфлоп-решение имеет medium confidence и isMarginal', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPostflop(postflopInput(trainer.C, {
    hero: cards('Ah Jh', trainer.C),
    pot: 160,
    bet: 80,
    stack: 240,
    customRange: 'JJ,99,88,44,22,J9s,KJs,QJs,JTs'
  }));

  assertStructuredResult(result);
  assert.equal(result.actionClass, 'CALL');
  assert.equal(result.confidence, 'medium');
  assert.equal(result.isMarginal, true);
  assert.ok(Math.abs(result.math.edge) < 0.05);
});

test('analyzerPostflop возвращает числовой callEV из PokerCore.callEV', () => {
  const trainer = loadTrainer();
  const input = postflopInput(trainer.C);
  const result = trainer.analyzerPostflop(input);
  const expected = trainer.C.callEV({
    equity: result.math.equity.equity,
    potBefore: input.pot,
    bet: input.bet,
    call: input.bet
  }).ev;

  assertStructuredResult(result);
  assert.equal(typeof result.callEV, 'number');
  assert.equal(result.callEV, expected);
});

test('callEV равен null, когда колл не рассматривается', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPostflop(postflopInput(trainer.C, {
    situation: 'checked_to',
    bet: 0
  }));

  assertStructuredResult(result);
  assert.equal(result.callEV, null);
});

test('основное действие и альтернативы имеют структурированный формат', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPostflop(postflopInput(trainer.C));

  assertStructuredResult(result);
  assert.ok(result.alternatives.length >= 1);
  assert.ok(
    result.alternatives.every(item => item.actionClass !== result.actionClass)
  );
});

test('старые текстовые поля сохранены, а UI использует совместимые labels', () => {
  const trainer = loadTrainer();
  const result = trainer.analyzerPostflop(postflopInput(trainer.C));
  for (const field of [
    'recommendation', 'best', 'confidenceLabel', 'range', 'why', 'missed',
    'alternativesText', 'oneLine', 'math', 'model'
  ]) {
    assert.ok(Object.hasOwn(result, field), field);
  }
  assert.equal(result.explanation, result.why);
  assert.equal(typeof result.alternativesText, 'string');

  const html = fs.readFileSync(
    path.resolve(__dirname, '..', 'index.html'),
    'utf8'
  );
  assert.match(html, /result\.confidenceLabel/);
  assert.match(html, /result\.alternativesText/);
});
