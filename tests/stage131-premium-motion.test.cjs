'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const hash = relative => crypto.createHash('sha256').update(read(relative)).digest('hex');

function loadMotion() {
  const file = path.join(root, 'src/ui/motion-system.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}

function createElement() {
  const classes = new Set();
  const listeners = new Map();
  return {
    dataset: {},
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) { listeners.get(type)?.({ type, target: this }); }
  };
}

function createHarness(reduced = false) {
  const elements = [];
  const timers = new Map();
  const cleared = [];
  let timerId = 0;
  const documentRef = {
    querySelectorAll(selector) {
      if (selector === '.is-motion-entering') {
        return elements.filter(element => element.classList.contains('is-motion-entering'));
      }
      return [];
    }
  };
  const create = () => {
    const element = createElement();
    elements.push(element);
    return element;
  };
  const system = loadMotion().createMotionSystem({
    documentRef,
    mediaQuery: () => ({ matches: reduced }),
    setTimeoutFn(callback) {
      timerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeoutFn(id) {
      cleared.push(id);
      timers.delete(id);
    }
  });
  return { create, system, timers, cleared };
}

test('Stage 13.1 defines a compact premium motion scale and easing contract', () => {
  const css = read('src/styles/design-tokens.css');
  for (const token of [
    '--motion-duration-tactile',
    '--motion-duration-standard',
    '--motion-duration-emphasized',
    '--motion-ease-premium'
  ]) assert.ok(css.includes(token), `Missing Stage 13.1 token ${token}`);
});

test('motion controller exposes semantic visual events without audio behavior', () => {
  const motion = loadMotion();
  assert.deepEqual(Object.keys(motion.EVENTS), [
    'NAVIGATION', 'PROGRESS', 'DAILY_STATE', 'CORRECT', 'INCORRECT',
    'CARD_DEAL', 'CHIP', 'FOLD', 'CALL', 'RAISE', 'REWARD'
  ]);
  const source = read('src/ui/motion-system.js');
  assert.doesNotMatch(source, /AudioContext|\.play\(|soundManager|SoundManager/);
});

test('rapid route changes cancel stale entry state and settle on the latest screen', () => {
  const { create, system, cleared } = createHarness();
  const first = create();
  const second = create();
  assert.equal(system.enterView(first), true);
  assert.equal(first.classList.contains('is-motion-entering'), true);
  assert.equal(system.enterView(second), true);
  assert.equal(first.classList.contains('is-motion-entering'), false);
  assert.equal(second.classList.contains('is-motion-entering'), true);
  assert.ok(cleared.length >= 1, 'stale route cleanup timer must be cancelled');
});

test('transient emphasis is replaceable and animation completion removes all residue', () => {
  const { create, system } = createHarness();
  const target = create();
  system.emphasize(target, system.events.REWARD);
  system.emphasize(target, system.events.CORRECT);
  assert.equal(target.classList.contains('is-motion-emphasis'), true);
  assert.equal(target.dataset.motionEvent, system.events.CORRECT);
  target.dispatch('animationend');
  assert.equal(target.classList.contains('is-motion-emphasis'), false);
  assert.equal('motionEvent' in target.dataset, false);
});

test('value motion runs only for a real change and never replays on an unchanged render', () => {
  const { create, system } = createHarness();
  const metric = create();
  assert.equal(system.trackValue(metric, '2078'), false, 'initial render must be stable');
  assert.equal(system.trackValue(metric, '2078'), false, 'same value must not replay');
  assert.equal(system.trackValue(metric, '2086'), true, 'changed value should receive emphasis');
  assert.equal(system.trackValue(metric, '2086'), false, 'rerender must not replay emphasis');
});

test('prefers-reduced-motion keeps canonical UI state and skips transient classes', () => {
  const { create, system } = createHarness(true);
  const screen = create();
  const metric = create();
  assert.equal(system.enterView(screen), false);
  assert.equal(system.trackValue(metric, 1), false);
  assert.equal(system.trackValue(metric, 2), false);
  assert.equal(screen.classList.contains('is-motion-entering'), false);
  assert.equal(metric.classList.contains('is-motion-emphasis'), false);
  assert.equal(system.prefersReducedMotion(), true);
});

test('Stage 13.1 CSS covers route, navigation, controls, Dashboard and Trainer surfaces', () => {
  const css = read('src/styles/motion.css');
  for (const selector of [
    '.screen.is-motion-entering',
    '.primary-navigation button.active .primary-nav-icon',
    '#dashboardContinue',
    '.home-quick-action',
    '.daily-challenge-card',
    '.actions button',
    '.trainer-explanation',
    '.is-motion-emphasis'
  ]) assert.ok(css.includes(selector), `Missing motion coverage for ${selector}`);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.is-motion-entering[\s\S]*animation:\s*none\s*!important/);
});

test('Stage 13.1 animations remain compositor-safe and contain no perpetual loops', () => {
  const css = read('src/styles/motion.css');
  const stage = css.split('/* Stage 13.1 — Premium Motion System. */')[1] || '';
  assert.ok(stage, 'Stage 13.1 CSS section is missing');
  assert.doesNotMatch(stage, /@keyframes[\s\S]*?\b(?:width|height|top|right|bottom|left|margin|padding)\s*:/);
  assert.doesNotMatch(stage, /animation[^;\n]*\binfinite\b/);
  assert.doesNotMatch(stage, /transition:\s*all\b/);
});

test('application integration is visual-only and never delays route state changes', () => {
  const html = read('index.html');
  assert.match(html, /<script src="src\/ui\/motion-system\.js"><\/script>/);
  assert.match(html, /const appMotion = PokerPilotMotion\.createMotionSystem/);
  assert.match(html, /appMotion\.enterView\(screen, PokerPilotMotion\.EVENTS\.NAVIGATION\)/);
  assert.match(html, /appMotion\.trackValue\(\$\('#homePokerIqValue'\)/);
  const routeSource = html.match(/function route\(name, options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(routeSource, /await|setTimeout|requestAnimationFrame/);
});

test('frozen Dashboard, Live geometry, Live motion and PokerCore sources are untouched', () => {
  const frozen = {
    'src/styles/live-session.css': 'b88e1caca08939a27645abc3540764011ea3bae1c59a0b5c168dba34d9429f2b',
    'src/live/live-seat-layouts.js': '70ad0f7e845d05ac208dfc15e4aa7ee3894d7a87f9da3f561296ac09704832b1',
    'src/live/live-motion.js': '167980e0e6b8b1cb6bc9a56148815547f467f26b1367cad542e5a54d856693c6',
    'src/poker-core.js': 'cb2f8c794a9246288c9c6b077ed9c73cbd53d21daeb26cabbb1b8d07da29c286',
    'src/styles/stage1101-redesign.css': '5a220eb2a1d53e393f9a5335af781ce2ee64746548c3733dfe235229e08f6ecc',
    'src/ui/dashboard.js': '08c19de9021344eaca06e4e11c70ef7db2d89bfe106bb3e658a3582fcfc10e80'
  };
  for (const [file, expected] of Object.entries(frozen)) {
    assert.equal(hash(file), expected, `${file} changed despite the frozen-surface contract`);
  }
});

test('motion controller contains no storage, evaluator, trainer or gameplay semantics', () => {
  const source = read('src/ui/motion-system.js');
  assert.doesNotMatch(source, /localStorage|PokerCore|equity|evaluate|recordDecision|preferred|correctAction|session\.|hero|villain/i);
});
