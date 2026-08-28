'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');

function blockAfter(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  assert.fail(`unterminated ${marker}`);
}

const portrait = blockAfter(css, '@media (max-width: 480px) and (orientation: portrait)');

test('portrait Live uses a smaller stable Hero and Action Zone budget', () => {
  assert.match(portrait, /--live-v2-hero-stage-height:\s*clamp\(/);
  assert.match(portrait, /--live-v2-action-stage-height:\s*clamp\(/);
  assert.match(
    portrait,
    /grid-template-rows:\s*var\(--live-v2-table-stage-height\)\s+var\(--live-v2-hero-stage-height\)\s+var\(--live-v2-action-stage-height\)/
  );
  assert.match(portrait, /\.live-v2-action-zone\s*\{[^}]*min-height:\s*var\(--live-v2-action-stage-height\);[^}]*align-items:\s*start/s);
  assert.doesNotMatch(portrait, /grid-template-rows:[^;]*232px/);
  assert.match(css, /@media \(min-width:\s*700px\)[\s\S]*?grid-template-rows:[^;]*232px/);
});

test('portrait Hero cards and canonical actions stay in the same stable flow', () => {
  assert.match(portrait, /\.live-v2-hero-zone\s*\{[^}]*height:\s*var\(--live-v2-hero-stage-height\)/s);
  assert.match(html, /class="live-v2-hero-zone"[\s\S]*?id="heroCards"[\s\S]*?class="live-v2-action-zone"/);
  assert.match(html, /decision\.actionOptions\.forEach/);
  assert.match(css, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[^}]*min-height:\s*48px/s);
});

test('normal helper copy wraps without an ellipsis while the dock remains compact', () => {
  assert.match(css, /\.live-v2-dock-helper\s*\{[^}]*text-overflow:\s*clip;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere/s);
  assert.doesNotMatch(css, /\.live-v2-dock-helper\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /data-live-dock-state="observing"\]\s*\{[^}]*min-height:\s*54px/s);
});

test('portrait opponent action bubbles are compact and remain outside game state', () => {
  assert.match(portrait, /\.player-action-bubble\s*\{[^}]*max-width:\s*78px;[^}]*padding:\s*3px 5px;[^}]*font-size:\s*8px/s);
  assert.match(portrait, /\.seat\.seat-edge-top \.player-action-bubble\s*\{[^}]*left:\s*calc\(100% \+ 2px\)/s);
  assert.match(html, /const action=player\.folded\|\|\['POST_BLIND','FOLD'\]\.includes\(actionType\)\?null:player\.visualAction/);
});

test('accepted table geometry and one Live safe-area owner remain unchanged', () => {
  assert.match(css, /\[data-table-size="6"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-height:\s*334px/s);
  assert.match(css, /\[data-table-size="9"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-width:\s*clamp\(410px, 112vw, 440px\)/s);
  assert.match(css, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[^}]*padding-block-end:\s*max\(8px, env\(safe-area-inset-bottom\)\)/s);
  assert.match(css, /\.is-live-game-active #primaryNavigation\s*\{[^}]*display:\s*none/s);
});
