'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fixtures = require('./fixtures/decision-quality-fixtures.cjs');
const Engine = require('../src/decision-quality/decision-quality-engine.js');

const base = {
  userAction: 'CALL',
  trainer: { actionClass: 'CALL', confidence: 'high' },
  context: { scenarioId: 'base', mode: 'TRAINING', street: 'river', pot: 100, toCall: 25 },
  evaluatedAt: '2026-01-01T00:00:00.000Z'
};

test('публичный API DecisionQualityEngine стабилен', () => {
  for (const name of ['evaluate', 'classify', 'getLabel', 'getGrade', 'getStars', 'explain']) {
    assert.equal(typeof Engine[name], 'function', name);
  }
});

test('результат имеет schemaVersion 1 и modelVersion', () => {
  const result = Engine.evaluate(base);
  assert.equal(result.schemaVersion, 1);
  assert.match(result.modelVersion, /^dq-/);
});

test('одинаковый вход даёт полностью детерминированный результат', () => {
  assert.deepEqual(Engine.evaluate(base), Engine.evaluate(structuredClone(base)));
});

test('результат сериализуется без потери', () => {
  const result = Engine.evaluate(base);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test('нет действия пользователя — UNRATED', () => {
  const result = Engine.evaluate({ ...base, userAction: null });
  assert.equal(result.classification, 'UNRATED');
  assert.equal(result.score, null);
  assert.equal(result.isRated, false);
});

test('нет рекомендации тренера — UNRATED', () => {
  const result = Engine.evaluate({ ...base, trainer: {} });
  assert.equal(result.classification, 'UNRATED');
});

test('нет контекста — UNRATED', () => {
  const result = Engine.evaluate({ ...base, context: null });
  assert.equal(result.classification, 'UNRATED');
});

test('неизвестное действие пользователя — UNRATED', () => {
  const result = Engine.evaluate({ ...base, userAction: 'DANCE' });
  assert.equal(result.classification, 'UNRATED');
});

test('classify использует зафиксированные пороги', () => {
  assert.equal(Engine.classify(95), 'EXCELLENT');
  assert.equal(Engine.classify(90), 'EXCELLENT');
  assert.equal(Engine.classify(80), 'GOOD');
  assert.equal(Engine.classify(70), 'ACCEPTABLE');
  assert.equal(Engine.classify(50), 'MISTAKE');
  assert.equal(Engine.classify(49), 'BLUNDER');
  assert.equal(Engine.classify(null), 'UNRATED');
});

test('getGrade различает A+, A, B, C, D, F и UNRATED', () => {
  assert.deepEqual([95, 90, 80, 70, 50, 0, null].map(Engine.getGrade), ['A+', 'A', 'B', 'C', 'D', 'F', null]);
});

test('getStars использует стабильную шкалу', () => {
  assert.deepEqual([95, 94, 85, 84, 70, 69, 50, 49, 1, 0, null].map(Engine.getStars), [5, 4, 4, 3, 3, 2, 2, 1, 1, 0, null]);
});

test('getLabel возвращает русские учебные labels', () => {
  assert.equal(Engine.getLabel('EXCELLENT'), 'Отличное решение');
  assert.equal(Engine.getLabel('UNRATED'), 'Недостаточно данных');
});

test('компоненты action/sizing/EV имеют число или null', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: { actionClass: 'CALL', amount: 25, amountUnit: 'ADDITIONAL' },
    trainer: { ...base.trainer, callEV: 5 }
  });
  assert.equal(typeof result.components.actionQuality, 'number');
  assert.equal(result.components.sizingQuality, null);
  assert.equal(typeof result.components.evQuality, 'number');
});

test('CHECK и FOLD не получают sizing penalty', () => {
  for (const action of ['CHECK', 'FOLD']) {
    const result = Engine.evaluate({
      ...base,
      userAction: { actionClass: action, amount: 999 },
      trainer: { actionClass: action, amount: 10, confidence: 'high' }
    });
    assert.equal(result.components.sizingQuality, null);
  }
});

test('несовместимые amountUnit исключают sizing из оценки', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: { actionClass: 'RAISE', amount: 75, amountUnit: 'ADDITIONAL' },
    trainer: { actionClass: 'RAISE', amount: 100, amountUnit: 'TO_TOTAL', confidence: 'high' }
  });
  assert.equal(result.components.sizingQuality, null);
});

test('нулевой рекомендуемый размер не создаёт деление на ноль', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: { actionClass: 'BET', amount: 10, amountUnit: 'TO_TOTAL' },
    trainer: { actionClass: 'BET', amount: 0, amountUnit: 'TO_TOTAL', confidence: 'high' }
  });
  assert.equal(result.components.sizingQuality, null);
  assert.ok(Number.isFinite(result.score));
});

test('отрицательный размер получает нулевой sizing component', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: { actionClass: 'BET', amount: -10, amountUnit: 'TO_TOTAL' },
    trainer: { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL', confidence: 'high' }
  });
  assert.equal(result.components.sizingQuality, 0);
});

test('отсутствующий EV не штрафует и перераспределяет веса', () => {
  const withoutEv = Engine.evaluate(base);
  const withPositiveEv = Engine.evaluate({ ...base, trainer: { ...base.trainer, callEV: 10 } });
  assert.ok(withoutEv.score >= 95);
  assert.ok(withPositiveEv.score >= 95);
});

test('нечисловой EV игнорируется', () => {
  const result = Engine.evaluate({ ...base, trainer: { ...base.trainer, callEV: 'unknown' } });
  assert.equal(result.components.evQuality, null);
});

test('confidence нормализуется к high/medium/low', () => {
  assert.equal(Engine.evaluate({ ...base, trainer: { ...base.trainer, confidence: 'weird' } }).confidence, 'medium');
});

test('marginal-решение не получает необоснованный BLUNDER', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: 'FOLD',
    trainer: { actionClass: 'CALL', confidence: 'high', isMarginal: true }
  });
  assert.ok(result.score >= 50);
});

test('structured alternative использует amount альтернативы', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: { actionClass: 'RAISE', amount: 102, amountUnit: 'TO_TOTAL' },
    trainer: {
      actionClass: 'CALL',
      confidence: 'medium',
      alternatives: [{ actionClass: 'RAISE', amount: 100, amountUnit: 'TO_TOTAL', reason: 'Допустимый рейз.' }]
    }
  });
  assert.equal(result.components.sizingQuality, 100);
});

test('reasons детерминированы и не содержат GTO/solver claims', () => {
  const result = Engine.evaluate(base);
  assert.ok(result.reasons.length > 0);
  assert.doesNotMatch(result.reasons.join(' '), /GTO|солвер/i);
});

test('explain возвращает понятную строку', () => {
  assert.equal(typeof Engine.explain(Engine.evaluate(base)), 'string');
  assert.ok(Engine.explain(Engine.evaluate(base)).length > 10);
});

test('CALL при materially negative exact callEV capped at 79', () => {
  const result = Engine.evaluate({
    ...base,
    trainer: { ...base.trainer, callEV: -8, callEVMethod: 'exact' }
  });
  assert.equal(result.score, 79);
  assert.equal(result.grade, 'C');
  assert.equal(result.classification, 'ACCEPTABLE');
  assert.ok(result.reasons.includes('Точная EV-оценка противоречит выбранному решению.'));
});

test('FOLD при materially positive exact callEV capped at 79', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: 'FOLD',
    trainer: { actionClass: 'FOLD', confidence: 'high', callEV: 8, callEVMethod: 'exact' }
  });
  assert.equal(result.score, 79);
  assert.equal(result.grade, 'C');
  assert.equal(result.classification, 'ACCEPTABLE');
});

test('CALL при positive exact callEV не ограничивается', () => {
  const result = Engine.evaluate({
    ...base,
    trainer: { ...base.trainer, callEV: 8, callEVMethod: 'exact' }
  });
  assert.equal(result.score, 98);
});

test('FOLD при negative exact callEV не ограничивается', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: 'FOLD',
    trainer: { actionClass: 'FOLD', confidence: 'high', callEV: -8, callEVMethod: 'exact' }
  });
  assert.equal(result.score, 98);
});

test('точное EV-расхождение меньше $1 не запускает cap', () => {
  const result = Engine.evaluate({
    ...base,
    trainer: { ...base.trainer, callEV: -0.5, callEVMethod: 'exact' }
  });
  assert.ok(result.score > 79);
  assert.equal(result.reasons.includes('Точная EV-оценка противоречит выбранному решению.'), false);
});

test('точное EV-расхождение меньше 1% банка не запускает cap', () => {
  const result = Engine.evaluate({
    ...base,
    trainer: { ...base.trainer, callEV: -5, callEVMethod: 'exact' },
    context: { ...base.context, pot: 1000 }
  });
  assert.ok(result.score > 79);
});

test('Monte Carlo callEV не запускает cap', () => {
  const result = Engine.evaluate({
    ...base,
    trainer: { ...base.trainer, callEV: -8, callEVMethod: 'montecarlo' }
  });
  assert.ok(result.score > 79);
  assert.equal(result.reasons.includes('Точная EV-оценка противоречит выбранному решению.'), false);
});

test('missing, NaN и Infinity callEV безопасно игнорируются', () => {
  for (const callEV of [undefined, NaN, Infinity, -Infinity]) {
    const result = Engine.evaluate({
      ...base,
      trainer: { ...base.trainer, callEV, callEVMethod: 'exact' }
    });
    assert.equal(result.score, 98);
    assert.equal(result.components.evQuality, null);
  }
});

test('structured alternative остаётся не выше 79 при прямом exact EV-конфликте', () => {
  const result = Engine.evaluate({
    ...base,
    userAction: 'CALL',
    trainer: {
      actionClass: 'FOLD',
      confidence: 'low',
      isMarginal: true,
      callEV: -8,
      callEVMethod: 'exact',
      alternatives: [{ actionClass: 'CALL', reason: 'Диапазонозависимая альтернатива.' }]
    }
  });
  assert.ok(result.score <= 79);
  assert.ok(result.reasons.includes('Точная EV-оценка противоречит выбранному решению.'));
});

test('остальные calibration fixtures сохраняют прежние точные scores', () => {
  const unchangedScores = {
    'exact-fold-high': 98,
    'exact-check-medium': 96,
    'exact-call-low': 94,
    'exact-bet-size': 98,
    'exact-raise-rounding': 98,
    'alternative-call': 84,
    'alternative-check': 88,
    'wrong-fold-high': 25,
    'wrong-call-high': 25,
    'wrong-low-confidence': 60,
    'wrong-marginal': 55,
    'bet-size-20pct': 93,
    'bet-size-40pct': 81,
    'bet-size-large': 76,
    'call-positive-ev': 98,
    'fold-negative-call-ev': 98,
    'all-in-exact': 98,
    'raise-alternative-sized': 88,
    'marginal-exact': 96,
    'low-confidence-opposite': 60,
    'medium-confidence-opposite': 45,
    'exact-no-optional-components': 98
  };
  for (const fixture of fixtures) {
    if (!Object.hasOwn(unchangedScores, fixture.id)) continue;
    assert.equal(Engine.evaluate(fixture.input).score, unchangedScores[fixture.id], fixture.id);
  }
});

for (const fixture of fixtures) {
  test(`контрольный сценарий DQ: ${fixture.id}`, () => {
    const result = Engine.evaluate(fixture.input);
    assert.equal(result.isRated, true);
    assert.ok(result.score >= fixture.expected.min, `${result.score} < ${fixture.expected.min}`);
    assert.ok(result.score <= fixture.expected.max, `${result.score} > ${fixture.expected.max}`);
    assert.equal(result.classification, fixture.expected.classification);
  });
}
