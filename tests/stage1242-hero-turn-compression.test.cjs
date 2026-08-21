'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const liveCss = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(root, 'src/styles/layout-foundation.css'), 'utf8');

test('canonical Hero state remains synchronized while session geometry stays stable', () => {
  assert.match(html, /function renderLive\(\)\{[\s\S]*?syncLivePresentationState\(\)/);
  assert.match(html, /PokerPilotLivePresentationState\.sync/);
  assert.match(html, /\.app-shell'\)\.dataset\.activeRoute = name;[\s\S]*?syncLivePresentationState\(name\)/);
  assert.match(html, /classList\.toggle\('is-live-game-active', gameActive\)/);
  assert.doesNotMatch(html, /PokerCore[\s\S]{0,100}is-live-hero-turn/);
});

test('Live V2 replaces obsolete Hero-only geometry with a session-wide shell', () => {
  assert.match(liveCss, /\/\* Stage 12\.5\.3 — Live Mode V2 stable premium shell\. \*\//);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active/);
  assert.doesNotMatch(liveCss, /Stage 12\.4\.2 — Hero turn vertical compression/);
  assert.doesNotMatch(liveCss, /#liveGame\.is-hero-turn \.poker-table\s*\{[^}]*height:/);
});

test('active Live top navigation is a dedicated minimal game bar', () => {
  assert.match(html, /id="liveBackControl"/);
  assert.match(html, /id="liveMoreToggle"/);
  assert.match(html, /class="chip top-stakes">\$1\/\$3/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.top-navigation\s*\{[\s\S]*?height:\s*48px/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.sound-volume\s*\{[^}]*display:\s*none/);
});

test('back and More controls keep usable compact touch targets for the whole game', () => {
  assert.match(liveCss, /\.live-v2-top-control\s*\{[\s\S]*?min-height:\s*42px/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.live-v2-top-control\s*\{[^}]*display:\s*grid/);
});

test('real Live HUD metrics and secondary controls remain available in More', () => {
  assert.match(html, /id="liveMoreSheet"[\s\S]*?id="liveStack"[\s\S]*?id="liveProfit"[\s\S]*?id="liveHands"[\s\S]*?id="liveTilt"/);
  assert.match(html, /id="liveMoreSheet"[\s\S]*?id="pauseLive"[\s\S]*?id="saveLiveHand"[\s\S]*?id="endSession"/);
});

test('table, Hero cards and action dimensions use the accepted V2 geometry', () => {
  assert.match(liveCss, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[\s\S]*?height:\s*var\(--live-table-camera-height\)/);
  assert.match(liveCss, /#screen-live #heroCards\.live-v2-hero-cards \.playing-card\s*\{[\s\S]*?width:\s*56px/);
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-height:\s*48px/);
});

test('decision ordering stays poker-first and learning remains in Coach', () => {
  assert.ok(html.indexOf('id="heroCards"') < html.indexOf('id="liveActions"'));
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveCoachSheet"'));
  assert.match(html, /id="liveHint"[^>]*aria-controls="liveCoachSheet"/);
});

test('fixed-navigation foundation remains unchanged outside active Live', () => {
  assert.match(layoutCss, /\.bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-area-bottom\) \+ var\(--bottom-navigation-offset\)\)/);
  assert.match(layoutCss, /\.app-shell\s*\{[\s\S]*?padding-block-end:\s*var\(--app-content-bottom-inset\)/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active #primaryNavigation\s*\{[^}]*display:\s*none/);
});

test('new shell does not alter gameplay or trainer calculations', () => {
  assert.doesNotMatch(liveCss, /PokerCore|analyzerPreflop|analyzerPostflop|callEV/);
  assert.match(html, /function getCanonicalLiveHeroDecision/);
  assert.match(html, /flowCanHeroAct:\s*Boolean\(session && flowController\.canHeroAct\(\)\)/);
  assert.match(html, /PokerPilotLivePresentationState\.deriveHeroDecision/);
});
