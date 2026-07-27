'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('design tokens покрывают полный визуальный контракт v2.0', () => {
  const css = read('src/styles/design-tokens.css');
  for (const token of [
    '--app-bg', '--surface-elevated', '--surface-glass', '--border-default',
    '--text-primary', '--accent', '--status-success', '--status-warning',
    '--status-danger', '--shadow-lg', '--blur-glass', '--radius-lg',
    '--space-10', '--font-size-display', '--z-modal',
    '--motion-duration-fast', '--motion-duration-slow', '--motion-ease-standard'
  ]) assert.ok(css.includes(token), `Нет design token ${token}`);
});

test('app shell и унифицированные компоненты вынесены в отдельный CSS', () => {
  const css = read('src/styles/app-shell.css');
  for (const selector of [
    '.app-shell', '.top-navigation', '.dashboard-grid', '.mode-card',
    '.progress-card', '.stat-card', '.ui-button-primary',
    '.ui-button-secondary', '.ui-button-ghost', '.ui-chip', '.ui-badge',
    '.ui-empty-state', '.ui-dialog', '.ui-toast', '.ui-progress',
    '.section-header', '.responsive-card-grid'
  ]) assert.ok(css.includes(selector), `Нет компонента ${selector}`);
});

test('кнопки имеют hover, focus-visible, active, disabled и loading состояния', () => {
  const css = read('src/styles/app-shell.css');
  for (const state of [':hover', ':focus-visible', ':active', ':disabled', '.is-loading']) {
    assert.ok(css.includes(state), `Нет состояния ${state}`);
  }
});

test('motion system покрывает основные переходы без анимации layout', () => {
  const css = read('src/styles/motion.css');
  for (const animation of [
    'dashboardReveal', 'staggerReveal', 'modeTransition', 'dialogIn',
    'progressGrow', 'answerCorrect', 'answerIncorrect', 'moduleUnlock',
    'positionSelect', 'cardDeal', 'chipToPot', 'potToWinner'
  ]) assert.ok(css.includes(`@keyframes ${animation}`), `Нет ${animation}`);
  assert.doesNotMatch(css, /@keyframes[\s\S]*?(?:width|height|top|left)\s*:/);
});

test('reduced motion полностью выключает декоративное движение', () => {
  const css = read('src/styles/motion.css');
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);
});

test('карты, стол, фишки и банк используют визуальные component states', () => {
  const css = read('src/styles/app-shell.css');
  for (const selector of [
    '.playing-card.face-down', '.playing-card.is-selected',
    '.playing-card.is-winning', '.playing-card.is-disabled',
    '.poker-table', '.seat.hero', '.seat.active-player',
    '.chip-stack', '.bet-display', '.pot-display'
  ]) assert.ok(css.includes(selector), `Нет ${selector}`);
});

test('desktop и iPhone layout имеют отдельные responsive правила без overflow', () => {
  const css = read('src/styles/app-shell.css');
  assert.match(css, /@media\s*\(min-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /min-height:\s*44px/);
});

