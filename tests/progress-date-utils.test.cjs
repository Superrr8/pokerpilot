'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let DateUtils = null;
let loadError = null;
try {
  DateUtils = require('../src/progress/progress-date-utils.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(DateUtils);
  return DateUtils;
}

test('dayKeyFromTimestamp использует переданный timezone offset и стабильный YYYY-MM-DD', () => {
  assert.equal(api().dayKeyFromTimestamp('2026-08-03T07:30:00.000Z', 420), '2026-08-03');
  assert.equal(api().dayKeyFromTimestamp('2026-08-03T06:30:00.000Z', 420), '2026-08-02');
});

test('события одного локального дня получают один bucket', () => {
  const utils = api();
  assert.equal(
    utils.dayKeyFromTimestamp('2026-08-03T08:00:00.000Z', 420),
    utils.dayKeyFromTimestamp('2026-08-04T06:59:59.000Z', 420)
  );
});

test('соседние локальные дни разделяются на границе полуночи', () => {
  const utils = api();
  assert.notEqual(
    utils.dayKeyFromTimestamp('2026-08-04T06:59:59.999Z', 420),
    utils.dayKeyFromTimestamp('2026-08-04T07:00:00.000Z', 420)
  );
});

test('DST offsets передаются для каждого timestamp без деления на 86400000', () => {
  const utils = api();
  assert.equal(utils.dayKeyFromTimestamp('2026-03-08T09:30:00.000Z', 480), '2026-03-08');
  assert.equal(utils.dayKeyFromTimestamp('2026-03-09T06:30:00.000Z', 420), '2026-03-08');
});

test('invalid timestamp и invalid day key безопасно возвращают null', () => {
  const utils = api();
  assert.equal(utils.dayKeyFromTimestamp('broken', 0), null);
  assert.equal(utils.normalizeDayKey('2026-99-99'), null);
  assert.equal(utils.normalizeDayKey(''), null);
});

test('addCalendarDays корректно проходит границы месяца и года', () => {
  const utils = api();
  assert.equal(utils.addCalendarDays('2026-12-31', 1), '2027-01-01');
  assert.equal(utils.addCalendarDays('2026-03-01', -1), '2026-02-28');
});

test('последние 7 дней включают now и ровно шесть предыдущих bucket', () => {
  const keys = api().calendarRange('2026-08-03', 7);
  assert.equal(keys.length, 7);
  assert.equal(keys[0], '2026-07-28');
  assert.equal(keys.at(-1), '2026-08-03');
});

test('последние 30 дней включают ровно ожидаемые bucket', () => {
  const keys = api().calendarRange('2026-08-03', 30);
  assert.equal(keys.length, 30);
  assert.equal(keys[0], '2026-07-05');
  assert.equal(keys.at(-1), '2026-08-03');
  assert.equal(new Set(keys).size, 30);
});

test('injected now определяет текущий локальный день детерминированно', () => {
  assert.equal(api().resolveNowDay({ now: () => '2026-08-04T06:30:00.000Z', timezoneOffsetMinutes: 420 }), '2026-08-03');
});
