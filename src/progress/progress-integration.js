'use strict';

(function attachProgressIntegration(root) {
  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function finite(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function dailyChallengeEventId({ dateKey, scheduleVersion, challengeId } = {}) {
    const date = text(dateKey);
    const challenge = text(challengeId);
    const version = Math.max(1, Math.floor(Number(scheduleVersion) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !challenge) return null;
    return `daily_challenge:v${version}:${date}:${challenge}`;
  }

  function invalid(reason = 'INVALID_INTEGRATION_INPUT') {
    return {
      applied: false,
      rewards: { xp: 0 },
      changes: [],
      reason
    };
  }

  function create({
    system,
    now = () => new Date().toISOString(),
    timezoneOffsetMinutes = () => new Date().getTimezoneOffset(),
    onSnapshot,
    onResult
  } = {}) {
    if (!system || typeof system.recordEvent !== 'function') {
      throw new Error('ProgressSystem is required');
    }

    const unsubscribe = typeof onSnapshot === 'function' && typeof system.subscribe === 'function'
      ? system.subscribe(onSnapshot)
      : () => {};

    function publish(result) {
      if (result?.applied === true && typeof onResult === 'function') onResult(result);
      return result;
    }

    function eventContext() {
      const timestamp = text(now()) || new Date().toISOString();
      const offset = finite(timezoneOffsetMinutes());
      return {
        timestamp,
        timezoneOffsetMinutes: offset === null ? 0 : offset
      };
    }

    function recordTrainingDecision(input) {
      const data = object(input);
      const record = object(data.decisionRecord);
      const decisionId = text(record.decisionId);
      if (!decisionId) return invalid();
      const context = eventContext();
      return publish(system.recordEvent({
        id: `decision:${decisionId}`,
        type: 'TRAINING_DECISION_RECORDED',
        timestamp: context.timestamp,
        source: text(data.source) || 'training',
        payload: {
          decisionRecord: record,
          topic: text(data.topic),
          localDate: text(data.localDate),
          timezoneOffsetMinutes: context.timezoneOffsetMinutes
        }
      }));
    }

    function completeTrainingScenario(input) {
      const data = object(input);
      const scenarioId = text(data.scenarioId);
      const decisionId = text(data.decisionId);
      if (!scenarioId || !decisionId) return invalid();
      const context = eventContext();
      return publish(system.recordEvent({
        id: `training-scenario:${decisionId}`,
        type: 'TRAINING_SCENARIO_COMPLETED',
        timestamp: context.timestamp,
        source: text(data.source) || 'training',
        payload: {
          scenarioId,
          decisionId,
          topic: text(data.topic),
          localDate: text(data.localDate),
          timezoneOffsetMinutes: context.timezoneOffsetMinutes
        }
      }));
    }

    function completeExam(input) {
      const data = object(input);
      const moduleId = text(data.moduleId);
      const attemptId = text(data.attemptId);
      const score = finite(data.score);
      if (!moduleId || !attemptId || score === null || score < 0 || score > 100) return invalid();
      const context = eventContext();
      return publish(system.recordEvent({
        id: `exam:${moduleId}:${attemptId}`,
        type: 'EXAM_COMPLETED',
        timestamp: context.timestamp,
        source: text(data.source) || 'learning',
        payload: {
          moduleId,
          attemptId,
          score,
          passed: data.passed === true,
          localDate: text(data.localDate),
          timezoneOffsetMinutes: context.timezoneOffsetMinutes
        }
      }));
    }

    function completeDailyChallenge(input) {
      const data = object(input);
      const dateKey = text(data.dateKey);
      const challengeId = text(data.challengeId);
      const selectedAction = text(data.selectedAction).toUpperCase();
      const correctAction = text(data.correctAction).toUpperCase();
      const scheduleVersion = Math.max(1, Math.floor(Number(data.scheduleVersion) || 1));
      const rewardVersion = Math.max(1, Math.floor(Number(data.rewardVersion) || 1));
      const id = dailyChallengeEventId({ dateKey, scheduleVersion, challengeId });
      const actions = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
      if (
        !id || typeof data.isCorrect !== 'boolean' || !selectedAction || !correctAction
        || !actions.has(selectedAction) || !actions.has(correctAction)
        || data.isCorrect !== (selectedAction === correctAction)
      ) return invalid();
      const context = eventContext();
      const timestamp = typeof data.completedAt === 'string' && Number.isFinite(Date.parse(data.completedAt))
        ? new Date(Date.parse(data.completedAt)).toISOString()
        : context.timestamp;
      return publish(system.recordEvent({
        id,
        type: 'DAILY_CHALLENGE_COMPLETED',
        timestamp,
        source: 'daily_challenge',
        payload: {
          dateKey,
          localDate: dateKey,
          timezoneOffsetMinutes: context.timezoneOffsetMinutes,
          challengeId,
          scheduleVersion,
          rewardVersion,
          outcome: data.isCorrect ? 'correct' : 'incorrect',
          isCorrect: data.isCorrect,
          selectedAction,
          correctAction,
          street: text(data.street).toLowerCase(),
          difficulty: text(data.difficulty)
        }
      }));
    }

    return Object.freeze({
      recordTrainingDecision,
      completeTrainingScenario,
      completeExam,
      completeDailyChallenge,
      destroy: unsubscribe
    });
  }

  const api = Object.freeze({ create, dailyChallengeEventId });
  root.PokerPilotProgressIntegration = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
