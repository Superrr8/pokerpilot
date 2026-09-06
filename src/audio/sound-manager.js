'use strict';

(function attachSoundManager(root) {
  const SOUNDS = ['tap', 'primary', 'success', 'error', 'complete', 'achievement'];
  const LIVE_SOUNDS = [
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
    navigation: null,
    cardDeal: 'live.card.deal',
    chipBet: 'live.action.bet',
    potCollect: 'complete',
    correct: 'success',
    incorrect: 'error',
    unlock: 'complete',
    moduleComplete: 'achievement',
    achievement: 'achievement'
  };

  // Stage 13.3.2.1 quiet-luxury palette. Each semantic event maps to one
  // pre-rendered, upper-mid-limited PCM micro-asset. SoundManager only decodes,
  // caches, mixes and schedules those assets; it does not synthesize them.
  const AUDIO_SOURCE = 'pre-rendered-pcm';
  const MASTER_GAIN = 0.08;
  const SOUND_DEFINITIONS = Object.freeze({
    tap: Object.freeze({ asset: 'soft-tap', cooldownMs: 90, level: 0.1 }),
    primary: Object.freeze({ asset: 'soft-press', cooldownMs: 110, level: 0.18 }),
    success: Object.freeze({ asset: 'soft-success', cooldownMs: 160, level: 0.3 }),
    error: Object.freeze({ asset: 'soft-error', cooldownMs: 180, level: 0.2 }),
    complete: Object.freeze({ asset: 'soft-complete', cooldownMs: 260, level: 0.3 }),
    achievement: Object.freeze({ asset: 'soft-achievement', cooldownMs: 420, level: 0.44 }),
    'live.card.deal': Object.freeze({ asset: 'card-contact', cooldownMs: 80, level: 0.08 }),
    'live.board.flop': Object.freeze({ asset: 'card-flop', cooldownMs: 120, level: 0.18 }),
    'live.board.turn': Object.freeze({ asset: 'card-contact', cooldownMs: 120, level: 0.15 }),
    'live.board.river': Object.freeze({ asset: 'card-contact', cooldownMs: 140, level: 0.16 }),
    'live.action.check': Object.freeze({ asset: 'soft-tap', cooldownMs: 140, level: 0.06 }),
    'live.action.fold': Object.freeze({ asset: 'card-release', cooldownMs: 150, level: 0.12 }),
    'live.action.call': Object.freeze({ asset: 'chip-call', cooldownMs: 150, level: 0.16 }),
    'live.action.bet': Object.freeze({ asset: 'chip-bet', cooldownMs: 180, level: 0.24 }),
    'live.action.raise': Object.freeze({ asset: 'chip-raise', cooldownMs: 220, level: 0.3 }),
    'live.action.allIn': Object.freeze({ asset: 'all-in', cooldownMs: 360, level: 0.38 }),
    'live.pot.collect': Object.freeze({ asset: 'pot-move', cooldownMs: 260, level: 0.1 }),
    'live.pot.award': Object.freeze({ asset: 'pot-award', cooldownMs: 460, level: 0.28 }),
    'live.showdown': Object.freeze({ asset: 'card-release', cooldownMs: 360, level: 0.1 }),
    'live.hand.complete': Object.freeze({ asset: 'soft-complete', cooldownMs: 520, level: 0.08 })
  });
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
    if (SOUNDS.includes(eventName) || LIVE_SOUNDS.includes(eventName)) return eventName;
    return Object.prototype.hasOwnProperty.call(LEGACY_EVENT_ALIASES, eventName)
      ? LEGACY_EVENT_ALIASES[eventName]
      : null;
  }

  function create(options = {}) {
    const Context = Object.prototype.hasOwnProperty.call(options, 'AudioContext')
      ? options.AudioContext
      : (root.AudioContext || root.webkitAudioContext || null);
    const assets = options.assets || root.MicroAudioAssets || null;
    const decodeBase64 = options.decodeBase64
      || (typeof root.atob === 'function' ? root.atob.bind(root) : null);
    const onSettingsChange = typeof options.onSettingsChange === 'function'
      ? options.onSettingsChange
      : () => {};
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    let settings = normalizeSettings(options.initialSettings);
    let context = null;
    let userActivated = false;
    const lastPlayedAt = new Map();
    const bufferCache = new Map();

    function notify() {
      onSettingsChange({ ...settings });
    }

    async function handleUserGesture() {
      userActivated = true;
      if (!Context) return false;
      try {
        if (!context || context.state === 'closed') {
          context = new Context();
          bufferCache.clear();
        }
        if (typeof context.resume === 'function' && context.state !== 'running') {
          await context.resume();
        }
        return !context.state || context.state === 'running';
      } catch (_) {
        context = null;
        bufferCache.clear();
        return false;
      }
    }

    function assetBuffer(assetName) {
      if (bufferCache.has(assetName)) return bufferCache.get(assetName);
      const asset = assets?.ASSETS?.[assetName];
      const sampleRate = Number(assets?.SAMPLE_RATE);
      if (!asset?.pcm || !Number.isFinite(sampleRate) || !decodeBase64) return null;
      const binary = decodeBase64(asset.pcm);
      const frameCount = Math.floor(binary.length / 2);
      if (!frameCount) return null;
      const buffer = context.createBuffer(1, frameCount, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) {
        let value = binary.charCodeAt(index * 2)
          | (binary.charCodeAt(index * 2 + 1) << 8);
        if (value & 0x8000) value -= 0x10000;
        channel[index] = value / 32768;
      }
      bufferCache.set(assetName, buffer);
      return buffer;
    }

    function scheduleAsset(definition, start) {
      const asset = assets?.ASSETS?.[definition.asset];
      const buffer = assetBuffer(definition.asset);
      if (!asset || !buffer) return false;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(
        Math.max(0.0001, settings.volume * MASTER_GAIN * definition.level),
        start
      );
      source.connect(gain);
      gain.connect(context.destination);
      source.start(start);
      source.stop(start + asset.durationMs / 1000 + 0.005);
      return true;
    }

    function play(eventName) {
      const sound = normalizeEvent(eventName);
      if (!userActivated || !settings.enabled || !sound || !context) return false;
      if (context.state && context.state !== 'running') return false;
      const definition = SOUND_DEFINITIONS[sound];
      if (!definition) return false;
      const timestamp = Number(now());
      const lastTimestamp = lastPlayedAt.get(sound);
      if (Number.isFinite(timestamp)
        && Number.isFinite(lastTimestamp)
        && timestamp - lastTimestamp < definition.cooldownMs) return false;
      try {
        const start = Number(context.currentTime) || 0;
        if (!scheduleAsset(definition, start)) return false;
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
      getContext: () => context,
      getCachedAssetCount: () => bufferCache.size
    };
  }

  function getInstance(options = {}) {
    if (!singleton) singleton = create(options);
    return singleton;
  }

  const api = {
    SOUNDS,
    LIVE_SOUNDS,
    EVENTS,
    LEGACY_EVENT_ALIASES,
    SOUND_DEFINITIONS,
    AUDIO_SOURCE,
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
