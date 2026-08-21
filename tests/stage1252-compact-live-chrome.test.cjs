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

const marker = '/* Stage 12.5.2 — Canonical Hero-decision viewport compression. */';
const start = liveCss.indexOf(marker);
const compactCss = start === -1 ? '' : liveCss.slice(start);

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing rule: ${selector}`);
  return match[1];
}

test('compact Live chrome is portrait-mobile and canonical-state scoped', () => {
  assert.notEqual(start, -1);
  assert.match(compactCss, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\)/);
  assert.match(compactCss, /\.app-shell\[data-active-route="live"\]\.is-live-hero-turn/);
  assert.doesNotMatch(compactCss, /awaiting|canHeroAct|hero-preflop|hero-postflop/);
});

test('global navigation is removed from layout and focus order only for a canonical Hero decision', () => {
  const nav = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn #primaryNavigation');
  assert.match(nav, /display:\s*none/);
  assert.match(nav, /pointer-events:\s*none/);
  assert.doesNotMatch(liveCss.slice(0, start), /#primaryNavigation\s*\{[^}]*display:\s*none/);
});

test('compact shell replaces fixed-navigation clearance with the iOS safe area', () => {
  const shell = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn');
  assert.match(shell, /padding-block-end:\s*max\(8px,\s*var\(--safe-area-bottom\)\)/);
});

test('Hero decision header keeps only PP, stakes and a compact sound button', () => {
  const header = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .top-navigation');
  const copy = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .brand > span:last-child');
  const stakes = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .top-stakes');
  const sound = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .sound-control');
  assert.match(header, /height:\s*40px/);
  assert.match(copy, /display:\s*none/);
  assert.match(stakes, /display:\s*inline-flex/);
  assert.match(sound, /width:\s*36px/);
});

test('volume value is preserved while the long slider is hidden during the decision', () => {
  const volume = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .sound-volume');
  const toggle = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn .sound-toggle');
  assert.match(volume, /display:\s*none/);
  assert.match(toggle, /min-height:\s*36px/);
  assert.match(html, /id="soundVolume"[^>]*value="0\.35"/);
});

test('back-to-training control yields its standalone row only during the decision', () => {
  const back = rule(compactCss, '.app-shell[data-active-route="live"].is-live-hero-turn #screen-live > .back');
  assert.match(back, /display:\s*none/);
  assert.match(html, /<button class="back" data-route="training">‹ К тренировке<\/button>/);
});

test('session status becomes one compact strip without discarding real metrics or pause', () => {
  const bar = rule(compactCss, '#screen-live #liveGame.is-hero-turn .session-bar');
  const stats = rule(compactCss, '#screen-live #liveGame.is-hero-turn .stats-grid.four');
  const action = rule(compactCss, '#screen-live #liveGame.is-hero-turn .compact-hand-action');
  assert.match(bar, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(bar, /padding:\s*4px 6px/);
  assert.match(stats, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(action, /min-height:\s*36px/);
  for (const id of ['liveStack', 'liveProfit', 'liveHands', 'liveTilt', 'pauseLive']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('table uses a height-aware compact budget while Hero cards and actions stay usable', () => {
  const table = rule(compactCss, '#screen-live #liveGame.is-hero-turn .poker-table');
  const cards = rule(compactCss, '#screen-live #liveGame.is-hero-turn #heroCards .playing-card');
  const actions = rule(compactCss, '#screen-live #liveActions button');
  assert.match(table, /height:\s*clamp\(190px,\s*24dvh,\s*210px\)/);
  assert.match(table, /min-height:\s*clamp\(190px,\s*24dvh,\s*210px\)/);
  assert.match(cards, /width:\s*54px/);
  assert.match(cards, /height:\s*76px/);
  assert.match(actions, /min-height:\s*44px/);
  assert.match(compactCss, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\) and \(max-height:\s*720px\)/);
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

test('the same compact state covers preflop, flop, turn and river decisions', () => {
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
  const actions = rule(compactCss, '#screen-live #liveActions button');
  assert.match(actions, /min-height:\s*44px/);
  assert.match(liveCss, /#screen-live #liveActions\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(liveCss, /#screen-live #liveActions button\s*\{[\s\S]*?min-width:\s*0/);
});

test('Stage 12.5.2 remains presentation-only', () => {
  assert.doesNotMatch(compactCss, /PokerCore|analyzerPreflop|analyzerPostflop|evaluator|equity|callEV|Monte Carlo/);
});
