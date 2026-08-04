'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const DateUtils = require('../src/daily/daily-date.js');
const Schedule = require('../src/daily/daily-challenge-schedule.js');

test('local date key имеет формат YYYY-MM-DD', () => {
  assert.equal(DateUtils.localDateKey(new Date(2026, 7, 4, 9, 15)), '2026-08-04');
});

test('утро и вечер одной local date возвращают одинаковый key', () => {
  assert.equal(
    DateUtils.localDateKey(new Date(2026, 7, 4, 0, 1)),
    DateUtils.localDateKey(new Date(2026, 7, 4, 23, 59))
  );
});

test('следующий локальный календарный день возвращает новый key', () => {
  assert.equal(DateUtils.localDateKey(new Date(2026, 7, 5, 0, 0)), '2026-08-05');
});

test('local date key не обрезает дату через UTC', () => {
  const latePacific = new Date('2026-08-04T23:30:00-07:00');
  assert.equal(DateUtils.localDateKey(latePacific), '2026-08-04');
});

test('DST date остаётся корректной локальной календарной датой', () => {
  assert.equal(DateUtils.localDateKey(new Date(2026, 2, 8, 3, 30)), '2026-03-08');
});

test('invalid Date обрабатывается безопасно', () => {
  assert.equal(DateUtils.localDateKey(new Date('broken')), null);
  assert.equal(DateUtils.localDateKey(null), null);
});

test('schedule v1 опубликован с фиксированной датой и immutable IDs', () => {
  assert.equal(Schedule.SCHEDULES[0].version, 1);
  assert.equal(Schedule.SCHEDULES[0].startsOn, '2026-08-04');
  assert.ok(Object.isFrozen(Schedule.SCHEDULES));
  assert.ok(Object.isFrozen(Schedule.SCHEDULES[0].challengeIds));
  assert.ok(Schedule.SCHEDULES[0].challengeIds.length >= 7);
});

test('одна дата всегда возвращает один challenge', () => {
  const first = Schedule.selectForDate('2026-08-04');
  const second = Schedule.selectForDate('2026-08-04');
  assert.deepEqual(second, first);
  assert.equal(first.status, 'available');
});

test('соседние даты выбираются детерминированно', () => {
  const first = Schedule.selectForDate('2026-08-04');
  const next = Schedule.selectForDate('2026-08-05');
  assert.notEqual(first.challengeId, next.challengeId);
  assert.equal(next.scheduleVersion, 1);
});

test('язык UI не влияет на challenge ID', () => {
  assert.equal(
    Schedule.selectForDate('2026-08-08', { locale: 'ru' }).challengeId,
    Schedule.selectForDate('2026-08-08', { locale: 'en' }).challengeId
  );
});

test('прошлая дата остаётся привязана к тому же challenge', () => {
  assert.equal(
    Schedule.selectForDate('2026-08-04').challengeId,
    Schedule.SCHEDULES[0].challengeIds[0]
  );
});

test('до начала первого schedule возвращается unavailable', () => {
  assert.deepEqual(Schedule.selectForDate('2026-08-03'), {
    status: 'unavailable',
    dateKey: '2026-08-03',
    reason: 'BEFORE_FIRST_SCHEDULE'
  });
});

test('после конца списка v1 используется документированный цикл', () => {
  const ids = Schedule.SCHEDULES[0].challengeIds;
  assert.equal(Schedule.selectForDate('2026-08-04').challengeId,
    Schedule.selectForDate(`2026-08-${String(4 + ids.length).padStart(2, '0')}`).challengeId);
});

test('schedule не использует Math.random', () => {
  const source = require('node:fs').readFileSync(require.resolve('../src/daily/daily-challenge-schedule.js'), 'utf8');
  assert.doesNotMatch(source, /Math\.random/);
});

test('повреждённая date key не приводит к crash', () => {
  assert.equal(Schedule.selectForDate('not-a-date').status, 'unavailable');
});
