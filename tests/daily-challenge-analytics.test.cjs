'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ProgressSystem = require('../src/progress/progress-system.js');

const NOW = '2026-08-04T19:00:00.000Z';

function dailyEvent(id, day, isCorrect) {
  return {
    id,
    type: 'DAILY_CHALLENGE_COMPLETED',
    timestamp: `${day}T19:00:00.000Z`,
    source: 'daily_challenge',
    payload: {
      dateKey: day,
      localDate: day,
      timezoneOffsetMinutes: 0,
      challengeId: `challenge-${day}`,
      scheduleVersion: 1,
      rewardVersion: 1,
      outcome: isCorrect ? 'correct' : 'incorrect',
      isCorrect,
      selectedAction: isCorrect ? 'CALL' : 'FOLD',
      correctAction: 'CALL',
      street: 'river',
      difficulty: 'Продвинутая'
    }
  };
}

function create() {
  return ProgressSystem.create({ storage: null, now: () => NOW, createPlayerId: () => 'analytics-daily' });
}

test('correct и incorrect объединяются в одну Daily Challenge category', () => {
  const system = create();
  system.recordEvent(dailyEvent('daily-1', '2026-08-04', true));
  system.recordEvent(dailyEvent('daily-2', '2026-08-03', false));
  const analytics = system.getAnalyticsSnapshot({ period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.deepEqual(analytics.eventBreakdown.map(item => [item.id, item.label, item.count]), [
    ['dailyChallenges', 'Раздача дня', 2]
  ]);
  assert.equal(analytics.periodSummary.dailyChallenges, 2);
});

test('Recent Activity показывает outcome и фактический XP без event ID', () => {
  const system = create();
  system.recordEvent(dailyEvent('daily-correct', '2026-08-04', true));
  system.recordEvent(dailyEvent('daily-wrong', '2026-08-03', false));
  const recent = system.getAnalyticsSnapshot({ period: 'all', now: NOW, timezoneOffsetMinutes: 0 }).recentActivity;
  assert.equal(recent[0].label, 'Раздача дня — правильный ответ');
  assert.equal(recent[0].xp, 25);
  assert.equal(recent[1].label, 'Раздача дня — ошибка');
  assert.equal(recent[1].xp, 10);
  assert.equal('eventId' in recent[0], false);
});

test('daily XP и activity series получают одну запись на accepted event', () => {
  const system = create();
  system.recordEvent(dailyEvent('daily-series', '2026-08-04', false));
  const analytics = system.getAnalyticsSnapshot({ period: '7d', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(analytics.series.dailyXp.find(item => item.day === '2026-08-04').value, 10);
  assert.equal(analytics.series.dailyActivity.find(item => item.day === '2026-08-04').value, 1);
  assert.equal(analytics.periodSummary.xpGained, 10);
  assert.equal(analytics.periodSummary.acceptedEvents, 1);
});

test('7d, 30d и all-time учитывают Daily Challenge по существующим фильтрам', () => {
  const system = create();
  system.recordEvent(dailyEvent('daily-now', '2026-08-04', true));
  system.recordEvent(dailyEvent('daily-old', '2026-07-20', false));
  assert.equal(system.getAnalyticsSnapshot({ period: '7d', now: NOW, timezoneOffsetMinutes: 0 }).periodSummary.dailyChallenges, 1);
  assert.equal(system.getAnalyticsSnapshot({ period: '30d', now: NOW, timezoneOffsetMinutes: 0 }).periodSummary.dailyChallenges, 2);
  assert.equal(system.getAnalyticsSnapshot({ period: 'all', now: NOW, timezoneOffsetMinutes: 0 }).periodSummary.dailyChallenges, 2);
});

test('duplicate canonical ID не меняет analytics totals', () => {
  const system = create();
  const event = dailyEvent('daily-duplicate', '2026-08-04', true);
  const before = system.getAnalyticsSnapshot({ period: 'all', now: NOW, timezoneOffsetMinutes: 0 });
  system.recordEvent(event);
  const afterFirst = system.getAnalyticsSnapshot({ period: 'all', now: NOW, timezoneOffsetMinutes: 0 });
  system.recordEvent(event);
  const afterDuplicate = system.getAnalyticsSnapshot({ period: 'all', now: NOW, timezoneOffsetMinutes: 0 });
  assert.equal(before.periodSummary.acceptedEvents, 0);
  assert.equal(afterFirst.periodSummary.acceptedEvents, 1);
  assert.deepEqual(afterDuplicate, afterFirst);
});
