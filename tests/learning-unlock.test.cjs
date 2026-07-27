'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCourseProgress } = require('./learning-course-loader.cjs');

function moduleOneState(api, course, score, completedLessons = true) {
  const state = api.defaultState();
  state.modules['holdem-foundations'] = {
    completedLessons: completedLessons
      ? course.modules[0].lessons.map(lesson => lesson.id)
      : [course.modules[0].lessons[0].id],
    completedTasks: [],
    taskAttempts: [],
    examAttempts: [],
    bestExamScore: score
  };
  return state;
}

test('Модуль 1 открыт сразу', () => {
  const { api } = loadCourseProgress();
  assert.equal(api.canOpenModule(api.defaultState(), 'holdem-foundations'), true);
});

test('результат 69% не открывает Модуль 2', () => {
  const { course, api } = loadCourseProgress();
  assert.equal(
    api.canOpenModule(moduleOneState(api, course, 69), 'hand-rankings'),
    false
  );
});

test('результат 70% открывает Модуль 2 после завершения всех уроков', () => {
  const { course, api } = loadCourseProgress();
  assert.equal(
    api.canOpenModule(moduleOneState(api, course, 70), 'hand-rankings'),
    true
  );
});

test('незавершённые уроки блокируют Модуль 2 даже при 100%', () => {
  const { course, api } = loadCourseProgress();
  assert.equal(
    api.canOpenModule(moduleOneState(api, course, 100, false), 'hand-rankings'),
    false
  );
});

test('заблокированный модуль нельзя открыть прямым вызовом', () => {
  const { api } = loadCourseProgress();
  assert.throws(
    () => api.openModule(api.defaultState(), 'hand-rankings'),
    /заблокирован/i
  );
});
