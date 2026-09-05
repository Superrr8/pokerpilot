'use strict';

(function attachHaptics(root) {
  const EVENTS = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
  const PATTERNS = {
    tap: 8,
    primary: 12,
    success: [10, 20, 14],
    error: 18,
    complete: [12, 22, 16],
    achievement: [10, 20, 14, 24, 18]
  };
  let singleton = null;

  function create(options = {}) {
    const navigatorRef = Object.prototype.hasOwnProperty.call(options, 'navigator')
      ? options.navigator
      : root.navigator;
    const vibrate = typeof navigatorRef?.vibrate === 'function'
      ? navigatorRef.vibrate.bind(navigatorRef)
      : null;

    function isSupported() {
      return Boolean(vibrate);
    }

    function trigger(eventName) {
      if (!vibrate || !EVENTS.includes(eventName)) return false;
      try {
        return vibrate(PATTERNS[eventName]) !== false;
      } catch (_) {
        return false;
      }
    }

    return { isSupported, trigger };
  }

  function getInstance(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton;
  }

  const api = { EVENTS, PATTERNS, create, getInstance };
  root.HapticManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
