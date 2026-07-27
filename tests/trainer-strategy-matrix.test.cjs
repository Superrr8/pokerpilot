'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTrainer } = require('./trainer-loader.cjs');
const {
  preflopScenarios,
  postflopScenarios
} = require('./fixtures/trainer-strategy-matrix.cjs');

const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
const CONFIDENCE = new Set(['low', 'medium', 'high']);
const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 };
const trainer = loadTrainer({ seed: 0x6400cafe });
const { C } = trainer;
const results = new Map();
const cards = text => text
  ? text.split(/\s+/).map(C.parseCard)
  : [];
const prepare = input => ({
  ...input,
  hero: cards(input.hero),
  board: cards(input.board)
});

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function allowedActions(scenario) {
  const { input } = scenario;
  if (input.street === 'preflop') {
    if (input.situation === 'firstin') return new Set(['FOLD', 'RAISE', 'ALL_IN']);
    return new Set(['FOLD', 'CALL', 'RAISE', 'ALL_IN']);
  }
  if (input.situation === 'checked_to') {
    return new Set(['CHECK', 'BET', 'ALL_IN']);
  }
  return new Set(['FOLD', 'CALL', 'RAISE', 'ALL_IN']);
}

function assertLegacyCompatibility(result, id) {
  const expectedBest = result.actionClass === 'ALL_IN'
    ? 'allin'
    : result.actionClass.toLowerCase();
  const confidenceLabels = { low: 'низкая', medium: 'средняя', high: 'высокая' };
  assert.equal(result.best, expectedBest, `[contract] ${id}: legacy best`);
  assert.equal(
    result.confidenceLabel,
    confidenceLabels[result.confidence],
    `[contract] ${id}: legacy confidence label`
  );
  assert.equal(result.why, result.explanation, `[contract] ${id}: why/explanation`);
  assert.equal(typeof result.recommendation, 'string', `[contract] ${id}: recommendation`);
  assert.ok(result.recommendation.length > 0, `[contract] ${id}: empty recommendation`);
  if (result.actionClass === 'ALL_IN') {
    assert.match(result.recommendation, /^ALL-IN/, `[contract] ${id}: ALL_IN label`);
  } else {
    assert.match(
      result.recommendation,
      new RegExp(`^${result.actionClass}`),
      `[contract] ${id}: action/recommendation mismatch`
    );
  }
}

function assertExplanationConsistency(result, scenario) {
  const { id } = scenario;
  if (result.actionClass === 'ALL_IN') {
    assert.match(
      result.explanation,
      /ALL-?IN|весь .*стек|весь effective stack/i,
      `[explanation] ${id}: ALL_IN is explained as an ordinary call/bet/raise`
    );
  }
  if (result.actionClass === 'FOLD') {
    assert.doesNotMatch(
      result.explanation,
      /колл сохраняет|позволяют ставить|достаточно сильна для 4-бета/i,
      `[explanation] ${id}: FOLD explanation recommends continuing`
    );
    if (Number.isFinite(result.callEV) && result.callEV > 0) {
      assert.doesNotMatch(
        result.explanation,
        /будет убыточн|математически убыточн/i,
        `[explanation] ${id}: positive callEV is described as mathematically losing`
      );
    }
  }
  if (result.actionClass === 'CHECK') {
    assert.doesNotMatch(
      result.explanation,
      /позволяют ставить/i,
      `[explanation] ${id}: CHECK explanation recommends betting`
    );
  }
  if (result.actionClass === 'BET' || result.actionClass === 'RAISE') {
    assert.doesNotMatch(
      result.explanation,
      /нет уверенного вэлью-бета|equity .*недостаточно/i,
      `[explanation] ${id}: aggressive action explanation rejects aggression`
    );
  }
}

function assertStructuredContract(result, scenario) {
  const { id, input } = scenario;
  const allowed = allowedActions(scenario);
  assert.ok(ACTIONS.has(result.actionClass), `[contract] ${id}: actionClass`);
  assert.ok(allowed.has(result.actionClass), `[contract] ${id}: action is impossible here`);
  assert.ok(CONFIDENCE.has(result.confidence), `[contract] ${id}: confidence`);
  assert.equal(typeof result.isMarginal, 'boolean', `[contract] ${id}: isMarginal`);
  assert.ok(Array.isArray(result.assumptions), `[contract] ${id}: assumptions`);
  assert.ok(result.assumptions.length > 0, `[contract] ${id}: empty assumptions`);
  assert.equal(typeof result.explanation, 'string', `[contract] ${id}: explanation`);
  assert.ok(result.explanation.length > 0, `[contract] ${id}: empty explanation`);

  assert.ok(
    result.amount === null || Number.isFinite(result.amount),
    `[contract] ${id}: amount`
  );
  if (result.amount !== null) {
    assert.ok(result.amount >= 0, `[contract] ${id}: negative amount`);
    assert.ok(result.amount <= input.stack, `[contract] ${id}: amount exceeds stack`);
    if (result.amount === input.stack) {
      assert.equal(
        result.actionClass,
        'ALL_IN',
        `[contract] ${id}: full-stack action is not ALL_IN`
      );
    }
  }
  if (result.actionClass === 'ALL_IN') {
    assert.equal(result.amount, input.stack, `[contract] ${id}: ALL_IN amount`);
  }
  if (result.actionClass === 'FOLD' || result.actionClass === 'CHECK') {
    assert.ok(
      result.amount === null || result.amount === 0,
      `[contract] ${id}: passive action has money amount`
    );
  }
  if (result.actionClass === 'CALL') {
    assert.ok(result.amount <= input.stack, `[contract] ${id}: CALL exceeds stack`);
  }
  if (result.actionClass === 'RAISE') {
    assert.ok(result.amount > input.bet, `[contract] ${id}: RAISE is not above call/bet`);
  }

  if (input.street !== 'preflop' && input.situation !== 'checked_to' && input.bet > 0) {
    assert.equal(typeof result.callEV, 'number', `[contract] ${id}: missing callEV`);
  }
  if (input.street !== 'preflop' && input.situation === 'checked_to') {
    assert.equal(result.callEV, null, `[contract] ${id}: callEV without a bet`);
  }
  if (result.isMarginal) {
    assert.notEqual(result.confidence, 'high', `[strategy] ${id}: marginal high confidence`);
  }
  if (scenario.complexMultiway) {
    assert.notEqual(
      result.confidence,
      'high',
      `[strategy] ${id}: complex multiway result has high confidence`
    );
  }

  assert.ok(Array.isArray(result.alternatives), `[contract] ${id}: alternatives`);
  const alternativeKeys = new Set();
  for (const alternative of result.alternatives) {
    assert.ok(ACTIONS.has(alternative.actionClass), `[contract] ${id}: alternative action`);
    assert.ok(
      allowed.has(alternative.actionClass),
      `[contract] ${id}: impossible alternative ${alternative.actionClass}`
    );
    assert.notEqual(
      alternative.actionClass,
      result.actionClass,
      `[contract] ${id}: alternative duplicates primary action`
    );
    assert.ok(
      alternative.amount === null || (
        Number.isFinite(alternative.amount) &&
        alternative.amount >= 0 &&
        alternative.amount <= input.stack
      ),
      `[contract] ${id}: alternative amount`
    );
    const key = `${alternative.actionClass}:${alternative.amount}`;
    assert.ok(!alternativeKeys.has(key), `[contract] ${id}: duplicate alternative`);
    alternativeKeys.add(key);
    assert.equal(typeof alternative.reason, 'string', `[contract] ${id}: alternative reason`);
  }

  const assumptions = result.assumptions.join(' ');
  assert.match(assumptions, /Позиция героя:/i, `[assumptions] ${id}: hero position`);
  assert.match(assumptions, /Тип соперника:/i, `[assumptions] ${id}: villain profile`);
  assert.match(
    assumptions,
    input.opponents > 1 ? /multiway/i : /heads-up/i,
    `[assumptions] ${id}: opponents`
  );
  if (input.street !== 'preflop') {
    assert.match(assumptions, /SPR:/i, `[assumptions] ${id}: SPR`);
    assert.match(assumptions, /Размер ставки:/i, `[assumptions] ${id}: bet size`);
  }
  if (scenario.neutralDefault) {
    assert.match(assumptions, /нейтраль|reg/i, `[assumptions] ${id}: unknown default`);
  }
  if (scenario.customRangeDisclosure) {
    assert.match(
      assumptions,
      /пользовательск|не пересчиты|не примен/i,
      `[assumptions] ${id}: preflop custom range is silently ignored`
    );
  }

  if (input.street === 'river') {
    assert.equal(result.math.outs.nextCard, 0, `[math-contract] ${id}: river next card`);
    assert.equal(result.math.outs.byRiver, 0, `[math-contract] ${id}: river by-river`);
    assert.equal(result.math.outs.strongOuts, 0, `[math-contract] ${id}: river outs`);
  }
  if (scenario.golden) {
    assert.equal(
      result.actionClass,
      scenario.golden,
      `[golden] ${id}: unambiguous action`
    );
  }

  assertLegacyCompatibility(result, id);
  assertExplanationConsistency(result, scenario);
}

test('матрица содержит 301 уникальный сценарий и покрывает обязательные группы', () => {
  const all = [...preflopScenarios, ...postflopScenarios];
  assert.equal(preflopScenarios.length, 171);
  assert.equal(postflopScenarios.length, 130);
  assert.equal(all.length, 301);
  assert.equal(new Set(all.map(item => item.id)).size, 301);

  for (const group of [
    'position-open', 'bb-defense', 'villain-profile', 'heads-up-multiway',
    'limper-count', 'effective-stack', 'opening-size', 'threebet-size',
    'custom-range', 'unknown-default', 'near-hand'
  ]) {
    assert.ok(preflopScenarios.some(item => item.group === group), group);
  }
  for (const group of [
    'street-coverage', 'hero-position', 'opponent-position', 'villain-profile',
    'spr', 'bet-size', 'multiway', 'board-texture', 'made-hands', 'draws',
    'river-ev', 'one-pair-texture-comparison', 'determinism',
    'explanation-consistency'
  ]) {
    assert.ok(postflopScenarios.some(item => item.group === group), group);
  }
});

for (const scenario of preflopScenarios) {
  test(`матрица preflop: ${scenario.id}`, () => {
    trainer.setPreflopContext({
      limpers: 1,
      opener: 'early',
      ...(scenario.context || {})
    });
    const result = trainer.analyzerPreflop(prepare(scenario.input));
    results.set(scenario.id, result);
    assertStructuredContract(result, scenario);
  });
}

for (const scenario of postflopScenarios) {
  test(`матрица postflop: ${scenario.id}`, () => {
    const result = trainer.analyzerPostflop(prepare(scenario.input));
    results.set(scenario.id, result);
    assertStructuredContract(result, scenario);
  });
}

test('увеличение ставки не превращает уже найденный FOLD в CALL или RAISE', () => {
  const groups = groupBy(
    postflopScenarios.filter(item => item.group === 'bet-size'),
    'comparison'
  );
  for (const scenarios of groups.values()) {
    const ordered = [...scenarios].sort((a, b) => a.order - b.order);
    let folded = false;
    for (const scenario of ordered) {
      const result = results.get(scenario.id);
      if (result.actionClass === 'FOLD') folded = true;
      if (folded) {
        assert.ok(
          !['CALL', 'RAISE'].includes(result.actionClass),
          `[strategy] ${scenario.id}: larger bet revived a folded hand`
        );
      }
    }
  }
});

test('увеличение числа соперников не повышает confidence', () => {
  const groups = groupBy(
    postflopScenarios.filter(item => item.group === 'multiway'),
    'comparison'
  );
  for (const scenarios of groups.values()) {
    const ordered = [...scenarios].sort((a, b) => a.order - b.order);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = results.get(ordered[index - 1].id);
      const current = results.get(ordered[index].id);
      assert.ok(previous && current, `[test-fixture] missing result in ${ordered[index].comparison}`);
      const confidenceIncreased =
        CONFIDENCE_RANK[current.confidence] > CONFIDENCE_RANK[previous.confidence];
      if (confidenceIncreased) {
        const equityShift = Math.abs(
          current.math.equity.equity - previous.math.equity.equity
        );
        assert.ok(
          current.actionClass !== previous.actionClass &&
          equityShift >= 0.10 &&
          ['FOLD', 'CHECK'].includes(current.actionClass),
          `[strategy] ${ordered[index].id}: multiway increased confidence without a materially clearer defensive decision`
        );
        assert.match(
          current.explanation,
          /multiway|соперник/i,
          `[explanation] ${ordered[index].id}: justified confidence change lacks multiway reason`
        );
      }
    }
  }
});

test('пассивный river-профиль не получает больше предполагаемых блефов, чем aggressive', () => {
  const passive = results.get('post-profile-passive-bluff-catch');
  const aggressive = results.get('post-profile-aggro-bluff-catch');
  const continuationRank = { FOLD: 0, CALL: 1, RAISE: 2, ALL_IN: 2 };
  assert.ok(
    continuationRank[passive.actionClass] <= continuationRank[aggressive.actionClass],
    '[strategy] passive river profile continues wider than aggressive'
  );
  assert.notEqual(passive.explanation, aggressive.explanation);
});

test('позиция постфлоп-соперника отражается в assumptions и explanation', () => {
  const groups = groupBy(
    postflopScenarios.filter(item => item.group === 'opponent-position'),
    'comparison'
  );
  for (const scenarios of groups.values()) {
    const [first, second] = [...scenarios].sort((a, b) => a.order - b.order);
    const firstResult = results.get(first.id);
    const secondResult = results.get(second.id);
    assert.notDeepEqual(firstResult.assumptions, secondResult.assumptions);
    assert.notEqual(firstResult.explanation, secondResult.explanation);
  }
});

test('одинаковая equity при разном SPR меняет размер или объяснение', () => {
  const groups = groupBy(
    postflopScenarios.filter(item => item.group === 'spr'),
    'comparison'
  );
  for (const scenarios of groups.values()) {
    const ordered = [...scenarios].sort((a, b) => a.order - b.order);
    const first = results.get(ordered[0].id);
    for (const scenario of ordered.slice(1)) {
      const current = results.get(scenario.id);
      assert.equal(current.math.equity.equity, first.math.equity.equity);
      assert.ok(
        current.amount !== first.amount || current.explanation !== first.explanation,
        `[strategy] ${scenario.id}: SPR has no visible effect`
      );
    }
  }
});

test('похожие префлоп-руки не получают необъяснимо противоположные действия', () => {
  const groups = groupBy(
    preflopScenarios.filter(item => item.group === 'near-hand'),
    'comparison'
  );
  for (const scenarios of groups.values()) {
    const [first, second] = scenarios;
    const firstResult = results.get(first.id);
    const secondResult = results.get(second.id);
    const opposite = new Set([firstResult.actionClass, secondResult.actionClass]);
    if (opposite.has('FOLD') && opposite.has('RAISE')) {
      assert.match(firstResult.explanation, /диапазон/i);
      assert.match(secondResult.explanation, /диапазон/i);
      assert.notEqual(firstResult.explanation, secondResult.explanation);
    }
  }
});

test('более опасная текстура не повышает уверенность с той же одной парой', () => {
  const scenarios = postflopScenarios
    .filter(item => item.group === 'one-pair-texture-comparison')
    .sort((a, b) => a.order - b.order);
  const dry = results.get(scenarios[0].id);
  for (const scenario of scenarios.slice(1)) {
    const result = results.get(scenario.id);
    assert.ok(
      CONFIDENCE_RANK[result.confidence] <= CONFIDENCE_RANK[dry.confidence],
      `[strategy] ${scenario.id}: dangerous texture increased confidence`
    );
  }
});

test('river callEV покрывает положительный, около нулевого и отрицательный случаи', () => {
  const positive = results.get('post-river-ev-positive').callEV;
  const nearZero = results.get('post-river-ev-near-zero').callEV;
  const negative = results.get('post-river-ev-negative').callEV;
  assert.ok(positive > 0, `positive EV: ${positive}`);
  assert.ok(Math.abs(nearZero) <= 15, `near-zero EV: ${nearZero}`);
  assert.ok(negative < 0, `negative EV: ${negative}`);
});

test('одинаковый Monte Carlo-вход даёт полностью детерминированный результат', () => {
  const scenario = postflopScenarios.find(item => item.deterministicMonteCarlo);
  const deterministicTrainer = loadTrainer({ seed: 0x6400cafe });
  const input = {
    ...scenario.input,
    hero: cards(scenario.input.hero),
    board: cards(scenario.input.board)
  };
  const first = deterministicTrainer.analyzerPostflop(input);
  const second = deterministicTrainer.analyzerPostflop(input);
  assert.equal(first.math.equity.method, 'montecarlo');
  assert.deepEqual(
    {
      actionClass: second.actionClass,
      amount: second.amount,
      confidence: second.confidence,
      isMarginal: second.isMarginal,
      equity: second.math.equity,
      explanation: second.explanation
    },
    {
      actionClass: first.actionClass,
      amount: first.amount,
      confidence: first.confidence,
      isMarginal: first.isMarginal,
      equity: first.math.equity,
      explanation: first.explanation
    },
    '[strategy] identical analyzer input is not deterministic'
  );
});
