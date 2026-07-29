'use strict';

(function attachDecisionQualityEngine(root) {
  const SCHEMA_VERSION = 1;
  const MODEL_VERSION = 'dq-1.0.0';
  const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
  const SIZED_ACTIONS = new Set(['BET', 'RAISE', 'ALL_IN']);
  const LABELS = Object.freeze({
    EXCELLENT: 'Отличное решение',
    GOOD: 'Хорошее решение',
    ACCEPTABLE: 'Допустимое решение',
    MISTAKE: 'Ошибка',
    BLUNDER: 'Серьёзная ошибка',
    UNRATED: 'Недостаточно данных'
  });
  const CONFIG = Object.freeze({
    weights: Object.freeze({ actionQuality: 70, sizingQuality: 20, evQuality: 10 }),
    thresholds: Object.freeze({ excellent: 90, good: 80, acceptable: 70, mistake: 50 }),
    sizingTolerance: Object.freeze({ close: 0.10, moderate: 0.25, large: 0.50 })
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeAction(value) {
    const raw = typeof value === 'string' ? value : object(value).actionClass;
    const normalized = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return normalized === 'ALLIN' ? 'ALL_IN' : ACTIONS.has(normalized) ? normalized : null;
  }

  function normalizeConfidence(value) {
    const normalized = String(value || '').toLowerCase();
    return ['low', 'medium', 'high'].includes(normalized) ? normalized : 'medium';
  }

  function classify(score) {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) return 'UNRATED';
    const numeric = clamp(Number(score));
    if (numeric >= 90) return 'EXCELLENT';
    if (numeric >= 80) return 'GOOD';
    if (numeric >= 70) return 'ACCEPTABLE';
    if (numeric >= 50) return 'MISTAKE';
    return 'BLUNDER';
  }

  function getGrade(score) {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) return null;
    const numeric = clamp(Number(score));
    if (numeric >= 95) return 'A+';
    if (numeric >= 90) return 'A';
    if (numeric >= 80) return 'B';
    if (numeric >= 70) return 'C';
    if (numeric >= 50) return 'D';
    return 'F';
  }

  function getStars(score) {
    if (score === null || score === undefined || !Number.isFinite(Number(score))) return null;
    const numeric = clamp(Number(score));
    if (numeric >= 95) return 5;
    if (numeric >= 85) return 4;
    if (numeric >= 70) return 3;
    if (numeric >= 50) return 2;
    if (numeric >= 1) return 1;
    return 0;
  }

  function getLabel(value) {
    const classification = typeof value === 'number' ? classify(value) : String(value || 'UNRATED');
    return LABELS[classification] || LABELS.UNRATED;
  }

  function unrated(evaluatedAt) {
    return {
      schemaVersion: SCHEMA_VERSION,
      score: null,
      grade: null,
      classification: 'UNRATED',
      stars: null,
      isRated: false,
      confidence: 'low',
      components: {
        actionQuality: null,
        sizingQuality: null,
        evQuality: null,
        contextReliability: null
      },
      reasons: ['Недостаточно данных для честной оценки решения.'],
      modelVersion: MODEL_VERSION,
      evaluatedAt
    };
  }

  function findAlternative(trainer, action) {
    const alternatives = Array.isArray(trainer.alternatives) ? trainer.alternatives : [];
    return alternatives.find(item => normalizeAction(item) === action) || null;
  }

  function actionComponent({ userAction, recommendedAction, alternative, confidence, isMarginal }) {
    if (userAction === recommendedAction) {
      if (confidence === 'low') return 94;
      if (confidence === 'medium' || isMarginal) return 96;
      return 98;
    }
    if (alternative) return isMarginal || confidence === 'low' ? 88 : 84;
    let score = confidence === 'high' ? 25 : confidence === 'medium' ? 45 : 60;
    if (isMarginal) score = Math.max(55, score);
    return score;
  }

  function compatibleUnit(user, reference) {
    const userUnit = String(object(user).amountUnit || '').toUpperCase();
    const referenceUnit = String(object(reference).amountUnit || '').toUpperCase();
    return !userUnit || !referenceUnit || userUnit === referenceUnit;
  }

  function sizingComponent(user, reference, action) {
    if (!SIZED_ACTIONS.has(action)) return null;
    const userAmount = finite(object(user).amount);
    const referenceAmount = finite(object(reference).amount);
    if (userAmount === null || referenceAmount === null || referenceAmount <= 0) return null;
    if (!compatibleUnit(user, reference)) return null;
    if (userAmount <= 0) return 0;
    const absoluteDifference = Math.abs(userAmount - referenceAmount);
    const relativeDifference = absoluteDifference / referenceAmount;
    if (absoluteDifference <= 1 || relativeDifference <= CONFIG.sizingTolerance.close) return 100;
    if (relativeDifference <= CONFIG.sizingTolerance.moderate) return 75;
    if (relativeDifference <= CONFIG.sizingTolerance.large) return 20;
    return 0;
  }

  function evComponent(userAction, trainer) {
    const callEv = finite(trainer.callEV);
    if (callEv === null || !['CALL', 'FOLD'].includes(userAction)) return null;
    if (userAction === 'CALL') return callEv >= 0 ? 100 : 0;
    return callEv <= 0 ? 100 : 0;
  }

  function hasMaterialExactEvConflict(userAction, trainer, context) {
    const callEv = finite(trainer.callEV);
    const method = String(trainer.callEVMethod || '').trim().toLowerCase();
    if (callEv === null || method !== 'exact' || !['CALL', 'FOLD'].includes(userAction)) return false;
    const pot = Math.max(0, finite(context.pot) ?? 0);
    const tolerance = Math.max(1, pot * 0.01);
    if (Math.abs(callEv) <= tolerance) return false;
    return userAction === 'CALL' ? callEv < 0 : callEv > 0;
  }

  function weightedScore(components) {
    let weighted = 0;
    let totalWeight = 0;
    for (const [name, weight] of Object.entries(CONFIG.weights)) {
      if (components[name] === null) continue;
      weighted += components[name] * weight;
      totalWeight += weight;
    }
    return totalWeight ? Math.round(weighted / totalWeight) : null;
  }

  function normalizeEvaluatedAt(value) {
    if (!value) return '1970-01-01T00:00:00.000Z';
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '1970-01-01T00:00:00.000Z';
  }

  function evaluate(input = {}) {
    const evaluatedAt = normalizeEvaluatedAt(input.evaluatedAt || input.timestamp);
    const trainer = object(input.trainer);
    const context = object(input.context);
    const user = typeof input.userAction === 'string'
      ? { actionClass: input.userAction }
      : object(input.userAction);
    const userAction = normalizeAction(user);
    const recommendedAction = normalizeAction(trainer);
    if (!userAction || !recommendedAction || !Object.keys(context).length) return unrated(evaluatedAt);

    const confidence = normalizeConfidence(trainer.confidence);
    const isMarginal = Boolean(trainer.isMarginal);
    const alternative = findAlternative(trainer, userAction);
    const reference = userAction === recommendedAction ? trainer : alternative;
    const components = {
      actionQuality: actionComponent({
        userAction,
        recommendedAction,
        alternative,
        confidence,
        isMarginal
      }),
      sizingQuality: sizingComponent(user, reference, userAction),
      evQuality: evComponent(userAction, trainer),
      contextReliability: confidence === 'high' ? 100 : confidence === 'medium' ? 75 : 55
    };
    let score = weightedScore(components);
    if (isMarginal) score = clamp(score, 50, 96);
    if (confidence === 'low') score = clamp(score, 50, 94);
    const exactEvConflict = hasMaterialExactEvConflict(userAction, trainer, context);
    if (exactEvConflict) score = Math.min(score, 79);

    const reasons = [];
    if (userAction === recommendedAction) {
      reasons.push('Вы выбрали основное действие тренера.');
    } else if (alternative) {
      reasons.push(`Вы выбрали допустимую альтернативу${alternative.reason ? `: ${String(alternative.reason)}` : '.'}`);
    } else {
      reasons.push('Выбранное действие расходится с основной рекомендацией тренера.');
    }
    if (components.sizingQuality !== null) {
      if (components.sizingQuality >= 95) reasons.push('Размер близок к рекомендованному.');
      else if (components.sizingQuality >= 65) reasons.push('Размер допустим, но заметно отличается от ориентира.');
      else reasons.push('Размер существенно отличается от рекомендованного ориентира.');
    }
    if (components.evQuality !== null) {
      reasons.push(components.evQuality >= 50
        ? 'Действие согласуется с доступным числовым EV колла.'
        : 'Действие не использует преимущество доступного числового EV колла.');
    }
    if (exactEvConflict) reasons.push('Точная EV-оценка противоречит выбранному решению.');
    if (isMarginal) reasons.push('Решение пограничное: небольшое изменение диапазона или контекста может изменить рекомендацию.');
    if (confidence === 'low') reasons.push('Уверенность модели низкая, поэтому оценка намеренно сжата.');

    return {
      schemaVersion: SCHEMA_VERSION,
      score,
      grade: getGrade(score),
      classification: classify(score),
      stars: getStars(score),
      isRated: true,
      confidence,
      components,
      reasons,
      modelVersion: MODEL_VERSION,
      evaluatedAt
    };
  }

  function explain(result) {
    const value = object(result);
    const reasons = Array.isArray(value.reasons) ? value.reasons.filter(Boolean).map(String) : [];
    return reasons.length ? reasons.join(' ') : LABELS.UNRATED;
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    MODEL_VERSION,
    CONFIG,
    evaluate,
    classify,
    getLabel,
    getGrade,
    getStars,
    explain
  });
  root.DecisionQualityEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
