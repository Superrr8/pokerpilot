'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCourseProgress } = require('./learning-course-loader.cjs');

const plain = value => JSON.parse(JSON.stringify(value));

test('открытие урока само по себе не завершает его', () => {
  const { api } = loadCourseProgress();
  const initial = api.defaultState();
  const opened = api.openLesson(initial, 'holdem-foundations', 'foundations-goal-cards');
  assert.deepEqual(
    plain(api.getModuleState(opened, 'holdem-foundations').completedLessons),
    []
  );
  assert.equal(opened.current.lessonId, 'foundations-goal-cards');
});

test('явное завершение урока сохраняется после нормализации', () => {
  const { api } = loadCourseProgress();
  const completed = api.completeLesson(
    api.defaultState(),
    'holdem-foundations',
    'foundations-goal-cards'
  );
  const reloaded = api.normalizeState(plain(completed));
  assert.deepEqual(
    plain(reloaded.modules['holdem-foundations'].completedLessons),
    ['foundations-goal-cards']
  );
});

test('экзамен сохраняет ответы, результат, ошибки и историю попыток', () => {
  const { course, api } = loadCourseProgress();
  const module = course.modules[0];
  const answers = Object.fromEntries(
    module.exam.questions.map((question, index) => [
      question.id,
      index === 0 ? 'definitely-wrong' : question.correctChoiceId
    ])
  );
  const result = api.submitExam(
    api.defaultState(),
    module.id,
    answers,
    '2026-07-27T10:00:00.000Z'
  );
  const saved = result.state.modules[module.id];
  assert.deepEqual(plain(saved.examAttempts[0].answers), answers);
  assert.equal(saved.examAttempts[0].score, 90);
  assert.equal(saved.examAttempts[0].errors.length, 1);
  assert.equal(result.score, 90);
  assert.equal(result.errors.length, 1);
  assert.equal(result.state.history.length, 1);
  assert.equal(result.state.weakTopics[module.exam.questions[0].topic], 1);
});

test('повтор экзамена не удаляет предыдущую историю', () => {
  const { course, api } = loadCourseProgress();
  const module = course.modules[0];
  const correct = Object.fromEntries(
    module.exam.questions.map(question => [question.id, question.correctChoiceId])
  );
  const wrong = Object.fromEntries(
    module.exam.questions.map(question => [question.id, 'wrong'])
  );
  const first = api.submitExam(api.defaultState(), module.id, wrong, '2026-07-27T10:00:00.000Z');
  const second = api.submitExam(first.state, module.id, correct, '2026-07-27T11:00:00.000Z');
  assert.equal(second.state.modules[module.id].examAttempts.length, 2);
  assert.equal(second.state.history.length, 2);
  assert.equal(second.state.modules[module.id].bestExamScore, 100);
});

test('ошибки мини-заданий и экзамена распределяются по темам', () => {
  const { course, api } = loadCourseProgress();
  const module = course.modules[0];
  const task = module.tasks[0];
  const taskResult = api.answerTask(
    api.defaultState(), module.id, task.id, 'wrong', '2026-07-27T09:00:00.000Z'
  );
  const examAnswers = Object.fromEntries(
    module.exam.questions.map(question => [question.id, 'wrong'])
  );
  const examResult = api.submitExam(
    taskResult.state, module.id, examAnswers, '2026-07-27T10:00:00.000Z'
  );
  assert.ok(examResult.state.weakTopics[task.topic] >= 1);
  assert.ok(Object.values(examResult.state.weakTopics).reduce((a, b) => a + b, 0) >= 11);
});

test('старый прогресс мигрирует без потери статистики тренера', () => {
  const { api } = loadCourseProgress();
  const legacy = {
    decisions: 12,
    scorePoints: 25,
    mistakes: { outs: 3 },
    history: [{ mode: 'study' }]
  };
  const migrated = api.migrateProgress(legacy);
  assert.equal(migrated.decisions, 12);
  assert.equal(migrated.scorePoints, 25);
  assert.equal(migrated.mistakes.outs, 3);
  assert.deepEqual(plain(migrated.history), legacy.history);
  assert.equal(migrated.learning.schemaVersion, 1);
});

test('повторная миграция идемпотентна', () => {
  const { api } = loadCourseProgress();
  const once = api.migrateProgress({ decisions: 4, futureField: { keep: true } });
  const twice = api.migrateProgress(plain(once));
  assert.deepEqual(plain(twice), plain(once));
});

test('неизвестные поля сохраняются, а повреждённые значения получают defaults', () => {
  const { api } = loadCourseProgress();
  const normalized = api.normalizeState({
    schemaVersion: 999,
    futureField: { keep: true },
    modules: 'broken',
    weakTopics: { cards: -4, future: 2 },
    history: 'broken',
    current: { moduleId: 42 }
  });
  assert.deepEqual(plain(normalized.futureField), { keep: true });
  assert.equal(normalized.schemaVersion, 1);
  assert.deepEqual(plain(normalized.modules), {});
  assert.equal(normalized.weakTopics.cards, undefined);
  assert.equal(normalized.weakTopics.future, 2);
  assert.deepEqual(plain(normalized.history), []);
  assert.equal(normalized.current, null);
});
