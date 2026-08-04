'use strict';

(function attachDailyChallengeSchedule(root) {
  const DateUtils = root.PokerPilotDailyDate
    || (typeof require === 'function' ? require('./daily-date.js') : null);
  const SCHEDULES = Object.freeze([
    Object.freeze({
      version: 1,
      startsOn: '2026-08-04',
      repeat: 'cycle',
      challengeIds: Object.freeze([
        'daily-river-aj-bluffcatch',
        'daily-flop-kk-value',
        'daily-turn-aq-nit',
        'daily-flop-nfd',
        'daily-flop-oesd',
        'daily-river-thin-value',
        'daily-turn-top-pair-control',
        'daily-flop-set-wet',
        'daily-river-flush-value',
        'daily-turn-combo-draw'
      ])
    })
  ]);

  function unavailable(dateKey, reason) {
    return { status: 'unavailable', dateKey, reason };
  }

  function selectForDate(dateKey) {
    if (!DateUtils.validDateKey(dateKey)) return unavailable(dateKey, 'INVALID_DATE');
    const day = DateUtils.calendarIndex(dateKey);
    const schedule = [...SCHEDULES].reverse().find(item =>
      DateUtils.calendarIndex(item.startsOn) <= day
    );
    if (!schedule) return unavailable(dateKey, 'BEFORE_FIRST_SCHEDULE');
    const offset = day - DateUtils.calendarIndex(schedule.startsOn);
    const cycleIndex = offset % schedule.challengeIds.length;
    return {
      status: 'available',
      dateKey,
      scheduleVersion: schedule.version,
      challengeId: schedule.challengeIds[cycleIndex],
      cycleIndex
    };
  }

  const api = Object.freeze({ SCHEDULES, selectForDate });
  root.PokerPilotDailyChallengeSchedule = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
