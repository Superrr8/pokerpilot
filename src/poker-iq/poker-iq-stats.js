'use strict';

(function attachPokerIqStats(root) {
  const STORAGE_KEY = 'pokerpilot_poker_iq_cache';
  const SCHEMA_VERSION = 1;
  const Engine = root.PokerIQ
    || (typeof require === 'function' ? require('./poker-iq-engine.js') : null);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function hash(value) {
    let output = 2166136261;
    for (const character of String(value)) {
      output ^= character.charCodeAt(0);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(36);
  }

  function sourceFingerprint(records) {
    const source = (Array.isArray(records) ? records : []).map(record => ({
      decisionId: record?.decisionId || null,
      score: record?.decisionQuality?.score ?? null,
      isRated: record?.decisionQuality?.isRated === true,
      confidence: record?.trainerSnapshot?.confidence || record?.decisionQuality?.confidence || null,
      isMarginal: Boolean(record?.trainerSnapshot?.isMarginal || record?.decisionQuality?.isMarginal),
      street: record?.street || null,
      mode: record?.decisionMode || record?.mode || null,
      timestamp: record?.date || record?.timestamp || record?.decisionQuality?.evaluatedAt || null,
      sessionId: record?.sessionId || null,
      modelVersion: record?.decisionQuality?.modelVersion || null
    })).sort((a, b) =>
      String(a.decisionId || '').localeCompare(String(b.decisionId || ''))
      || String(a.timestamp || '').localeCompare(String(b.timestamp || ''))
      || String(a.score).localeCompare(String(b.score))
    );
    return `poker-iq-${hash(JSON.stringify(source))}`;
  }

  function create({ storage, now = () => new Date().toISOString() } = {}) {
    let activeStorage = storage;
    if (activeStorage === undefined) {
      try {
        activeStorage = root.localStorage || null;
      } catch (_) {
        activeStorage = null;
      }
    }
    let status = { persisted: Boolean(activeStorage), error: null };
    let memoryCache = null;

    function read() {
      if (!activeStorage || typeof activeStorage.getItem !== 'function') return null;
      try {
        const raw = activeStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        status = { persisted: false, error: String(error?.message || error) };
        return null;
      }
    }

    function write(cache) {
      memoryCache = clone(cache);
      if (!activeStorage || typeof activeStorage.setItem !== 'function') {
        status = { persisted: false, error: null };
        return false;
      }
      try {
        activeStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
        status = { persisted: true, error: null };
        return true;
      } catch (error) {
        status = { persisted: false, error: String(error?.message || error) };
        return false;
      }
    }

    function valid(cache, fingerprint) {
      return cache
        && cache.schemaVersion === SCHEMA_VERSION
        && cache.modelVersion === Engine.MODEL_VERSION
        && cache.sourceFingerprint === fingerprint
        && cache.summary
        && typeof cache.summary === 'object';
    }

    return Object.freeze({
      getSummary(records) {
        const fingerprint = sourceFingerprint(records);
        const cached = valid(memoryCache, fingerprint) ? memoryCache : read();
        if (valid(cached, fingerprint)) {
          memoryCache = clone(cached);
          return clone(cached.summary);
        }
        const summary = Engine.getSummary(records);
        write({
          schemaVersion: SCHEMA_VERSION,
          modelVersion: Engine.MODEL_VERSION,
          sourceFingerprint: fingerprint,
          summary,
          updatedAt: now()
        });
        return clone(summary);
      },
      invalidate() {
        memoryCache = null;
      },
      getStatus() {
        return { ...status };
      }
    });
  }

  const singleton = create();
  const api = Object.freeze({
    STORAGE_KEY,
    SCHEMA_VERSION,
    sourceFingerprint,
    create,
    getSummary: singleton.getSummary,
    invalidate: singleton.invalidate,
    getStatus: singleton.getStatus
  });
  root.PokerIQStats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
