'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const liveCss = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const modulePath = path.join(root, 'src/live/live-presentation-state.js');
const presentationState = fs.existsSync(modulePath) ? require(modulePath) : null;

function fakeElement(initial = []) {
  const values = new Set(initial);
  return {
    classList: {
      add: value => values.add(value),
      remove: value => values.delete(value),
      toggle(value, force) {
        const enabled = force === undefined ? !values.has(value) : Boolean(force);
        if (enabled) values.add(value);
        else values.delete(value);
        return enabled;
      },
      contains: value => values.has(value)
    }
  };
}

function elements() {
  return {
    shell: fakeElement(),
    game: fakeElement(),
    decisionPanel: fakeElement()
  };
}

test('Live presentation state is a separately testable classic-script module', () => {
  assert.ok(presentationState, 'src/live/live-presentation-state.js must exist');
  assert.equal(typeof presentationState.isHeroTurn, 'function');
  assert.equal(typeof presentationState.sync, 'function');
  assert.equal(typeof presentationState.clear, 'function');
});

test('only canonical actionable Hero states activate compact Live chrome', () => {
  const base = { route: 'live', gameVisible: true, canHeroAct: true };
  assert.equal(presentationState.isHeroTurn({ ...base, awaiting: 'hero-preflop' }), true);
  assert.equal(presentationState.isHeroTurn({ ...base, awaiting: 'hero-postflop' }), true);
  for (const awaiting of ['ai', 'dealing', 'hero-presentation', 'paused', null]) {
    assert.equal(presentationState.isHeroTurn({ ...base, awaiting }), false, String(awaiting));
  }
});

test('route, mounted game and action authorization are all required', () => {
  const state = { route: 'live', gameVisible: true, canHeroAct: true, awaiting: 'hero-postflop' };
  assert.equal(presentationState.isHeroTurn({ ...state, route: 'home' }), false);
  assert.equal(presentationState.isHeroTurn({ ...state, gameVisible: false }), false);
  assert.equal(presentationState.isHeroTurn({ ...state, canHeroAct: false }), false);
});

test('opponent to Hero transition binds shell, game and decision state together', () => {
  const nodes = elements();
  presentationState.sync(nodes, {
    route: 'live', gameVisible: true, canHeroAct: true, awaiting: 'hero-preflop'
  });
  assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), true);
  assert.equal(nodes.game.classList.contains('is-hero-turn'), true);
  assert.equal(nodes.decisionPanel.classList.contains('is-hero-turn'), true);
});

test('Hero action immediately removes all active-turn presentation classes', () => {
  const nodes = elements();
  presentationState.sync(nodes, {
    route: 'live', gameVisible: true, canHeroAct: true, awaiting: 'hero-postflop'
  });
  presentationState.sync(nodes, {
    route: 'live', gameVisible: true, canHeroAct: true, awaiting: 'hero-presentation'
  });
  assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), false);
  assert.equal(nodes.game.classList.contains('is-hero-turn'), false);
  assert.equal(nodes.decisionPanel.classList.contains('is-hero-turn'), false);
});

test('new street can reactivate Hero state after an opponent interval', () => {
  const nodes = elements();
  const sync = state => presentationState.sync(nodes, state);
  const common = { route: 'live', gameVisible: true, canHeroAct: true };
  sync({ ...common, awaiting: 'hero-preflop' });
  sync({ ...common, awaiting: 'ai' });
  assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), false);
  sync({ ...common, awaiting: 'hero-postflop' });
  assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), true);
});

test('pause, new hand and exit clear stale Hero-turn presentation state', () => {
  for (const state of [
    { route: 'live', gameVisible: true, canHeroAct: false, awaiting: 'paused' },
    { route: 'live', gameVisible: true, canHeroAct: false, awaiting: 'dealing' },
    { route: 'home', gameVisible: false, canHeroAct: false, awaiting: null }
  ]) {
    const nodes = elements();
    nodes.shell.classList.add('is-live-hero-turn');
    nodes.game.classList.add('is-hero-turn');
    nodes.decisionPanel.classList.add('is-hero-turn');
    presentationState.sync(nodes, state);
    assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), false);
    assert.equal(nodes.game.classList.contains('is-hero-turn'), false);
    assert.equal(nodes.decisionPanel.classList.contains('is-hero-turn'), false);
  }
});

test('explicit clear is idempotent and removes every related class', () => {
  const nodes = elements();
  nodes.shell.classList.add('is-live-hero-turn');
  nodes.game.classList.add('is-hero-turn');
  nodes.decisionPanel.classList.add('is-hero-turn');
  presentationState.clear(nodes);
  presentationState.clear(nodes);
  assert.equal(nodes.shell.classList.contains('is-live-hero-turn'), false);
  assert.equal(nodes.game.classList.contains('is-hero-turn'), false);
  assert.equal(nodes.decisionPanel.classList.contains('is-hero-turn'), false);
});

test('application wires state binding before the inline app and at critical transitions', () => {
  assert.ok(
    html.indexOf('src/live/live-presentation-state.js') < html.indexOf("<script>\n'use strict';"),
    'state binding must load before the inline application'
  );
  assert.match(html, /function syncLivePresentationState\(/);
  assert.match(html, /function renderLive\(\)\{[\s\S]*?syncLivePresentationState\(\)/);
  assert.match(html, /function presentHeroAction\([\s\S]*?session\.awaiting='hero-presentation';[\s\S]*?syncLivePresentationState\(\)/);
  assert.match(html, /function route\([\s\S]*?syncLivePresentationState\(name\)/);
});

test('Live V2 geometry consumes the same canonical state without Hero-only resizing', () => {
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.top-navigation\s*\{[^}]*height:\s*48px/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active #screen-live > \.back,[\s\S]*?display:\s*none/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-game-active \.sound-volume\s*\{[^}]*display:\s*none/);
  assert.match(liveCss, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[\s\S]*?height:\s*var\(--live-table-camera-height\)/);
  assert.match(liveCss, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-height:\s*48px/);
  assert.doesNotMatch(liveCss, /#liveGame\.is-hero-turn \.poker-table\s*\{[^}]*height:/);
});
