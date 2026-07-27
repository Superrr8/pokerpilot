'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCourseProgress } = require('./learning-course-loader.cjs');

const plain = value => JSON.parse(JSON.stringify(value));

function completeModule(state, module, api, score = 70) {
  const next = api.normalizeState(state);
  next.modules[module.id] = {
    completedLessons: module.lessons.map(lesson => lesson.id),
    completedTasks: [],
    taskAttempts: [],
    examAttempts: [{ score, passed: score >= 70, answers: {}, errors: [] }],
    bestExamScore: score
  };
  return next;
}

function unlockedThroughModule2(course, api) {
  let state = api.defaultState();
  state = completeModule(state, course.modules[0], api);
  state = completeModule(state, course.modules[1], api);
  return state;
}

test('Модуль 3 закрыт до полного завершения Модуля 2', () => {
  const { course, api } = loadCourseProgress();
  let state = completeModule(api.defaultState(), course.modules[0], api);
  state = completeModule(state, course.modules[1], api, 69);
  assert.equal(api.canOpenModule(state, 'table-positions'), false);
  state = completeModule(state, course.modules[1], api, 70);
  assert.equal(api.canOpenModule(state, 'table-positions'), true);
});

test('следующий placeholder остаётся locked при 69% и становится coming-soon при 70%', () => {
  const { course, api } = loadCourseProgress();
  const base = unlockedThroughModule2(course, api);
  const score69 = completeModule(base, course.modules[2], api, 69);
  const score70 = completeModule(base, course.modules[2], api, 70);
  assert.equal(api.upcomingModuleStatus(score69, 'starting-hands'), 'locked');
  assert.equal(api.upcomingModuleStatus(score70, 'starting-hands'), 'coming-soon');
  assert.throws(() => api.openModule(score70, 'starting-hands'), /не реализован/i);
});

test('экзамен Модуля 3 сохраняет ответы, результат, ошибки и повторные попытки', () => {
  const { course, api } = loadCourseProgress();
  const module = course.modules[2];
  const base = unlockedThroughModule2(course, api);
  const correct = Object.fromEntries(
    module.exam.questions.map(question => [question.id, question.correctChoiceId])
  );
  const wrong = Object.fromEntries(
    module.exam.questions.map(question => [question.id, 'wrong'])
  );
  const first = api.submitExam(base, module.id, wrong, '2026-07-27T12:00:00.000Z');
  const second = api.submitExam(first.state, module.id, correct, '2026-07-27T13:00:00.000Z');
  const saved = second.state.modules[module.id];
  assert.equal(saved.examAttempts.length, 2);
  assert.equal(saved.examAttempts[0].errors.length, 10);
  assert.equal(saved.examAttempts[1].score, 100);
  assert.equal(saved.bestExamScore, 100);
  assert.equal(second.state.history.filter(item => item.moduleId === module.id).length, 2);
});

test('learning preferences имеют безопасные sound defaults и нормализуются', () => {
  const { api } = loadCourseProgress();
  assert.deepEqual(plain(api.defaultState().preferences), {
    sound: { enabled: true, volume: 0.35 }
  });
  const normalized = api.normalizeState({
    preferences: { sound: { enabled: 'yes', volume: 99 }, future: true }
  });
  assert.deepEqual(plain(normalized.preferences.sound), {
    enabled: true,
    volume: 0.35
  });
  assert.equal(normalized.preferences.future, true);
});

test('миграция состояния Этапа 7.1 остаётся идемпотентной и сохраняет неизвестные поля', () => {
  const { api } = loadCourseProgress();
  const old = {
    decisions: 8,
    futureTrainerField: { keep: true },
    learning: {
      schemaVersion: 1,
      modules: { 'holdem-foundations': { completedLessons: ['foundations-goal-cards'] } },
      weakTopics: { positions: 2 },
      history: [],
      current: null,
      futureLearningField: { keep: true }
    }
  };
  const once = api.migrateProgress(old);
  const twice = api.migrateProgress(plain(once));
  assert.deepEqual(plain(twice), plain(once));
  assert.deepEqual(plain(twice.futureTrainerField), { keep: true });
  assert.deepEqual(plain(twice.learning.futureLearningField), { keep: true });
});
