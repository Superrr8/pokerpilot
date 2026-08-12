'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/training/trainer-explanation-engine.js');
const { loadTrainer } = require('./trainer-loader.cjs');
const { preflopHands, postflopHands } = require('./fixtures/trainer-control-hands.cjs');

const cards = (text, C) => text.split(/\s+/).map(C.parseCard);
const prepare = (input, C) => ({
  ...input,
  hero: cards(input.hero, C),
  board: input.board ? cards(input.board, C) : []
});

function fixture(id) {
  return [...preflopHands, ...postflopHands].find(item => item.id === id);
}

function explanationInput(input, result) {
  return {
    street: input.street,
    handClass: input.handClass,
    hero: input.hero,
    board: input.board,
    position: input.position,
    opponents: input.opponents,
    actionContext: input.situation,
    pot: input.pot,
    bet: input.bet,
    stack: input.stack,
    customRange: input.customRange,
    trainerResult: result,
    math: result.math
  };
}

for (const id of ['early-open-aqs', 'fold-kjo-vs-early', 'short-stack-aks-vs-threebet']) {
  test(`реальный analyzerPreflop остаётся источником решения: ${id}`, () => {
    const hand = fixture(id);
    const trainer = loadTrainer();
    trainer.setPreflopContext(hand.context || {});
    const input = prepare(hand.input, trainer.C);
    input.handClass = trainer.C.handClass(input.hero);
    const result = trainer.analyzerPreflop(input);
    const recommendationBefore = JSON.stringify(result);
    const explanation = Engine.generateExplanation(explanationInput(input, result));
    assert.equal(JSON.stringify(result), recommendationBefore);
    assert.equal(result.best, hand.expected.action);
    assert.ok(explanation.reasons.length >= 2 && explanation.reasons.length <= 4);
    assert.deepEqual(explanation.math, {});
  });
}

for (const id of ['combo-draw-semi-bluff', 'multiway-overpair', 'positive-ev-call', 'negative-ev-call']) {
  test(`реальный analyzerPostflop передаёт готовую математику без пересчёта: ${id}`, () => {
    const hand = fixture(id);
    const trainer = loadTrainer();
    const input = prepare(hand.input, trainer.C);
    input.handClass = trainer.C.handClass(input.hero);
    const result = trainer.analyzerPostflop(input);
    const recommendationBefore = JSON.stringify(result);
    const explanation = Engine.generateExplanation(explanationInput(input, result));
    assert.equal(JSON.stringify(result), recommendationBefore);
    assert.equal(result.best, hand.expected.action);
    assert.equal(explanation.math.equity, result.math.equity.equity);
    assert.equal(explanation.math.requiredEquity, result.math.required);
    assert.equal(explanation.math.spr, result.math.spr);
    assert.ok(explanation.summary.length > 20);
    if (input.opponents > 1) assert.match(JSON.stringify(explanation), /multiway/i);
  });
}

test('пограничный fixture объясняет medium confidence без fake precision', () => {
  const hand = fixture('range-sensitive-tight');
  const trainer = loadTrainer();
  const input = prepare(hand.input, trainer.C);
  input.handClass = trainer.C.handClass(input.hero);
  const result = trainer.analyzerPostflop(input);
  const explanation = Engine.generateExplanation(explanationInput(input, result));
  assert.equal(result.isMarginal, true);
  assert.match(explanation.confidenceExplanation, /погранич/i);
  assert.doesNotMatch(explanation.confidenceExplanation, /GTO|точно|гарант/i);
});
