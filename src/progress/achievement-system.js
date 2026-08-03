'use strict';

(function attachAchievementSystem(root) {
  const Config = root.PokerPilotAchievementConfig
    || (typeof require === 'function' ? require('./achievement-config.js') : null);

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function finite(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function integer(value) {
    return Math.max(0, Math.floor(finite(value)));
  }

  function safeIso(value, fallback = '1970-01-01T00:00:00.000Z') {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
  }

  function createDefaultAchievementState() {
    return { unlocked: {}, history: [] };
  }

  function normalizeUnlock(value) {
    const raw = object(value);
    const unlockedAt = safeIso(raw.unlockedAt, null);
    if (!unlockedAt) return null;
    return {
      unlockedAt,
      sourceEventId: text(raw.sourceEventId) || null
    };
  }

  function normalizeAchievementState(value) {
    const raw = object(value);
    const rawUnlocked = object(raw.unlocked);
    const unlocked = {};
    for (const [id, record] of Object.entries(rawUnlocked)) {
      if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(id)) continue;
      const normalized = normalizeUnlock(record);
      if (normalized) unlocked[id] = normalized;
    }

    const seen = new Set();
    const history = (Array.isArray(raw.history) ? raw.history : []).map(item => {
      const record = object(item);
      const id = text(record.id);
      const unlockedAt = safeIso(record.unlockedAt, null);
      if (!id || !unlockedAt || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        unlockedAt,
        sourceEventId: text(record.sourceEventId) || null
      };
    }).filter(Boolean).slice(-200);

    for (const [id, record] of Object.entries(unlocked)) {
      if (seen.has(id)) continue;
      history.push({ id, ...record });
      seen.add(id);
    }
    return { unlocked, history: history.slice(-200) };
  }

  function rankIndex(value) {
    return Config.RANK_ORDER.indexOf(text(object(value).id || value));
  }

  function metricValue(metrics, metric) {
    const source = object(metrics);
    if (metric === 'rank') return object(source.rank);
    const value = Number(source[metric]);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function conditionSatisfied(condition, metrics) {
    const rule = object(condition);
    if (rule.comparator === 'gte') {
      return metricValue(metrics, rule.metric) >= finite(rule.target, Number.POSITIVE_INFINITY);
    }
    if (rule.comparator === 'rankAbove') {
      const current = rankIndex(metricValue(metrics, 'rank'));
      const target = Config.RANK_ORDER.indexOf(text(rule.target));
      return current >= 0 && target >= 0 && current > target;
    }
    return false;
  }

  function progressLabel(metric, current, target) {
    if (metric === 'trainingScenarios') return `${current} / ${target} тренировок`;
    if (metric === 'trainerDecisions') return `${current} / ${target} решений`;
    if (metric === 'exams') return `${current} / ${target} экзаменов`;
    if (metric === 'lifetimeXp') return `${current} / ${target} XP`;
    if (metric === 'level') return `Level ${current} / ${target}`;
    if (metric === 'streak') return `${current} / ${target} дней`;
    if (metric === 'pokerIq') return `${current} / ${target} Poker IQ`;
    return `${current} / ${target}`;
  }

  function progressFor(definition, metrics, unlocked) {
    if (unlocked) {
      const target = finite(definition.condition.target, 1);
      return { current: target, target, percent: 100, label: progressLabel(definition.condition.metric, target, target) };
    }
    if (definition.hidden || definition.condition.comparator !== 'gte') return null;
    const target = Math.max(1, integer(definition.condition.target));
    const current = Math.min(target, integer(metricValue(metrics, definition.condition.metric)));
    return {
      current,
      target,
      percent: Math.round(current / target * 100),
      label: progressLabel(definition.condition.metric, current, target)
    };
  }

  function evaluateAchievements({ state, metrics, eventId, timestamp } = {}) {
    const next = normalizeAchievementState(state);
    const unlockedAt = safeIso(timestamp);
    const sourceEventId = text(eventId) || null;
    const newlyUnlocked = [];

    for (const definition of Config.ACHIEVEMENTS) {
      if (next.unlocked[definition.id]) continue;
      if (!conditionSatisfied(definition.condition, metrics)) continue;
      const record = { unlockedAt, sourceEventId };
      next.unlocked[definition.id] = record;
      next.history.push({ id: definition.id, ...record });
      newlyUnlocked.push({ ...clone(definition), ...record });
    }

    return {
      state: normalizeAchievementState(next),
      newlyUnlocked
    };
  }

  function createAchievementSnapshot({ state, metrics } = {}) {
    const current = normalizeAchievementState(state);
    const items = Config.ACHIEVEMENTS.map(definition => {
      const record = current.unlocked[definition.id] || null;
      const unlocked = Boolean(record);
      return {
        ...clone(definition),
        unlocked,
        unlockedAt: record?.unlockedAt || null,
        sourceEventId: record?.sourceEventId || null,
        progress: progressFor(definition, metrics, unlocked)
      };
    });
    return {
      unlockedCount: items.filter(item => item.unlocked).length,
      totalCount: items.length,
      items,
      history: clone(current.history.filter(item => Config.BY_ID[item.id]))
    };
  }

  const api = Object.freeze({
    createDefaultAchievementState,
    normalizeAchievementState,
    conditionSatisfied,
    evaluateAchievements,
    createAchievementSnapshot
  });

  root.PokerPilotAchievementSystem = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
