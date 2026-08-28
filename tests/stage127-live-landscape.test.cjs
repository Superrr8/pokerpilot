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

const landscapeMarker = '@media (orientation: landscape) and (min-width: 700px) and (max-height: 500px)';

test('Live has a dedicated short-height landscape presentation after desktop rules', () => {
  const landscapeIndex = css.indexOf(landscapeMarker);
  assert.notEqual(landscapeIndex, -1);
  assert.ok(landscapeIndex > css.indexOf('@media (min-width: 700px)'), 'landscape must override desktop sizing');
});

test('landscape shell owns all four safe areas and uses dynamic viewport height', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[^}]*padding-inline-start:\s*max\([^;]*safe-area-inset-left[^;]*\);[^}]*padding-inline-end:\s*max\([^;]*safe-area-inset-right[^;]*\)/s);
  assert.match(landscape, /\.live-v2-game-shell\s*\{[^}]*height:\s*calc\(100dvh[^;]*safe-area-inset-top[^;]*safe-area-inset-bottom[^;]*\)/s);
});

test('landscape uses a two-column table/action composition without scrolling', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /\.live-v2-game-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+clamp\(/s);
  assert.match(landscape, /grid-template-areas:\s*"table action"\s*"hero action"/s);
  assert.match(landscape, /overflow:\s*hidden/);
  assert.match(landscape, /\.live-v2-table-stage\s*\{[^}]*grid-area:\s*table/s);
  assert.match(landscape, /\.live-v2-hero-zone\s*\{[^}]*grid-area:\s*hero/s);
  assert.match(landscape, /\.live-v2-action-zone\s*\{[^}]*grid-area:\s*action/s);
});

test('landscape scales the accepted 6-max and 9-max cameras without new seat coordinates', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /--live-v2-landscape-table-scale:/);
  assert.match(landscape, /data-table-size="6"[^}]*--live-table-camera-width:\s*378px;[^}]*--live-table-camera-height:\s*334px/s);
  assert.match(landscape, /data-table-size="9"[^}]*--live-table-camera-width:\s*440px;[^}]*--live-table-camera-height:\s*330px/s);
  assert.match(landscape, /transform:\s*translateX\(-50%\)\s+scale\(var\(--live-v2-landscape-table-scale\)\)/);
  assert.doesNotMatch(landscape, /\.seat[^\{]*\{[^}]*(?:top|left|right|bottom)\s*:/s);
});

test('Hero cards and the canonical action row remain simultaneously visible in landscape', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /\.live-v2-hero-zone\s*\{[^}]*height:\s*76px/s);
  assert.match(landscape, /#heroCards\.live-v2-hero-cards \.playing-card\s*\{[^}]*width:\s*46px;[^}]*height:\s*66px/s);
  assert.match(landscape, /#liveActions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(landscape, /#liveActions button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(html, /id="liveActions"[^>]*aria-label="Действия Hero"/);
});

test('landscape observation dock is compact while the action state remains usable', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /data-live-dock-state="waiting"[\s\S]*?data-live-dock-state="observing"[\s\S]*?max-height:\s*58px/);
  assert.match(landscape, /\.live-v2-action-zone\s*\{[^}]*min-height:\s*0;[^}]*align-items:\s*center/s);
  assert.match(landscape, /\.live-v2-action-dock\.is-sizing\s*\{[^}]*max-height:\s*100%/s);
});

test('landscape keeps essential top controls and removes the gameplay bottom-nav collision', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /\.top-navigation\s*\{[^}]*height:\s*44px;[^}]*min-height:\s*44px/s);
  assert.match(landscape, /\.live-v2-top-control[\s\S]*?\.sound-control[\s\S]*?min-height:\s*40px/s);
  assert.match(css, /\.is-live-game-active #primaryNavigation\s*\{[^}]*display:\s*none/s);
  assert.match(html, /id="liveBackControl"[^>]*aria-label="Выйти из Live Cash"/);
});

test('Trainer sheet is safe-area bounded with an internally scrollable landscape body', () => {
  const landscape = blockAfter(css, landscapeMarker);
  assert.match(landscape, /\.live-v2-sheet\s*\{[^}]*max-height:\s*calc\(100dvh[^;]*safe-area-inset-top[^;]*safe-area-inset-bottom[^;]*\)/s);
  assert.match(landscape, /\.live-v2-sheet-header\s*\{[^}]*min-height:\s*52px/s);
  assert.match(landscape, /\.live-v2-sheet-body\s*\{[^}]*max-height:\s*calc\(100dvh[^;]*\);[^}]*overflow-y:\s*auto/s);
  assert.match(html, /id="liveCoachClose"[^>]*aria-label="Закрыть Тренер"/);
});

test('accepted portrait density and canonical DOM stay intact', () => {
  const portrait = blockAfter(css, '@media (max-width: 480px) and (orientation: portrait)');
  assert.match(portrait, /--live-v2-hero-stage-height:\s*clamp\(94px,\s*11\.5dvh,\s*100px\)/);
  assert.match(portrait, /--live-v2-action-stage-height:\s*clamp\(164px,\s*20\.5dvh,\s*184px\)/);
  assert.match(html, /class="live-v2-table-stage"[\s\S]*?class="live-v2-hero-zone"[\s\S]*?class="live-v2-action-zone"/);
});
