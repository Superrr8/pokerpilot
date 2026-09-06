'use strict';

(function attachHaptics(root) {
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
  const PATTERNS = {
    tap: 8,
    primary: 12,
    success: [10, 20, 14],
    error: 18,
    complete: [12, 22, 16],
    achievement: [10, 20, 14, 24, 18],
    'live.card.deal': 4,
    'live.board.flop': 6,
    'live.board.turn': 7,
    'live.board.river': 9,
    'live.action.check': 4,
    'live.action.fold': 6,
    'live.action.call': 8,
    'live.action.bet': 11,
    'live.action.raise': [11, 18, 8],
    'live.action.allIn': [14, 24, 20],
    'live.pot.collect': 7,
    'live.pot.award': [11, 20, 13],
    'live.showdown': 8,
    'live.hand.complete': 9
  };
  let singleton = null;

  function create(options = {}) {
    const navigatorRef = Object.prototype.hasOwnProperty.call(options, 'navigator')
      ? options.navigator
      : root.navigator;
    const vibrate = typeof navigatorRef?.vibrate === 'function'
      ? navigatorRef.vibrate.bind(navigatorRef)
      : null;
    let enabled = options.enabled !== false;

    function isSupported() {
      return Boolean(vibrate);
    }

    function trigger(eventName) {
      if (!enabled || !vibrate || (!EVENTS.includes(eventName) && !LIVE_EVENTS.includes(eventName))) return false;
      try {
        return vibrate(PATTERNS[eventName]) !== false;
      } catch (_) {
        return false;
      }
    }

    function setEnabled(value) {
      enabled = Boolean(value);
      return enabled;
    }

    return { isSupported, trigger, setEnabled, isEnabled: () => enabled };
  }

  function getInstance(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton;
  }

  const api = { EVENTS, LIVE_EVENTS, PATTERNS, create, getInstance };
  root.HapticManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
