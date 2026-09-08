'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const ASSET_NAMES = [
  'tactile-tap',
  'tactile-primary',
  'tactile-success',
  'tactile-error',
  'tactile-complete',
  'tactile-achievement',
  'live-card',
  'live-neutral',
  'live-commit',
  'live-fold',
  'live-result'
];

function fresh(relativePath) {
  const modulePath = path.join(root, relativePath);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function samplesFor(asset) {
  const bytes = Buffer.from(asset.pcm, 'base64');
  return Array.from({ length: bytes.length / 2 }, (_, index) => (
    bytes.readInt16LE(index * 2) / 32768
  ));
}

function energyTime(samples, sampleRate, ratio) {
  const energy = samples.map(sample => sample * sample);
  const total = energy.reduce((sum, value) => sum + value, 0);
  let accumulated = 0;
  for (let index = 0; index < energy.length; index += 1) {
    accumulated += energy[index];
    if (accumulated >= total * ratio) return index / sampleRate * 1000;
  }
  return samples.length / sampleRate * 1000;
}

function fakeControl({ tag = 'BUTTON', classes = [], attributes = {}, disabled = false } = {}) {
  const values = { ...attributes };
  const control = {
    tagName: tag,
    disabled,
    classList: { contains: name => classes.includes(name) },
    getAttribute: name => values[name] ?? null,
    hasAttribute: name => Object.hasOwn(values, name),
    matches: selector => selector === ':disabled' ? disabled : false,
  };
  control.closest = selector => selector.includes(tag.toLowerCase()) || selector.includes('[role="button"]')
    ? control
    : null;
  return control;
}

test('release-candidate assets are short, dry, phone-forward and one coherent family', () => {
  assert.equal(exists('src/audio/sonic-identity-assets.js'), true);
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  assert.equal(bundle.SAMPLE_RATE, 48000);
  assert.equal(bundle.CHANNELS, 1);
  assert.deepEqual(Object.keys(bundle.ASSETS), ASSET_NAMES);
  assert.ok(bundle.TOTAL_PCM_BYTES <= 24 * 1024);

  for (const [name, asset] of Object.entries(bundle.ASSETS)) {
    const samples = samplesFor(asset);
    const peak = Math.max(...samples.map(Math.abs));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const tail = samples.slice(Math.floor(samples.length * 0.8));
    const tailRms = Math.sqrt(tail.reduce((sum, value) => sum + value * value, 0) / tail.length);
    assert.equal(asset.material, 'tactile-contact');
    assert.ok(asset.durationMs >= 9 && asset.durationMs <= 40, `${name} stays micro-length`);
    assert.ok(peak >= 0.78 && peak < 0.9, `${name} has clear unclipped peak`);
    assert.ok(Math.abs(mean) < 0.001, `${name} has no meaningful DC`);
    assert.ok(tailRms < 0.001, `${name} has no audible residual tail`);
    assert.ok(energyTime(samples, bundle.SAMPLE_RATE, 0.99) < asset.durationMs * 0.72, `${name} ends dry`);
  }

  const tap = bundle.ASSETS['tactile-tap'];
  const tapSamples = samplesFor(tap);
  assert.ok(tap.durationMs <= 10);
  assert.ok(energyTime(tapSamples, bundle.SAMPLE_RATE, 0.99) <= 5.5);
});

test('asset generator creates fused asymmetric contacts without rejected synthesis', () => {
  const source = read('tools/audio-audition.cjs');
  assert.match(source, /contactPulse/);
  assert.match(source, /SAMPLE_RATE = 48000/);
  assert.doesNotMatch(source, /Math\.random|randomGenerator|\bseed\b|smoothA|smoothB|createOscillator/);
  assert.doesNotMatch(source, /Math\.sin|reverb|echo|delay|noise/i);
});

test('release mix is clearly audible at default volume with restrained headroom', () => {
  const manager = loadSoundManager();
  const assets = fresh('src/audio/sonic-identity-assets.js');
  assert.ok(manager.MASTER_GAIN >= 0.3 && manager.MASTER_GAIN <= 0.4);
  const outputPeak = semantic => {
    const definition = manager.SOUND_DEFINITIONS[semantic];
    const asset = assets.ASSETS[definition.asset];
    return manager.DEFAULT_SETTINGS.volume * manager.MASTER_GAIN * definition.level * asset.peak;
  };
  assert.ok(outputPeak('tap') >= 0.07 && outputPeak('tap') <= 0.11);
  assert.ok(outputPeak('primary') > outputPeak('tap'));
  assert.ok(outputPeak('primary') / outputPeak('tap') <= 1.28);
  for (const semantic of [...manager.SOUNDS, ...manager.LIVE_SOUNDS]) {
    assert.ok(outputPeak(semantic) < 0.14, `${semantic} retains default headroom`);
  }
});

test('delegated interaction owner covers dynamic real controls once and filters false interactions', async () => {
  assert.equal(exists('src/audio/interaction-feedback.js'), true);
  const InteractionFeedback = fresh('src/audio/interaction-feedback.js');
  const played = [];
  let gestures = 0;
  const sound = {
    handleUserGesture: async () => { gestures += 1; return true; },
    play: semantic => { played.push(semantic); return true; }
  };
  const listeners = [];
  const documentRef = {
    addEventListener: (type, listener, capture) => listeners.push({ type, listener, capture }),
    removeEventListener() {}
  };
  const controller = InteractionFeedback.create({ documentRef, sound });
  assert.equal(controller.install(), true);
  assert.equal(controller.install(), false);
  assert.equal(listeners.filter(listener => listener.type === 'click').length, 2);

  const tap = fakeControl();
  const primary = fakeControl({ classes: ['ui-button-primary'] });
  const select = fakeControl({ tag: 'SELECT' });
  const disabled = fakeControl({ disabled: true });
  const passive = { closest: () => null };
  const range = fakeControl({ tag: 'INPUT', attributes: { type: 'range' } });
  const semanticOwner = fakeControl({ attributes: { 'data-audio-owner': 'semantic' } });

  const installedEvent = { isTrusted: true, defaultPrevented: false, target: tap };
  listeners.find(listener => listener.capture === true).listener(installedEvent);
  await listeners.find(listener => listener.capture === false).listener(installedEvent);
  assert.deepEqual(played, ['tap'], 'capture and bubble phases produce exactly one sound');
  assert.equal(gestures, 1, 'one physical click shares one activation attempt');
  played.length = 0;
  gestures = 0;

  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: tap }), true);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: primary }), true);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: select }), true);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: disabled }), false);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: passive }), false);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: range }), false);
  assert.equal(await controller.handleClick({ isTrusted: false, defaultPrevented: false, target: tap }), false);
  assert.equal(await controller.handleClick({ isTrusted: true, defaultPrevented: false, target: semanticOwner }), false);
  assert.deepEqual(played, ['tap', 'primary', 'tap']);
  assert.equal(gestures, 4, 'semantic owners still unlock audio without adding a generic sound');
});

test('application installs one click-based owner and removes selective pointerdown playback', () => {
  const html = read('index.html');
  assert.match(html, /src\/audio\/interaction-feedback\.js\?v=13\.3\.2\.3/);
  assert.match(html, /InteractionFeedback\.create\(\{\s*documentRef:\s*document,\s*sound:\s*appSound\s*\}\)/);
  assert.match(html, /appInteractionFeedback\.install\(\)/);
  assert.doesNotMatch(html, /addEventListener\('pointerdown'[\s\S]*?appSound/);
  assert.doesNotMatch(html, /appSound\.play\(interactionSoundFor/);
  assert.doesNotMatch(html, /\$\$\('\[data-route\]'\)[\s\S]{0,180}appSound/);
});

test('Learning and Live semantic controls own one sound instead of stacking a global tap', () => {
  const html = read('index.html');
  const learning = read('src/ui/learning-mode.js');
  assert.match(html, /id="confirmBet"[^>]+data-audio-owner="semantic"/);
  assert.match(html, /b\.dataset\.audioOwner='semantic'/);
  assert.match(learning, /playInteractionSound/);
  assert.doesNotMatch(learning, /sound\.play\('uiClick'\)[\s\S]{0,220}sound\.play\('cardDeal'\)/);
  assert.doesNotMatch(learning, /sound\.handleUserGesture\(\);\s*if/);
});

test('Live release vocabulary distinguishes cards, neutral actions, commitments, fold and result', () => {
  const manager = loadSoundManager();
  const definitions = manager.SOUND_DEFINITIONS;
  assert.equal(definitions['live.card.deal'].asset, 'live-card');
  assert.equal(definitions['live.board.flop'].asset, 'live-card');
  assert.equal(definitions['live.action.check'].asset, 'live-neutral');
  assert.equal(definitions['live.action.call'].asset, 'live-neutral');
  assert.equal(definitions['live.action.bet'].asset, 'live-commit');
  assert.equal(definitions['live.action.raise'].asset, 'live-commit');
  assert.equal(definitions['live.action.allIn'].asset, 'live-commit');
  assert.equal(definitions['live.action.fold'].asset, 'live-fold');
  assert.equal(definitions['live.pot.award'].asset, 'live-result');
});

test('Live density adds one deal cue while keeping AI and passive state changes silent', () => {
  const LiveFeedback = fresh('src/audio/live-feedback.js');
  const calls = [];
  const live = LiveFeedback.create({
    feedback: {
      trigger: (key, channels) => {
        calls.push({ key, channels });
        return { sound: channels.sound !== false, haptic: channels.haptic !== false };
      }
    }
  });
  live.startHand('release-candidate');
  for (let index = 0; index < 18; index += 1) live.cardDeal(index);
  live.boardReveal('flop', 0);
  live.boardReveal('flop', 1);
  live.boardReveal('flop', 2);
  live.boardReveal('turn', 0);
  live.boardReveal('river', 0);
  live.action({ sequence: 1, playerId: 2, type: 'CALL' });
  live.action({ sequence: 2, playerId: 0, type: 'CHECK' });
  live.action({ sequence: 3, playerId: 0, type: 'RAISE' });
  live.potCollect('river');
  live.showdown();
  live.potAward(0);
  live.handComplete();

  assert.equal(calls.filter(call => call.key === 'live.card.deal' && call.channels.sound !== false).length, 1);
  assert.equal(calls.filter(call => call.key.startsWith('live.board.') && call.channels.sound !== false).length, 3);
  assert.equal(calls.find(call => call.key === 'live.action.call').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.action.check').channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.action.raise').channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.pot.collect').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.showdown').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.pot.award').channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.hand.complete').channels.sound, false);
});
