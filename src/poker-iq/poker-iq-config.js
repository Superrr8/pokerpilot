'use strict';

(function attachPokerIqConfig(root) {
  const config = Object.freeze({
    schemaVersion: 1,
    modelVersion: 'poker-iq-v1.1',
    minScore: 1000,
    maxScore: 3000,
    priorScore: 1500,
    priorWeight: 60,
    sampleThresholds: Object.freeze({
      provisional: 1,
      forming: 10,
      established: 30
    }),
    recencyWeights: Object.freeze({
      recent20: 1.20,
      decisions21To50: 1.10,
      older: 1.00
    }),
    confidenceWeights: Object.freeze({
      high: 1.00,
      medium: 0.92,
      low: 0.80
    }),
    marginalWeight: 0.90,
    consistency: Object.freeze({
      deviationMultiplier: 2,
      modifierScale: 0.8,
      modifierMin: -50,
      modifierMax: 24,
      minimumSample: 5
    }),
    streetBalance: Object.freeze({
      modifierMin: -30,
      modifierMax: 30,
      minimumSample: 10
    }),
    confidenceModifier: Object.freeze({
      baseline: 90,
      min: -15,
      max: 10
    }),
    trend: Object.freeze({
      window: 20,
      minimumWindow: 5,
      dqThreshold: 3
    }),
    dqCurve: Object.freeze([
      Object.freeze([0, 1000]),
      Object.freeze([50, 1100]),
      Object.freeze([60, 1250]),
      Object.freeze([70, 1450]),
      Object.freeze([80, 1650]),
      Object.freeze([85, 1800]),
      Object.freeze([90, 2000]),
      Object.freeze([95, 2250]),
      Object.freeze([100, 2850])
    ]),
    ranks: Object.freeze([
      Object.freeze({ id: 'BEGINNER', label: 'Новичок', shortLabel: 'Beginner', minScore: 1000, maxScore: 1199 }),
      Object.freeze({ id: 'LEARNING', label: 'Ученик', shortLabel: 'Learning', minScore: 1200, maxScore: 1399 }),
      Object.freeze({ id: 'INTERMEDIATE', label: 'Средний уровень', shortLabel: 'Intermediate', minScore: 1400, maxScore: 1599 }),
      Object.freeze({ id: 'ADVANCED', label: 'Продвинутый', shortLabel: 'Advanced', minScore: 1600, maxScore: 1799 }),
      Object.freeze({ id: 'EXPERT', label: 'Эксперт', shortLabel: 'Expert', minScore: 1800, maxScore: 1999 }),
      Object.freeze({ id: 'MASTER', label: 'Мастер', shortLabel: 'Master', minScore: 2000, maxScore: 2199 }),
      Object.freeze({ id: 'GRANDMASTER', label: 'Гроссмейстер', shortLabel: 'Grandmaster', minScore: 2200, maxScore: 2399 }),
      Object.freeze({ id: 'ELITE', label: 'Элита', shortLabel: 'Elite', minScore: 2400, maxScore: 2599 }),
      Object.freeze({ id: 'LEGEND', label: 'Легенда', shortLabel: 'Legend', minScore: 2600, maxScore: 2799 }),
      Object.freeze({ id: 'POKERPILOT', label: 'PokerPilot', shortLabel: 'PokerPilot', minScore: 2800, maxScore: 3000 })
    ])
  });

  root.POKER_IQ_CONFIG = config;
  if (typeof module === 'object' && module.exports) module.exports = config;
})(typeof window !== 'undefined' ? window : globalThis);
