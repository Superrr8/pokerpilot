'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Engine = require('../src/training/trainer-explanation-engine.js');
const UI = require('../src/ui/trainer-explanation.js');
const { loadTrainer } = require('./trainer-loader.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function liveTrainerResult(overrides = {}) {
  return {
    actionClass: 'FOLD',
    amount: null,
    amountUnit: null,
    confidence: 'medium',
    isMarginal: false,
    callEV: null,
    callEVMethod: null,
    alternatives: [],
    explanation: '73o обычно слишком слаба из HJ в базовой 9-max live-модели.',
    ...overrides
  };
}

test('weak offsuit Live spot produces teaching structure instead of only the legacy sentence', () => {
  const explanation = Engine.generateExplanation({
    street: 'preflop',
    handClass: '73o',
    position: 'HJ',
    opponents: 5,
    actionContext: 'firstin',
    trainerResult: liveTrainerResult()
  });
  const model = UI.createViewModel(explanation, liveTrainerResult());
  assert.ok(model.primaryReasons.length >= 2);
  assert.deepEqual(
    model.supportingSections.map(section => section.title),
    ['Ключевые факторы', 'Что изменило бы решение', 'Запомнить']
  );
  assert.match(JSON.stringify(model), /offsuit|разномаст/i);
  assert.match(JSON.stringify(model), /позади|позици/i);
  assert.match(JSON.stringify(model), /связност|suited|одномаст/i);
});

test('Live result has a dedicated shared Coach explanation destination', () => {
  assert.match(html, /id="liveExplanation"[^>]*class="trainer-explanation hidden"/);
});

test('Live result invokes the same structured explanation path as Trainer surfaces', () => {
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?liveTrainerResult,[\s\S]*?record\.decisionQuality/);
});

test('Live recommendation snapshot is shared by scoring and explanation without mutation', () => {
  assert.match(html, /const liveTrainerResult\s*=\s*\{[\s\S]*?actionClass:evaluation\.best[\s\S]*?explanation:evaluation\.why[\s\S]*?\};/);
  assert.match(html, /trainer:liveTrainerResult/);
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?liveTrainerResult/);
});

test('Live passes real scenario context and existing math to the explanation engine', () => {
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?street:session\.street/);
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?handClass:C\.handClass\(hero\.cards\)/);
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?boardTexture:/);
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?positionState:/);
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?math:/);
});

test('Live keeps the legacy summary only as an explicit renderer fallback', () => {
  assert.match(html, /const liveExplanationModel\s*=\s*renderTrainerExplanation\('#liveExplanation'/);
  assert.match(html, /liveExplanationModel\s*\?\s*' trainer-feedback-superseded'\s*:\s*''/);
});

test('partial structured explanation remains useful without optional math', () => {
  const model = UI.createViewModel({
    summary: 'Fold сохраняет стек.',
    reasons: ['Несколько игроков остаются позади.'],
    keyFactors: ['позиция HJ'],
    alternatives: [],
    takeaway: '',
    math: {}
  }, liveTrainerResult());
  assert.deepEqual(model.primaryReasons, ['Несколько игроков остаются позади.']);
  assert.equal(model.hasMath, false);
  assert.deepEqual(model.supportingSections.map(section => section.title), ['Ключевые факторы']);
});

test('postflop explanation exposes supplied math but never calculates it', () => {
  const result = liveTrainerResult({ actionClass: 'CALL', callEV: 6, callEVMethod: 'exact' });
  const explanation = Engine.generateExplanation({
    street: 'turn',
    positionState: 'oop',
    opponents: 2,
    actionContext: 'facing_bet',
    trainerResult: result,
    math: {
      handName: 'Одна пара',
      equity: { equity: 0.38 },
      required: 0.25,
      callEV: 6,
      outs: { strongOuts: 5, conditionalOuts: 2, strongNextCard: 5 / 46 }
    }
  });
  const model = UI.createViewModel(explanation, result);
  assert.equal(model.hasMath, true);
  assert.match(model.sections.find(section => section.title === 'Математика').items.join(' '), /38%.*25%.*\+\$6/s);
});

test('real Trainer recommendation remains byte-for-byte unchanged by explanation generation', () => {
  const trainer = loadTrainer();
  const input = {
    street: 'preflop',
    hero: [trainer.C.parseCard('Kh'), trainer.C.parseCard('Jd')],
    position: 'BB',
    openerPosition: 'UTG',
    situation: 'vs_raise_early',
    stack: 100,
    opponents: 1,
    villain: 'tight'
  };
  const result = trainer.analyzerPreflop(input);
  const before = JSON.stringify(result);
  Engine.generateExplanation({ ...input, actionContext: input.situation, trainerResult: result });
  assert.equal(JSON.stringify(result), before);
});

test('Stage 12.3 does not introduce poker calculations into presentation modules', () => {
  const engine = fs.readFileSync(path.join(root, 'src/training/trainer-explanation-engine.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/ui/trainer-explanation.js'), 'utf8');
  assert.doesNotMatch(engine, /PokerCore|equityVsRange|analyzeOuts|callEV\s*\(/);
  assert.doesNotMatch(ui, /PokerCore|equityVsRange|analyzeOuts|callEV\s*\(/);
});
