'use strict';

(function attachFeedbackManager(root) {
  const EVENTS = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
  let singleton = null;

  function create({ sound = null, haptics = null } = {}) {
    function trigger(eventName) {
      if (!EVENTS.includes(eventName)) return { sound: false, haptic: false };
      let soundPlayed = false;
      let hapticPlayed = false;
      try {
        soundPlayed = sound?.play?.(eventName) === true;
      } catch (_) {}
      try {
        hapticPlayed = haptics?.trigger?.(eventName) === true;
      } catch (_) {}
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

  const api = { EVENTS, create, getInstance };
  root.FeedbackManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
