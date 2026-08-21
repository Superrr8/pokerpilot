const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');

test('observation state has one canonical visible label and no clipped English action fragment', () => {
  assert.equal((html.match(/'Наблюдение за столом'/g) || []).length, 1);
  assert.doesNotMatch(html, /id="liveObservingStatus"/);
  assert.doesNotMatch(html, /watching the action/i);
  assert.doesNotMatch(css, /content:\s*"Наблюдение за столом"/);
  assert.doesNotMatch(css, /\.live-observing-status/);
});

test('waiting and observing docks are compact inside the unchanged Action Zone reserve', () => {
  assert.match(css, /\.live-v2-action-zone\s*\{[^}]*min-height:\s*232px/s);
  assert.match(
    css,
    /\.live-v2-action-dock\[data-live-dock-state="waiting"\],[\s\S]*?\.live-v2-action-dock\[data-live-dock-state="observing"\]\s*\{[^}]*min-height:\s*54px/s
  );
  assert.match(
    css,
    /\.live-v2-action-dock\[data-live-dock-state="waiting"\]\s+#liveActions,[\s\S]*?\.live-v2-action-dock\[data-live-dock-state="observing"\]\s+#liveActions\s*\{[^}]*display:\s*none/s
  );
});

test('folded pods use dimming and their integrated status without an external FOLD badge', () => {
  assert.doesNotMatch(html, /fold-badge/);
  assert.doesNotMatch(html, /data-seat-part=['"]fold['"]/);
  assert.doesNotMatch(css, /\.fold-badge/);
  assert.match(css, /#screen-live \.seat\.folded/);
  assert.match(html, /lastAction\.dataset\.action=p\.lastActionType\|\|''/);
  assert.match(html, /const actionType=player\.visualAction\?\.type/);
  assert.match(html, /const action=player\.folded\|\|\['POST_BLIND','FOLD'\]\.includes\(actionType\)\?null:player\.visualAction/);
});

test('Hero controls, canonical diagnostics and accepted seat layouts remain wired', () => {
  assert.match(html, /decision\.actionOptions\.forEach/);
  assert.match(css, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[^}]*min-height:\s*48px/s);
  assert.match(html, /data-live-dock-state/);
  assert.match(html, /PokerPilotLivePresentationState\.deriveHeroDecision/);
  assert.match(html, /PokerPilotLiveSeatLayouts\.getLayout\(session\.n\)/);
});
