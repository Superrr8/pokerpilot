'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadLearningCourse,
  loadLearningMode,
  readRequired
} = require('./learning-course-loader.cjs');

const root = path.resolve(__dirname, '..');

test('index.html подключает данные, прогресс и UI обучения до приложения', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const data = '<script src="src/data/learning-course.js"></script>';
  const progress = '<script src="src/learning/course-progress.js"></script>';
  const ui = '<script src="src/ui/learning-mode.js"></script>';
  const app = 'const C = window.PokerCore;';
  assert.ok(html.includes('data-route="learning"'));
  assert.ok(html.includes('id="screen-learning"'));
  assert.ok(html.indexOf(data) > 0);
  assert.ok(html.indexOf(data) < html.indexOf(progress));
  assert.ok(html.indexOf(progress) < html.indexOf(ui));
  assert.ok(html.indexOf(ui) < html.indexOf(app));
});

test('UI не раскрывает правильный ответ или объяснение до выбора', () => {
  const course = loadLearningCourse();
  const ui = loadLearningMode();
  const question = course.modules[0].tasks[0];
  const markup = ui.renderQuestionMarkup(question, null);
  assert.doesNotMatch(markup, /selected-correct|selected-wrong|reveal-best/);
  assert.ok(!markup.includes(question.explanation));
  assert.equal(
    (markup.match(/class="learning-choice(?:\s|")/g) || []).length,
    question.choices.length
  );
});

test('после ответа UI показывает результат и понятное объяснение', () => {
  const course = loadLearningCourse();
  const ui = loadLearningMode();
  const question = course.modules[0].tasks[0];
  const markup = ui.renderQuestionMarkup(question, question.correctChoiceId);
  assert.match(markup, /selected-correct/);
  assert.ok(markup.includes(question.explanation));
});

test('стили обучения ограничивают ширину и не создают горизонтальный скролл', () => {
  const source = readRequired('src/ui/learning-mode.js');
  const css = readRequired('src/styles/learning-mode.css');
  assert.match(css, /\.learning-(?:module-grid|choices)[^{]*\{[^}]*minmax\(0,\s*1fr\)/);
  assert.match(css, /overflow-wrap:\s*break-word/);
  assert.doesNotMatch(source, /document\.write|eval\(/);
});
