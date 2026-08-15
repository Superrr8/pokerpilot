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
const stage11Css = fs.readFileSync(path.join(root, 'src/styles/stage11-refresh.css'), 'utf8');
const explanationEngine = fs.readFileSync(path.join(root, 'src/training/trainer-explanation-engine.js'), 'utf8');

function block(source, marker, endMarker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing marker: ${marker}`);
  const end = source.indexOf(endMarker, start + marker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

test('Hero cards and all primary actions remain inside the play-first decision core', () => {
  const core = block(html, '<div id="liveDecisionCore"', '</div><!-- /live-decision-core -->');
  assert.ok(core.indexOf('id="heroCards"') < core.indexOf('id="liveActions"'));
  assert.match(core, /id="liveActions"/);
  assert.match(html, /\['fold','call','raise'\]/);
});

test('learning content remains after the primary decision controls', () => {
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveLearningPanel"'));
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveHistoryPanel"'));
});

test('short iPhone viewport uses a single-row compact session bar', () => {
  assert.match(
    liveCss,
    /@media \(max-width:\s*430px\)[\s\S]*?#screen-live #liveGame\.is-hero-turn \.session-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/
  );
  assert.match(
    liveCss,
    /#screen-live #liveGame\.is-hero-turn \.live-hand-controls\s*\{[\s\S]*?width:\s*auto/
  );
});

test('mobile table budget leaves a practical navigation safety margin', () => {
  assert.match(liveCss, /--live-mobile-nav-safety-gap:\s*20px/);
  assert.match(
    liveCss,
    /#screen-live #liveGame\.is-hero-turn \.poker-table\s*\{[\s\S]*?height:\s*clamp\(220px,\s*27dvh,\s*232px\)/
  );
  assert.match(
    liveCss,
    /#screen-live #liveGame\.is-hero-turn \.poker-table\s*\{[\s\S]*?margin:\s*2px 0 8px/
  );
});

test('Hero cards preserve the accepted readable Stage 12.4 size', () => {
  assert.match(
    liveCss,
    /#screen-live #liveGame\.is-hero-turn #heroCards \.playing-card\s*\{[\s\S]*?width:\s*54px;[\s\S]*?height:\s*76px/
  );
});

test('primary Live actions retain a 44px minimum touch target', () => {
  assert.match(
    liveCss,
    /#screen-live #liveActions button\s*\{[\s\S]*?min-height:\s*44px/
  );
});

test('mobile width remains constrained without a fixed or sticky action dock', () => {
  assert.match(liveCss, /\.live-decision-core\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(stage11Css, /@media \(max-width:\s*430px\)[\s\S]*?overflow-x:\s*clip/);
  assert.doesNotMatch(liveCss, /#liveActions[^}]*position:\s*(?:fixed|sticky)/);
  assert.doesNotMatch(liveCss, /\.live-decision-core[^}]*position:\s*(?:fixed|sticky)/);
});

test('Stage 12.1 safe-area and fixed-navigation contract remains intact', () => {
  assert.match(tokensCss, /--safe-area-bottom:\s*env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(layoutCss, /\.bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-area-bottom\) \+ var\(--bottom-navigation-offset\)\)/);
  assert.match(layoutCss, /\.app-shell\s*\{[\s\S]*?padding-block-end:\s*var\(--app-content-bottom-inset\)/);
});

test('Stage 12.3 structured explanation remains wired to the shared engine', () => {
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?liveTrainerResult,[\s\S]*?record\.decisionQuality/);
  assert.match(html, /<details id="liveLearningPanel"/);
  assert.match(explanationEngine, /function generateExplanation\(input = \{\}\)/);
});

test('compact geometry is mobile-only and leaves desktop Live rules untouched', () => {
  const stage124Start = liveCss.indexOf('/* Stage 12.4');
  assert.notEqual(stage124Start, -1);
  const compactRule = liveCss.indexOf('grid-template-columns: minmax(0, 1fr) auto', stage124Start);
  assert.notEqual(compactRule, -1);
  const mediaStart = liveCss.lastIndexOf('@media (max-width: 430px)', compactRule);
  assert.ok(mediaStart >= stage124Start);
  assert.ok(mediaStart < compactRule);
});
