'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const liveHtml = html.slice(html.indexOf('<section id="screen-live"'), html.indexOf('</main>'));

test('Live dock exposes one composed context block with a truthful helper line', () => {
  assert.match(liveHtml, /class="live-v2-dock-context"/);
  assert.match(liveHtml, /class="live-v2-dock-copy"/);
  assert.match(liveHtml, /id="liveDockHelper"[^>]*aria-live="polite"/);
  assert.match(html, /\$\('#liveDockHelper'\)\.textContent=/);
  assert.match(html, /Ты сфолдил · следи за действиями соперников/);
  assert.match(html, /Ожидаем действие игрока/);
  assert.match(html, /Выбери линию · (?:к коллу|можно Check)/);
});

test('waiting and observing states keep the accepted reserve while using a premium compact surface', () => {
  assert.match(css, /\.live-v2-action-zone\s*\{[^}]*min-height:\s*232px/s);
  assert.match(css, /\.live-v2-action-dock\[data-live-dock-state="waiting"\],[\s\S]*?\.live-v2-action-dock\[data-live-dock-state="observing"\]\s*\{[^}]*min-height:\s*54px/s);
  assert.match(css, /\.live-v2-dock-context\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /\.live-v2-dock-copy\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.live-v2-dock-helper\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(css, /data-live-dock-state="waiting"[\s\S]*?background:\s*linear-gradient/s);
});

test('Hero decision surface keeps actions and sizing visually integrated with Trainer aligned', () => {
  assert.match(css, /\.live-v2-coach-trigger\s*\{[^}]*top:\s*10px;[^}]*right:\s*10px/s);
  assert.match(css, /#screen-live \.live-v2-action-dock #liveActions\s*\{[^}]*border-top:\s*1px solid/s);
  assert.match(css, /#screen-live \.live-v2-action-dock \.bet-sizer\s*\{[^}]*border-top:\s*1px solid/s);
  assert.match(css, /\.live-v2-sizing-row\s*\{[^}]*border:\s*1px solid/s);
  assert.match(css, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[^}]*box-shadow:/s);
});

test('external recent-action bubble suppresses every FOLD event while preserving non-fold actions', () => {
  assert.match(html, /const actionType=player\.visualAction\?\.type/);
  assert.match(html, /\['POST_BLIND','FOLD'\]\.includes\(actionType\)/);
  assert.match(html, /const action=player\.folded\|\|/);
  assert.match(html, /bubble\.dataset\.action=action\.type/);
  assert.match(html, /lastAction\.dataset\.action=p\.lastActionType\|\|''/);
});

test('approved 6-max and 9-max geometry remains frozen', () => {
  assert.match(html, /PokerPilotLiveSeatLayouts\.getLayout\(session\.n\)/);
  assert.match(css, /--live-v2-table-stage-height:\s*clamp\(360px,[^;]*380px\)/);
  assert.match(css, /\[data-table-size="6"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-height:\s*334px/s);
  assert.match(css, /\[data-table-size="9"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-width:\s*clamp\(410px, 112vw, 440px\)/s);
});

