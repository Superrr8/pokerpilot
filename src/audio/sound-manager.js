'use strict';

(function attachSoundManager(root) {
  const EVENTS = [
    'uiClick',
    'navigation',
    'cardDeal',
    'chipBet',
    'potCollect',
    'correct',
    'incorrect',
    'unlock',
    'achievement'
  ];
  const LEGACY_EVENT_ALIASES = {
    click: 'uiClick',
    moduleComplete: 'achievement'
  };
  const TONES = {
    uiClick: { frequency: 330, duration: 0.045, type: 'sine' },
    navigation: { frequency: 390, duration: 0.055, type: 'sine' },
    cardDeal: { frequency: 210, duration: 0.07, type: 'triangle' },
    chipBet: { frequency: 260, duration: 0.06, type: 'square' },
    potCollect: { frequency: 460, duration: 0.1, type: 'triangle' },
    correct: { frequency: 660, duration: 0.12, type: 'sine' },
    incorrect: { frequency: 155, duration: 0.14, type: 'triangle' },
    unlock: { frequency: 740, duration: 0.16, type: 'sine' },
    achievement: { frequency: 880, duration: 0.22, type: 'sine' }
  };
  const DEFAULT_SETTINGS = { enabled: true, volume: 0.35 };

  function normalizeSettings(value) {
    const raw = value && typeof value === 'object' ? value : {};
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
      volume: typeof raw.volume === 'number'
        && Number.isFinite(raw.volume)
        && raw.volume >= 0
        && raw.volume <= 1
        ? raw.volume
        : DEFAULT_SETTINGS.volume
    };
  }

  function normalizeEvent(eventName) {
    const normalized = LEGACY_EVENT_ALIASES[eventName] || eventName;
    return EVENTS.includes(normalized) ? normalized : null;
  }

  function create(options = {}) {
    const Context = Object.prototype.hasOwnProperty.call(options, 'AudioContext')
      ? options.AudioContext
      : (root.AudioContext || root.webkitAudioContext || null);
    const onSettingsChange = typeof options.onSettingsChange === 'function'
      ? options.onSettingsChange
      : () => {};
    let settings = normalizeSettings(options.initialSettings);
    let context = null;
    let userActivated = false;

    function notify() {
      onSettingsChange({ ...settings });
    }

    async function handleUserGesture() {
      userActivated = true;
      if (!Context) return false;
      try {
        if (!context) context = new Context();
        if (typeof context.resume === 'function') await context.resume();
        return true;
      } catch (_) {
        context = null;
        return false;
      }
    }

    function play(eventName) {
      const normalizedEvent = normalizeEvent(eventName);
      if (!userActivated || !settings.enabled || !normalizedEvent || !context) {
        return false;
      }
      try {
        const tone = TONES[normalizedEvent];
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = Number(context.currentTime) || 0;
        oscillator.type = tone.type;
        oscillator.frequency.setValueAtTime(tone.frequency, start);
        gain.gain.setValueAtTime(Math.max(0.0001, settings.volume * 0.08), start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + tone.duration);
        return true;
      } catch (_) {
        return false;
      }
    }

    function setEnabled(enabled) {
      settings = { ...settings, enabled: Boolean(enabled) };
      notify();
      return settings.enabled;
    }

    function toggle() {
      return setEnabled(!settings.enabled);
    }

    function setVolume(volume) {
      const numeric = Number(volume);
      settings = {
        ...settings,
        volume: Number.isFinite(numeric)
          ? Math.max(0, Math.min(1, numeric))
          : settings.volume
      };
      notify();
      return settings.volume;
    }

    return {
      handleUserGesture,
      play,
      setEnabled,
      toggle,
      setVolume,
      getSettings: () => ({ ...settings }),
      hasUserGesture: () => userActivated
    };
  }

  const api = {
    EVENTS,
    LEGACY_EVENT_ALIASES,
    DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeEvent,
    create
  };
  root.SoundManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
