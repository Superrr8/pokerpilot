'use strict';

(function attachFocusSession(root) {
  const TOTAL_DECISIONS = 5;
  const MIN_COMPARISON_ATTEMPTS = 10;
  let generatedIdentity = 0;

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function finiteScore(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 100 ? numeric : null;
  }

  function count(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }

  function uniqueIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).reduce((result, value) => {
      const id = text(value);
      if (!id || seen.has(id)) return result;
      seen.add(id);
      result.push(id);
      return result;
    }, []);
  }

  function buildScenarioPlan({ preferredScenarioIds, availableScenarioIds, total = TOTAL_DECISIONS } = {}) {
    const limit = Math.max(1, Math.floor(Number(total) || TOTAL_DECISIONS));
    const available = uniqueIds(availableScenarioIds);
    const availableSet = new Set(available);
    const preferred = uniqueIds(preferredScenarioIds).filter(id => !available.length || availableSet.has(id));
    const fallback = available.filter(id => !preferred.includes(id));
    const uniquePlan = [...preferred, ...fallback].slice(0, limit);
    const scenarioIds = [...uniquePlan];
    const repeatSource = uniquePlan.length ? uniquePlan : preferred;
    while (scenarioIds.length < limit && repeatSource.length) {
      scenarioIds.push(repeatSource[scenarioIds.length % repeatSource.length]);
    }
    return {
      scenarioIds,
      usedFallback: preferred.length < limit || scenarioIds.some(id => !preferred.includes(id))
    };
  }

  function clone(value) {
    return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  function comparisonFor(session, averageDecisionQuality) {
    const baseline = object(session.baseline);
    const baselineScore = finiteScore(baseline.score);
    const reliable = baselineScore !== null
      && count(baseline.attempts) >= MIN_COMPARISON_ATTEMPTS
      && averageDecisionQuality !== null;
    if (!reliable) {
      return {
        id: 'INSUFFICIENT_DATA',
        text: 'Продолжай тренировку — PokerPilot накопит больше данных для сравнения.'
      };
    }
    const delta = averageDecisionQuality - baselineScore;
    if (delta > 3) return { id: 'IMPROVING', text: 'Улучшение: решения в этой сессии стали увереннее.' };
    if (delta < -3) return { id: 'NEEDS_PRACTICE', text: 'Нужно закрепить: повтори тему ещё одной короткой сессией.' };
    return { id: 'STABLE', text: 'Стабильно: качество решений держится на привычном уровне.' };
  }

  function resultFor(session) {
    if (!session || session.status !== 'completed') return null;
    const scores = session.decisions
      .map(decision => finiteScore(decision.decisionQualityScore))
      .filter(value => value !== null);
    const averageDecisionQuality = scores.length === session.totalDecisions
      ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
      : null;
    const correctDecisions = session.decisions.filter(decision => decision.isCorrect).length;
    return {
      id: session.id,
      topicId: session.topicId,
      topicLabel: session.topicLabel,
      route: session.route,
      completedDecisions: session.decisions.length,
      totalDecisions: session.totalDecisions,
      correctDecisions,
      incorrectDecisions: session.decisions.length - correctDecisions,
      accuracy: Math.round(correctDecisions / session.totalDecisions * 100),
      ratedDecisions: scores.length,
      averageDecisionQuality,
      scenarioIds: session.decisions.map(decision => decision.scenarioId),
      comparison: comparisonFor(session, averageDecisionQuality),
      usedFallback: session.usedFallback
    };
  }

  function create({ idFactory } = {}) {
    const makeId = typeof idFactory === 'function'
      ? idFactory
      : () => `focus-${Date.now()}-${++generatedIdentity}`;
    let session = null;

    function snapshot() {
      if (!session) return null;
      const completed = session.decisions.length;
      return clone({
        ...session,
        completedDecisions: completed,
        currentDecision: session.status === 'completed' ? session.totalDecisions : completed + 1,
        progressLabel: session.status === 'completed'
          ? `${session.totalDecisions}/${session.totalDecisions}`
          : `${completed + 1}/${session.totalDecisions}`
      });
    }

    function start(input = {}) {
      const data = object(input);
      const topicId = text(data.topicId);
      const topicLabel = text(data.topicLabel);
      const route = text(data.route);
      if (!topicId || !topicLabel || !['study', 'ranges'].includes(route)) {
        throw new Error('Valid focus topic and route are required');
      }
      const dynamicScenarios = data.dynamicScenarios === true;
      const plan = dynamicScenarios
        ? { scenarioIds: [], usedFallback: data.fallback === true }
        : buildScenarioPlan({
            preferredScenarioIds: data.preferredScenarioIds,
            availableScenarioIds: data.availableScenarioIds,
            total: TOTAL_DECISIONS
          });
      session = {
        id: text(makeId()) || `focus-${Date.now()}-${++generatedIdentity}`,
        status: 'active',
        topicId,
        topicLabel,
        route,
        totalDecisions: TOTAL_DECISIONS,
        scenarioPlan: plan.scenarioIds,
        usedFallback: data.fallback === true || plan.usedFallback,
        baseline: {
          score: finiteScore(object(data.baseline).score),
          attempts: count(object(data.baseline).attempts)
        },
        decisions: []
      };
      return snapshot();
    }

    function getCurrentScenarioId() {
      if (!session || session.status !== 'active' || !session.scenarioPlan.length) return null;
      return session.scenarioPlan[session.decisions.length] || null;
    }

    function recordDecision(input = {}) {
      if (!session) return { accepted: false, reason: 'NO_ACTIVE_SESSION', state: null };
      if (session.status === 'completed') {
        return { accepted: false, reason: 'SESSION_COMPLETED', state: snapshot() };
      }
      const data = object(input);
      const decisionId = text(data.decisionId);
      const scenarioId = text(data.scenarioId);
      if (!decisionId || !scenarioId) {
        return { accepted: false, reason: 'INVALID_DECISION', state: snapshot() };
      }
      if (session.decisions.some(decision => decision.decisionId === decisionId)) {
        return { accepted: false, reason: 'DUPLICATE_DECISION', state: snapshot() };
      }
      session.decisions.push({
        decisionId,
        scenarioId,
        isCorrect: data.isCorrect === true,
        decisionQualityScore: finiteScore(data.decisionQualityScore)
      });
      if (session.decisions.length >= session.totalDecisions) session.status = 'completed';
      return { accepted: true, reason: null, state: snapshot() };
    }

    function clear() {
      session = null;
    }

    return Object.freeze({
      start,
      recordDecision,
      getSnapshot: snapshot,
      getCurrentScenarioId,
      getResult: () => clone(resultFor(session)),
      clear
    });
  }

  const api = Object.freeze({
    TOTAL_DECISIONS,
    MIN_COMPARISON_ATTEMPTS,
    buildScenarioPlan,
    create
  });

  root.PokerPilotFocusSession = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
