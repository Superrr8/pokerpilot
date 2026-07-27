'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadLearningCourse,
  loadLearningMode
} = require('./learning-course-loader.cjs');

test('курс содержит третьим полноценный модуль «Позиции за покерным столом»', () => {
  const course = loadLearningCourse();
  assert.equal(course.modules.length, 3);
  const module = course.modules[2];
  assert.equal(module.id, 'table-positions');
  assert.equal(module.order, 3);
  assert.equal(module.title, 'Позиции за покерным столом');
  assert.equal(module.lessons.length, 4);
  assert.ok(module.examples.length >= 2);
  assert.ok(module.tasks.length >= 3);
  assert.equal(module.exam.questions.length, 10);
  assert.equal(module.exam.passingScore, 70);
});

test('интерактивная схема содержит ровно UTG, HJ, CO, BTN, SB и BB', () => {
  const module = loadLearningCourse().modules[2];
  assert.deepEqual(
    JSON.parse(JSON.stringify(module.table.positions.map(position => position.id))),
    ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  );
  for (const position of module.table.positions) {
    assert.equal(typeof position.description, 'string');
    assert.ok(position.description.length > 20);
    assert.ok(['early', 'middle', 'late', 'blinds'].includes(position.group));
    assert.ok(Array.isArray(position.exampleHands) && position.exampleHands.length >= 3);
  }
});

test('уроки покрывают раннюю, среднюю, позднюю позицию и IP/OOP', () => {
  const module = loadLearningCourse().modules[2];
  const text = [
    ...module.topics,
    ...module.lessons.flatMap(lesson => [lesson.title, ...lesson.sections])
  ].join(' ').toLowerCase();
  for (const topic of ['ранняя позиция', 'средняя позиция', 'поздняя позиция', 'ip', 'oop']) {
    assert.ok(text.includes(topic), `Не раскрыта тема: ${topic}`);
  }
});

test('примеры стартовых рук различаются по позициям', () => {
  const positions = loadLearningCourse().modules[2].table.positions;
  const utg = positions.find(position => position.id === 'UTG');
  const btn = positions.find(position => position.id === 'BTN');
  assert.notDeepEqual(
    JSON.parse(JSON.stringify(utg.exampleHands)),
    JSON.parse(JSON.stringify(btn.exampleHands))
  );
  assert.ok(btn.exampleHands.length >= utg.exampleHands.length);
});

test('схема позиции до выбора не выделяет место, после выбора объясняет его', () => {
  const module = loadLearningCourse().modules[2];
  const ui = loadLearningMode();
  const before = ui.renderPositionTableMarkup(module.table, null);
  assert.doesNotMatch(before, /is-selected/);
  const after = ui.renderPositionTableMarkup(module.table, 'BTN');
  assert.match(after, /is-selected/);
  assert.match(after, /BTN/);
  assert.ok(after.includes(module.table.positions.find(position => position.id === 'BTN').description));
});

test('следующий модуль существует только как заблокированный placeholder без контента', () => {
  const course = loadLearningCourse();
  assert.equal(course.upcomingModules.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(course.upcomingModules[0])),
    {
      id: 'starting-hands',
      order: 4,
      title: 'Стартовые руки',
      description: 'Диапазоны входа в банк из разных позиций.',
      requires: 'table-positions'
    }
  );
  assert.ok(!course.modules.some(module => module.id === 'starting-hands'));
});
