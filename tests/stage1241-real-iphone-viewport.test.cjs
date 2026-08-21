'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const liveCss = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(root, 'src/styles/layout-foundation.css'), 'utf8');
const tokensCss = fs.readFileSync(path.join(root, 'src/styles/design-tokens.css'), 'utf8');
const explanationEngine = fs.readFileSync(path.join(root, 'src/training/trainer-explanation-engine.js'), 'utf8');

test('Hero cards remain attached to the table before the persistent action dock', () => {
  assert.match(html, /id="pokerTable"[\s\S]*?id="heroCards"[\s\S]*?id="liveDecisionCore"[\s\S]*?id="liveActions"/);
  assert.match(html, /\['fold','call','raise'\]/);
});

test('learning and history remain secondary to primary decision controls', () => {
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveLearningPanel"'));
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveHistoryPanel"'));
  assert.match(html, /id="liveCoachSheet"/);
});

test('short iPhone viewport uses one stable table and action-dock budget', () => {
  assert.match(liveCss, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\)/);
  assert.match(liveCss, /\.live-v2-game-shell\s*\{[\s\S]*?grid-template-rows:\s*var\(--live-v2-table-stage-height\)\s+108px\s+232px/);
  assert.match(liveCss, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\) and \(max-height:\s*720px\)[\s\S]*?grid-template-rows:\s*var\(--live-v2-table-stage-height\)\s+88px\s+180px/);
});

test('mobile table budget uses stable session geometry rather than Hero-turn geometry', () => {
  assert.match(liveCss, /\.live-v2-table-stage\s*\{[\s\S]*?min-height:\s*0/);
  assert.match(liveCss, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[\s\S]*?height:\s*var\(--live-table-camera-height\)/);
  assert.doesNotMatch(liveCss, /#liveGame\.is-hero-turn \.poker-table\s*\{[^}]*height:/);
});

test('Hero cards retain readable adaptive dimensions without changing state geometry', () => {
  assert.match(liveCss, /#screen-live #heroCards\.live-v2-hero-cards \.playing-card\s*\{[\s\S]*?width:\s*56px/);
  assert.match(liveCss, /#screen-live #heroCards\.live-v2-hero-cards\s*\{[\s\S]*?position:\s*relative/);
});

test('primary Live actions retain a 48px minimum touch target', () => {
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-height:\s*48px/);
});

test('mobile width remains constrained without a fixed viewport action bar', () => {
  assert.match(liveCss, /\.live-decision-core\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[\s\S]*?overflow-x:\s*clip/);
  assert.doesNotMatch(liveCss, /\.live-v2-action-dock[^}]*position:\s*fixed/);
});

test('Stage 12.1 safe-area contract remains available outside the isolated Live shell', () => {
  assert.match(tokensCss, /--safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(layoutCss, /\.bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-area-bottom\) \+ var\(--bottom-navigation-offset\)\)/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[\s\S]*?padding-block-end:\s*max\(8px,\s*env\(safe-area-inset-bottom\)\)/);
});

test('Stage 12.3 structured explanation remains wired to the shared engine', () => {
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?liveTrainerResult,[\s\S]*?record\.decisionQuality/);
  assert.match(html, /<details id="liveLearningPanel"/);
  assert.match(explanationEngine, /function generateExplanation\(input = \{\}\)/);
});

test('stable Live geometry is session-scoped on both desktop and mobile', () => {
  const marker = liveCss.indexOf('/* Stage 12.5.3 — Live Mode V2 stable premium shell. */');
  assert.notEqual(marker, -1);
  const sessionRule = liveCss.indexOf('.app-shell[data-active-route="live"].is-live-game-active', marker);
  const mobileRule = liveCss.indexOf('@media (max-width: 480px) and (orientation: portrait)', marker);
  assert.ok(sessionRule > marker);
  assert.ok(mobileRule > sessionRule);
});
