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

  // Stage 13.3.1.1 sound language: every event begins with the same short,
  // band-limited noise transient. Quiet body/accent layers add meaning without
  // turning repeated interaction feedback into pitched beeps or notifications.
  const MASTER_GAIN = 0.12;
  const SOUND_DEFINITIONS = {
    tap: {
      cooldownMs: 45,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.0025, duration: 0.032, level: 0.62, highpass: 520, lowpass: 3600, seed: 11 }
      ]
    },
    primary: {
      cooldownMs: 70,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.003, duration: 0.048, level: 0.62, highpass: 320, lowpass: 3000, seed: 23 },
        { kind: 'tone', frequency: 170, type: 'sine', offset: 0.004, attack: 0.004, duration: 0.05, level: 0.1, lowpass: 900 }
      ]
    },
    success: {
      cooldownMs: 120,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.0025, duration: 0.036, level: 0.58, highpass: 480, lowpass: 3800, seed: 37 },
        { kind: 'tone', frequency: 620, type: 'triangle', offset: 0.016, attack: 0.006, duration: 0.055, level: 0.08, lowpass: 1800 }
      ]
    },
    error: {
      cooldownMs: 150,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.0035, duration: 0.048, level: 0.58, highpass: 140, lowpass: 1600, seed: 41 },
        { kind: 'tone', frequency: 135, type: 'sine', offset: 0, attack: 0.004, duration: 0.052, level: 0.07, lowpass: 700 }
      ]
    },
    complete: {
      cooldownMs: 220,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.003, duration: 0.04, level: 0.6, highpass: 350, lowpass: 3000, seed: 53 },
        { kind: 'noise', offset: 0.035, attack: 0.003, duration: 0.028, level: 0.24, highpass: 500, lowpass: 3300, seed: 59 }
      ]
    },
    achievement: {
      cooldownMs: 350,
      layers: [
        { kind: 'noise', offset: 0, attack: 0.003, duration: 0.042, level: 0.58, highpass: 380, lowpass: 3200, seed: 67 },
        { kind: 'noise', offset: 0.045, attack: 0.006, duration: 0.05, level: 0.15, highpass: 1200, lowpass: 5000, seed: 71 },
        { kind: 'tone', frequency: 520, type: 'triangle', offset: 0.05, attack: 0.008, duration: 0.068, level: 0.08, lowpass: 1900 }
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

    function connectLayer(source, gain, layer, start) {
      if (typeof context.createBiquadFilter !== 'function') {
        source.connect(gain);
        return;
      }
      let tail = source;
      if (layer.highpass) {
        const highpass = context.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency?.setValueAtTime?.(layer.highpass, start);
        highpass.Q?.setValueAtTime?.(0.6, start);
        tail.connect(highpass);
        tail = highpass;
      }
      if (layer.lowpass) {
        const lowpass = context.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency?.setValueAtTime?.(layer.lowpass, start);
        lowpass.Q?.setValueAtTime?.(0.55, start);
        tail.connect(lowpass);
        tail = lowpass;
      }
      tail.connect(gain);
    }

    function createNoiseSource(layer) {
      const sampleRate = Number(context.sampleRate) || 44100;
      const frameCount = Math.max(1, Math.ceil((layer.duration + 0.005) * sampleRate));
      const buffer = context.createBuffer(1, frameCount, sampleRate);
      const samples = buffer.getChannelData(0);
      let state = layer.seed >>> 0;
      for (let index = 0; index < samples.length; index += 1) {
        state = (state * 1664525 + 1013904223) >>> 0;
        samples[index] = (state / 4294967296) * 2 - 1;
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      return source;
    }

    function createLayerSource(layer, start) {
      if (layer.kind === 'noise') return createNoiseSource(layer);
      const oscillator = context.createOscillator();
      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(layer.frequency, start);
      return oscillator;
    }

    function scheduleLayer(layer, baseTime) {
      const gain = context.createGain();
      const start = baseTime + layer.offset;
      const source = createLayerSource(layer, start);
      const peak = Math.max(0.0001, settings.volume * MASTER_GAIN * layer.level);
      gain.gain.setValueAtTime(0.0001, start);
      if (typeof gain.gain.linearRampToValueAtTime === 'function') {
        gain.gain.linearRampToValueAtTime(peak, start + layer.attack);
      } else {
        gain.gain.setValueAtTime(peak, start + layer.attack);
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, start + layer.duration);
      connectLayer(source, gain, layer, start);
      gain.connect(context.destination);
      source.start(start);
      source.stop(start + layer.duration + 0.005);
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
        definition.layers.forEach(layer => scheduleLayer(layer, start));
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
