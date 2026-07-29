'use strict';

(function attachPokerIq(root) {
  const CONFIG = root.POKER_IQ_CONFIG
    || (typeof require === 'function' ? require('./poker-iq-config.js') : null);
  const STREETS = Object.freeze(['preflop', 'flop', 'turn', 'river']);
  const MODES = Object.freeze(['LIVE', 'TRAINING', 'EXAM', 'REVIEW']);

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  }

  function confidenceOf(record) {
    const value = String(
      record?.trainerSnapshot?.confidence
      || record?.trainerSnapshot?.trainerConfidence
      || record?.decisionQuality?.confidence
      || 'medium'
    ).toLowerCase();
    return ['high', 'medium', 'low'].includes(value) ? value : 'medium';
  }

  function marginalOf(record) {
    return Boolean(record?.trainerSnapshot?.isMarginal || record?.decisionQuality?.isMarginal);
  }

  function timestampOf(record) {
    const value = Date.parse(record?.date || record?.timestamp || record?.decisionQuality?.evaluatedAt || '');
    return Number.isFinite(value) ? value : 0;
  }

  function normalizeStreet(value) {
    const street = String(value || '').toLowerCase();
    return STREETS.includes(street) ? street : 'unknown';
  }

  function normalizeMode(record) {
    const mode = String(record?.decisionMode || record?.mode || 'UNKNOWN').toUpperCase();
    return MODES.includes(mode) ? mode : 'UNKNOWN';
  }

  function stableId(record) {
    return record?.decisionId ? String(record.decisionId) : null;
  }

  function normalizeRecords(value) {
    if (!Array.isArray(value)) return [];
    const candidates = value.map(record => {
      const score = finite(record?.decisionQuality?.score);
      if (
        !record
        || record.decisionQuality?.isRated !== true
        || score === null
        || score < 0
        || score > 100
      ) return null;
      return {
        id: stableId(record),
        score,
        classification: String(record.decisionQuality.classification || ''),
        confidence: confidenceOf(record),
        marginal: marginalOf(record),
        street: normalizeStreet(record.street),
        mode: normalizeMode(record),
        timestamp: timestampOf(record),
        sessionId: record.sessionId ? String(record.sessionId) : null,
        dqModelVersion: String(record.decisionQuality.modelVersion || '')
      };
    }).filter(Boolean);

    candidates.sort((a, b) =>
      String(a.id || '').localeCompare(String(b.id || ''))
      || a.timestamp - b.timestamp
      || a.score - b.score
      || a.street.localeCompare(b.street)
      || a.mode.localeCompare(b.mode)
    );
    const seen = new Set();
    const unique = candidates.filter(record => {
      if (!record.id) return true;
      if (seen.has(record.id)) return false;
      seen.add(record.id);
      return true;
    });
    return unique.sort((a, b) =>
      b.timestamp - a.timestamp
      || String(a.id || '').localeCompare(String(b.id || ''))
      || b.score - a.score
      || a.street.localeCompare(b.street)
    );
  }

  function getSampleStatus(count) {
    const safeCount = Math.max(0, Math.floor(finite(count) ?? 0));
    if (!safeCount) return 'NONE';
    if (safeCount < CONFIG.sampleThresholds.forming) return 'PROVISIONAL';
    if (safeCount < CONFIG.sampleThresholds.established) return 'FORMING';
    return 'ESTABLISHED';
  }

  function recencyWeight(index) {
    if (index < 20) return CONFIG.recencyWeights.recent20;
    if (index < 50) return CONFIG.recencyWeights.decisions21To50;
    return CONFIG.recencyWeights.older;
  }

  function analyticalWeight(record, index) {
    return recencyWeight(index)
      * CONFIG.confidenceWeights[record.confidence]
      * (record.marginal ? CONFIG.marginalWeight : 1);
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function robustScores(records) {
    if (records.length < CONFIG.sampleThresholds.established) {
      return records.map(record => record.score);
    }
    const center = median(records.map(record => record.score));
    return records.map(record => clamp(record.score, center - 40, center + 40));
  }

  function weightedDecisionQuality(records) {
    const scores = robustScores(records);
    let weighted = 0;
    let total = 0;
    records.forEach((record, index) => {
      const weight = analyticalWeight(record, index);
      weighted += scores[index] * weight;
      total += weight;
    });
    return total ? weighted / total : null;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  function mapDqToIq(value) {
    const dq = clamp(finite(value) ?? 0, 0, 100);
    const curve = CONFIG.dqCurve;
    for (let index = 1; index < curve.length; index += 1) {
      const [rightDq, rightIq] = curve[index];
      const [leftDq, leftIq] = curve[index - 1];
      if (dq <= rightDq) {
        const progress = (dq - leftDq) / (rightDq - leftDq || 1);
        return leftIq + (rightIq - leftIq) * progress;
      }
    }
    return curve.at(-1)[1];
  }

  function consistencyComponent(records) {
    const values = records.map(record => record.score);
    const center = median(values);
    const deviation = median(values.map(value => Math.abs(value - center))) || 0;
    const score = clamp(100 - deviation * CONFIG.consistency.deviationMultiplier, 0, 100);
    const modifier = records.length < CONFIG.consistency.minimumSample
      ? 0
      : clamp(
        (score - 70) * CONFIG.consistency.modifierScale,
        CONFIG.consistency.modifierMin,
        CONFIG.consistency.modifierMax
      );
    return { score: round(score), deviation: round(deviation), modifier: round(modifier) };
  }

  function confidenceComponent(records) {
    if (!records.length) return { score: null, modifier: 0 };
    const values = records.map(record => {
      const base = CONFIG.confidenceWeights[record.confidence] * 100;
      return clamp(base - (record.marginal ? 6 : 0), 0, 100);
    });
    const score = values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      score: round(score),
      modifier: round(clamp(
        score - CONFIG.confidenceModifier.baseline,
        CONFIG.confidenceModifier.min,
        CONFIG.confidenceModifier.max
      ))
    };
  }

  function streetComponent(records) {
    const means = STREETS.map(street => {
      const items = records.filter(record => record.street === street);
      return items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : null;
    }).filter(value => value !== null);
    if (!means.length) return { score: null, modifier: 0, availableStreets: 0 };
    const coverageScore = 60 + means.length * 10;
    const spreadPenalty = standardDeviation(means) * 2;
    const score = clamp(coverageScore - spreadPenalty, 0, 100);
    const modifier = records.length < CONFIG.streetBalance.minimumSample
      ? 0
      : clamp((score - 75) * 1.2, CONFIG.streetBalance.modifierMin, CONFIG.streetBalance.modifierMax);
    return {
      score: round(score),
      modifier: round(modifier),
      availableStreets: means.length
    };
  }

  function unranked() {
    return {
      id: 'UNRANKED',
      label: 'Без ранга',
      shortLabel: 'Unranked',
      minScore: null,
      maxScore: null,
      nextRank: null,
      iqToNext: null,
      progressPercent: 0
    };
  }

  function getRank(value) {
    const numeric = finite(value);
    if (numeric === null) return unranked();
    const score = clamp(Math.round(numeric), CONFIG.minScore, CONFIG.maxScore);
    const index = CONFIG.ranks.findIndex(rank => score >= rank.minScore && score <= rank.maxScore);
    if (index < 0) return unranked();
    const rank = CONFIG.ranks[index];
    const nextRank = CONFIG.ranks[index + 1] || null;
    const span = nextRank ? nextRank.minScore - rank.minScore : rank.maxScore - rank.minScore;
    const progressPercent = nextRank
      ? clamp(Math.round((score - rank.minScore) / span * 100), 0, 100)
      : 100;
    return {
      ...rank,
      nextRank: nextRank ? { ...nextRank } : null,
      iqToNext: nextRank ? Math.max(0, nextRank.minScore - score) : null,
      progressPercent
    };
  }

  function trendFromNormalized(records) {
    const windowSize = Math.min(CONFIG.trend.window, Math.floor(records.length / 2));
    if (windowSize < CONFIG.trend.minimumWindow) {
      return { direction: 'INSUFFICIENT_DATA', delta: null, deltaDQ: null };
    }
    const recent = records.slice(0, windowSize);
    const previous = records.slice(windowSize, windowSize * 2);
    const recentDq = weightedDecisionQuality(recent);
    const previousDq = weightedDecisionQuality(previous);
    const deltaDQ = round(recentDq - previousDq);
    const delta = Math.round(mapDqToIq(recentDq) - mapDqToIq(previousDq));
    return {
      direction: deltaDQ > CONFIG.trend.dqThreshold
        ? 'UP'
        : deltaDQ < -CONFIG.trend.dqThreshold ? 'DOWN' : 'STABLE',
      delta,
      deltaDQ,
      recentAverage: round(recentDq),
      previousAverage: round(previousDq)
    };
  }

  function evaluateNormalized(records, { includeBreakdown = true, includeModes = true } = {}) {
    const count = records.length;
    const sampleStatus = getSampleStatus(count);
    if (!count) {
      return {
        schemaVersion: CONFIG.schemaVersion,
        modelVersion: CONFIG.modelVersion,
        score: null,
        isRated: false,
        sampleStatus,
        rank: getRank(null),
        trend: { direction: 'INSUFFICIENT_DATA', delta: null, deltaDQ: null },
        components: {
          decisionQuality: null,
          consistency: null,
          experience: 0,
          streetBalance: null,
          confidenceReliability: null,
          consistencyModifier: 0,
          streetBalanceModifier: 0,
          confidenceModifier: 0
        },
        breakdown: {
          preflop: null,
          flop: null,
          turn: null,
          river: null,
          postflop: null
        },
        byMode: {},
        ratedDecisions: 0,
        calculatedAt: '1970-01-01T00:00:00.000Z'
      };
    }

    const dq = weightedDecisionQuality(records);
    const consistency = consistencyComponent(records);
    const confidence = confidenceComponent(records);
    const street = streetComponent(records);
    const experienceRatio = count / (count + CONFIG.priorWeight);
    const observedIq = mapDqToIq(dq) + consistency.modifier + street.modifier + confidence.modifier;
    const score = Math.round(clamp(
      (observedIq * count + CONFIG.priorScore * CONFIG.priorWeight) / (count + CONFIG.priorWeight),
      CONFIG.minScore,
      CONFIG.maxScore
    ));
    const result = {
      schemaVersion: CONFIG.schemaVersion,
      modelVersion: CONFIG.modelVersion,
      score,
      isRated: true,
      sampleStatus,
      rank: getRank(score),
      trend: trendFromNormalized(records),
      components: {
        decisionQuality: round(dq),
        consistency: consistency.score,
        experience: round(experienceRatio * 100),
        streetBalance: street.score,
        confidenceReliability: confidence.score,
        consistencyModifier: consistency.modifier,
        streetBalanceModifier: street.modifier,
        confidenceModifier: confidence.modifier
      },
      breakdown: {
        preflop: null,
        flop: null,
        turn: null,
        river: null,
        postflop: null
      },
      byMode: {},
      ratedDecisions: count,
      calculatedAt: records[0].timestamp
        ? new Date(records[0].timestamp).toISOString()
        : '1970-01-01T00:00:00.000Z'
    };

    if (includeBreakdown) {
      for (const name of STREETS) {
        const items = records.filter(record => record.street === name);
        result.breakdown[name] = items.length
          ? evaluateNormalized(items, { includeBreakdown: false, includeModes: false }).score
          : null;
      }
      const postflop = records.filter(record => ['flop', 'turn', 'river'].includes(record.street));
      result.breakdown.postflop = postflop.length
        ? evaluateNormalized(postflop, { includeBreakdown: false, includeModes: false }).score
        : null;
    }
    if (includeModes) {
      for (const mode of [...MODES, 'UNKNOWN']) {
        const items = records.filter(record => record.mode === mode);
        if (items.length) {
          const summary = evaluateNormalized(items, { includeBreakdown: false, includeModes: false });
          result.byMode[mode] = {
            score: summary.score,
            ratedDecisions: summary.ratedDecisions,
            sampleStatus: summary.sampleStatus
          };
        }
      }
    }
    return result;
  }

  function evaluate(value) {
    return evaluateNormalized(normalizeRecords(value));
  }

  function getTrend(value) {
    return trendFromNormalized(normalizeRecords(value));
  }

  function getBreakdown(value) {
    return evaluate(value).breakdown;
  }

  function getSummary(value) {
    return evaluate(value);
  }

  const api = Object.freeze({
    SCHEMA_VERSION: CONFIG.schemaVersion,
    MODEL_VERSION: CONFIG.modelVersion,
    CONFIG,
    evaluate,
    getRank,
    getTrend,
    getBreakdown,
    getSampleStatus,
    getSummary
  });
  root.PokerIQ = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
