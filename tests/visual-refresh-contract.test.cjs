'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('design tokens вынесены в отдельный CSS-файл и покрывают обязательные группы', () => {
  const css = read('src/styles/design-tokens.css');
  for (const token of [
    '--color-accent', '--surface-1', '--text-primary', '--border-subtle',
    '--shadow-card', '--radius-card', '--space-4', '--motion-fast'
  ]) assert.ok(css.includes(token), `Нет токена ${token}`);
});

test('Learning Mode использует tokens и современные поверхности без полного редизайна', () => {
  const css = read('src/styles/learning-mode.css');
  assert.match(css, /var\(--surface-/);
  assert.match(css, /backdrop-filter/);
  assert.match(css, /\.learning-module-card/);
  assert.doesNotMatch(css, /#screen-(?:home|analyzer|study|ranges|live|coach)/);
});

test('кнопки обучения имеют hover, focus-visible, active и disabled состояния', () => {
  const css = read('src/styles/learning-mode.css');
  for (const state of [':hover', ':focus-visible', ':active', ':disabled']) {
    assert.ok(css.includes(state), `Нет состояния ${state}`);
  }
});

test('анимации покрывают карточки, уроки, позицию, ответы, прогресс и unlock', () => {
  const css = read('src/styles/learning-mode.css');
  for (const name of [
    'learningCardIn', 'learningLessonIn', 'positionSelect',
    'answerCorrect', 'answerIncorrect', 'examProgress', 'moduleUnlock'
  ]) assert.ok(css.includes(`@keyframes ${name}`), `Нет анимации ${name}`);
});

test('мобильный layout защищён от overflow и уважает reduced motion', () => {
  const css = read('src/styles/learning-mode.css');
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /overflow-wrap:\s*break-word/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
