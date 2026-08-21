'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'src/live/live-presentation-state.js'), 'utf8');
const liveState = require(path.join(root, 'src/live/live-presentation-state.js'));

const liveDecision = Object.freeze({
  route: 'live',
  gameVisible: true,
  awaiting: 'hero-preflop',
  flowCanHeroAct: true,
  flowPhase: 'playing',
  heroFolded: false,
  street: 'preflop',
  toCall: 12
});

function derive(patch = {}) {
  return liveState.deriveHeroDecision({ ...liveDecision, ...patch });
}

function fakeElement() {
  const classes = new Set();
  return {
    dataset: {},
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    }
  };
}

test('one pure selector owns Hero action availability and compact presentation', () => {
  assert.equal(typeof liveState.deriveHeroDecision, 'function');
  assert.equal(typeof liveState.getHeroActionOptions, 'function');
  assert.match(source, /function deriveHeroDecision\(/);
  assert.match(source, /function getHeroActionOptions\(/);
});

test('opponent turn keeps Hero controls unavailable and compact false', () => {
  const result = derive({ awaiting: 'ai', flowCanHeroAct: true });
  assert.equal(result.heroCanAct, false);
  assert.equal(result.compact, false);
  assert.deepEqual(result.actionOptions, []);
});

test('transition immediately before Hero turn does not activate compact early', () => {
  const result = derive({ awaiting: 'hero-transition', flowCanHeroAct: true });
  assert.equal(result.heroCanAct, false);
  assert.equal(result.compact, false);
});

test('actual Hero preflop decision exposes canonical controls and compact state', () => {
  const result = derive();
  assert.equal(result.heroCanAct, true);
  assert.equal(result.compact, true);
  assert.deepEqual(result.actionOptions, ['fold', 'call', 'raise']);
});

test('actual Hero postflop decision uses the same canonical state', () => {
  const result = derive({ awaiting: 'hero-postflop', street: 'flop', toCall: 0 });
  assert.equal(result.heroCanAct, true);
  assert.equal(result.compact, true);
  assert.deepEqual(result.actionOptions, ['check', 'bet', 'allin']);
});

test('Hero action completion immediately disables controls and compact state', () => {
  const result = derive({ awaiting: 'hero-presentation' });
  assert.equal(result.heroCanAct, false);
  assert.equal(result.compact, false);
  assert.deepEqual(result.actionOptions, []);
});

test('folded or flow-inactive Hero can never activate compact state', () => {
  assert.equal(derive({ heroFolded: true }).compact, false);
  assert.equal(derive({ flowCanHeroAct: false }).compact, false);
  assert.equal(derive({ flowPhase: 'observing' }).compact, false);
});

test('completed hand can never expose Hero actions or compact state', () => {
  const result = derive({ flowPhase: 'completed', awaiting: null });
  assert.equal(result.heroCanAct, false);
  assert.equal(result.compact, false);
  assert.deepEqual(result.actionOptions, []);
});

test('canonical invariants hold across supported Live states', () => {
  const states = [
    derive(),
    derive({ awaiting: 'hero-postflop', street: 'river', toCall: 25 }),
    derive({ awaiting: 'ai' }),
    derive({ awaiting: 'paused', flowPhase: 'paused' }),
    derive({ route: 'training' }),
    derive({ gameVisible: false })
  ];
  states.forEach(result => {
    if (result.controlsAvailable) assert.equal(result.compact, true);
    if (result.compact) assert.equal(result.heroCanAct, true);
  });
});

test('runtime diagnostics expose canonical and actual presentation state', () => {
  const game = fakeElement();
  const nodes = { shell: fakeElement(), game, decisionPanel: fakeElement() };
  liveState.sync(nodes, derive(), {
    actionsVisible: true,
    currentActor: 'hero',
    heroSeat: '0',
    street: 'preflop'
  });
  assert.equal(game.dataset.liveHeroTurn, 'true');
  assert.equal(game.dataset.liveHeroCanAct, 'true');
  assert.equal(game.dataset.liveActionsVisible, 'true');
  assert.equal(game.dataset.liveCompact, 'true');
  assert.equal(game.dataset.liveCurrentActor, 'hero');
  assert.equal(game.dataset.liveHeroSeat, '0');
  assert.equal(game.dataset.liveStreet, 'preflop');
});

test('action controls, action guard and compact binding consume the same selector', () => {
  assert.match(html, /function getCanonicalLiveHeroDecision\(/);
  assert.match(html, /function showHeroActions\(\)[\s\S]*?getCanonicalLiveHeroDecision\(\)[\s\S]*?decision\.actionOptions\.forEach/);
  assert.match(html, /function handleHeroAction\([\s\S]*?getCanonicalLiveHeroDecision\(\)[\s\S]*?decision\.controlsAvailable/);
  assert.match(html, /function syncLivePresentationState\([\s\S]*?getCanonicalLiveHeroDecision/);
  assert.doesNotMatch(html, /function showHeroActions\(\)[\s\S]{0,600}?if\(!flowController\.canHeroAct\(\)\)return/);
});

test('Stage 12.5.1 remains presentation-only and does not touch poker calculations', () => {
  assert.doesNotMatch(source, /PokerCore|evaluator|equity|callEV|Monte Carlo|analyzerPreflop|analyzerPostflop/);
});
