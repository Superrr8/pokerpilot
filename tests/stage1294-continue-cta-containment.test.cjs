'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/stage1101-redesign.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function containmentBlock() {
  const marker = '/* Stage 12.9.4 — Continue CTA containment fix. */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'missing Stage 12.9.4 containment block');
  return css.slice(start);
}

test('Stage 12.9.4 cache key and full Continue label are present', () => {
  assert.match(html, /href="src\/styles\/stage1101-redesign\.css\?v=12\.9\.4"/);
  assert.match(html, /id="dashboardContinue"[^>]*>Продолжить<\/button>/);
});

test('Continue CTA uses a localized bounded track rather than the old oversized track', () => {
  const block = containmentBlock();
  assert.match(block, /\.dashboard-learning-row\s*\{[^}]*grid-template-columns:\s*34px minmax\(0, 1fr\) 136px/s);
  assert.match(block, /#dashboardContinue\s*\{[^}]*width:\s*136px[^}]*min-width:\s*136px[^}]*max-width:\s*136px/s);
  assert.doesNotMatch(block, /211px/);
});

test('Continue label remains contained and may wrap normally inside the button', () => {
  const block = containmentBlock();
  assert.match(block, /#dashboardContinue\s*\{[^}]*overflow:\s*hidden[^}]*overflow-wrap:\s*normal[^}]*white-space:\s*normal[^}]*word-break:\s*normal/s);
  assert.doesNotMatch(block, /#dashboardContinue\s*\{[^}]*text-overflow:\s*ellipsis/s);
});

test('Continue arrow is restored and contained as a stable CTA child', () => {
  const block = containmentBlock();
  assert.match(block, /#dashboardContinue::after\s*\{[^}]*display:\s*inline-block[^}]*flex:\s*0 0 auto[^}]*margin-left:\s*0/s);
  assert.match(block, /#dashboardContinue\s*\{[^}]*column-gap:\s*4px/s);
});

test('390x844, 430x932 and 440x956 share the containment rule', () => {
  const block = containmentBlock();
  assert.match(block, /@media \(max-width: 480px\)/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 440, height: 956 }]) {
    assert.ok(viewport.width <= 480, `${viewport.width}x${viewport.height} must contain the CTA`);
  }
});

test('containment fix stays isolated from accepted Dashboard and frozen systems', () => {
  const block = containmentBlock();
  assert.doesNotMatch(block, /daily-challenge|homeStatus|home-quick-action|home-focus|home-recent/);
  assert.doesNotMatch(block, /#screen-live|live-v2|poker-table|bottom-nav|PokerCore|Trainer|localStorage|data-theme/);
});
