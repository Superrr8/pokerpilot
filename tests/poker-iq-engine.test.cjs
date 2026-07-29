'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fixtures, makeRecords, STREETS } = require('./fixtures/poker-iq-fixtures.cjs');
require('../src/poker-iq/poker-iq-config.js');
const PokerIQ = require('../src/poker-iq/poker-iq-engine.js');

test('PokerIQ public API стабилен', () => {
  for (const name of ['evaluate', 'getRank', 'getTrend', 'getBreakdown', 'getSampleStatus', 'getSummary']) {
    assert.equal(typeof PokerIQ[name], 'function', name);
  }
});

test('empty records возвращают NONE без score', () => {
  const result = PokerIQ.evaluate([]);
  assert.equal(result.score, null);
  assert.equal(result.isRated, false);
  assert.equal(result.sampleStatus, 'NONE');
});

test('UNRATED records исключаются', () => {
  const records = makeRecords(2);
  records.push({ decisionId: 'unrated', decisionQuality: { score: null, isRated: false } });
  assert.equal(PokerIQ.evaluate(records).ratedDecisions, 2);
});

for (const [count, status] of [[1, 'PROVISIONAL'], [9, 'PROVISIONAL'], [10, 'FORMING'], [29, 'FORMING'], [30, 'ESTABLISHED']]) {
  test(`${count} rated decisions дают ${status}`, () => {
    assert.equal(PokerIQ.evaluate(makeRecords(count)).sampleStatus, status);
  });
}

test('duplicate decisionId учитывается один раз', () => {
  const records = makeRecords(2);
  records.push(structuredClone(records[0]));
  assert.equal(PokerIQ.evaluate(records).ratedDecisions, 2);
});

for (const score of [-1, 101, NaN, Infinity, -Infinity, 'broken']) {
  test(`invalid DQ score ${String(score)} игнорируется`, () => {
    const records = makeRecords(1);
    records[0].decisionQuality.score = score;
    assert.equal(PokerIQ.evaluate(records).score, null);
  });
}

test('одинаковый вход даёт полностью детерминированный результат', () => {
  const records = makeRecords(40, { score: 86, streets: STREETS });
  assert.deepEqual(PokerIQ.evaluate(records), PokerIQ.evaluate(structuredClone(records)));
});

test('порядок records не меняет результат', () => {
  const records = makeRecords(40, { scores: [65, 75, 85, 95], streets: STREETS });
  assert.deepEqual(PokerIQ.evaluate(records), PokerIQ.evaluate([...records].reverse()));
});

test('более высокий DQ даёт более высокий Poker IQ', () => {
  assert.ok(PokerIQ.evaluate(makeRecords(60, { score: 90 })).score > PokerIQ.evaluate(makeRecords(60, { score: 70 })).score);
});

test('стабильные scores выше волатильных с тем же средним', () => {
  const stable = PokerIQ.evaluate(makeRecords(40, { score: 90, streets: STREETS }));
  const volatile = PokerIQ.evaluate(makeRecords(40, { scores: [100, 80], streets: STREETS }));
  assert.ok(stable.score > volatile.score);
});

test('consistency modifier ограничен конфигом', () => {
  for (const records of [makeRecords(40, { score: 90 }), makeRecords(40, { scores: [0, 100] })]) {
    const modifier = PokerIQ.evaluate(records).components.consistencyModifier;
    assert.ok(modifier >= -50 && modifier <= 24);
  }
});

test('high confidence имеет больший аналитический вес чем low', () => {
  const high = PokerIQ.evaluate(makeRecords(60, { score: 85, confidence: 'high', streets: STREETS }));
  const low = PokerIQ.evaluate(makeRecords(60, { score: 85, confidence: 'low', streets: STREETS }));
  assert.ok(high.score > low.score);
});

test('medium confidence weight зафиксирован', () => {
  assert.equal(globalThis.POKER_IQ_CONFIG.confidenceWeights.medium, 0.92);
});

test('low confidence weight зафиксирован', () => {
  assert.equal(globalThis.POKER_IQ_CONFIG.confidenceWeights.low, 0.80);
});

test('Stage 9.2 calibration использует priorWeight 60 и endpoint DQ 100 → 2850', () => {
  assert.equal(globalThis.POKER_IQ_CONFIG.priorWeight, 60);
  assert.deepEqual(globalThis.POKER_IQ_CONFIG.dqCurve.at(-1), [100, 2850]);
});

for (const [dq, expectedScore, expectedRank] of [
  [80, 1634, 'ADVANCED'],
  [90, 1852, 'EXPERT'],
  [95, 2009, 'MASTER']
]) {
  test(`Stage 9.2 calibration: 100 решений DQ ${dq} → ${expectedScore} ${expectedRank}`, () => {
    const result = PokerIQ.evaluate(makeRecords(100, { score: dq, streets: STREETS }));
    assert.equal(result.score, expectedScore);
    assert.equal(result.rank.id, expectedRank);
  });
}

test('Stage 9.2 calibration не выдаёт Master за 30 идеальных решений', () => {
  const result = PokerIQ.evaluate(makeRecords(30, { score: 100, streets: STREETS }));
  assert.equal(result.score, 1971);
  assert.equal(result.rank.id, 'EXPERT');
});

test('Stage 9.2 calibration сохраняет достижимость Legend и PokerPilot', () => {
  const legend = PokerIQ.evaluate(makeRecords(500, { score: 100, streets: STREETS }));
  const pokerPilot = PokerIQ.evaluate(makeRecords(1000, { score: 100, streets: STREETS }));
  assert.equal(legend.score, 2763);
  assert.equal(legend.rank.id, 'LEGEND');
  assert.equal(pokerPilot.score, 2834);
  assert.equal(pokerPilot.rank.id, 'POKERPILOT');
});

test('marginal запись не доминирует weighted DQ', () => {
  const records = [
    ...makeRecords(20, { score: 80, start: Date.UTC(2026, 0, 1) }),
    ...makeRecords(1, { score: 100, marginal: true, confidence: 'low', start: Date.UTC(2026, 1, 1) })
  ];
  assert.ok(PokerIQ.evaluate(records).components.decisionQuality < 85);
});

test('последние решения имеют немного больший вес', () => {
  const recentStrong = [...makeRecords(25, { score: 70, start: Date.UTC(2026, 0, 1) }), ...makeRecords(25, { score: 90, start: Date.UTC(2026, 1, 1) })];
  const recentWeak = [...makeRecords(25, { score: 90, start: Date.UTC(2026, 0, 1) }), ...makeRecords(25, { score: 70, start: Date.UTC(2026, 1, 1) })];
  assert.ok(PokerIQ.evaluate(recentStrong).score > PokerIQ.evaluate(recentWeak).score);
});

test('старые записи продолжают влиять', () => {
  const recent = makeRecords(20, { score: 90, start: Date.UTC(2026, 1, 1) });
  const withPoorHistory = [...makeRecords(100, { score: 50, start: Date.UTC(2025, 0, 1) }), ...recent];
  assert.ok(PokerIQ.evaluate(withPoorHistory).score < PokerIQ.evaluate(recent).score);
});

test('маленькая выборка сильнее притянута к 1500', () => {
  const small = PokerIQ.evaluate(makeRecords(1, { score: 98 }));
  const large = PokerIQ.evaluate(makeRecords(100, { score: 98 }));
  assert.ok(Math.abs(small.score - 1500) < Math.abs(large.score - 1500));
});

test('большая выборка уменьшает shrinkage', () => {
  const small = PokerIQ.evaluate(makeRecords(10, { score: 90 }));
  const large = PokerIQ.evaluate(makeRecords(100, { score: 90 }));
  assert.ok(large.components.experience > small.components.experience);
});

for (const score of [0, 50, 100]) {
  test(`Poker IQ для DQ ${score} остаётся в 1000–3000`, () => {
    const result = PokerIQ.evaluate(makeRecords(500, { score, streets: STREETS }));
    assert.ok(result.score >= 1000 && result.score <= 3000);
  });
}

test('одно решение не создаёт максимальный рейтинг', () => {
  assert.ok(PokerIQ.evaluate(makeRecords(1, { score: 100 })).score < 1800);
});

test('высокий DQ малой выборки не создаёт Legend', () => {
  assert.ok(PokerIQ.evaluate(makeRecords(9, { score: 100 })).rank.minScore < 2600);
});

test('высокий DQ большой стабильной выборки создаёт высокий rank', () => {
  assert.ok(PokerIQ.evaluate(makeRecords(300, { score: 98, streets: STREETS })).score >= 2400);
});

test('плохой DQ большой выборки создаёт низкий rank', () => {
  assert.ok(PokerIQ.evaluate(makeRecords(300, { score: 45, streets: STREETS })).score < 1300);
});

test('отсутствующая улица остаётся null, а не 0', () => {
  const breakdown = PokerIQ.getBreakdown(makeRecords(30, { street: 'preflop' }));
  assert.equal(breakdown.flop, null);
  assert.equal(breakdown.turn, null);
  assert.equal(breakdown.river, null);
});

for (const street of STREETS) {
  test(`${street} breakdown вычисляется отдельно`, () => {
    const breakdown = PokerIQ.getBreakdown(makeRecords(30, { street }));
    assert.ok(Number.isFinite(breakdown[street]));
  });
}

test('postflop aggregate использует flop/turn/river', () => {
  const breakdown = PokerIQ.getBreakdown(makeRecords(30, { streets: ['flop', 'turn', 'river'] }));
  assert.ok(Number.isFinite(breakdown.postflop));
});

test('street balance modifier ограничен', () => {
  for (const records of [makeRecords(60, { street: 'preflop' }), makeRecords(60, { streets: STREETS })]) {
    const modifier = PokerIQ.evaluate(records).components.streetBalanceModifier;
    assert.ok(modifier >= -30 && modifier <= 30);
  }
});

for (const [id, expected] of [['improving-recent', 'UP'], ['declining-recent', 'DOWN']]) {
  test(`trend ${expected}`, () => {
    const fixture = fixtures.find(item => item.id === id);
    assert.equal(PokerIQ.getTrend(fixture.records).direction, expected);
  });
}

test('trend STABLE', () => {
  assert.equal(PokerIQ.getTrend(makeRecords(40, { score: 82 })).direction, 'STABLE');
});

test('trend insufficient data', () => {
  assert.equal(PokerIQ.getTrend(makeRecords(5, { score: 82 })).direction, 'INSUFFICIENT_DATA');
});

const rankBoundaries = [
  [1200, 'LEARNING'], [1400, 'INTERMEDIATE'], [1600, 'ADVANCED'], [1800, 'EXPERT'],
  [2000, 'MASTER'], [2200, 'GRANDMASTER'], [2400, 'ELITE'], [2600, 'LEGEND'],
  [2800, 'POKERPILOT'], [3000, 'POKERPILOT']
];
for (const [score, id] of rankBoundaries) {
  test(`rank boundary ${score} → ${id}`, () => assert.equal(PokerIQ.getRank(score).id, id));
}

test('unknown score даёт UNRANKED', () => {
  assert.equal(PokerIQ.getRank(null).id, 'UNRANKED');
});

test('rank progress равен 0 на нижней границе', () => {
  assert.equal(PokerIQ.getRank(1600).progressPercent, 0);
});

test('rank progress растёт около следующей границы', () => {
  const rank = PokerIQ.getRank(1799);
  assert.ok(rank.progressPercent >= 99);
  assert.equal(rank.iqToNext, 1);
});

test('максимальный rank не имеет бессмысленного next rank', () => {
  const rank = PokerIQ.getRank(3000);
  assert.equal(rank.nextRank, null);
  assert.equal(rank.iqToNext, null);
  assert.equal(rank.progressPercent, 100);
});

test('summary не содержит NaN или Infinity', () => {
  const json = JSON.stringify(PokerIQ.getSummary(makeRecords(40, { scores: [0, 100], streets: STREETS })));
  assert.doesNotMatch(json, /NaN|Infinity/);
});

test('schemaVersion и modelVersion присутствуют', () => {
  const result = PokerIQ.evaluate(makeRecords(30));
  assert.equal(result.schemaVersion, 1);
  assert.equal(result.modelVersion, 'poker-iq-v1.1');
});

for (const fixture of fixtures) {
  test(`Poker IQ fixture: ${fixture.id}`, () => {
    const result = PokerIQ.evaluate(fixture.records);
    assert.equal(result.sampleStatus, fixture.expected.status);
    if (fixture.expected.min === null) assert.equal(result.score, null);
    else {
      assert.ok(result.score >= fixture.expected.min, `${result.score} < ${fixture.expected.min}`);
      assert.ok(result.score <= fixture.expected.max, `${result.score} > ${fixture.expected.max}`);
    }
    assert.equal(result.rank.id, fixture.expected.rank);
    if (fixture.expected.trend) assert.equal(result.trend.direction, fixture.expected.trend);
  });
}
