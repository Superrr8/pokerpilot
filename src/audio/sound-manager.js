'use strict';

(function attachSoundManager(root) {
  const SOUNDS = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
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
    click: 'tap',
    uiClick: 'tap',
    navigation: 'tap',
    cardDeal: 'tap',
    chipBet: 'primary',
    potCollect: 'complete',
    correct: 'success',
    incorrect: 'error',
    unlock: 'complete',
    moduleComplete: 'achievement',
    achievement: 'achievement'
  };

  // Stage 13.3.1 sound language: compact consonant intervals, soft 4–12 ms
  // attacks, short releases and a deliberately conservative master level.
  const MASTER_GAIN = 0.12;
  const SOUND_DEFINITIONS = {
    tap: {
      cooldownMs: 45,
      voices: [
        { frequency: 240, type: 'triangle', offset: 0, attack: 0.004, duration: 0.055, level: 0.42, filter: 1200 }
      ]
    },
    primary: {
      cooldownMs: 70,
      voices: [
        { frequency: 220, type: 'sine', offset: 0, attack: 0.006, duration: 0.085, level: 0.48, filter: 1300 },
        { frequency: 330, type: 'triangle', offset: 0.012, attack: 0.006, duration: 0.072, level: 0.2, filter: 1500 }
      ]
    },
    success: {
      cooldownMs: 120,
      voices: [
        { frequency: 392, type: 'sine', offset: 0, attack: 0.008, duration: 0.13, level: 0.42, filter: 1600 },
        { frequency: 523.25, type: 'sine', offset: 0.052, attack: 0.009, duration: 0.14, level: 0.34, filter: 1800 }
      ]
    },
    error: {
      cooldownMs: 150,
      voices: [
        { frequency: 174.61, type: 'triangle', offset: 0, attack: 0.01, duration: 0.14, level: 0.36, filter: 850 },
        { frequency: 146.83, type: 'sine', offset: 0.045, attack: 0.012, duration: 0.13, level: 0.24, filter: 720 }
      ]
    },
    complete: {
      cooldownMs: 220,
      voices: [
        { frequency: 329.63, type: 'sine', offset: 0, attack: 0.008, duration: 0.17, level: 0.32, filter: 1500 },
        { frequency: 493.88, type: 'sine', offset: 0.052, attack: 0.009, duration: 0.17, level: 0.3, filter: 1750 },
        { frequency: 659.25, type: 'triangle', offset: 0.104, attack: 0.01, duration: 0.16, level: 0.18, filter: 1900 }
      ]
    },
    achievement: {
      cooldownMs: 350,
      voices: [
        { frequency: 392, type: 'sine', offset: 0, attack: 0.01, duration: 0.24, level: 0.32, filter: 1600 },
        { frequency: 523.25, type: 'sine', offset: 0.065, attack: 0.011, duration: 0.25, level: 0.29, filter: 1800 },
        { frequency: 659.25, type: 'triangle', offset: 0.13, attack: 0.012, duration: 0.28, level: 0.18, filter: 2000 }
      ]
    }
  };
  const DEFAULT_SETTINGS = { enabled: true, volume: 0.35 };
  let singleton = null;

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
    if (SOUNDS.includes(eventName)) return eventName;
    return LEGACY_EVENT_ALIASES[eventName] || null;
  }

  function create(options = {}) {
    const Context = Object.prototype.hasOwnProperty.call(options, 'AudioContext')
      ? options.AudioContext
      : (root.AudioContext || root.webkitAudioContext || null);
    const onSettingsChange = typeof options.onSettingsChange === 'function'
      ? options.onSettingsChange
      : () => {};
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    let settings = normalizeSettings(options.initialSettings);
    let context = null;
    let userActivated = false;
    const lastPlayedAt = new Map();

    function notify() {
      onSettingsChange({ ...settings });
    }

    async function handleUserGesture() {
      userActivated = true;
      if (!Context) return false;
      try {
        if (!context || context.state === 'closed') context = new Context();
        if (typeof context.resume === 'function' && context.state !== 'running') {
          await context.resume();
        }
        return !context.state || context.state === 'running';
      } catch (_) {
        context = null;
        return false;
      }
    }

    function connectVoice(oscillator, gain, voice, start) {
      if (typeof context.createBiquadFilter !== 'function') {
        oscillator.connect(gain);
        return;
      }
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency?.setValueAtTime?.(voice.filter, start);
      filter.Q?.setValueAtTime?.(0.55, start);
      oscillator.connect(filter);
      filter.connect(gain);
    }

    function scheduleVoice(voice, baseTime) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = baseTime + voice.offset;
      const peak = Math.max(0.0001, settings.volume * MASTER_GAIN * voice.level);
      oscillator.type = voice.type;
      oscillator.frequency.setValueAtTime(voice.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      if (typeof gain.gain.linearRampToValueAtTime === 'function') {
        gain.gain.linearRampToValueAtTime(peak, start + voice.attack);
      } else {
        gain.gain.setValueAtTime(peak, start + voice.attack);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.duration);
      connectVoice(oscillator, gain, voice, start);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + voice.duration + 0.005);
    }

    function play(eventName) {
      const sound = normalizeEvent(eventName);
      if (!userActivated || !settings.enabled || !sound || !context) return false;
      if (context.state && context.state !== 'running') return false;
      const definition = SOUND_DEFINITIONS[sound];
      const timestamp = Number(now());
      const lastTimestamp = lastPlayedAt.get(sound);
      if (Number.isFinite(timestamp)
        && Number.isFinite(lastTimestamp)
        && timestamp - lastTimestamp < definition.cooldownMs) return false;
      try {
        const start = Number(context.currentTime) || 0;
        definition.voices.forEach(voice => scheduleVoice(voice, start));
        if (Number.isFinite(timestamp)) lastPlayedAt.set(sound, timestamp);
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
      hasUserGesture: () => userActivated,
      getContext: () => context
    };
  }

  function getInstance(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton;
  }

  const api = {
    SOUNDS,
    EVENTS,
    LEGACY_EVENT_ALIASES,
    SOUND_DEFINITIONS,
    MASTER_GAIN,
    DEFAULT_SETTINGS,
    normalizeSettings,
    normalizeEvent,
    create,
    getInstance
  };
  root.SoundManager = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
