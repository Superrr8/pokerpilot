'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLearningCourse } = require('./learning-course-loader.cjs');

const requiredTopics = {
  'holdem-foundations': [
    'цель игры', 'карманные и общие карты', 'улицы', 'позиции и дилер',
    'блайнды', 'действия', 'уникальность карт', 'интерфейс PokerPilot'
  ],
  'hand-rankings': [
    'high card', 'one pair', 'two pair', 'three of a kind', 'straight',
    'flush', 'full house', 'four of a kind', 'straight flush',
    'best five of seven', 'кикеры', 'ничьи', 'сравнение рук'
  ]
};

test('курс сохраняет первые два модуля и добавляет третий последовательный модуль', () => {
  const course = loadLearningCourse();
  assert.equal(course.schemaVersion, 1);
  assert.equal(course.modules.length, 3);
  assert.deepEqual(
    JSON.parse(JSON.stringify(course.modules.map(module => module.id))),
    ['holdem-foundations', 'hand-rankings', 'table-positions']
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(course.modules.map(module => module.order))),
    [1, 2, 3]
  );
});

test('каждый модуль содержит полноценные уроки, примеры, задания и экзамен', () => {
  for (const module of loadLearningCourse().modules) {
    assert.ok(module.lessons.length >= 3, `${module.id}: минимум 3 урока`);
    assert.ok(module.examples.length >= 2, `${module.id}: минимум 2 примера`);
    assert.ok(module.tasks.length >= 3, `${module.id}: минимум 3 задания`);
    assert.ok(module.exam.questions.length >= 8, `${module.id}: минимум 8 вопросов`);
    assert.equal(module.exam.passingScore, 70);
  }
});

test('идентификаторы модулей, уроков, примеров, заданий и вопросов уникальны', () => {
  const ids = [];
  for (const module of loadLearningCourse().modules) {
    ids.push(module.id);
    for (const item of [
      ...module.lessons,
      ...module.examples,
      ...module.tasks,
      ...module.exam.questions
    ]) ids.push(item.id);
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('уроки и интерактивные вопросы имеют обязательные поля и объяснения', () => {
  for (const module of loadLearningCourse().modules) {
    for (const lesson of module.lessons) {
      assert.equal(typeof lesson.title, 'string');
      assert.ok(Array.isArray(lesson.sections) && lesson.sections.length > 0);
      assert.equal(typeof lesson.coachTip, 'string');
      assert.ok(lesson.topic);
    }
    for (const question of [...module.tasks, ...module.exam.questions]) {
      assert.equal(typeof question.prompt, 'string');
      assert.ok(question.choices.length >= 2);
      assert.ok(question.choices.some(choice => choice.id === question.correctChoiceId));
      assert.equal(typeof question.explanation, 'string');
      assert.ok(question.explanation.length > 0);
      assert.ok(question.topic);
    }
  }
});

test('два модуля покрывают все темы, заявленные для Этапа 7.1', () => {
  const course = loadLearningCourse();
  for (const module of course.modules) {
    for (const topic of requiredTopics[module.id] || []) {
      assert.ok(module.topics.includes(topic), `${module.id}: отсутствует тема «${topic}»`);
    }
  }
});
