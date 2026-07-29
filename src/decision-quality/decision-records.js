'use strict';

(function attachDecisionQualityRecords(root) {
  const HISTORY_RETENTION = 1200;
  const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function action(value) {
    const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return normalized === 'ALLIN' ? 'ALL_IN' : ACTIONS.has(normalized) ? normalized : null;
  }

  function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function hash(value) {
    let output = 2166136261;
    for (const character of String(value)) {
      output ^= character.charCodeAt(0);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(36);
  }

  function createDecisionId(record = {}) {
    const source = [
      record.date || record.timestamp || '',
      record.mode || '',
      record.title || '',
      record.choice || record.userAction || '',
      record.sessionId || '',
      record.sequence ?? ''
    ].join('|');
    return `decision-${hash(source)}`;
  }

  function normalizeAlternative(value) {
    const item = object(value);
    const actionClass = action(item.actionClass || item.action);
    if (!actionClass) return null;
    return {
      actionClass,
      amount: finiteOrNull(item.amount),
      amountUnit: item.amountUnit ? String(item.amountUnit) : null,
      reason: item.reason ? String(item.reason) : ''
    };
  }

  function createTrainerSnapshot(value = {}) {
    const trainer = object(value);
    const actionClass = action(trainer.actionClass || trainer.recommendedAction || trainer.preferred);
    if (!actionClass) return null;
    const callEVMethod = ['exact', 'montecarlo'].includes(String(trainer.callEVMethod).toLowerCase())
      ? String(trainer.callEVMethod).toLowerCase()
      : null;
    return {
      actionClass,
      recommendedAction: actionClass,
      amount: finiteOrNull(trainer.amount),
      recommendedAmount: finiteOrNull(trainer.amount),
      amountUnit: trainer.amountUnit ? String(trainer.amountUnit) : null,
      confidence: ['low', 'medium', 'high'].includes(String(trainer.confidence).toLowerCase())
        ? String(trainer.confidence).toLowerCase()
        : 'medium',
      trainerConfidence: ['low', 'medium', 'high'].includes(String(trainer.confidence).toLowerCase())
        ? String(trainer.confidence).toLowerCase()
        : 'medium',
      isMarginal: Boolean(trainer.isMarginal),
      callEV: finiteOrNull(trainer.callEV),
      callEVMethod,
      alternatives: (Array.isArray(trainer.alternatives) ? trainer.alternatives : [])
        .map(normalizeAlternative)
        .filter(Boolean)
    };
  }

  function normalizeDecisionQuality(value) {
    const quality = object(value);
    if (quality.schemaVersion !== 1) return null;
    const isRated = quality.isRated === true && Number.isFinite(Number(quality.score));
    if (!isRated) {
      return {
        ...quality,
        schemaVersion: 1,
        score: null,
        grade: null,
        classification: 'UNRATED',
        stars: null,
        isRated: false
      };
    }
    return {
      ...quality,
      schemaVersion: 1,
      score: Math.max(0, Math.min(100, Number(quality.score))),
      isRated: true
    };
  }

  function createDecisionRecord({
    base = {},
    userAction,
    userAmount = null,
    userAmountUnit = null,
    trainer,
    context,
    evaluatedAt
  } = {}) {
    const date = evaluatedAt || base.date || new Date().toISOString();
    const trainerSnapshot = createTrainerSnapshot(trainer);
    const normalizedAction = action(userAction || base.choice);
    const decisionQuality = root.DecisionQualityEngine?.evaluate({
      userAction: normalizedAction
        ? { actionClass: normalizedAction, amount: finiteOrNull(userAmount), amountUnit: userAmountUnit }
        : null,
      trainer: trainerSnapshot,
      context,
      evaluatedAt: date
    }) || null;
    const record = {
      ...base,
      date,
      decisionId: base.decisionId || createDecisionId({ ...base, date, userAction: normalizedAction }),
      choice: normalizedAction ? normalizedAction.toLowerCase() : base.choice,
      userAction: normalizedAction,
      street: context?.street || base.street || null,
      sessionId: context?.sessionId || base.sessionId || null,
      trainerSnapshot,
      decisionQuality
    };
    return record;
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    return value.slice(0, HISTORY_RETENTION).map(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const quality = normalizeDecisionQuality(item.decisionQuality);
      return quality ? { ...item, decisionQuality: quality } : {
        ...item,
        decisionQuality: {
          schemaVersion: 1,
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
          reasons: ['Историческая запись не содержит достаточных данных для оценки.'],
          modelVersion: root.DecisionQualityEngine?.MODEL_VERSION || 'dq-1.0.0',
          evaluatedAt: Number.isFinite(Date.parse(item.date || '')) ? new Date(item.date).toISOString() : '1970-01-01T00:00:00.000Z'
        }
      };
    });
  }

  function normalizeProgressHistory(progress = {}) {
    return {
      ...progress,
      history: normalizeHistory(progress.history)
    };
  }

  const api = Object.freeze({
    HISTORY_RETENTION,
    createDecisionId,
    createTrainerSnapshot,
    createDecisionRecord,
    normalizeDecisionQuality,
    normalizeHistory,
    normalizeProgressHistory
  });
  root.DecisionQualityRecords = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
