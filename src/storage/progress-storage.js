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

function loadProgress() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(PREVIOUS_STORAGE_KEY) || 'null');
    if (current) return CourseProgress.migrateProgress({
      ...defaultProgress(),
      ...current,
      mistakes: { ...defaultProgress().mistakes, ...(current.mistakes || {}) },
      savedHands: Array.isArray(current.savedHands) ? current.savedHands : []
    });
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
    if (old) {
      return CourseProgress.migrateProgress({
        ...defaultProgress(),
        decisions: old.decisions || 0,
        scorePoints: (old.correct || 0) * 3,
        maxPoints: (old.decisions || 0) * 3,
        sessions: old.sessions || 0,
        mistakes: { ...defaultProgress().mistakes, ...(old.mistakes || {}) },
        history: old.history || []
      });
    }
  } catch (_) {}
  return defaultProgress();
}

function saveProgress() {
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
