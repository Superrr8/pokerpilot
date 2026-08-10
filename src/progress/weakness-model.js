'use strict';

(function attachWeaknessModel(root) {
  const MIN_RELIABLE_ATTEMPTS = 10;
  const FOCUS_SCORE_CEILING = 80;
  const FULL_SAMPLE_ATTEMPTS = 30;
  const SKILL_IDS = Object.freeze([
    'preflop',
    'value',
    'bluffing',
    'discipline',
    'pokerMath',
    'postflop'
  ]);
  const SKILL_LABELS = Object.freeze({
    preflop: 'Префлоп',
    value: 'Вэлью-беты',
    bluffing: 'Блефы',
    discipline: 'Дисциплина решений',
    pokerMath: 'Покерная математика',
    postflop: 'Постфлоп'
  });
  const TREND_LABELS = Object.freeze({
    UP: 'Динамика улучшается',
    DOWN: 'Недавняя динамика снижается',
    STABLE: 'Динамика стабильна',
    INSUFFICIENT_DATA: null
  });
  const TREND_ADJUSTMENTS = Object.freeze({
    UP: -4,
    DOWN: 6,
    STABLE: 0,
    INSUFFICIENT_DATA: 0
  });
  const TRAINING_TARGETS = Object.freeze({
    preflop: Object.freeze({ route: 'ranges', scenarioIds: Object.freeze([]), fallback: false }),
    value: Object.freeze({
      route: 'study',
      scenarioIds: Object.freeze(['flop-kk-value', 'river-thin-value', 'flop-set-wet', 'river-flush-value']),
      fallback: false
    }),
    bluffing: Object.freeze({
      route: 'study',
      scenarioIds: Object.freeze(['river-missed-draw']),
      fallback: false
    }),
    discipline: Object.freeze({
      route: 'study',
      scenarioIds: Object.freeze(['river-aj-bluffcatch', 'turn-aq-nit', 'flop-underpair', 'river-overbet', 'river-qq-aggro']),
      fallback: false
    }),
    pokerMath: Object.freeze({
      route: 'study',
      scenarioIds: Object.freeze(['flop-nfd', 'flop-oesd', 'turn-combo-draw', 'turn-nfd-price', 'flop-gutshot-overs']),
      fallback: false
    }),
    postflop: Object.freeze({ route: 'study', scenarioIds: Object.freeze([]), fallback: true })
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function attempts(value) {
    const numeric = finite(value);
    return numeric === null ? 0 : Math.max(0, Math.floor(numeric));
  }

  function score(value) {
    const numeric = finite(value);
    return numeric !== null && numeric >= 0 && numeric <= 100
      ? Math.round(numeric * 10) / 10
      : null;
  }

  function trainingTargetFor(skillId) {
    const target = TRAINING_TARGETS[skillId];
    if (!target) return { skillId: null, route: 'study', scenarioIds: [], fallback: true };
    return {
      skillId,
      route: target.route,
      scenarioIds: [...target.scenarioIds],
      fallback: target.fallback
    };
  }

  function topicForScenario(scenarioId) {
    const id = typeof scenarioId === 'string' ? scenarioId.trim() : '';
    if (!id) return 'postflop';
    for (const skillId of ['value', 'bluffing', 'discipline', 'pokerMath']) {
      if (TRAINING_TARGETS[skillId].scenarioIds.includes(id)) {
        return skillId === 'pokerMath' ? 'poker_math' : skillId;
      }
    }
    return 'postflop';
  }

  function categoryModel(id, value) {
    const raw = object(value);
    const relevantDecisions = attempts(raw.attempts);
    const currentScore = score(raw.score);
    const confidence = ['insufficient', 'low', 'medium', 'high'].includes(raw.confidence)
      ? raw.confidence
      : 'insufficient';
    const trend = Object.hasOwn(TREND_ADJUSTMENTS, raw.recentTrend)
      ? raw.recentTrend
      : 'INSUFFICIENT_DATA';
    const reliable = relevantDecisions >= MIN_RELIABLE_ATTEMPTS
      && ['medium', 'high'].includes(confidence)
      && currentScore !== null;
    const eligible = reliable && currentScore < FOCUS_SCORE_CEILING;
    const sampleWeight = Math.min(1, relevantDecisions / FULL_SAMPLE_ATTEMPTS);
    const priority = eligible
      ? Math.round((((100 - currentScore) * sampleWeight) + TREND_ADJUSTMENTS[trend]) * 10) / 10
      : null;
    return {
      id,
      label: SKILL_LABELS[id],
      relevantDecisions,
      score: currentScore,
      scoreLabel: currentScore === null ? 'Нет оценки' : `${Math.round(currentScore)} / 100`,
      mistakes: null,
      accuracy: null,
      recentMistakes: null,
      confidence,
      coverage: reliable ? (relevantDecisions >= FULL_SAMPLE_ATTEMPTS ? 'high' : 'medium') : 'insufficient',
      coverageLabel: reliable
        ? `${relevantDecisions} оценённых решений`
        : `${relevantDecisions} из ${MIN_RELIABLE_ATTEMPTS} решений для фокуса`,
      trend,
      trendLabel: TREND_LABELS[trend],
      recentAdjustment: TREND_ADJUSTMENTS[trend],
      eligible,
      priority,
      trainingTarget: trainingTargetFor(id)
    };
  }

  function derive(snapshot) {
    const skills = object(object(snapshot).skills);
    const categories = SKILL_IDS.map(id => categoryModel(id, skills[id]));
    const ranked = categories.filter(item => item.eligible).sort((left, right) =>
      right.priority - left.priority
      || right.relevantDecisions - left.relevantDecisions
      || SKILL_IDS.indexOf(left.id) - SKILL_IDS.indexOf(right.id)
    );
    const hasReliableData = categories.some(item =>
      item.coverage === 'medium' || item.coverage === 'high'
    );
    return {
      categories,
      ranked,
      primary: ranked[0] || null,
      hasReliableData,
      minimumReliableAttempts: MIN_RELIABLE_ATTEMPTS,
      focusScoreCeiling: FOCUS_SCORE_CEILING,
      emptyMessage: hasReliableData
        ? 'Надёжных слабых тем сейчас не обнаружено. Поддерживайте форму обычной тренировкой.'
        : `Нужно минимум ${MIN_RELIABLE_ATTEMPTS} оценённых решений по теме, чтобы выбрать персональный фокус.`
    };
  }

  const api = Object.freeze({
    SKILL_IDS,
    SKILL_LABELS,
    MIN_RELIABLE_ATTEMPTS,
    FOCUS_SCORE_CEILING,
    derive,
    trainingTargetFor,
    topicForScenario
  });

  root.PokerPilotWeaknessModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
