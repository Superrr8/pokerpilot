'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTrainer } = require('./trainer-loader.cjs');
const {
  preflopHands,
  postflopHands
} = require('./fixtures/trainer-control-hands.cjs');

const ACTIONS = new Set(['fold', 'check', 'call', 'bet', 'raise', 'allin']);
const cards = (text, C) => text.split(/\s+/).map(C.parseCard);
const inRange = (value, [minimum, maximum], label) => {
  assert.ok(
    value >= minimum && value <= maximum,
    `${label}: ${value} is outside ${minimum}..${maximum}`
  );
};
const recommendationSize = recommendation => {
  const match = String(recommendation).match(/\$(\d+)/);
  return match ? Number(match[1]) : null;
};
const seedFor = id => {
  let seed = 0x5eed1234;
  for (const char of id) seed = ((seed * 33) ^ char.charCodeAt(0)) >>> 0;
  return seed;
};
const prepare = (input, C) => ({
  ...input,
  hero: cards(input.hero, C),
  board: input.board ? cards(input.board, C) : []
});

test('контрольный набор содержит 10 префлоп- и 20 постфлоп-раздач', () => {
  assert.equal(preflopHands.length, 10);
  assert.equal(postflopHands.length, 20);
  assert.equal(
    new Set([...preflopHands, ...postflopHands].map(hand => hand.id)).size,
    30
  );
});

test('каждая контрольная раздача фиксирует входы, альтернативы, размер, математику и допущения', () => {
  for (const hand of [...preflopHands, ...postflopHands]) {
    assert.ok(hand.id && hand.title, 'id and title are required');
    assert.equal(typeof hand.input, 'object', `${hand.id}: input`);
    assert.ok(Array.isArray(hand.assumptions) && hand.assumptions.length > 0, `${hand.id}: assumptions`);
    assert.equal(typeof hand.boundary, 'boolean', `${hand.id}: boundary`);
    assert.ok(['validation', 'mathematical', 'strategic'].includes(hand.decisionClass), `${hand.id}: decisionClass`);
    assert.ok(Object.hasOwn(hand.expected, 'math'), `${hand.id}: math contract`);
    if (!hand.expected.error) {
      assert.ok(ACTIONS.has(hand.expected.action), `${hand.id}: expected action`);
      assert.ok(Array.isArray(hand.expected.alternatives), `${hand.id}: alternatives`);
      assert.ok(Array.isArray(hand.expected.confidence), `${hand.id}: confidence`);
      assert.ok(
        hand.expected.sizeRange === null ||
          (Array.isArray(hand.expected.sizeRange) && hand.expected.sizeRange.length === 2),
        `${hand.id}: size range`
      );
    }
  }
});

for (const hand of preflopHands) {
  test(`префлоп: ${hand.title}`, () => {
    const trainer = loadTrainer({ seed: seedFor(hand.id) });
    trainer.setPreflopContext(hand.context || {});
    const input = prepare(hand.input, trainer.C);

    if (hand.expected.error) {
      const openerGroup = input.situation === 'vs_raise_early'
        ? 'early'
        : input.situation === 'vs_raise_late'
          ? 'late'
          : input.situation === 'blind_defense'
            ? 'blind_defense'
            : null;
      assert.throws(
        () => trainer.validateAnalyzerPosition(input.position, openerGroup),
        hand.expected.error
      );
      return;
    }

    const result = trainer.analyzerPreflop(input);
    assert.equal(result.best, hand.expected.action);
    assert.ok(
      hand.expected.confidence.includes(result.confidenceLabel),
      `${hand.id}: confidence ${result.confidenceLabel}`
    );
    const size = recommendationSize(result.recommendation);
    if (hand.expected.sizeRange) {
      assert.notEqual(size, null, `${hand.id}: recommendation size`);
      inRange(size, hand.expected.sizeRange, `${hand.id}: size`);
    } else {
      assert.equal(size, null, `${hand.id}: unexpected size`);
    }
    assert.equal(result.math, null);
    for (const field of [
      'recommendation', 'range', 'why', 'missed', 'alternativesText', 'oneLine', 'model'
    ]) {
      assert.equal(typeof result[field], 'string', `${hand.id}: ${field}`);
    }
    assert.ok(Array.isArray(result.alternatives), `${hand.id}: structured alternatives`);
  });
}

for (const hand of postflopHands) {
  test(`постфлоп: ${hand.title}`, () => {
    const trainer = loadTrainer({ seed: seedFor(hand.id) });
    const input = prepare(hand.input, trainer.C);
    const result = trainer.analyzerPostflop(input);
    const expectedMath = hand.expected.math;

    assert.equal(result.best, hand.expected.action);
    assert.ok(
      hand.expected.confidence.includes(result.confidenceLabel),
      `${hand.id}: confidence ${result.confidenceLabel}`
    );
    const size = recommendationSize(result.recommendation);
    if (hand.expected.sizeRange) {
      assert.notEqual(size, null, `${hand.id}: recommendation size`);
      inRange(size, hand.expected.sizeRange, `${hand.id}: size`);
    } else {
      assert.equal(size, null, `${hand.id}: unexpected size`);
    }

    assert.ok(result.math, `${hand.id}: math result`);
    inRange(result.math.equity.equity, expectedMath.equity, `${hand.id}: equity`);
    inRange(result.math.required, expectedMath.required, `${hand.id}: required equity`);
    inRange(result.math.spr, expectedMath.spr, `${hand.id}: SPR`);
    assert.equal(result.math.equity.method, expectedMath.method, `${hand.id}: method`);
    if (expectedMath.edgeSign === 'positive') {
      assert.ok(result.math.edge > 0, `${hand.id}: positive equity edge`);
    }
    if (expectedMath.edgeSign === 'negative') {
      assert.ok(result.math.edge < 0, `${hand.id}: negative equity edge`);
    }
    for (const [field, actualField] of [
      ['strongOuts', 'strongOuts'],
      ['conditionalOuts', 'conditionalOuts'],
      ['dirtyOuts', 'dirtyOuts']
    ]) {
      if (expectedMath[field]) {
        inRange(
          result.math.outs[actualField],
          expectedMath[field],
          `${hand.id}: ${field}`
        );
      }
    }
    if (expectedMath.callEVSign) {
      const ev = trainer.C.callEV({
        equity: result.math.equity.equity,
        potBefore: input.pot,
        bet: input.bet,
        call: input.bet
      }).ev;
      assert.equal(
        Math.sign(ev),
        expectedMath.callEVSign === 'positive' ? 1 : -1,
        `${hand.id}: call EV`
      );
    }
    for (const field of [
      'recommendation', 'range', 'why', 'missed', 'alternativesText', 'oneLine', 'model'
    ]) {
      assert.equal(typeof result[field], 'string', `${hand.id}: ${field}`);
    }
    assert.ok(Array.isArray(result.alternatives), `${hand.id}: structured alternatives`);
  });
}

test('пограничное решение меняется при небольшом изменении диапазона', () => {
  const tight = postflopHands.find(hand => hand.id === 'range-sensitive-tight');
  const wide = postflopHands.find(hand => hand.id === 'range-sensitive-wide');
  const trainer = loadTrainer();
  const tightResult = trainer.analyzerPostflop(prepare(tight.input, trainer.C));
  const wideResult = trainer.analyzerPostflop(prepare(wide.input, trainer.C));

  assert.equal(tightResult.best, 'fold');
  assert.equal(wideResult.best, 'call');
  assert.equal(tightResult.confidence, 'medium');
  assert.equal(wideResult.confidence, 'medium');
  assert.equal(tightResult.isMarginal, true);
  assert.equal(wideResult.isMarginal, true);
  assert.ok(Math.abs(tightResult.math.edge) < 0.05);
  assert.ok(Math.abs(wideResult.math.edge) < 0.05);
});

test('префлоп-контекст отражается в контракте без подмены статического диапазона', () => {
  const trainer = loadTrainer();
  const base = prepare(preflopHands[0].input, trainer.C);
  const changed = {
    ...base,
    villain: 'wild',
    pot: 999,
    stack: 20,
    opponents: 4,
    customRange: '22'
  };
  const first = trainer.analyzerPreflop(base);
  const second = trainer.analyzerPreflop(changed);
  assert.deepEqual(
    {
      best: second.best,
      recommendation: second.recommendation,
      range: second.range
    },
    {
      best: first.best,
      recommendation: first.recommendation,
      range: first.range
    }
  );
  assert.equal(first.confidence, 'high');
  assert.equal(second.confidence, 'low');
  assert.equal(second.isMarginal, true);
  assert.notDeepEqual(second.assumptions, first.assumptions);
  assert.notEqual(second.explanation, first.explanation);
});

test('постфлоп-позиция отражается в контракте, а notes меняет только текст модели', () => {
  const hand = postflopHands.find(item => item.id === 'river-bluff-catch');
  const trainer = loadTrainer();
  const base = prepare(hand.input, trainer.C);
  const first = trainer.analyzerPostflop({ ...base, position: 'UTG', notes: '' });
  const second = trainer.analyzerPostflop({
    ...base,
    position: 'BTN',
    notes: 'Проверочная заметка'
  });
  assert.equal(second.best, first.best);
  assert.equal(second.recommendation, first.recommendation);
  assert.equal(second.confidence, first.confidence);
  assert.equal(second.math.equity.equity, first.math.equity.equity);
  assert.notDeepEqual(second.assumptions, first.assumptions);
  assert.notEqual(second.explanation, first.explanation);
  assert.notEqual(second.model, first.model);
});

test('исправленные противоречия удалены из данных аудита', () => {
  const contradictions = [...preflopHands, ...postflopHands]
    .filter(hand => hand.knownContradiction);
  assert.deepEqual(contradictions, []);
});
