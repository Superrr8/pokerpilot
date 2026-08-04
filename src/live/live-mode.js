'use strict';

(function attachLiveMode(root) {
  const CANONICAL_ID = 'live_cash_1_3';
  const FULL_LABEL = 'Live Cash $1/$3';
  const SHORT_LABEL = 'Live Cash';
  const CATEGORY_LABEL = 'Live Poker';
  const LEGACY_IDENTIFIERS = new Set([
    'sycuan', 'sycuanlive', 'sycuanmode',
    'сайкан', 'сайканlive', 'сайканmode'
  ]);

  function compactIdentifier(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  }

  function isLiveIdentifier(value) {
    const compact = compactIdentifier(value);
    return compact === compactIdentifier(CANONICAL_ID)
      || compact === compactIdentifier(FULL_LABEL)
      || compact === compactIdentifier(SHORT_LABEL)
      || compact === 'livesession'
      || LEGACY_IDENTIFIERS.has(compact);
  }

  function normalizeIdentifier(value) {
    if (typeof value !== 'string') return value;
    return isLiveIdentifier(value) ? CANONICAL_ID : value;
  }

  function getLabel(variant = 'full') {
    if (variant === 'short') return SHORT_LABEL;
    if (variant === 'category') return CATEGORY_LABEL;
    return FULL_LABEL;
  }

  function normalizeDisplayText(value, variant = 'full') {
    if (typeof value !== 'string') return value;
    const label = getLabel(variant);
    return value
      .replace(/sycuan(?:[\s_-]*live)?/gi, label)
      .replace(/сайкан(?:[\s_-]*live)?/gi, label);
  }

  function normalizeSavedHand(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    if (isLiveIdentifier(value.mode) || isLiveIdentifier(value.source)) {
      if (value.mode === CANONICAL_ID && value.source === FULL_LABEL) return value;
      return { ...value, mode: CANONICAL_ID, source: FULL_LABEL };
    }
    return value;
  }

  function normalizeSessionRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const changes = {};
    if (isLiveIdentifier(value.liveMode) && value.liveMode !== CANONICAL_ID) {
      changes.liveMode = CANONICAL_ID;
    }
    if (typeof value.title === 'string') {
      const title = normalizeDisplayText(value.title);
      if (title !== value.title) changes.title = title;
    }
    if (typeof value.source === 'string' && isLiveIdentifier(value.source)) {
      if (value.source !== CANONICAL_ID) changes.source = CANONICAL_ID;
    }
    return Object.keys(changes).length ? { ...value, ...changes } : value;
  }

  function normalizeProgressSource(value) {
    return typeof value === 'string' && isLiveIdentifier(value)
      ? CANONICAL_ID
      : value;
  }

  function normalizeProgressMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const normalized = { ...value };
    for (const key of ['mode', 'liveMode', 'tableMode', 'source']) {
      if (typeof normalized[key] === 'string' && isLiveIdentifier(normalized[key])) {
        normalized[key] = CANONICAL_ID;
      }
    }
    return normalized;
  }

  const api = Object.freeze({
    CANONICAL_ID,
    FULL_LABEL,
    SHORT_LABEL,
    CATEGORY_LABEL,
    isLiveIdentifier,
    normalizeIdentifier,
    getLabel,
    normalizeDisplayText,
    normalizeSavedHand,
    normalizeSessionRecord,
    normalizeProgressSource,
    normalizeProgressMetadata
  });

  root.PokerPilotLiveMode = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
