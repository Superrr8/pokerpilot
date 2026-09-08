'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSoundManager } = require('./sound-manager-loader.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const LIVE_SOUND_KEYS = [
  'live.card.deal',
  'live.board.flop',
  'live.board.turn',
  'live.board.river',
  'live.action.check',
  'live.action.fold',
  'live.action.call',
  'live.action.bet',
  'live.action.raise',
  'live.action.allIn',
  'live.pot.collect',
  'live.pot.award',
  'live.showdown',
  'live.hand.complete'
];

const LIVE_EVENTS = [
  'CARD_DEAL',
  'BOARD_REVEAL',
  'CHECK',
  'FOLD',
  'CALL',
  'BET',
  'RAISE',
  'ALL_IN',
  'POT_COLLECT',
  'POT_AWARD',
  'SHOWDOWN',
  'HAND_COMPLETE'
];

function fresh(relativePath) {
  const modulePath = path.join(root, relativePath);
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test('Live palette preserves the complete semantic family on local micro-assets', () => {
  const manager = loadSoundManager();
  const assets = fresh('src/audio/sonic-identity-assets.js');
  assert.deepEqual(JSON.parse(JSON.stringify(manager.LIVE_SOUNDS)), LIVE_SOUND_KEYS);
  assert.deepEqual(
    JSON.parse(JSON.stringify(manager.SOUNDS)),
    ['tap', 'primary', 'success', 'error', 'complete', 'achievement']
  );
  for (const key of manager.LIVE_SOUNDS) {
    const definition = manager.SOUND_DEFINITIONS[key];
    assert.ok(definition);
    assert.ok(assets.ASSETS[definition.asset]);
    assert.ok(definition.level > 0 && definition.level <= 1);
    assert.equal(Object.hasOwn(definition, 'layers'), false);
  }
});

test('FeedbackManager and HapticManager recognize the same Live semantics', () => {
  const Feedback = fresh('src/audio/feedback-manager.js');
  const Haptics = fresh('src/audio/haptic-manager.js');
  assert.deepEqual(JSON.parse(JSON.stringify(Feedback.LIVE_EVENTS)), LIVE_SOUND_KEYS);
  assert.deepEqual(JSON.parse(JSON.stringify(Haptics.LIVE_EVENTS)), LIVE_SOUND_KEYS);
  assert.deepEqual(Object.keys(Haptics.PATTERNS).filter(key => key.startsWith('live.')), LIVE_SOUND_KEYS);
});

test('haptics can be disabled and unsupported platforms remain a silent no-op', () => {
  const Haptics = fresh('src/audio/haptic-manager.js');
  const calls = [];
  const disabled = Haptics.create({
    navigator: { vibrate: pattern => calls.push(pattern) || true },
    enabled: false
  });
  assert.equal(disabled.trigger('live.action.allIn'), false);
  assert.equal(calls.length, 0);
  assert.equal(disabled.setEnabled(true), true);
  assert.equal(disabled.trigger('live.action.allIn'), true);
  assert.equal(calls.length, 1);
  assert.equal(Haptics.create({ navigator: {} }).trigger('live.pot.award'), false);
});

test('FeedbackManager can suppress one channel without muting the other', () => {
  const Feedback = fresh('src/audio/feedback-manager.js');
  const sound = [];
  const haptic = [];
  const feedback = Feedback.create({
    sound: { play: key => { sound.push(key); return true; } },
    haptics: { trigger: key => { haptic.push(key); return true; } }
  });
  assert.deepEqual(
    feedback.trigger('live.action.check', { haptic: false }),
    { sound: true, haptic: false }
  );
  assert.deepEqual(
    feedback.trigger('live.pot.award', { sound: false }),
    { sound: false, haptic: true }
  );
  assert.deepEqual(sound, ['live.action.check']);
  assert.deepEqual(haptic, ['live.pot.award']);
});

test('LiveFeedback maps twelve domain events and deduplicates each hand event', () => {
  const LiveFeedback = fresh('src/audio/live-feedback.js');
  assert.deepEqual(Object.keys(LiveFeedback.EVENTS), LIVE_EVENTS);
  const calls = [];
  const live = LiveFeedback.create({
    feedback: { trigger: (key, channels) => { calls.push({ key, channels }); return { sound: channels?.sound !== false, haptic: channels?.haptic !== false }; } }
  });

  live.startHand('hand-1');
  assert.equal(live.cardDeal(0).sound, true);
  assert.equal(live.cardDeal(0).duplicate, true);
  live.boardReveal('flop', 0);
  live.boardReveal('turn', 0);
  live.boardReveal('river', 0);
  live.action({ sequence: 1, playerId: 0, type: 'CHECK' });
  live.action({ sequence: 2, playerId: 2, type: 'CALL' });
  live.action({ sequence: 3, playerId: 2, type: 'ALL_IN' });
  live.potCollect('river');
  live.potAward(0);
  live.showdown(0);
  live.showdown(2);
  live.handComplete();

  assert.deepEqual(calls.map(call => call.key), [
    'live.card.deal',
    'live.board.flop',
    'live.board.turn',
    'live.board.river',
    'live.action.check',
    'live.action.call',
    'live.action.allIn',
    'live.pot.collect',
    'live.pot.award',
    'live.showdown',
    'live.hand.complete'
  ]);
  assert.equal(calls.find(call => call.key === 'live.action.call').channels.haptic, false);
  assert.equal(calls.find(call => call.key === 'live.action.check').channels.haptic, true);
  assert.equal(calls.find(call => call.key === 'live.action.allIn').channels.haptic, false);
});

test('Live integration is centralized on presentation callbacks without legacy duplicate sounds', () => {
  assert.match(html, /src\/audio\/live-feedback\.js\?v=13\.3\.2\.3/);
  assert.match(html, /LiveFeedback\.create\(\{\s*feedback:\s*appFeedback\s*\}\)/);
  assert.match(html, /appLiveFeedback\.startHand\(session\.handToken\)/);
  assert.match(html, /onCard:index=>appLiveFeedback\.cardDeal\(index\)/);
  assert.match(html, /appLiveFeedback\.boardReveal\(street,index\)/);
  assert.match(html, /appLiveFeedback\.action\(action\)/);
  assert.match(html, /appLiveFeedback\.potCollect\(/);
  assert.match(html, /appLiveFeedback\.potAward\(/);
  assert.match(html, /appLiveFeedback\.showdown\(/);
  assert.match(html, /appLiveFeedback\.handComplete\(\)/);
  assert.match(html, /id="confirmBet"[^>]+data-audio-owner="semantic"/);
  assert.match(html, /b\.dataset\.audioOwner='semantic'/);
  assert.doesNotMatch(html, /appSound\.play\('(cardDeal|chipBet|potCollect)'\)/);
});
