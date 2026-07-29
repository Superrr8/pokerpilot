'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/decision-quality/decision-quality-engine.js');
const Records = require('../src/decision-quality/decision-records.js');

test('decision record расширяет существующую запись без параллельной истории', () => {
  const record = Records.createDecisionRecord({
    base: { mode: 'study', title: 'Spot', grade: 'best', custom: 'keep' },
    userAction: 'call',
    trainer: { actionClass: 'CALL', confidence: 'high' },
    context: { scenarioId: 'spot', mode: 'TRAINING', street: 'river' },
    evaluatedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(record.mode, 'study');
  assert.equal(record.custom, 'keep');
  assert.equal(record.decisionQuality.isRated, true);
  assert.equal(record.userAction, 'CALL');
});

test('trainer snapshot содержит минимальные audit fields', () => {
  const snapshot = Records.createTrainerSnapshot({
    actionClass: 'RAISE',
    amount: 75,
    amountUnit: 'to_total',
    confidence: 'medium',
    isMarginal: true,
    callEV: 4,
    callEVMethod: 'exact',
    alternatives: [{ actionClass: 'CALL', reason: 'Контроль банка.' }]
  });
  assert.equal(snapshot.recommendedAction, 'RAISE');
  assert.equal(snapshot.recommendedAmount, 75);
  assert.equal(snapshot.trainerConfidence, 'medium');
  assert.equal(snapshot.isMarginal, true);
  assert.equal(snapshot.callEVMethod, 'exact');
  assert.equal(snapshot.alternatives.length, 1);
});

test('snapshot не сохраняет огромные assumptions/explanation payloads', () => {
  const snapshot = Records.createTrainerSnapshot({
    actionClass: 'CALL',
    assumptions: Array(100).fill('large'),
    explanation: 'x'.repeat(10_000)
  });
  assert.equal(Object.hasOwn(snapshot, 'assumptions'), false);
  assert.equal(Object.hasOwn(snapshot, 'explanation'), false);
});

test('decisionId детерминирован для одинакового record snapshot', () => {
  const input = { date: '2026-01-01', mode: 'LIVE', choice: 'CALL', sequence: 1 };
  assert.equal(Records.createDecisionId(input), Records.createDecisionId({ ...input }));
});

test('разные sequence создают разные decisionId', () => {
  const base = { date: '2026-01-01', mode: 'LIVE', choice: 'CALL' };
  assert.notEqual(Records.createDecisionId({ ...base, sequence: 1 }), Records.createDecisionId({ ...base, sequence: 2 }));
});

test('старая запись нормализуется в явный UNRATED без score 0', () => {
  const [record] = Records.normalizeHistory([{ date: '2025-01-01', mode: 'study', grade: 'best' }]);
  assert.equal(record.decisionQuality.classification, 'UNRATED');
  assert.equal(record.decisionQuality.score, null);
  assert.equal(record.decisionQuality.isRated, false);
});

test('повреждённая DQ запись нормализуется безопасно', () => {
  const [record] = Records.normalizeHistory([{
    decisionQuality: { schemaVersion: 1, score: 'broken', isRated: true }
  }]);
  assert.equal(record.decisionQuality.isRated, false);
  assert.equal(record.decisionQuality.score, null);
});

test('валидная DQ запись сохраняет неизвестные будущие поля', () => {
  const [record] = Records.normalizeHistory([{
    decisionQuality: { schemaVersion: 1, score: 88, isRated: true, future: { keep: true } }
  }]);
  assert.deepEqual(record.decisionQuality.future, { keep: true });
});

test('normalizeHistory не мутирует исходную историю', () => {
  const history = [{ mode: 'study' }];
  const snapshot = structuredClone(history);
  Records.normalizeHistory(history);
  assert.deepEqual(history, snapshot);
});

test('normalizeHistory применяет документированный retention 1200', () => {
  const history = Array.from({ length: 1300 }, (_, index) => ({ index }));
  assert.equal(Records.normalizeHistory(history).length, 1200);
});

test('недостаточный контекст создаёт UNRATED новое решение', () => {
  const record = Records.createDecisionRecord({
    base: { mode: 'study' },
    userAction: 'CALL',
    trainer: { actionClass: 'CALL' },
    context: null,
    evaluatedAt: '2026-01-01T00:00:00.000Z'
  });
  assert.equal(record.decisionQuality.isRated, false);
});

test('неизвестные actions не проходят в snapshot', () => {
  assert.equal(Records.createTrainerSnapshot({ actionClass: 'DANCE' }), null);
});

test('null amounts остаются null, а не превращаются в 0', () => {
  const snapshot = Records.createTrainerSnapshot({ actionClass: 'BET', amount: null });
  assert.equal(snapshot.amount, null);
  assert.equal(snapshot.recommendedAmount, null);
});
