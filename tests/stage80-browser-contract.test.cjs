'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('v2.0 stylesheets подключены после legacy styles и до Learning Mode', () => {
  const shell = '<link rel="stylesheet" href="src/styles/app-shell.css">';
  const motion = '<link rel="stylesheet" href="src/styles/motion.css">';
  const learning = '<link rel="stylesheet" href="src/styles/learning-mode.css">';
  assert.ok(html.includes(shell));
  assert.ok(html.includes(motion));
  assert.ok(html.indexOf(shell) < html.indexOf(motion));
  assert.ok(html.indexOf(motion) < html.indexOf(learning));
});

test('app shell содержит доступную top navigation без дублирующей mode navigation', () => {
  assert.match(html, /class="[^"]*app-shell/);
  assert.match(html, /class="[^"]*top-navigation/);
  assert.match(html, /aria-label="Основная навигация"/);
  for (const route of ['home', 'learning', 'analyzer', 'study', 'ranges', 'live', 'coach']) {
    assert.match(html, new RegExp(`id="screen-${route}"`), `Нет screen-${route}`);
  }
});

test('dialog и toast имеют доступные роли и живую область', () => {
  assert.match(html, /<dialog[^>]+id="appDialog"/);
  assert.match(html, /id="appToast"[^>]+role="status"[^>]+aria-live="polite"/);
});

test('dashboard имеет empty state, populated state hooks и семантические progress bars', () => {
  assert.match(html, /id="dashboardEmpty"/);
  assert.match(html, /id="dashboardPopulated"/);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-valuemin="0"/);
  assert.match(html, /aria-valuemax="100"/);
});

test('встроенный browser smoke hook контролирует console errors и overflow', () => {
  assert.match(html, /data-smoke="dashboard-ready"/);
  assert.match(html, /document\.documentElement\.scrollWidth/);
  assert.match(html, /window\.innerWidth/);
});
