'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

function fakeAudioContext() {
  const starts = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
    }
    resume() { return Promise.resolve(); }
    createOscillator() {
      return {
        type: '',
        frequency: { setValueAtTime() {} },
        connect() {},
        start: time => starts.push(time),
        stop() {}
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {}
        },
        connect() {}
      };
    }
  }
  return { FakeAudioContext, starts };
}

test('sound manager объявляет девять контролируемых событий v2.0', () => {
  const manager = loadSoundManager();
  assert.deepEqual(
    JSON.parse(JSON.stringify(manager.EVENTS)),
    [
      'uiClick', 'navigation', 'cardDeal', 'chipBet', 'potCollect',
      'correct', 'incorrect', 'unlock', 'achievement'
    ]
  );
});

test('звук не проигрывается до пользовательского действия', () => {
  const fake = fakeAudioContext();
  const manager = loadSoundManager();
  const sound = manager.create({
    AudioContext: fake.FakeAudioContext,
    initialSettings: { enabled: true, volume: 0.35 }
  });
  assert.equal(sound.play('uiClick'), false);
  assert.equal(fake.starts.length, 0);
});

test('после user gesture разрешён известный звук с умеренной громкостью', async () => {
  const fake = fakeAudioContext();
  const manager = loadSoundManager();
  const sound = manager.create({
    AudioContext: fake.FakeAudioContext,
    initialSettings: { enabled: true, volume: 0.35 }
  });
  await sound.handleUserGesture();
  assert.equal(sound.play('correct'), true);
  assert.equal(fake.starts.length, 1);
  assert.equal(sound.getSettings().volume, 0.35);
});

test('toggle и volume сохраняются через переданный callback', () => {
  const saved = [];
  const manager = loadSoundManager();
  const sound = manager.create({
    initialSettings: { enabled: true, volume: 0.35 },
    onSettingsChange: settings => saved.push(settings)
  });
  sound.setEnabled(false);
  sound.setVolume(0.5);
  assert.deepEqual(JSON.parse(JSON.stringify(saved)), [
    { enabled: false, volume: 0.35 },
    { enabled: false, volume: 0.5 }
  ]);
});

test('выключенный звук и неизвестное событие ничего не проигрывают', async () => {
  const fake = fakeAudioContext();
  const sound = loadSoundManager().create({
    AudioContext: fake.FakeAudioContext,
    initialSettings: { enabled: false, volume: 0.35 }
  });
  await sound.handleUserGesture();
  assert.equal(sound.play('uiClick'), false);
  assert.equal(sound.play('unknown'), false);
  assert.equal(fake.starts.length, 0);
});

test('отсутствие AudioContext или аудиофайла не ломает приложение', async () => {
  const sound = loadSoundManager().create({
    AudioContext: null,
    initialSettings: { enabled: true, volume: 0.35 }
  });
  await assert.doesNotReject(() => sound.handleUserGesture());
  assert.doesNotThrow(() => sound.play('cardDeal'));
  assert.equal(sound.play('cardDeal'), false);
});
