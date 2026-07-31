'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCourseProgress } = require('./learning-course-loader.cjs');

const root = path.resolve(__dirname, '..');
const dashboardPath = path.join(root, 'src', 'ui', 'dashboard.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function loadDashboard() {
  const source = fs.readFileSync(dashboardPath, 'utf8');
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox, {
    name: 'PokerPilot dashboard sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, { filename: 'src/ui/dashboard.js' })
    .runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.PokerPilotDashboard || sandbox.module.exports;
}

function completedModuleState(course, progressApi, moduleId, score = 80) {
  const module = course.modules.find(item => item.id === moduleId);
  const state = progressApi.defaultState();
  state.modules[moduleId] = {
    completedLessons: module.lessons.map(lesson => lesson.id),
    completedTasks: [],
    taskAttempts: [],
    examAttempts: [{ score, passed: true, date: '2026-01-01T00:00:00.000Z' }],
    bestExamScore: score
  };
  return state;
}

test('dashboard вынесен в отдельный classic-script модуль', () => {
  assert.ok(fs.existsSync(dashboardPath), 'Нет src/ui/dashboard.js');
  assert.match(html, /<script src="src\/ui\/dashboard\.js"><\/script>/);
});

test('dashboard contract содержит обязательные продуктовые блоки', () => {
  for (const id of [
    'dashboardContinue', 'dashboardTrainer', 'dashboardLive',
    'dashboardProgress', 'dashboardLastModule', 'dashboardBestExam',
    'dashboardResume', 'dashboardModeNav'
  ]) assert.match(html, new RegExp(`id="${id}"`), `Нет #${id}`);
});

test('пустой прогресс даёт безопасную модель без выдуманных достижений', () => {
  const { course, api } = loadCourseProgress();
  const model = loadDashboard().createModel({
    progress: { decisions: 0, maxPoints: 0, scorePoints: 0, learning: api.defaultState() },
    course,
    courseProgress: api
  });
  assert.equal(model.isEmpty, true);
  assert.equal(model.coursePercent, 0);
  assert.equal(model.lastCompletedTitle, 'Пока нет завершённых модулей');
  assert.equal(model.bestExamScore, null);
  assert.equal(model.resume.moduleId, 'holdem-foundations');
  assert.deepEqual({ ...model.primaryAction }, {
    label: 'Начать тренировку',
    route: 'study',
    resume: false
  });
  assert.equal(model.availableModules, 1);
});

test('заполненный прогресс показывает последний модуль, лучший экзамен и продолжение', () => {
  const { course, api } = loadCourseProgress();
  let learning = completedModuleState(course, api, 'holdem-foundations', 80);
  const rankings = course.modules.find(item => item.id === 'hand-rankings');
  learning.modules['hand-rankings'] = {
    completedLessons: [rankings.lessons[0].id],
    completedTasks: [],
    taskAttempts: [],
    examAttempts: [{ score: 90, passed: true, date: '2026-01-02T00:00:00.000Z' }],
    bestExamScore: 90
  };
  learning.current = {
    moduleId: 'hand-rankings',
    lessonId: rankings.lessons[0].id,
    view: 'lesson'
  };
  const model = loadDashboard().createModel({
    progress: { decisions: 4, maxPoints: 12, scorePoints: 9, learning },
    course,
    courseProgress: api
  });
  assert.equal(model.isEmpty, false);
  assert.equal(model.lastCompletedTitle, 'Основы Texas Hold’em');
  assert.equal(model.bestExamScore, 90);
  assert.equal(model.resume.moduleId, 'hand-rankings');
  assert.match(model.resume.label, /Комбинации/);
  assert.ok(model.coursePercent > 0 && model.coursePercent < 100);
  assert.deepEqual({ ...model.primaryAction }, {
    label: 'Продолжить',
    route: 'learning',
    resume: true
  });
});

test('dashboard не мутирует объект прогресса при построении модели', () => {
  const { course, api } = loadCourseProgress();
  const progress = { decisions: 0, learning: api.defaultState(), unknown: { keep: true } };
  const before = JSON.stringify(progress);
  loadDashboard().createModel({ progress, course, courseProgress: api });
  assert.equal(JSON.stringify(progress), before);
});

test('при наличии только решений dashboard честно предлагает тренировку', () => {
  const { course, api } = loadCourseProgress();
  const model = loadDashboard().createModel({
    progress: {
      decisions: 3,
      maxPoints: 9,
      scorePoints: 6,
      learning: api.defaultState()
    },
    course,
    courseProgress: api
  });
  assert.deepEqual({ ...model.primaryAction }, {
    label: 'Начать тренировку',
    route: 'study',
    resume: false
  });
});
