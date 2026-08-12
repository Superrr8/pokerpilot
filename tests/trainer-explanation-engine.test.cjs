'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../src/training/trainer-explanation-engine.js');

function trainer(overrides = {}) {
  return {
    actionClass: 'FOLD',
    amount: null,
    amountUnit: null,
    confidence: 'high',
    isMarginal: false,
    alternatives: [],
    assumptions: [],
    explanation: 'Существующее объяснение Trainer.',
    math: null,
    ...overrides
  };
}

function explain(overrides = {}) {
  return Engine.generateExplanation({
    street: 'preflop',
    handClass: 'K6o',
    position: 'CO',
    opponents: 1,
    actionContext: 'firstin',
    trainerResult: trainer(),
    ...overrides
  });
}

test('публичный контракт Coach 2.0 стабилен и содержит только structured data', () => {
  const result = explain();
  assert.equal(typeof result.summary, 'string');
  assert.ok(Array.isArray(result.reasons));
  assert.ok(Array.isArray(result.keyFactors));
  assert.ok(Array.isArray(result.alternatives));
  assert.equal(typeof result.takeaway, 'string');
  assert.equal(typeof result.math, 'object');
  assert.equal(typeof result.confidenceExplanation, 'string');
  assert.equal(typeof result.decisionQualityExplanation, 'string');
  assert.ok(result.reasons.length >= 2 && result.reasons.length <= 4);
});

test('premium pair из ранней позиции объясняется силой руки без выдуманной equity', () => {
  const result = explain({
    handClass: 'AA',
    position: 'UTG',
    trainerResult: trainer({ actionClass: 'RAISE', amount: 12 })
  });
  assert.match(result.summary, /премиальн/i);
  assert.match(result.keyFactors.join(' '), /ранн|UTG/i);
  assert.deepEqual(result.math, {});
  assert.doesNotMatch(JSON.stringify(result), /equity|эквити/i);
});

test('weak offsuit king объясняет kicker, domination и игроков позади', () => {
  const result = explain();
  const text = JSON.stringify(result);
  assert.match(text, /разномаст|offsuit/i);
  assert.match(text, /kicker/i);
  assert.match(text, /доминац/i);
  assert.match(text, /позади/i);
});

test('suited ace и suited connector получают разные hand-class причины', () => {
  const ace = explain({ handClass: 'A5s', position: 'BTN', trainerResult: trainer({ actionClass: 'RAISE' }) });
  const connector = explain({ handClass: '76s', position: 'BTN', trainerResult: trainer({ actionClass: 'RAISE' }) });
  assert.match(JSON.stringify(ace), /одномастн.*туз|suited ace/i);
  assert.match(JSON.stringify(connector), /коннектор|последователь/i);
  assert.notEqual(ace.summary, connector.summary);
});

test('suited broadway не классифицируется как connector', () => {
  const result = explain({ handClass: 'KQs', position: 'BTN', trainerResult: trainer({ actionClass: 'RAISE' }) });
  assert.match(JSON.stringify(result), /одномастный broadway/i);
  assert.doesNotMatch(JSON.stringify(result), /одномастный коннектор/i);
});

test('одинаковая рука из EP и BTN получает разный позиционный контекст', () => {
  const early = explain({ handClass: 'K9o', position: 'UTG' });
  const button = explain({ handClass: 'K9o', position: 'BTN' });
  assert.match(JSON.stringify(early), /ранн|позади/i);
  assert.match(JSON.stringify(button), /BTN|поздн/i);
  assert.notDeepEqual(early.keyFactors, button.keyFactors);
});

test('facing raise, multiway limp и short-stack shove отражают реальный action context', () => {
  const facing = explain({ actionContext: 'vs_raise_early', trainerResult: trainer({ actionClass: 'CALL', confidence: 'medium' }) });
  const limp = explain({ actionContext: 'limpers', opponents: 3, limpers: 3, trainerResult: trainer({ actionClass: 'RAISE' }) });
  const shove = explain({ handClass: 'AKs', actionContext: 'vs_3bet', stack: 25, bet: 30, trainerResult: trainer({ actionClass: 'ALL_IN', amount: 25 }) });
  assert.match(JSON.stringify(facing), /рейз|открыт/i);
  assert.match(JSON.stringify(limp), /лимп|multiway/i);
  assert.match(JSON.stringify(shove), /коротк|стек|ALL-IN/i);
});

test('postflop strong made hand использует готовую силу и board texture', () => {
  const result = explain({
    street: 'flop', handClass: 'AQs', position: 'BTN', positionState: 'ip',
    boardTexture: { wet: true, connected: true, paired: false, flushy: false },
    trainerResult: trainer({ actionClass: 'BET', math: { handName: 'Стрит', equity: { equity: 0.92 }, spr: 3.2 } })
  });
  assert.match(result.summary, /стрит/i);
  assert.match(JSON.stringify(result), /связан|динамич/i);
  assert.equal(result.math.equity, 0.92);
  assert.equal(result.math.spr, 3.2);
});

test('top pair с weak kicker отличается от strong kicker', () => {
  const base = {
    street: 'flop', board: [{ r: 13, s: 's' }, { r: 7, s: 'd' }, { r: 2, s: 'c' }],
    trainerResult: trainer({ actionClass: 'CHECK', math: { handName: 'Одна пара' } })
  };
  const weak = explain({ ...base, hero: [{ r: 13, s: 'h' }, { r: 6, s: 'd' }] });
  const strong = explain({ ...base, hero: [{ r: 13, s: 'h' }, { r: 14, s: 'd' }] });
  assert.match(JSON.stringify(weak), /top pair.*слаб|слаб.*kicker/i);
  assert.match(JSON.stringify(strong), /top pair.*силь|силь.*kicker/i);
});

test('flush, straight и combo draws используют только существующие outs', () => {
  const draw = groups => explain({
    street: 'flop',
    trainerResult: trainer({
      actionClass: 'CALL',
      math: {
        handName: 'Старшая карта',
        outs: { strongOuts: 9, conditionalOuts: 0, strongNextCard: 9 / 47, groups },
        equity: { equity: 0.36 }, required: 0.25, callEV: 8
      }
    })
  });
  assert.match(JSON.stringify(draw([{ label: 'Флеш', outs: 9 }])), /флеш-дро/i);
  assert.match(JSON.stringify(draw([{ label: 'Стрит', outs: 8 }])), /стрит-дро/i);
  assert.match(JSON.stringify(draw([{ label: 'Флеш', outs: 9 }, { label: 'Стрит', outs: 8 }])), /комбо-дро/i);
});

test('ауты made hand на сет не называются draw без flush/straight group', () => {
  const result = explain({
    street: 'flop',
    hero: [{ r: 14, s: 'h' }, { r: 14, s: 'd' }],
    board: [{ r: 13, s: 's' }, { r: 7, s: 'd' }, { r: 2, s: 'c' }],
    trainerResult: trainer({ actionClass: 'BET', math: { handName: 'Пара', outs: { strongOuts: 2, groups: [{ label: 'Сет', outs: 2 }] } } })
  });
  assert.match(JSON.stringify(result), /оверпара/i);
  assert.doesNotMatch(JSON.stringify(result), /у Hero дро|флеш-дро|стрит-дро|комбо-дро/i);
});

test('dry/wet, IP/OOP и multiway дают разные подтверждённые причины', () => {
  const dryIp = explain({ street: 'flop', positionState: 'ip', opponents: 1, boardTexture: { wet: false }, trainerResult: trainer({ actionClass: 'BET', math: { handName: 'Одна пара' } }) });
  const wetOopMulti = explain({ street: 'flop', positionState: 'oop', opponents: 3, boardTexture: { wet: true, connected: true }, trainerResult: trainer({ actionClass: 'CHECK', confidence: 'medium', isMarginal: true, math: { handName: 'Одна пара' } }) });
  assert.match(JSON.stringify(dryIp), /сух|спокойн/i);
  assert.match(JSON.stringify(dryIp), /позици/i);
  assert.match(JSON.stringify(wetOopMulti), /динамич|связан/i);
  assert.match(JSON.stringify(wetOopMulti), /multiway|нескольк/i);
  assert.match(JSON.stringify(wetOopMulti), /без позиции|OOP/i);
});

test('two-tone board из известных карт не называется сухой', () => {
  const result = explain({
    street: 'flop',
    board: [{ r: 12, s: 's' }, { r: 7, s: 's' }, { r: 2, s: 'd' }],
    boardTexture: { wet: false, connected: false },
    trainerResult: trainer({ actionClass: 'CALL', math: { handName: 'Старшая карта' } })
  });
  assert.match(JSON.stringify(result), /two-tone|flush draw/i);
  assert.doesNotMatch(JSON.stringify(result), /доска сухая/i);
});

test('river explanation не обещает будущие draw или следующую карту', () => {
  const result = explain({
    street: 'river',
    board: [{ r: 11, s: 'd' }, { r: 8, s: 'c' }, { r: 4, s: 's' }, { r: 9, s: 'h' }, { r: 2, s: 'd' }],
    boardTexture: { connected: true },
    trainerResult: trainer({ actionClass: 'CALL', math: { handName: 'Одна пара', equity: { equity: 0.4 }, required: 0.25 } })
  });
  assert.match(JSON.stringify(result), /будущих draw уже нет/i);
  assert.doesNotMatch(JSON.stringify(result), /следующей карте/i);
});

test('pot odds profitable/unprofitable объясняются только из готовых math values', () => {
  const profitable = explain({ street: 'turn', pot: 100, bet: 25, trainerResult: trainer({ actionClass: 'CALL', callEV: 9, math: { handName: 'Одна пара', equity: { equity: 0.38 }, required: 0.20, callEV: 9 } }) });
  const unprofitable = explain({ street: 'turn', pot: 100, bet: 50, trainerResult: trainer({ actionClass: 'FOLD', callEV: -12, math: { handName: 'Одна пара', equity: { equity: 0.21 }, required: 0.333, callEV: -12 } }) });
  assert.match(JSON.stringify(profitable), /20%/);
  assert.match(JSON.stringify(profitable), /38%/);
  assert.match(JSON.stringify(profitable), /\+\$9/);
  assert.match(JSON.stringify(unprofitable), /33%/);
  assert.match(JSON.stringify(unprofitable), /21%/);
  assert.match(JSON.stringify(unprofitable), /-\$12/);
});

test('отсутствующая математика, range, blockers и implied odds не выдумываются', () => {
  const text = JSON.stringify(explain());
  assert.doesNotMatch(text, /equity|эквити|аут|EV|SPR|implied|blocker|блокер|диапазон соперника/i);
});

test('confidence и Decision Quality получают отдельные человеческие объяснения', () => {
  const result = explain({
    trainerResult: trainer({ confidence: 'medium', isMarginal: true }),
    decisionQuality: { isRated: true, score: 96, grade: 'A+', reasons: ['Вы выбрали основное действие тренера.', 'Размер близок к рекомендованному.'] }
  });
  assert.match(result.confidenceExplanation, /погранич|не полностью однознач/i);
  assert.match(result.decisionQualityExplanation, /основн.*действ|размер/i);
});

test('одинаковый input детерминирован и не мутирует trainer recommendation', () => {
  const input = { street: 'preflop', handClass: 'K6o', position: 'CO', opponents: 1, actionContext: 'firstin', trainerResult: trainer() };
  const before = JSON.stringify(input);
  assert.deepEqual(Engine.generateExplanation(input), Engine.generateExplanation(input));
  assert.equal(JSON.stringify(input), before);
  assert.equal(input.trainerResult.actionClass, 'FOLD');
});

test('engine не импортирует и не пересчитывает PokerCore, equity, outs или EV', () => {
  const source = require('node:fs').readFileSync(require.resolve('../src/training/trainer-explanation-engine.js'), 'utf8');
  assert.doesNotMatch(source, /PokerCore|equityVsRange|analyzeOuts|callEV\s*\(/);
});
