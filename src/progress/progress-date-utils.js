'use strict';

(function attachProgressDateUtils(root) {
  const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  function finite(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function normalizeDayKey(value) {
    if (typeof value !== 'string' || !DAY_KEY_PATTERN.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return null;
    return value;
  }

  function dayKeyFromTimestamp(value, timezoneOffsetMinutes = 0) {
    const timestamp = typeof value === 'string' || value instanceof Date
      ? Date.parse(value)
      : finite(value);
    if (!Number.isFinite(timestamp)) return null;
    const offset = finite(timezoneOffsetMinutes, 0);
    return new Date(timestamp - offset * 60_000).toISOString().slice(0, 10);
  }

  function addCalendarDays(value, delta) {
    const dayKey = normalizeDayKey(value);
    const amount = Math.trunc(finite(delta, 0));
    if (!dayKey) return null;
    const [year, month, day] = dayKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
  }

  function calendarRange(endDay, count) {
    const normalizedEnd = normalizeDayKey(endDay);
    const length = Math.max(0, Math.floor(finite(count, 0)));
    if (!normalizedEnd || length === 0) return [];
    return Array.from({ length }, (_, index) =>
      addCalendarDays(normalizedEnd, index - length + 1)
    );
  }

  function resolveNowDay({ now = () => new Date().toISOString(), timezoneOffsetMinutes = 0 } = {}) {
    let value = now;
    try {
      if (typeof now === 'function') value = now();
    } catch (_) {
      return null;
    }
    const offset = typeof timezoneOffsetMinutes === 'function'
      ? timezoneOffsetMinutes(value)
      : timezoneOffsetMinutes;
    return dayKeyFromTimestamp(value, offset);
  }

  const api = Object.freeze({
    normalizeDayKey,
    dayKeyFromTimestamp,
    addCalendarDays,
    calendarRange,
    resolveNowDay
  });

  root.PokerPilotProgressDateUtils = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
