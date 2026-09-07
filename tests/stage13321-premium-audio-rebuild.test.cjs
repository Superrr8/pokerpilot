'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const ASSET_NAMES = [
  'tactile-tap',
  'tactile-primary',
  'tactile-success',
  'tactile-error',
  'tactile-complete',
  'tactile-achievement',
  'live-street',
  'live-commit',
  'live-result'
];

function fresh(relativePath) {
  const modulePath = path.join(root, relativePath);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('pre-rendered audio foundation carries the current compact sonic identity set', () => {
  const assets = fresh('src/audio/sonic-identity-assets.js');
  assert.equal(assets.FORMAT, 'pcm-s16le-base64');
  assert.equal(assets.SAMPLE_RATE, 24000);
  assert.equal(assets.CHANNELS, 1);
  assert.deepEqual(Object.keys(assets.ASSETS), ASSET_NAMES);

  let totalBytes = 0;
  for (const [name, asset] of Object.entries(assets.ASSETS)) {
    const bytes = Buffer.from(asset.pcm, 'base64');
    totalBytes += bytes.length;
    assert.ok(bytes.length > 0 && bytes.length % 2 === 0, `${name} has valid PCM16 data`);
    assert.ok(asset.durationMs >= 16 && asset.durationMs <= 86, `${name} stays micro-length`);
    assert.equal(asset.channels, 1);
    assert.equal(asset.material, 'tactile-contact');
    assert.equal(Math.round(bytes.length / 2 / assets.SAMPLE_RATE * 1000), asset.durationMs);
    const samples = [];
    for (let offset = 0; offset < bytes.length; offset += 2) {
      samples.push(bytes.readInt16LE(offset) / 32768);
    }
    const peak = Math.max(...samples.map(Math.abs));
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const roughness = samples.slice(1)
      .reduce((sum, value, index) => sum + Math.abs(value - samples[index]), 0)
      / (samples.length - 1);
    assert.ok(Math.abs(samples[0]) <= 1 / 32768 && Math.abs(samples.at(-1)) <= 1 / 32768);
    assert.ok(peak < 0.86 && rms < 0.24);
    assert.ok(roughness / rms < 0.8, `${name} avoids hard sample-to-sample edges`);
  }
  assert.equal(totalBytes, assets.TOTAL_PCM_BYTES);
  assert.ok(totalBytes <= 24 * 1024);
});

test('SoundManager uses cached pre-rendered buffers instead of runtime synthesis', () => {
  const manager = loadSoundManager();
  const assets = fresh('src/audio/sonic-identity-assets.js');
  const source = read('src/audio/sound-manager.js');
  const allSounds = [...manager.SOUNDS, ...manager.LIVE_SOUNDS];

  assert.equal(manager.AUDIO_SOURCE, 'pre-rendered-pcm');
  assert.ok(manager.MASTER_GAIN >= 0.18 && manager.MASTER_GAIN <= 0.28);
  for (const sound of allSounds) {
    const definition = manager.SOUND_DEFINITIONS[sound];
    assert.ok(definition);
    assert.ok(assets.ASSETS[definition.asset], `${sound} maps to a local asset`);
    assert.ok(definition.level > 0 && definition.level <= 1);
    assert.equal(Object.hasOwn(definition, 'layers'), false);
  }

  assert.doesNotMatch(source, /createOscillator|createNoiseSource|kind:\s*['"](?:noise|tone)['"]/);
  assert.match(source, /createBufferSource/);
  assert.match(source, /bufferCache/);
});

test('global palette restores audible navigation within the same restrained hierarchy', () => {
  const manager = loadSoundManager();
  const definitions = manager.SOUND_DEFINITIONS;
  assert.equal(manager.normalizeEvent('navigation'), 'tap');
  assert.ok(definitions.tap.level < definitions.primary.level);
  assert.ok(definitions.primary.level < definitions.success.level);
  assert.ok(definitions.success.level < definitions.achievement.level);
  assert.ok(definitions.tap.cooldownMs >= 45);
});

test('Live repetition policy suppresses low-value density without changing semantics', () => {
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

  live.startHand('fatigue-check');
  for (let index = 0; index < 18; index += 1) live.cardDeal(index);
  live.action({ sequence: 19, playerId: 2, type: 'CHECK' });
  live.action({ sequence: 20, playerId: 3, type: 'FOLD' });
  live.action({ sequence: 21, playerId: 0, type: 'CHECK' });
  live.action({ sequence: 22, playerId: 4, type: 'CALL' });
  live.action({ sequence: 23, playerId: 5, type: 'RAISE' });
  live.handComplete();

  const dealCalls = calls.filter(call => call.key === 'live.card.deal');
  assert.equal(dealCalls.length, 18);
  assert.equal(dealCalls.filter(call => call.channels.sound !== false).length, 0);
  assert.equal(calls.find(call => call.key === 'live.action.check').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.action.fold').channels.sound, false);
  assert.equal(calls.filter(call => call.key === 'live.action.check')[1].channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.action.call').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.action.raise').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.hand.complete').channels.sound, false);
});

test('ten-hand repetition simulation keeps the high-frequency event layer sparse', () => {
  const LiveFeedback = fresh('src/audio/live-feedback.js');
  let audible = 0;
  for (let hand = 0; hand < 10; hand += 1) {
    const live = LiveFeedback.create({
      feedback: {
        trigger: (_key, channels) => {
          if (channels.sound !== false) audible += 1;
          return { sound: channels.sound !== false, haptic: channels.haptic !== false };
        }
      }
    });
    live.startHand(`hand-${hand}`);
    for (let index = 0; index < 18; index += 1) live.cardDeal(index);
    live.action({ sequence: 19, playerId: 2, type: 'FOLD' });
    live.action({ sequence: 20, playerId: 3, type: 'CHECK' });
    live.action({ sequence: 21, playerId: 0, type: 'CALL' });
    live.action({ sequence: 22, playerId: 4, type: 'CHECK' });
    live.handComplete();
  }
  assert.equal(audible, 10);
});

test('Live loudness hierarchy keeps repetitive sounds below meaningful actions', () => {
  const definitions = loadSoundManager().SOUND_DEFINITIONS;
  assert.ok(definitions['live.board.flop'].level < definitions['live.action.check'].level);
  assert.ok(definitions['live.action.check'].level < definitions['live.action.call'].level);
  assert.ok(definitions['live.action.call'].level < definitions['live.action.bet'].level);
  assert.ok(definitions['live.action.bet'].level < definitions['live.action.raise'].level);
  assert.ok(definitions['live.action.raise'].level < definitions['live.action.allIn'].level);
  assert.ok(definitions['live.pot.collect'].level < definitions['live.pot.award'].level);
});

test('current sonic identity bundle loads before SoundManager and audition tooling stays development-only', () => {
  const html = read('index.html');
  const audition = read('tools/audio-audition.cjs');
  const assetsTag = '<script src="src/audio/sonic-identity-assets.js?v=13.3.2.2"></script>';
  const soundTag = '<script src="src/audio/sound-manager.js?v=13.3.2.2"></script>';
  assert.ok(html.includes(assetsTag));
  assert.ok(html.includes(soundTag));
  assert.ok(html.indexOf(assetsTag) < html.indexOf(soundTag));
  assert.doesNotMatch(html, /audio-audition/);
  assert.match(audition, /--list/);
  assert.match(audition, /afplay/);
  const listed = execFileSync(process.execPath, [path.join(root, 'tools/audio-audition.cjs'), '--list'], {
    encoding: 'utf8'
  }).trim().split('\n');
  for (const name of ['tap', 'primary', 'deal', 'check', 'fold', 'call', 'bet', 'raise', 'all-in', 'pot-award', 'success', 'achievement']) {
    assert.ok(listed.includes(name));
  }
});
