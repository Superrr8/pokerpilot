'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');

test('sound manager объявляет полный набор событий v2.0', () => {
  const manager = loadSoundManager();
  assert.deepEqual(JSON.parse(JSON.stringify(manager.EVENTS)), [
    'uiClick', 'navigation', 'cardDeal', 'chipBet', 'potCollect',
    'correct', 'incorrect', 'unlock', 'achievement'
  ]);
});

test('legacy sound events безопасно нормализуются в новые события', () => {
  const manager = loadSoundManager();
  assert.equal(manager.normalizeEvent('click'), 'uiClick');
  assert.equal(manager.normalizeEvent('moduleComplete'), 'achievement');
  assert.equal(manager.normalizeEvent('unknown'), null);
});

test('настройки звука и volume control подключены к прежнему progress storage', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /id="soundToggle"/);
  assert.match(html, /id="soundVolume"/);
  assert.match(html, /CourseProgress\.setSoundPreferences/);
  assert.doesNotMatch(html, /localStorage\.(?:setItem|getItem)\([^)]*sound/i);
});

test('volume normalizes to 0..1 and remains moderate by default', () => {
  const manager = loadSoundManager();
  assert.ok(manager.DEFAULT_SETTINGS.volume >= 0.2);
  assert.ok(manager.DEFAULT_SETTINGS.volume <= 0.5);
  assert.equal(manager.normalizeSettings({ enabled: true, volume: 2 }).volume, manager.DEFAULT_SETTINGS.volume);
});

test('sound manager does not create AudioContext before a user gesture', () => {
  let constructions = 0;
  class Context {
    constructor() { constructions += 1; }
  }
  const sound = loadSoundManager().create({ AudioContext: Context });
  sound.play('navigation');
  assert.equal(constructions, 0);
});

