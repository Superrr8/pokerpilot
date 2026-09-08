'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

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

function maxStep(samples) {
  return samples.slice(1).reduce(
    (largest, sample, index) => Math.max(largest, Math.abs(sample - samples[index])),
    0
  );
}

function similarity(left, right) {
  const length = Math.min(left.length, right.length);
  let product = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < length; index += 1) {
    product += left[index] * right[index];
    leftEnergy += left[index] * left[index];
    rightEnergy += right[index] * right[index];
  }
  return Math.abs(product / Math.sqrt(leftEnergy * rightEnergy));
}

test('iPhone viewport prevents zoom-out without disabling accessible zoom-in', () => {
  const html = read('index.html');
  const viewport = html.match(/<meta\s+name="viewport"\s+content="([^"]+)"/)?.[1] || '';
  const directives = Object.fromEntries(viewport.split(',').map(value => {
    const [name, setting = ''] = value.trim().split('=');
    return [name, setting];
  }));

  assert.equal(directives.width, 'device-width');
  assert.equal(directives['initial-scale'], '1');
  assert.equal(directives['minimum-scale'], '1');
  assert.equal(directives['viewport-fit'], 'cover');
  assert.equal(Object.hasOwn(directives, 'maximum-scale'), false);
  assert.equal(Object.hasOwn(directives, 'user-scalable'), false);
});

test('approved mobile geometry remains free of global scale or zoom overrides', () => {
  const html = read('index.html');
  const styles = [
    'src/styles/design-tokens.css',
    'src/styles/app-shell.css',
    'src/styles/home.css',
    'src/styles/live-session.css',
    'src/styles/layout-foundation.css'
  ].map(read).join('\n');

  assert.doesNotMatch(styles, /(^|[;{])\s*zoom\s*:/m);
  assert.doesNotMatch(styles, /(?:html|body|\.app(?:-shell)?)\s*\{[^}]*transform\s*:/s);
  assert.doesNotMatch(html, /(?:html|body|\.app(?:-shell)?)\s*\{[^}]*transform\s*:/s);
});

test('phone-forward assets use smooth attacks instead of full-scale sample jumps', () => {
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  for (const [name, asset] of Object.entries(bundle.ASSETS)) {
    const samples = samplesFor(asset);
    const peak = Math.max(...samples.map(Math.abs));
    assert.ok(maxStep(samples) / peak < 0.28, `${name} has a smooth non-harsh onset`);
    assert.ok(asset.rms >= 0.045, `${name} remains audible on a phone speaker`);
    assert.ok(asset.rms < 0.28, `${name} keeps restrained average energy`);
  }
});

test('global meanings have distinct assets and distinct physical characters', () => {
  const manager = loadSoundManager();
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  const semantics = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
  const names = semantics.map(semantic => manager.SOUND_DEFINITIONS[semantic].asset);
  const characters = names.map(name => bundle.ASSETS[name].character);

  assert.equal(new Set(names).size, semantics.length);
  assert.equal(new Set(characters).size, semantics.length);
  assert.notEqual(bundle.ASSETS[names[0]].material, bundle.ASSETS[names[1]].material);
  assert.notEqual(bundle.ASSETS[names[2]].character, bundle.ASSETS[names[3]].character);

  for (let left = 0; left < names.length; left += 1) {
    for (let right = left + 1; right < names.length; right += 1) {
      assert.ok(
        similarity(samplesFor(bundle.ASSETS[names[left]]), samplesFor(bundle.ASSETS[names[right]])) < 0.65,
        `${semantics[left]} and ${semantics[right]} have measurably distinct waveforms`
      );
    }
  }
});

test('Live routing uses five intentional cue characters without fallback reuse', () => {
  const manager = loadSoundManager();
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  const definitions = manager.SOUND_DEFINITIONS;
  const expected = {
    'live.card.deal': 'live-card',
    'live.board.flop': 'live-card',
    'live.board.turn': 'live-card',
    'live.board.river': 'live-card',
    'live.action.check': 'live-neutral',
    'live.action.call': 'live-neutral',
    'live.action.bet': 'live-commit',
    'live.action.raise': 'live-commit',
    'live.action.allIn': 'live-commit',
    'live.action.fold': 'live-fold',
    'live.pot.collect': 'live-neutral',
    'live.pot.award': 'live-result',
    'live.showdown': 'live-card',
    'live.hand.complete': 'live-result'
  };

  for (const [semantic, asset] of Object.entries(expected)) {
    assert.equal(definitions[semantic].asset, asset, `${semantic} keeps its intended route`);
    assert.ok(bundle.ASSETS[asset], `${semantic} resolves without a fallback`);
  }
  assert.equal(new Set(Object.values(expected)).size, 5);
  assert.equal(new Set(Object.values(expected).map(name => bundle.ASSETS[name].character)).size, 5);

  const liveAssets = [...new Set(Object.values(expected))];
  for (let left = 0; left < liveAssets.length; left += 1) {
    for (let right = left + 1; right < liveAssets.length; right += 1) {
      assert.ok(
        similarity(
          samplesFor(bundle.ASSETS[liveAssets[left]]),
          samplesFor(bundle.ASSETS[liveAssets[right]])
        ) < 0.65,
        `${liveAssets[left]} and ${liveAssets[right]} have measurably distinct waveforms`
      );
    }
  }
});

test('default phone mix stays clearly audible and restrained', () => {
  const manager = loadSoundManager();
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  for (const semantic of [...manager.SOUNDS, ...manager.LIVE_SOUNDS]) {
    const definition = manager.SOUND_DEFINITIONS[semantic];
    const asset = bundle.ASSETS[definition.asset];
    const outputRms = manager.DEFAULT_SETTINGS.volume
      * manager.MASTER_GAIN
      * definition.level
      * asset.rms;
    assert.ok(outputRms >= 0.016, `${semantic} remains audible at default volume`);
    assert.ok(outputRms < 0.035, `${semantic} remains restrained at default volume`);
  }
});

test('asset generation is deterministic, dry, and contains no legacy hard-contact kernel', () => {
  const source = read('tools/audio-audition.cjs');
  assert.doesNotMatch(source, /contactPulse/);
  assert.doesNotMatch(source, /Math\.random|randomGenerator|\bseed\b|createOscillator/);
  assert.doesNotMatch(source, /reverb|echo|delay|noise/i);
  assert.match(source, /SAMPLE_RATE = 48000/);
});
