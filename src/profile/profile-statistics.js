'use strict';

(function attachProfileStatistics(root) {
  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }

  function sessionHands(history) {
    return history.reduce((sum, item) => {
      if (item?.mode !== 'session' || typeof item.title !== 'string') return sum;
      const match = item.title.match(/(\d+)\s+рук/i);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
  }

  function bestExamResult(learning) {
    const modules = object(object(learning).modules);
    const values = [];
    Object.values(modules).forEach(moduleState => {
      const state = object(moduleState);
      const savedBest = Number(state.bestExamScore);
      if (Number.isFinite(savedBest)) values.push(savedBest);
      const attempts = Array.isArray(state.examAttempts) ? state.examAttempts : [];
      attempts.forEach(attempt => {
        const score = Number(attempt?.score ?? attempt?.percentage);
        if (Number.isFinite(score)) values.push(score);
      });
    });
    return values.length ? Math.max(...values.map(value => Math.max(0, Math.min(100, value)))) : null;
  }

  function fromProgress(value) {
    const progress = object(value);
    const history = Array.isArray(progress.history) ? progress.history : [];
    const savedHands = Array.isArray(progress.savedHands) ? progress.savedHands.length : 0;
    const decisionsMade = number(progress.decisions);
    const maxPoints = number(progress.maxPoints);
    const scorePoints = number(progress.scorePoints);
    const correctDecisions = history.filter(item =>
      item?.mode !== 'session' && (item?.grade === 'best' || item?.grade === 'good')
    ).length;
    const sessionsPlayed = number(progress.sessions);
    const handsPlayed = sessionHands(history);
    const bestResult = bestExamResult(progress.learning);
    return {
      isEmpty: decisionsMade === 0 && sessionsPlayed === 0 && handsPlayed === 0 && savedHands === 0,
      sessionsPlayed,
      handsPlayed,
      savedHands,
      decisionsMade,
      correctDecisions,
      decisionAccuracy: maxPoints > 0 ? Math.round(scorePoints / maxPoints * 100) : null,
      bestResult,
      currentDecisionStreak: number(progress.streak),
      bestDecisionStreak: number(progress.bestStreak),
      currentStreakDays: null
    };
  }

  const api = Object.freeze({ fromProgress });
  root.ProfileStatistics = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

