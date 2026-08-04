'use strict';

(function attachProgressConfig(root) {
  const pokerIqConfig = root.POKER_IQ_CONFIG
    || (typeof require === 'function' ? require('../poker-iq/poker-iq-config.js') : null);
  const DailyReward = root.PokerPilotDailyChallengeReward
    || (typeof require === 'function' ? require('../daily/daily-challenge-reward.js') : null);

  const SCHEMA_VERSION = 3;
  const STORAGE_KEY = 'pokerpilot_progress_system';
  const HISTORY_LIMIT = 2000;
  const DECISION_RETENTION = 1200;
  const PROCESSED_EVENT_LIMIT = 5000;
  const SKILL_IDS = Object.freeze([
    'preflop',
    'value',
    'bluffing',
    'discipline',
    'pokerMath',
    'postflop'
  ]);
  const EVENT_TYPES = Object.freeze([
    'LESSON_COMPLETED',
    'EXAM_COMPLETED',
    'TRAINING_DECISION_RECORDED',
    'TRAINING_SCENARIO_COMPLETED',
    'TRAINING_SESSION_COMPLETED',
    'HAND_REVIEW_COMPLETED',
    'DAILY_HAND_COMPLETED',
    'DAILY_CHALLENGE_COMPLETED',
    'LIVE_SESSION_REVIEWED',
    'SKILL_CHECK_COMPLETED'
  ]);
  const XP_REWARDS = Object.freeze({
    LESSON_COMPLETED: 30,
    EXAM_COMPLETED: 60,
    TRAINING_DECISION_RECORDED: 0,
    TRAINING_SCENARIO_COMPLETED: 15,
    TRAINING_SESSION_COMPLETED: 40,
    HAND_REVIEW_COMPLETED: 35,
    DAILY_HAND_COMPLETED: 25,
    DAILY_CHALLENGE_COMPLETED: DailyReward.POLICY.correctXp,
    LIVE_SESSION_REVIEWED: 45,
    SKILL_CHECK_COMPLETED: 50
  });
  const TOPIC_TO_SKILL = Object.freeze({
    preflop: 'preflop',
    position: 'preflop',
    ranges: 'preflop',
    too_tight: 'discipline',
    too_loose: 'discipline',
    passive: 'discipline',
    overplay: 'discipline',
    value: 'value',
    thin_value: 'value',
    bluffing: 'bluffing',
    bluff_catch: 'discipline',
    discipline: 'discipline',
    pot_odds: 'pokerMath',
    outs: 'pokerMath',
    equity: 'pokerMath',
    ev: 'pokerMath',
    poker_math: 'pokerMath',
    postflop: 'postflop',
    sizing: 'postflop',
    range_reading: 'postflop'
  });
  const RANKS = Object.freeze((pokerIqConfig?.ranks || []).map(rank =>
    Object.freeze({ ...rank })
  ));

  function xpRequiredForLevel(level) {
    const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
    return 250 * (safeLevel + 1);
  }

  function deriveLevel(value) {
    const numeric = Number(value);
    const totalXp = Number.isFinite(numeric)
      ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(numeric)))
      : 0;
    const level = Math.max(1, Math.floor(
      (-1 + Math.sqrt(9 + (4 * totalXp) / 125)) / 2
    ));
    const levelStartXp = 125 * (level - 1) * (level + 2);
    const xpToNextLevel = xpRequiredForLevel(level);
    return {
      totalXp,
      level,
      xpIntoLevel: totalXp - levelStartXp,
      xpToNextLevel,
      levelStartXp,
      nextLevelXp: levelStartXp + xpToNextLevel
    };
  }

  function xpRewardForEvent(type, payload = {}) {
    if (type === 'DAILY_CHALLENGE_COMPLETED') {
      return DailyReward.xpForOutcome(payload.isCorrect, payload.rewardVersion);
    }
    return XP_REWARDS[type];
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    STORAGE_KEY,
    HISTORY_LIMIT,
    DECISION_RETENTION,
    PROCESSED_EVENT_LIMIT,
    SKILL_IDS,
    EVENT_TYPES,
    XP_REWARDS,
    xpRewardForEvent,
    TOPIC_TO_SKILL,
    RANKS,
    xpRequiredForLevel,
    deriveLevel
  });

  root.PokerPilotProgressConfig = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
