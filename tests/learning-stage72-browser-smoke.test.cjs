'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

test('design tokens и learning CSS подключены без изменения старых экранов', () => {
  const tokens = '<link rel="stylesheet" href="src/styles/design-tokens.css">';
  const learning = '<link rel="stylesheet" href="src/styles/learning-mode.css">';
  assert.ok(html.includes(tokens));
  assert.ok(html.includes(learning));
  assert.ok(html.indexOf(tokens) < html.indexOf(learning));
});

test('sound manager загружается до Learning Mode и прикладного скрипта', () => {
  const sound = '<script src="src/audio/sound-manager.js"></script>';
  const learning = '<script src="src/ui/learning-mode.js"></script>';
  const app = 'const C = window.PokerCore;';
  assert.ok(html.includes(sound));
  assert.ok(html.indexOf(sound) < html.indexOf(learning));
  assert.ok(html.indexOf(learning) < html.indexOf(app));
});

test('Learning Mode содержит доступный переключатель звука и интерактивный стол', () => {
  const ui = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'ui', 'learning-mode.js'),
    'utf8'
  );
  assert.match(ui, /data-learning-action="toggle-sound"/);
  assert.match(ui, /aria-pressed=/);
  assert.match(ui, /data-learning-action="select-position"/);
  assert.match(ui, /learning-poker-table/);
});
