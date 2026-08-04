'use strict';

(function attachDailyDate(root) {
  function localDateKey(value = new Date()) {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) return null;
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function validDateKey(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
    const [year, month, day] = String(value).split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;
  }

  function calendarIndex(value) {
    if (!validDateKey(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  }

  const api = Object.freeze({ localDateKey, validDateKey, calendarIndex });
  root.PokerPilotDailyDate = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
