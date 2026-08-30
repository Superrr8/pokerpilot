'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/stage1101-redesign.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dashboard = fs.readFileSync(path.join(root, 'src/ui/dashboard.js'), 'utf8');

function stage129Block() {
  const marker = '/* Stage 12.9 — Dashboard premium mobile polish. */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'missing Stage 12.9 presentation block');
  return css.slice(start);
}

test('mobile progress details wrap cleanly instead of forcing ellipsis', () => {
  const block = stage129Block();
  assert.match(block, /\.home-dashboard-pro \.home-progress-metric (?:small|small,)[\s\S]*?text-overflow:\s*clip/);
  assert.match(block, /white-space:\s*normal/);
  assert.match(block, /overflow-wrap:\s*anywhere/);
});

test('Continue surface keeps its real label and allows supporting copy to wrap', () => {
  const block = stage129Block();
  assert.match(block, /\.dashboard-learning-row \.ui-button-primary\s*\{[^}]*min-width:\s*112px[^}]*font-size:\s*0\.75rem/s);
  assert.doesNotMatch(block, /color:\s*transparent|font-size:\s*0(?:\s*[;}])/);
  assert.match(block, /\.dashboard-learning-row p\s*\{[^}]*white-space:\s*normal/s);
  assert.match(block, /\.dashboard-learning-row p\s*\{[^}]*text-overflow:\s*clip/s);
  assert.match(block, /\.dashboard-learning-row \.ui-button-primary::after\s*\{[^}]*display:\s*none/s);
  assert.match(html, /id="dashboardContinue"[\s\S]*aria-label="Продолжить обучение"/);
});

test('Quick Actions reserve balanced two-line labels and comfortable touch height', () => {
  const block = stage129Block();
  assert.match(block, /\.home-dashboard-pro \.home-quick-action\s*\{[^}]*min-height:\s*64px/s);
  assert.match(block, /\.home-dashboard-pro \.home-quick-action strong\s*\{[^}]*min-height:\s*2\.2em[^}]*white-space:\s*normal/s);
  assert.match(dashboard, /label:\s*'Тренировка'/);
  assert.match(dashboard, /label:\s*'Ввести раздачу'/);
  assert.match(dashboard, /label:\s*'Equity'/);
});

test('Stage 12.9 stays shared across themes and isolated from frozen Live/gameplay', () => {
  const block = stage129Block();
  assert.doesNotMatch(block, /data-theme|#screen-live|live-v2|poker-table|player-pod|heroCards|liveActions/);
  assert.doesNotMatch(block, /PokerCore|evaluateHand|callEV|Trainer|ProgressSystem|localStorage/);
  assert.doesNotMatch(block, /position:\s*(?:absolute|fixed)|grid-template-areas|safe-area-inset/);
});
