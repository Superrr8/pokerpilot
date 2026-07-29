'use strict';

(function attachDecisionQualityStats(root) {
  const HISTORY_RETENTION = 1200;
  const STREETS = ['preflop', 'flop', 'turn', 'river'];

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function average(records) {
    if (!records.length) return null;
    const value = records.reduce((sum, item) => sum + Number(item.decisionQuality.score), 0) / records.length;
    return Math.round(value * 10) / 10;
  }

  function sampleStatus(count) {
    if (count === 0) return 'NONE';
    if (count < 5) return 'PROVISIONAL';
    if (count < 20) return 'FORMING';
    return 'ESTABLISHED';
  }

  function ratedRecords(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => {
        const score = finite(record?.decisionQuality?.score);
        if (!record || record.decisionQuality?.isRated !== true || score === null || score < 0 || score > 100) return false;
        if (record.decisionId) {
          if (seen.has(record.decisionId)) return false;
          seen.add(record.decisionId);
        }
        return true;
      })
      .sort((a, b) => {
        const aTime = Date.parse(a.record.date || a.record.timestamp || '') || 0;
        const bTime = Date.parse(b.record.date || b.record.timestamp || '') || 0;
        return bTime - aTime || a.index - b.index;
      })
      .map(({ record }) => record);
  }

  function compact(records) {
    const score = average(records);
    return {
      count: records.length,
      average: score,
      grade: root.DecisionQualityEngine?.getGrade?.(score) || null,
      classification: root.DecisionQualityEngine?.classify?.(score) || (score === null ? 'UNRATED' : null)
    };
  }

  function grouped(records, keyGetter) {
    const groups = {};
    records.forEach(record => {
      const key = keyGetter(record);
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
    });
    return Object.fromEntries(Object.entries(groups).map(([key, items]) => [key, compact(items)]));
  }

  function getRecentDecisions(history, limit = 20) {
    return ratedRecords(history).slice(0, Math.max(0, Math.floor(Number(limit) || 0)));
  }

  function getTrend(history) {
    const records = ratedRecords(history);
    const recent = records.slice(0, 20);
    const previous = records.slice(20, 40);
    const recentAverage = average(recent);
    const previousAverage = average(previous);
    if (recentAverage === null || previousAverage === null) {
      return { direction: 'INSUFFICIENT_DATA', delta: null, recentAverage, previousAverage };
    }
    const delta = Math.round((recentAverage - previousAverage) * 10) / 10;
    return {
      direction: Math.abs(delta) < 2 ? 'STABLE' : delta > 0 ? 'UP' : 'DOWN',
      delta,
      recentAverage,
      previousAverage
    };
  }

  function getStreetBreakdown(history) {
    const records = ratedRecords(history);
    const known = Object.fromEntries(STREETS.map(street => [street, []]));
    records.forEach(record => {
      const street = STREETS.includes(String(record.street).toLowerCase())
        ? String(record.street).toLowerCase()
        : 'unknown';
      if (!known[street]) known[street] = [];
      known[street].push(record);
    });
    return Object.fromEntries(Object.entries(known)
      .filter(([, items]) => items.length)
      .map(([street, items]) => [street, compact(items)]));
  }

  function getSessionSummary(history, sessionId) {
    const allRecords = ratedRecords(history);
    const records = allRecords.filter(record => record.sessionId && record.sessionId === sessionId);
    const otherSessionIds = [...new Set(allRecords
      .filter(record => record.sessionId && record.sessionId !== sessionId)
      .map(record => record.sessionId))];
    const previousRecords = otherSessionIds.length
      ? allRecords.filter(record => record.sessionId === otherSessionIds[0])
      : [];
    const currentAverage = average(records);
    const previousAverage = average(previousRecords);
    const sessionDelta = currentAverage !== null && previousAverage !== null
      ? Math.round((currentAverage - previousAverage) * 10) / 10
      : null;
    return {
      ...compact(records),
      ratedCount: records.length,
      sampleStatus: sampleStatus(records.length),
      decisions: records,
      bestDecision: records.length ? records.reduce((best, item) =>
        item.decisionQuality.score > best.decisionQuality.score ? item : best) : null,
      worstDecision: records.length ? records.reduce((worst, item) =>
        item.decisionQuality.score < worst.decisionQuality.score ? item : worst) : null,
      byStreet: getStreetBreakdown(records),
      preflop: compact(records.filter(record => String(record.street).toLowerCase() === 'preflop')),
      postflop: compact(records.filter(record => ['flop', 'turn', 'river'].includes(String(record.street).toLowerCase()))),
      trend: {
        direction: sessionDelta === null ? 'INSUFFICIENT_DATA' : Math.abs(sessionDelta) < 2 ? 'STABLE' : sessionDelta > 0 ? 'UP' : 'DOWN',
        delta: sessionDelta,
        previousAverage
      }
    };
  }

  function bestSession(records) {
    const sessions = {};
    records.forEach(record => {
      if (!record.sessionId) return;
      if (!sessions[record.sessionId]) sessions[record.sessionId] = [];
      sessions[record.sessionId].push(record);
    });
    const candidates = Object.entries(sessions)
      .map(([sessionId, items]) => ({ sessionId, ...compact(items) }))
      .filter(item => item.count >= 2)
      .sort((a, b) => b.average - a.average || String(a.sessionId).localeCompare(String(b.sessionId)));
    return candidates[0] || null;
  }

  function getSummary(history) {
    const records = ratedRecords(history);
    const overall = compact(records);
    const recent = records.slice(0, 20);
    const previous = records.slice(20, 40);
    const trend = getTrend(records);
    const summary = {
      ratedCount: records.length,
      average: overall.average,
      grade: overall.grade,
      classification: overall.classification,
      sampleStatus: sampleStatus(records.length),
      current: compact(recent),
      lifetime: overall,
      recent20: compact(recent),
      previous20: compact(previous),
      trend,
      bestSession: bestSession(records),
      latest: records[0] || null,
      byStreet: getStreetBreakdown(records),
      byMode: grouped(records, record => String(record.decisionMode || record.mode || 'UNKNOWN').toUpperCase())
    };
    return {
      ...summary,
      currentAverage: summary.current.average,
      lifetimeAverage: summary.lifetime.average,
      ratedDecisions: summary.ratedCount,
      recent20Average: summary.recent20.average,
      previous20Average: summary.previous20.average,
      latestScore: summary.latest?.decisionQuality?.score ?? null
    };
  }

  function applyRetention(history) {
    return Array.isArray(history) ? history.slice(0, HISTORY_RETENTION) : [];
  }

  const api = Object.freeze({
    HISTORY_RETENTION,
    getSummary,
    getTrend,
    getStreetBreakdown,
    getRecent: getRecentDecisions,
    getRecentDecisions,
    getSessionSummary,
    applyRetention
  });
  root.DecisionQualityStats = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
