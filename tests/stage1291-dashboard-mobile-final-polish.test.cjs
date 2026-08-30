'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/stage1101-redesign.css'), 'utf8');

function stage1291Block() {
  const marker = '/* Stage 12.9.1 — Dashboard mobile final polish. */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'missing Stage 12.9.1 presentation block');
  return css.slice(start);
}

test('Stage 12.9.1 remains isolated to the mobile Dashboard breakpoint', () => {
  const block = stage1291Block();
  assert.match(block, /^\/\* Stage 12\.9\.1[^]*@media \(max-width: 430px\)/);
  assert.doesNotMatch(block, /#screen-live|live-v2|poker-table|player-pod|heroCards|liveActions/);
  assert.doesNotMatch(block, /PokerCore|Trainer|evaluateHand|localStorage|data-theme/);
});

test('top summary wraps Poker IQ detail without ellipsis', () => {
  const block = stage1291Block();
  assert.match(block, /\.home-dashboard-pro \.home-welcome p\s*\{[^}]*overflow:\s*visible[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal/s);
});

test('Continue title and supporting copy are not line-clamped or ellipsized', () => {
  const block = stage1291Block();
  assert.match(block, /\.dashboard-learning-row h2,[^}]*\.dashboard-learning-row p\s*\{[^}]*overflow:\s*visible[^}]*white-space:\s*normal[^}]*-webkit-line-clamp:\s*unset/s);
  assert.match(block, /grid-template-columns:\s*34px minmax\(0, 1fr\) 104px/);
});

test('Daily Hand title and metadata use controlled wrapping', () => {
  const block = stage1291Block();
  assert.match(block, /\.daily-hand-meta\s*\{[^}]*flex:\s*1 1 100%[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal/s);
  assert.match(block, /\.daily-hand-copy p,[^}]*\.daily-hand-copy small\s*\{[^}]*overflow:\s*visible[^}]*-webkit-line-clamp:\s*unset/s);
  assert.match(block, /\.daily-challenge-progress\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(block, /\.daily-challenge-progress span\s*\{[^}]*text-overflow:\s*clip[^}]*white-space:\s*normal/s);
});

test('Quick Action labels retain balanced wrapping without forced word breaks', () => {
  const block = stage1291Block();
  assert.match(block, /\.home-dashboard-pro \.home-quick-action strong\s*\{[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*normal/s);
  assert.doesNotMatch(block, /\.home-dashboard-pro \.home-quick-action\s*\{[^}]*min-height:\s*(?:[0-5]?\d)px/s);
});

test('390x844 and 430x932 Dashboard contracts remain horizontally fluid', () => {
  const block = stage1291Block();
  const viewports = [
    { width: 390, height: 844 },
    { width: 430, height: 932 }
  ];
  for (const viewport of viewports) {
    assert.ok(viewport.width <= 430, `${viewport.width}x${viewport.height} must use the mobile contract`);
  }
  assert.match(block, /grid-template-columns:\s*34px minmax\(0, 1fr\) 104px/);
  assert.match(block, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(block, /^\s*width:\s*(?:390|430)px|position:\s*(?:absolute|fixed)|translateX\(/m);
});
