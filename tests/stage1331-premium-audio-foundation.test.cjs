'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const courseProgress = fs.readFileSync(path.join(root, 'src/learning/course-progress.js'), 'utf8');

function fresh(relativePath) {
  const modulePath = path.join(root, relativePath);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function fakeAudioContext({ state = 'running' } = {}) {
  const starts = [];
  let resumes = 0;
  class Context {
    constructor() {
      this.currentTime = 1;
      this.destination = {};
      this.state = state;
      this.sampleRate = 44100;
    }
    resume() {
      resumes += 1;
      this.state = 'running';
      return Promise.resolve();
    }
    createOscillator() {
      return {
        type: '',
        frequency: { setValueAtTime() {} },
        connect() {},
        start: time => starts.push(time),
        stop() {}
      };
    }
    createBuffer(_channels, length) {
      const samples = new Float32Array(length);
      return { getChannelData: () => samples };
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start: time => starts.push(time),
        stop() {}
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        connect() {}
      };
    }
    createBiquadFilter() {
      return {
        type: '',
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {}
      };
    }
  }
  return { Context, starts, get resumes() { return resumes; } };
}

test('premium audio language preserves exactly six reusable semantic sounds', () => {
  const manager = loadSoundManager();
  assert.deepEqual(
    JSON.parse(JSON.stringify(manager.SOUNDS)),
    ['tap', 'primary', 'success', 'error', 'complete', 'achievement']
  );
  assert.equal(manager.AUDIO_SOURCE, 'pre-rendered-pcm');
  assert.ok(manager.MASTER_GAIN >= 0.3 && manager.MASTER_GAIN <= 0.4);
  for (const sound of manager.SOUNDS) {
    const definition = manager.SOUND_DEFINITIONS[sound];
    assert.ok(definition.cooldownMs >= 28);
    assert.equal(typeof definition.asset, 'string');
    assert.ok(definition.level > 0 && definition.level <= 1);
    assert.equal(Object.hasOwn(definition, 'layers'), false);
  }
  assert.ok(manager.SOUND_DEFINITIONS.tap.level < manager.SOUND_DEFINITIONS.primary.level);
  assert.ok(manager.SOUND_DEFINITIONS.primary.level < manager.SOUND_DEFINITIONS.achievement.level);
});

test('canonical SoundManager instance is lazy and resumes safely after a gesture', async () => {
  const fake = fakeAudioContext({ state: 'suspended' });
  const manager = loadSoundManager();
  const first = manager.getInstance({ AudioContext: fake.Context });
  const second = manager.getInstance({ AudioContext: null });
  assert.equal(first, second);
  assert.equal(first.play('tap'), false);
  assert.equal(fake.starts.length, 0);
  assert.equal(await first.handleUserGesture(), true);
  assert.equal(fake.resumes, 1);
  assert.equal(first.play('tap'), true);
});

test('rapid duplicate sounds are suppressed without blocking later semantic playback', async () => {
  const fake = fakeAudioContext();
  let now = 1_000;
  const sound = loadSoundManager().create({ AudioContext: fake.Context, now: () => now });
  await sound.handleUserGesture();
  assert.equal(sound.play('tap'), true);
  assert.equal(sound.play('tap'), false);
  assert.equal(sound.play('success'), true);
  now += 100;
  assert.equal(sound.play('tap'), true);
});

test('suspended playback and unknown keys fail silently until a valid resume', async () => {
  const fake = fakeAudioContext();
  const sound = loadSoundManager().create({ AudioContext: fake.Context });
  await sound.handleUserGesture();
  sound.getContext().state = 'suspended';
  assert.doesNotThrow(() => sound.play('unknown'));
  assert.equal(sound.play('unknown'), false);
  assert.equal(sound.play('primary'), false);
  await sound.handleUserGesture();
  assert.equal(sound.play('primary'), true);
});

test('haptics detect capability and silently no-op when vibration is unavailable', () => {
  const Haptics = fresh('src/audio/haptic-manager.js');
  const unsupported = Haptics.create({ navigator: {} });
  assert.equal(unsupported.isSupported(), false);
  assert.equal(unsupported.trigger('success'), false);

  const patterns = [];
  const supported = Haptics.create({ navigator: { vibrate: pattern => patterns.push(pattern) || true } });
  assert.equal(supported.isSupported(), true);
  assert.equal(supported.trigger('achievement'), true);
  assert.equal(patterns.length, 1);
  assert.equal(supported.trigger('unknown'), false);
});

test('semantic feedback coordinates matching sound and haptic categories', () => {
  const Feedback = fresh('src/audio/feedback-manager.js');
  const sounds = [];
  const haptics = [];
  const feedback = Feedback.create({
    sound: { play: key => { sounds.push(key); return true; } },
    haptics: { trigger: key => { haptics.push(key); return true; } }
  });
  for (const key of ['tap', 'primary', 'success', 'error', 'complete', 'achievement']) {
    assert.deepEqual(feedback[key](), { sound: true, haptic: true });
  }
  assert.deepEqual(sounds, Feedback.EVENTS);
  assert.deepEqual(haptics, Feedback.EVENTS);
  assert.deepEqual(feedback.trigger('unknown'), { sound: false, haptic: false });
});

test('foundation is loaded centrally and reuses the existing sound preference', () => {
  assert.match(html, /src\/audio\/sonic-identity-assets\.js\?v=13\.3\.2\.3/);
  assert.match(html, /src\/audio\/sound-manager\.js\?v=13\.3\.2\.3/);
  assert.match(html, /src\/audio\/haptic-manager\.js\?v=13\.3\.2/);
  assert.match(html, /src\/audio\/feedback-manager\.js\?v=13\.3\.2/);
  assert.match(html, /SoundManager\.getInstance/);
  assert.match(html, /HapticManager\.getInstance/);
  assert.match(html, /FeedbackManager\.getInstance/);
  assert.doesNotMatch(html, /PokerPilot(?:Haptics|Feedback)/);
  assert.match(html, /CourseProgress\.setSoundPreferences/);
  assert.match(courseProgress, /DEFAULT_SOUND\s*=\s*\{\s*enabled:\s*true,\s*volume:\s*0\.35\s*\}/);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^)]*(?:sound|audio|haptic)/i);
});
