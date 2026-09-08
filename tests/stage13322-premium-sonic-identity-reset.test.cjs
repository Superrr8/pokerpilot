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
  const samples = [];
  for (let offset = 0; offset < bytes.length; offset += 2) {
    samples.push(bytes.readInt16LE(offset) / 32768);
  }
  return { bytes, samples };
}

function fakeAudioContext() {
  let buffers = 0;
  let starts = 0;
  class Context {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.state = 'running';
    }
    resume() { return Promise.resolve(); }
    createBuffer(_channels, length) {
      buffers += 1;
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start() { starts += 1; },
        stop() {}
      };
    }
    createGain() {
      return { gain: { setValueAtTime() {} }, connect() {} };
    }
  }
  return { Context, get buffers() { return buffers; }, get starts() { return starts; } };
}

test('sonic reset keeps every rejected noise asset out of the compact physical palette', () => {
  assert.equal(exists('src/audio/micro-audio-assets.js'), false);
  assert.equal(exists('src/audio/sonic-identity-assets.js'), true);
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  assert.equal(bundle.FORMAT, 'pcm-s16le-base64');
  assert.equal(bundle.SAMPLE_RATE, 48000);
  assert.equal(bundle.CHANNELS, 1);
  assert.deepEqual(Object.keys(bundle.ASSETS), ASSET_NAMES);

  let totalBytes = 0;
  for (const [name, asset] of Object.entries(bundle.ASSETS)) {
    const { bytes, samples } = samplesFor(asset);
    totalBytes += bytes.length;
    const peak = Math.max(...samples.map(Math.abs));
    const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const tail = samples.slice(Math.floor(samples.length * 0.85));
    const tailRms = Math.sqrt(tail.reduce((sum, value) => sum + value * value, 0) / tail.length);
    assert.equal(asset.channels, 1, `${name} remains mono`);
    assert.equal(typeof asset.material, 'string', `${name} declares its physical material`);
    assert.equal(typeof asset.character, 'string', `${name} declares its distinct character`);
    assert.ok(asset.durationMs >= 9 && asset.durationMs <= 40, `${name} remains short`);
    assert.equal(Math.round(bytes.length / 2 / bundle.SAMPLE_RATE * 1000), asset.durationMs);
    assert.ok(Math.abs(samples[0]) <= 1 / 32768 && Math.abs(samples.at(-1)) <= 1 / 32768);
    assert.ok(peak >= 0.78 && peak < 0.9, `${name} is audible without clipping`);
    assert.ok(Math.abs(mean) < 0.001, `${name} has no meaningful DC offset`);
    assert.ok(rms < 0.28, `${name} keeps restrained average energy`);
    assert.ok(tailRms < 0.003, `${name} has no hiss or ringing tail`);
    assert.equal(asset.peak, Number(peak.toFixed(4)));
    assert.equal(asset.rms, Number(rms.toFixed(4)));
  }
  assert.equal(totalBytes, bundle.TOTAL_PCM_BYTES);
  assert.ok(totalBytes <= 24 * 1024);
});

test('asset generation uses deterministic smooth packets, not random/static material', () => {
  const source = read('tools/audio-audition.cjs');
  assert.match(source, /smoothPacket/);
  assert.match(source, /sonic-identity-assets\.js/);
  assert.doesNotMatch(source, /randomGenerator|Math\.random|\bseed\b|smoothA|smoothB/);
  assert.doesNotMatch(source, /softLimitHz|card-contact|chip-call|pot-move/);
});

test('SoundManager restores practical iPhone loudness and audible navigation taps', () => {
  const manager = loadSoundManager();
  assert.equal(manager.AUDIO_SOURCE, 'pre-rendered-pcm');
  assert.ok(manager.MASTER_GAIN >= 0.3 && manager.MASTER_GAIN <= 0.4);
  assert.equal(manager.normalizeEvent('navigation'), 'tap');
  assert.equal(manager.normalizeEvent('uiClick'), 'tap');
  assert.equal(manager.SOUND_DEFINITIONS.tap.asset, 'tactile-tap');
  assert.equal(manager.SOUND_DEFINITIONS.primary.asset, 'tactile-primary');
  assert.ok(manager.SOUND_DEFINITIONS.tap.level >= 0.55);
  assert.ok(manager.SOUND_DEFINITIONS.primary.level > manager.SOUND_DEFINITIONS.tap.level);
  assert.ok(manager.SOUND_DEFINITIONS.primary.level / manager.SOUND_DEFINITIONS.tap.level <= 1.3);
});

test('all global and Live semantics resolve only to the new sonic identity assets', () => {
  const manager = loadSoundManager();
  const bundle = fresh('src/audio/sonic-identity-assets.js');
  const rejected = /soft-tap|soft-press|card-contact|card-flop|card-release|chip-call|chip-bet|chip-raise|pot-move|pot-award/;
  for (const key of [...manager.SOUNDS, ...manager.LIVE_SOUNDS]) {
    assert.ok(bundle.ASSETS[manager.SOUND_DEFINITIONS[key].asset], `${key} has a current asset`);
    assert.doesNotMatch(manager.SOUND_DEFINITIONS[key].asset, rejected);
  }
  assert.doesNotMatch(read('src/audio/sound-manager.js'), /createOscillator|createNoiseSource/);
});

test('first user activation warms the frequent asset cache without starting audio', async () => {
  const fake = fakeAudioContext();
  const sound = loadSoundManager().create({ AudioContext: fake.Context });
  assert.equal(sound.getCachedAssetCount(), 0);
  await sound.handleUserGesture();
  assert.equal(sound.getCachedAssetCount(), 11);
  assert.equal(fake.buffers, 11);
  assert.equal(fake.starts, 0);
  assert.equal(sound.play('tap'), true);
  assert.equal(sound.getCachedAssetCount(), 11);
  assert.equal(fake.starts, 1);
});

test('global interaction wiring distinguishes primary controls and restores route feedback', () => {
  const html = read('index.html');
  const assetTag = '<script src="src/audio/sonic-identity-assets.js?v=13.3.2.4"></script>';
  const managerTag = '<script src="src/audio/sound-manager.js?v=13.3.2.3"></script>';
  assert.ok(html.includes(assetTag));
  assert.ok(html.includes(managerTag));
  assert.ok(html.indexOf(assetTag) < html.indexOf(managerTag));
  assert.match(html, /src\/audio\/interaction-feedback\.js\?v=13\.3\.2\.3/);
  assert.match(html, /InteractionFeedback\.create/);
  assert.match(html, /appInteractionFeedback\.install\(\)/);
  assert.doesNotMatch(html, /appSound\.play\('navigation'\)/);
});

test('Live reset keeps only Hero commits, street transitions and result audio', () => {
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
  live.startHand('identity-reset');
  for (let index = 0; index < 18; index += 1) live.cardDeal(index);
  for (const street of ['flop', 'turn', 'river']) {
    for (let index = 0; index < (street === 'flop' ? 3 : 1); index += 1) live.boardReveal(street, index);
  }
  live.action({ sequence: 24, playerId: 2, type: 'CALL' });
  live.action({ sequence: 25, playerId: 3, type: 'ALL_IN' });
  live.action({ sequence: 26, playerId: 0, type: 'RAISE' });
  live.potCollect('river');
  live.showdown();
  live.potAward(0);
  live.handComplete();

  assert.equal(calls.filter(call => call.key === 'live.card.deal' && call.channels.sound !== false).length, 1);
  assert.equal(calls.filter(call => call.key.startsWith('live.board.') && call.channels.sound !== false).length, 3);
  assert.equal(calls.find(call => call.key === 'live.action.call').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.action.allIn').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.action.raise').channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.pot.collect').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.showdown').channels.sound, false);
  assert.equal(calls.find(call => call.key === 'live.pot.award').channels.sound, true);
  assert.equal(calls.find(call => call.key === 'live.hand.complete').channels.sound, false);
});

test('ten-hand fatigue contract caps the modeled Live session at seven sounds per hand', () => {
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
    live.boardReveal('flop', 0);
    live.boardReveal('flop', 1);
    live.boardReveal('flop', 2);
    live.boardReveal('turn', 0);
    live.boardReveal('river', 0);
    live.action({ sequence: 22, playerId: 2, type: 'CALL' });
    live.action({ sequence: 23, playerId: 0, type: 'CALL' });
    live.action({ sequence: 24, playerId: 0, type: 'CHECK' });
    live.potCollect('river');
    live.showdown();
    live.potAward(0);
    live.handComplete();
  }
  assert.equal(audible, 70);
});
