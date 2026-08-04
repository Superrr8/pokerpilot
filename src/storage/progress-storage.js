'use strict';

const STORAGE_KEY = 'pokerpilot_v1_6_progress';
const PREVIOUS_STORAGE_KEY = 'pokerpilot_v1_5_1_progress';
const OLD_STORAGE_KEY = 'pokerpilot_v1_5_progress';
const LEGACY_STORAGE_KEY = 'pokerpilot_v1_4_progress';

function defaultProgress() {
  return {
    decisions: 0,
    scorePoints: 0,
    maxPoints: 0,
    sessions: 0,
    streak: 0,
    bestStreak: 0,
    assistMode: 'training',
    mistakes: {
      too_tight: 0,
      too_loose: 0,
      passive: 0,
      overplay: 0,
      pot_odds: 0,
      outs: 0,
      sizing: 0,
      position: 0,
      range_reading: 0
    },
    history: [],
    savedHands: [],
    learning: CourseProgress.defaultState()
  };
}

function normalizeDecisionHistory(value) {
  const history = typeof DecisionQualityRecords !== 'undefined'
    ? DecisionQualityRecords.normalizeHistory(value)
    : (Array.isArray(value) ? value : []);
  if (typeof PokerPilotLiveMode === 'undefined') return history;
  const normalized = history.map(item => PokerPilotLiveMode.normalizeSessionRecord(item));
  return normalized.every((item, index) => item === history[index]) ? history : normalized;
}

function normalizeSavedHands(value) {
  const hands = Array.isArray(value) ? value : [];
  if (typeof PokerPilotLiveMode === 'undefined') return hands;
  const normalized = hands.map(hand => PokerPilotLiveMode.normalizeSavedHand(hand));
  return normalized.every((hand, index) => hand === hands[index]) ? hands : normalized;
}

function loadProgress() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || 'null');
    if (current) {
      const migrated = CourseProgress.migrateProgress({
      ...defaultProgress(),
      ...current,
      mistakes: { ...defaultProgress().mistakes, ...(current.mistakes || {}) },
      savedHands: normalizeSavedHands(current.savedHands),
      history: normalizeDecisionHistory(current.history)
      });
      return migrated;
    }
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (old) {
      return CourseProgress.migrateProgress({
        ...defaultProgress(),
        decisions: old.decisions || 0,
        scorePoints: (old.correct || 0) * 3,
        maxPoints: (old.decisions || 0) * 3,
        sessions: old.sessions || 0,
        mistakes: { ...defaultProgress().mistakes, ...(old.mistakes || {}) },
        history: normalizeDecisionHistory(old.history)
      });
    }
  } catch (_) {}
  return defaultProgress();
}

function saveProgress() {
  if (typeof DecisionQualityRecords !== 'undefined') {
    progress.history = DecisionQualityRecords.normalizeHistory(progress.history);
  }
  progress.history = normalizeDecisionHistory(progress.history);
  progress.savedHands = normalizeSavedHands(progress.savedHands);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) {}
  renderProgress();
}

if (typeof module === 'object' && module.exports) {
  module.exports = {
    STORAGE_KEY,
    PREVIOUS_STORAGE_KEY,
    OLD_STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    defaultProgress,
    loadProgress,
    saveProgress
  };
}
