'use strict';

(function attachFeedbackManager(root) {
  const EVENTS = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
  const LIVE_EVENTS = [
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
  let singleton = null;

  function create({ sound = null, haptics = null } = {}) {
    function trigger(eventName, channels = {}) {
      if (!EVENTS.includes(eventName) && !LIVE_EVENTS.includes(eventName)) {
        return { sound: false, haptic: false };
      }
      let soundPlayed = false;
      let hapticPlayed = false;
      if (channels.sound !== false) {
        try {
          soundPlayed = sound?.play?.(eventName) === true;
        } catch (_) {}
      }
      if (channels.haptic !== false) {
        try {
          hapticPlayed = haptics?.trigger?.(eventName) === true;
        } catch (_) {}
      }
      return { sound: soundPlayed, haptic: hapticPlayed };
    }

    const api = { trigger };
    EVENTS.forEach(eventName => {
      api[eventName] = () => trigger(eventName);
    });
    return api;
  }

  function getInstance(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton;
  }

  const api = { EVENTS, LIVE_EVENTS, create, getInstance };
  root.FeedbackManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
