'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Stats = require('../src/decision-quality/decision-quality-stats.js');

function record(id, score, options = {}) {
  const sequence = Number(id.replace(/\D/g, '')) || 1;
  return {
    decisionId: id,
    date: options.date || new Date(Date.UTC(2026, 0, 1) + sequence * 86_400_000).toISOString(),
    mode: options.mode || 'TRAINING',
    street: options.street || 'flop',
    sessionId: options.sessionId || null,
    decisionQuality: score === null ? { schemaVersion: 1, score: null, isRated: false, classification: 'UNRATED' } : {
      schemaVersion: 1,
      score,
      grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 50 ? 'D' : 'F',
      classification: score >= 90 ? 'EXCELLENT' : score >= 80 ? 'GOOD' : score >= 70 ? 'ACCEPTABLE' : score >= 50 ? 'MISTAKE' : 'BLUNDER',
      isRated: true
    }
  };
}

test('публичный API аналитики стабилен', () => {
  for (const name of ['getSummary', 'getTrend', 'getStreetBreakdown', 'getRecent', 'getRecentDecisions', 'getSessionSummary']) {
    assert.equal(typeof Stats[name], 'function', name);
  }
});

test('пустая история возвращает NONE без фиктивной оценки', () => {
  const summary = Stats.getSummary([]);
  assert.equal(summary.sampleStatus, 'NONE');
  assert.equal(summary.average, null);
  assert.equal(summary.ratedCount, 0);
});

test('1–4 решения дают PROVISIONAL', () => {
  assert.equal(Stats.getSummary([record('1', 90)]).sampleStatus, 'PROVISIONAL');
  assert.equal(Stats.getSummary([record('1', 90), record('2', 80), record('3', 70), record('4', 60)]).sampleStatus, 'PROVISIONAL');
});

test('5–19 решений дают FORMING', () => {
  assert.equal(Stats.getSummary(Array.from({ length: 5 }, (_, i) => record(String(i + 1), 80))).sampleStatus, 'FORMING');
  assert.equal(Stats.getSummary(Array.from({ length: 19 }, (_, i) => record(String(i + 1), 80))).sampleStatus, 'FORMING');
});

test('20+ решений дают ESTABLISHED', () => {
  assert.equal(Stats.getSummary(Array.from({ length: 20 }, (_, i) => record(String(i + 1), 80))).sampleStatus, 'ESTABLISHED');
});

test('UNRATED записи не входят в среднее', () => {
  const summary = Stats.getSummary([record('1', 80), record('2', null)]);
  assert.equal(summary.ratedCount, 1);
  assert.equal(summary.average, 80);
});

test('повторный decisionId учитывается один раз', () => {
  const summary = Stats.getSummary([record('same', 90), record('same', 10)]);
  assert.equal(summary.ratedCount, 1);
});

test('повреждённые записи игнорируются безопасно', () => {
  const summary = Stats.getSummary([null, {}, { decisionQuality: { score: NaN, isRated: true } }, record('1', 75)]);
  assert.equal(summary.ratedCount, 1);
  assert.equal(summary.average, 75);
});

test('recent20 содержит последние двадцать по timestamp', () => {
  const history = Array.from({ length: 25 }, (_, i) => record(String(i + 1), i + 1));
  const recent = Stats.getRecentDecisions(history, 20);
  assert.equal(recent.length, 20);
  assert.equal(recent[0].decisionId, '25');
  assert.equal(recent.at(-1).decisionId, '6');
});

test('стабильная сортировка сохраняет порядок при одинаковой дате', () => {
  const date = '2026-01-01T00:00:00.000Z';
  const recent = Stats.getRecentDecisions([record('a', 80, { date }), record('b', 90, { date })], 20);
  assert.deepEqual(recent.map(item => item.decisionId), ['a', 'b']);
});

test('trend сравнивает recent20 с previous20', () => {
  const history = [];
  for (let i = 1; i <= 20; i += 1) history.push(record(String(i), 60));
  for (let i = 21; i <= 40; i += 1) history.push(record(String(i), 80));
  assert.equal(Stats.getTrend(history).delta, 20);
  assert.equal(Stats.getTrend(history).direction, 'UP');
});

test('trend без предыдущей выборки честно INSUFFICIENT_DATA', () => {
  assert.equal(Stats.getTrend([record('1', 80)]).direction, 'INSUFFICIENT_DATA');
});

test('trend DOWN определяется детерминированно', () => {
  const history = [];
  for (let i = 1; i <= 20; i += 1) history.push(record(String(i), 90));
  for (let i = 21; i <= 40; i += 1) history.push(record(String(i), 50));
  assert.equal(Stats.getTrend(history).direction, 'DOWN');
});

test('trend STABLE допускает малое изменение', () => {
  const history = [];
  for (let i = 1; i <= 20; i += 1) history.push(record(String(i), 80));
  for (let i = 21; i <= 40; i += 1) history.push(record(String(i), 81));
  assert.equal(Stats.getTrend(history).direction, 'STABLE');
});

test('street breakdown группирует preflop/flop/turn/river', () => {
  const breakdown = Stats.getStreetBreakdown([
    record('1', 90, { street: 'preflop' }),
    record('2', 80, { street: 'flop' }),
    record('3', 70, { street: 'turn' }),
    record('4', 60, { street: 'river' })
  ]);
  assert.deepEqual(Object.keys(breakdown), ['preflop', 'flop', 'turn', 'river']);
});

test('street breakdown нормализует неизвестную улицу', () => {
  const breakdown = Stats.getStreetBreakdown([record('1', 80, { street: 'moon' })]);
  assert.equal(breakdown.unknown.count, 1);
});

test('mode breakdown присутствует в summary', () => {
  const summary = Stats.getSummary([
    record('1', 90, { mode: 'TRAINING' }),
    record('2', 70, { mode: 'LIVE' })
  ]);
  assert.equal(summary.byMode.TRAINING.count, 1);
  assert.equal(summary.byMode.LIVE.count, 1);
});

test('session summary фильтрует только указанную сессию', () => {
  const summary = Stats.getSessionSummary([
    record('1', 90, { sessionId: 's1' }),
    record('2', 10, { sessionId: 's2' })
  ], 's1');
  assert.equal(summary.average, 90);
  assert.equal(summary.ratedCount, 1);
});

test('best session требует минимум два rated решения', () => {
  const summary = Stats.getSummary([
    record('1', 100, { sessionId: 'single' }),
    record('2', 80, { sessionId: 'real' }),
    record('3', 90, { sessionId: 'real' })
  ]);
  assert.equal(summary.bestSession.sessionId, 'real');
});

test('latest возвращает последнее rated решение', () => {
  const summary = Stats.getSummary([record('1', 50), record('2', 90)]);
  assert.equal(summary.latest.decisionId, '2');
});

test('среднее округляется до одного знака', () => {
  assert.equal(Stats.getSummary([record('1', 80), record('2', 81), record('3', 81)]).average, 80.7);
});

test('входной массив не мутируется', () => {
  const history = [record('2', 90), record('1', 80)];
  const snapshot = structuredClone(history);
  Stats.getSummary(history);
  assert.deepEqual(history, snapshot);
});

test('retention helper ограничивает историю без удаления неизвестных полей', () => {
  const history = Array.from({ length: Stats.HISTORY_RETENTION + 2 }, (_, i) => ({ ...record(String(i + 1), 80), extra: 'keep' }));
  const retained = Stats.applyRetention(history);
  assert.equal(retained.length, Stats.HISTORY_RETENTION);
  assert.equal(retained[0].extra, 'keep');
});
