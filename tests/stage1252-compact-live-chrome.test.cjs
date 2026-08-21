'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const liveCss = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const presentationSource = fs.readFileSync(path.join(root, 'src/live/live-presentation-state.js'), 'utf8');
const presentationState = require(path.join(root, 'src/live/live-presentation-state.js'));

test('Live V2 supersedes Hero-only compact chrome without changing canonical state', () => {
  assert.match(liveCss, /\/\* Stage 12\.5\.3 — Live Mode V2 stable premium shell\. \*\//);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active/);
  assert.doesNotMatch(liveCss, /Stage 12\.5\.2 — Canonical Hero-decision viewport compression/);
  assert.match(presentationSource, /compact:\s*controlsAvailable/);
});

test('global navigation leaves layout and focus order for the whole active game session', () => {
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active #screen-live > \.back,[\s\S]*?#primaryNavigation\s*\{[^}]*display:\s*none;[^}]*pointer-events:\s*none/s);
  assert.match(html, /const gameActive = Boolean\([\s\S]*?routeName === 'live'[\s\S]*?shell\?\.classList\.toggle\('is-live-game-active', gameActive\)/);
});

test('Live shell replaces fixed-navigation clearance with iOS safe areas', () => {
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[\s\S]*?padding-block-start:\s*max\(4px,\s*env\(safe-area-inset-top\)\);[\s\S]*?padding-block-end:\s*max\(8px,\s*env\(safe-area-inset-bottom\)\)/);
});

test('game header exposes only back, stakes, sound and More controls', () => {
  assert.match(html, /id="liveBackControl"/);
  assert.match(html, /class="chip top-stakes">\$1\/\$3/);
  assert.match(html, /id="soundToggle"/);
  assert.match(html, /id="liveMoreToggle"/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.brand\s*\{[^}]*display:\s*none/);
});

test('volume preference remains stored while the long slider is hidden in Live', () => {
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.sound-volume\s*\{[^}]*display:\s*none/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.sound-toggle\s*\{[\s\S]*?min-height:\s*42px/);
  assert.match(html, /id="soundVolume"[^>]*value="0\.35"/);
});

test('legacy back row is replaced by the dedicated game-header control', () => {
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active #screen-live > \.back,[\s\S]*?display:\s*none/);
  assert.match(html, /id="liveBackControl"[^>]*data-route="training"/);
});

test('session status and secondary controls stay available in More', () => {
  for (const id of ['liveStack', 'liveProfit', 'liveHands', 'liveTilt', 'pauseLive', 'saveLiveHand']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="liveMoreSheet"[\s\S]*?live-v2-session-meta/);
});

test('stable table budget and persistent action dock keep decisions usable', () => {
  assert.match(liveCss, /\.live-v2-game-shell\s*\{[\s\S]*?grid-template-rows:\s*var\(--live-v2-table-stage-height\)\s+108px\s+232px/);
  assert.match(liveCss, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[\s\S]*?height:\s*var\(--live-table-camera-height\)/);
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(liveCss, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\) and \(max-height:\s*720px\)/);
});

test('canonical action visibility and diagnostics remain the presentation invariant', () => {
  assert.match(html, /decision\.controlsAvailable/);
  assert.match(presentationSource, /compact:\s*controlsAvailable/);
  for (const diagnostic of [
    'liveHeroTurn',
    'liveHeroCanAct',
    'liveActionsVisible',
    'liveCompact',
    'liveCurrentActor',
    'liveHeroSeat',
    'liveStreet'
  ]) assert.match(presentationSource, new RegExp(diagnostic));
});

test('the same canonical decision covers preflop, flop, turn and river', () => {
  const base = {
    route: 'live',
    gameVisible: true,
    flowCanHeroAct: true,
    flowPhase: 'playing',
    heroFolded: false
  };
  const decisions = [
    presentationState.deriveHeroDecision({ ...base, awaiting: 'hero-preflop', street: 'preflop', toCall: 10 }),
    presentationState.deriveHeroDecision({ ...base, awaiting: 'hero-postflop', street: 'flop', toCall: 0 }),
    presentationState.deriveHeroDecision({ ...base, awaiting: 'hero-postflop', street: 'turn', toCall: 125 }),
    presentationState.deriveHeroDecision({ ...base, awaiting: 'hero-postflop', street: 'river', toCall: 0 })
  ];
  decisions.forEach(decision => {
    assert.equal(decision.controlsAvailable, true);
    assert.equal(decision.compact, true);
  });
  assert.deepEqual(decisions[0].actionOptions, ['fold', 'call', 'raise']);
  assert.deepEqual(decisions[1].actionOptions, ['check', 'bet', 'allin']);
  assert.deepEqual(decisions[2].actionOptions, ['fold', 'call', 'raise']);
  assert.deepEqual(decisions[3].actionOptions, ['check', 'bet', 'allin']);
});

test('long amounts cannot force the action row wider than the mobile viewport', () => {
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[\s\S]*?overflow-x:\s*clip/);
});

test('Live V2 remains presentation-only', () => {
  const marker = liveCss.indexOf('/* Stage 12.5.3 — Live Mode V2 stable premium shell. */');
  assert.notEqual(marker, -1);
  assert.doesNotMatch(liveCss.slice(marker), /PokerCore|analyzerPreflop|analyzerPostflop|evaluator|equity|callEV|Monte Carlo/);
});
