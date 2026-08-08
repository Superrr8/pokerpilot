'use strict';

(function attachDailyChallengeStorage(root) {
  const Catalog = root.PokerPilotDailyChallengeCatalog
    || (typeof require === 'function' ? require('./daily-challenge-catalog.js') : null);
  const DateUtils = root.PokerPilotDailyDate
    || (typeof require === 'function' ? require('./daily-date.js') : null);
  const STORAGE_KEY = 'pokerpilot_daily_challenge_v1';
  const SCHEMA_VERSION = 2;
  const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
  const PROGRESS_STATUSES = new Set(['pending', 'recorded', 'legacy_uncredited']);

  function emptyState() {
    return { schemaVersion: SCHEMA_VERSION, completions: {} };
  }

  function normalizeProgress(value) {
    if (value === null || value === undefined) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'pending' };
    const status = String(value.status || '').toLowerCase();
    if (!PROGRESS_STATUSES.has(status)) return { status: 'pending' };
    if (status === 'legacy_uncredited') return { status };
    const eventId = typeof value.eventId === 'string' ? value.eventId.trim().slice(0, 200) : '';
    const rewardVersion = Math.max(1, Math.floor(Number(value.rewardVersion) || 1));
    const xpAwarded = Number(value.xpAwarded);
    if (status === 'pending') {
      return {
        status,
        ...(eventId ? { eventId } : {}),
        ...(Number.isFinite(Number(value.rewardVersion)) ? { rewardVersion } : {})
      };
    }
    const recordedAt = Date.parse(value.recordedAt);
    if (!eventId || !Number.isFinite(xpAwarded) || xpAwarded < 0 || !Number.isFinite(recordedAt)) {
      return { status: 'pending' };
    }
    return {
      status,
      eventId,
      rewardVersion,
      xpAwarded: Math.floor(xpAwarded),
      recordedAt: new Date(recordedAt).toISOString()
    };
  }

  function normalizeCompletion(value, dateKey) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!DateUtils.validDateKey(dateKey) || !Catalog.getById(value.challengeId)) return null;
    const selectedAction = String(value.selectedAction || '').toUpperCase();
    const correctAction = String(value.correctAction || '').toUpperCase();
    if (!ACTIONS.has(selectedAction) || !ACTIONS.has(correctAction)) return null;
    const scheduleVersion = Math.max(1, Math.floor(Number(value.scheduleVersion) || 1));
    const timestamp = Date.parse(value.completedAt);
    if (!Number.isFinite(timestamp)) return null;
    return {
      challengeId: value.challengeId,
      scheduleVersion,
      selectedAction,
      correctAction,
      isCorrect: selectedAction === correctAction,
      completedAt: new Date(timestamp).toISOString(),
      progress: normalizeProgress(value.progress)
    };
  }

  function normalizeHistoryCompletion(value, dateKey) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (!DateUtils.validDateKey(dateKey)) return null;
    const challengeId = typeof value.challengeId === 'string' ? value.challengeId.trim().slice(0, 120) : '';
    const selectedAction = String(value.selectedAction || '').toUpperCase();
    const correctAction = String(value.correctAction || '').toUpperCase();
    const scheduleVersion = Math.floor(Number(value.scheduleVersion));
    const timestamp = Date.parse(value.completedAt);
    const isCorrect = value.isCorrect;
    if (!challengeId || !ACTIONS.has(selectedAction) || !ACTIONS.has(correctAction)) return null;
    if (!Number.isFinite(scheduleVersion) || scheduleVersion < 1 || !Number.isFinite(timestamp)) return null;
    if (typeof isCorrect !== 'boolean' || isCorrect !== (selectedAction === correctAction)) return null;
    return {
      dateKey,
      challengeId,
      scheduleVersion,
      selectedAction,
      correctAction,
      isCorrect,
      completedAt: new Date(timestamp).toISOString(),
      progress: normalizeProgress(value.progress)
    };
  }

  function normalizeState(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const completions = {};
    const source = raw.completions && typeof raw.completions === 'object' && !Array.isArray(raw.completions)
      ? raw.completions
      : {};
    Object.entries(source).forEach(([dateKey, completion]) => {
      const normalized = normalizeCompletion(completion, dateKey);
      if (normalized) completions[dateKey] = normalized;
    });
    return { schemaVersion: SCHEMA_VERSION, completions };
  }

  function create({ storage = root.localStorage } = {}) {
    function readRawState() {
      try {
        const value = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
      } catch (_) {
        return {};
      }
    }

    function load() {
      try {
        return normalizeState(JSON.parse(storage?.getItem(STORAGE_KEY) || 'null'));
      } catch (_) {
        return emptyState();
      }
    }

    function getCompletion(dateKey) {
      const completion = load().completions[dateKey];
      return completion ? { ...completion } : null;
    }

    function getHistoryCompletions() {
      const source = readRawState().completions;
      if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
      return Object.entries(source)
        .map(([dateKey, value]) => normalizeHistoryCompletion(value, dateKey))
        .filter(Boolean)
        .map(value => ({
          ...value,
          progress: value.progress ? { ...value.progress } : null
        }));
    }

    function saveCompletion(dateKey, completion) {
      const state = load();
      if (state.completions[dateKey]) {
        return { saved: false, duplicate: true, completion: { ...state.completions[dateKey] } };
      }
      const normalized = normalizeCompletion(completion, dateKey);
      if (!normalized) return { saved: false, duplicate: false, reason: 'INVALID_COMPLETION', completion: null };
      const next = {
        schemaVersion: SCHEMA_VERSION,
        completions: { ...state.completions, [dateKey]: normalized }
      };
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(next));
        return { saved: true, duplicate: false, completion: { ...normalized } };
      } catch (_) {
        return { saved: false, duplicate: false, reason: 'STORAGE_UNAVAILABLE', completion: null };
      }
    }

    function saveProgress(dateKey, progress) {
      const state = load();
      const current = state.completions[dateKey];
      if (!current) return { saved: false, reason: 'UNKNOWN_COMPLETION', completion: null };
      const normalized = normalizeProgress(progress);
      if (!normalized) return { saved: false, reason: 'INVALID_PROGRESS', completion: { ...current } };
      const completion = { ...current, progress: normalized };
      const next = {
        schemaVersion: SCHEMA_VERSION,
        completions: { ...state.completions, [dateKey]: completion }
      };
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(next));
        return { saved: true, completion: { ...completion, progress: { ...normalized } } };
      } catch (_) {
        return { saved: false, reason: 'STORAGE_UNAVAILABLE', completion: { ...current } };
      }
    }

    return Object.freeze({ load, getCompletion, getHistoryCompletions, saveCompletion, saveProgress });
  }

  const api = Object.freeze({
    STORAGE_KEY, SCHEMA_VERSION, emptyState, normalizeProgress, normalizeState,
    normalizeHistoryCompletion, create
  });
  root.PokerPilotDailyChallengeStorage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
