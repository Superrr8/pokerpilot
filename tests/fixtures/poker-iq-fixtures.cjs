'use strict';

const STREETS = ['preflop', 'flop', 'turn', 'river'];

function makeRecords(count, {
  score = 80,
  scores = null,
  street = 'flop',
  streets = null,
  confidence = 'high',
  marginal = false,
  mode = 'TRAINING',
  start = Date.UTC(2026, 0, 1)
} = {}) {
  return Array.from({ length: count }, (_, index) => {
    const value = scores ? scores[index % scores.length] : score;
    return {
      decisionId: `iq-fixture-${start}-${index}`,
      date: new Date(start + index * 60_000).toISOString(),
      street: streets ? streets[index % streets.length] : street,
      decisionMode: mode,
      trainerSnapshot: { confidence, isMarginal: marginal },
      decisionQuality: {
        schemaVersion: 1,
        modelVersion: 'dq-1.0.0',
        score: value,
        classification: value >= 90 ? 'EXCELLENT' : value >= 80 ? 'GOOD' : value >= 70 ? 'ACCEPTABLE' : value >= 50 ? 'MISTAKE' : 'BLUNDER',
        confidence,
        isRated: true
      }
    };
  });
}

const fixtures = [
  { id: 'empty', records: [], expected: { min: null, max: null, rank: 'UNRANKED', status: 'NONE' } },
  { id: 'one-excellent', records: makeRecords(1, { score: 98 }), expected: { min: 1500, max: 1600, rank: 'INTERMEDIATE', status: 'PROVISIONAL' } },
  { id: 'ten-excellent', records: makeRecords(10, { score: 98 }), expected: { min: 1650, max: 1850, rank: 'ADVANCED', status: 'FORMING' } },
  { id: 'thirty-excellent', records: makeRecords(30, { score: 98, streets: STREETS }), expected: { min: 1800, max: 2000, rank: 'EXPERT', status: 'ESTABLISHED' } },
  { id: 'hundred-excellent', records: makeRecords(100, { score: 98, streets: STREETS }), expected: { min: 2200, max: 2400, rank: 'GRANDMASTER', status: 'ESTABLISHED' } },
  { id: 'thirty-average', records: makeRecords(30, { score: 80, streets: STREETS }), expected: { min: 1500, max: 1600, rank: 'INTERMEDIATE', status: 'ESTABLISHED' } },
  { id: 'hundred-average', records: makeRecords(100, { score: 80, streets: STREETS }), expected: { min: 1600, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'thirty-poor', records: makeRecords(30, { score: 50, streets: STREETS }), expected: { min: 1200, max: 1450, rank: 'LEARNING', status: 'ESTABLISHED' } },
  { id: 'hundred-poor', records: makeRecords(100, { score: 50, streets: STREETS }), expected: { min: 1100, max: 1350, rank: 'LEARNING', status: 'ESTABLISHED' } },
  { id: 'stable-ninety', records: makeRecords(40, { score: 90, streets: STREETS }), expected: { min: 1650, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'volatile-ninety', records: makeRecords(40, { scores: [100, 80], streets: STREETS }), expected: { min: 1650, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'mostly-preflop', records: makeRecords(60, { score: 85, street: 'preflop' }), expected: { min: 1650, max: 1850, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'balanced-streets', records: makeRecords(60, { score: 85, streets: STREETS }), expected: { min: 1650, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'high-confidence', records: makeRecords(60, { score: 85, streets: STREETS, confidence: 'high' }), expected: { min: 1650, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'low-confidence', records: makeRecords(60, { score: 85, streets: STREETS, confidence: 'low' }), expected: { min: 1650, max: 1850, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'improving-recent', records: [...makeRecords(20, { score: 70, start: Date.UTC(2026, 0, 1) }), ...makeRecords(20, { score: 90, start: Date.UTC(2026, 1, 1) })], expected: { min: 1500, max: 1700, rank: 'INTERMEDIATE', status: 'ESTABLISHED', trend: 'UP' } },
  { id: 'declining-recent', records: [...makeRecords(20, { score: 90, start: Date.UTC(2026, 0, 1) }), ...makeRecords(20, { score: 70, start: Date.UTC(2026, 1, 1) })], expected: { min: 1550, max: 1800, rank: 'INTERMEDIATE', status: 'ESTABLISHED', trend: 'DOWN' } },
  { id: 'one-outlier', records: makeRecords(40, { scores: [...Array(39).fill(88), 10], streets: STREETS }), expected: { min: 1600, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'many-marginal', records: makeRecords(40, { score: 85, streets: STREETS, confidence: 'medium', marginal: true }), expected: { min: 1600, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } },
  { id: 'mixed-modes', records: ['LIVE', 'TRAINING', 'EXAM', 'REVIEW'].flatMap((mode, index) => makeRecords(10, { score: 82 + index, streets: STREETS, mode, start: Date.UTC(2026, index, 1) })), expected: { min: 1600, max: 1800, rank: 'ADVANCED', status: 'ESTABLISHED' } }
];

module.exports = { STREETS, makeRecords, fixtures };
