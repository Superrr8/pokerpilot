'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let Analytics = null;
let loadError = null;
try {
  Analytics = require('../src/progress/progress-analytics.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(Analytics);
  return Analytics;
}

const NOW = '2026-08-03T18:00:00.000Z';

function snapshot(overrides = {}) {
  return {
    lifetimeXp: 200,
    level: { level: 1, xpIntoLevel: 200, xpToNextLevel: 500 },
    rank: { id: 'ADVANCED', label: 'Продвинутый' },
    pokerIq: { score: 1650, isRated: true },
    streak: { current: 2, best: 5 },
    counters: { trainingScenarios: 8, trainerDecisions: 3, exams: 1 },
    metadata: {},
    ...overrides
  };
}

function row(id, day, type, xp, extra = {}) {
  return {
    eventId: id,
    type,
    timestamp: `${day}T12:00:00.000Z`,
    localDate: day,
    timezoneOffsetMinutes: 0,
    source: 'test',
    xp,
    summary: `${type} ${id}`,
    lifetimeXpAfter: extra.lifetimeXpAfter ?? null,
    levelAfter: extra.levelAfter ?? null,
    rankAfter: extra.rankAfter ?? null,
    pokerIqAfter: extra.pokerIqAfter ?? null,
    streakAfter: extra.streakAfter ?? null,
    metadata: extra.metadata || {}
  };
}

const HISTORY = [
  row('scenario', '2026-08-03', 'TRAINING_SCENARIO_COMPLETED', 15, { lifetimeXpAfter: 200 }),
  row('decision', '2026-08-03', 'TRAINING_DECISION_RECORDED', 0, { pokerIqAfter: 1650 }),
  row('exam', '2026-08-01', 'EXAM_COMPLETED', 60, { lifetimeXpAfter: 185 }),
  row('lesson', '2026-07-20', 'LESSON_COMPLETED', 30, { lifetimeXpAfter: 125 })
];

test('7d aggregation включает нулевые дни и реальные daily events/XP', () => {
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(result.period.id, '7d');
  assert.equal(result.series.dailyActivity.length, 7);
  assert.equal(result.series.dailyXp.length, 7);
  assert.equal(result.periodSummary.acceptedEvents, 3);
  assert.equal(result.periodSummary.xpGained, 75);
  assert.equal(result.periodSummary.activeDays, 2);
  assert.equal(result.periodSummary.averageXpPerActiveDay, 37.5);
  assert.equal(result.series.dailyActivity.find(item => item.day === '2026-08-02').value, 0);
});

test('30d и all-time выбирают корректные события, unknown period fallback = 7d', () => {
  const analytics = api();
  const thirty = analytics.createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: '30d', now: NOW, timezoneOffsetMinutes: 0 });
  const all = analytics.createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: 'all', now: NOW, timezoneOffsetMinutes: 0 });
  const fallback = analytics.createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: 'wat', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(thirty.periodSummary.acceptedEvents, 4);
  assert.equal(all.periodSummary.acceptedEvents, 4);
  assert.equal(fallback.period.id, '7d');
});

test('future и out-of-period events не искажают 7d', () => {
  const history = [...HISTORY, row('future', '2026-08-04', 'EXAM_COMPLETED', 60), row('old', '2026-01-01', 'EXAM_COMPLETED', 60)];
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history, period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(result.periodSummary.acceptedEvents, 3);
  assert.equal(result.periodSummary.xpGained, 75);
});

test('duplicate IDs не удваивают totals даже при повреждённом входе', () => {
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: [HISTORY[0], { ...HISTORY[0], xp: 999 }], period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(result.periodSummary.acceptedEvents, 1);
  assert.equal(result.periodSummary.xpGained, 15);
});

test('event breakdown использует централизованные реальные категории', () => {
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: '30d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.deepEqual(result.eventBreakdown.map(item => [item.id, item.count]), [
    ['trainingScenarios', 1], ['trainerDecisions', 1], ['exams', 1], ['other', 1]
  ]);
});

test('Poker IQ series содержит только реальные finite pokerIqAfter points', () => {
  const history = [
    ...HISTORY,
    row('missing-iq', '2026-08-02', 'TRAINING_DECISION_RECORDED', 0),
    row('bad-iq', '2026-08-01', 'TRAINING_DECISION_RECORDED', 0, { pokerIqAfter: Infinity })
  ];
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history, period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.deepEqual(result.series.pokerIq.map(point => point.value), [1650]);
  assert.equal(result.pokerIqHistory.isPartial, true);
  assert.equal(result.current.pokerIq, 1650);
});

test('legacy coverage остаётся partial без fake reconstruction', () => {
  const result = api().createAnalyticsSnapshot({
    snapshot: snapshot({ analyticsCoverage: { isPartial: true, startsAt: NOW, reason: 'LEGACY_TOTALS_WITHOUT_DETAILED_HISTORY' } }),
    history: [], period: 'all', now: NOW, timezoneOffsetMinutes: 0
  });
  assert.equal(result.coverage.isPartial, true);
  assert.equal(result.periodSummary.acceptedEvents, 0);
  assert.equal(result.periodSummary.xpGained, 0);
  assert.equal(result.current.lifetimeXp, 200);
});

test('zero-value и one-event periods не создают NaN/Infinity', () => {
  const empty = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: [], period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  const one = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: [row('zero', '2026-08-03', 'TRAINING_DECISION_RECORDED', 0)], period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(empty.periodSummary.averageXpPerActiveDay, 0);
  assert.equal(one.periodSummary.activeDays, 1);
  assert.equal(JSON.stringify([empty, one]).includes('null'), true);
  assert.doesNotMatch(JSON.stringify([empty, one]), /NaN|Infinity/);
});

test('negative, NaN и Infinity XP clamp-ятся к безопасному нулю', () => {
  const history = [row('negative', '2026-08-03', 'LESSON_COMPLETED', -10), row('nan', '2026-08-03', 'EXAM_COMPLETED', NaN), row('inf', '2026-08-03', 'EXAM_COMPLETED', Infinity)];
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history, period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(result.periodSummary.xpGained, 0);
});

test('recent activity ограничена, не раскрывает raw IDs и сортируется newest-first', () => {
  const result = api().createAnalyticsSnapshot({ snapshot: snapshot(), history: HISTORY, period: 'all', now: NOW, timezoneOffsetMinutes: 0, recentLimit: 2 });
  assert.equal(result.recentActivity.length, 2);
  assert.equal(Object.hasOwn(result.recentActivity[0], 'eventId'), false);
  assert.equal(result.recentActivity[0].type, 'TRAINING_SCENARIO_COMPLETED');
});

test('output plain serializable, immutable и не мутирует входы', () => {
  const sourceHistory = JSON.parse(JSON.stringify(HISTORY));
  const sourceSnapshot = snapshot();
  const result = api().createAnalyticsSnapshot({ snapshot: sourceSnapshot, history: sourceHistory, period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  result.series.dailyXp[0].value = 999;
  assert.deepEqual(sourceHistory, JSON.parse(JSON.stringify(HISTORY)));
  assert.equal(sourceSnapshot.lifetimeXp, 200);
  assert.doesNotThrow(() => JSON.stringify(result));
});
