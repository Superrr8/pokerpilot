'use strict';

(function attachDailyChallengeProgress(root) {
  const Reward = root.PokerPilotDailyChallengeReward
    || (typeof require === 'function' ? require('./daily-challenge-reward.js') : null);
  const EVENT_TYPE = 'DAILY_CHALLENGE_COMPLETED';

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function eventId({ dateKey, scheduleVersion, challengeId } = {}) {
    const date = text(dateKey);
    const challenge = text(challengeId);
    const version = Math.max(1, Math.floor(Number(scheduleVersion) || 1));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !challenge) return null;
    return `daily_challenge:v${version}:${date}:${challenge}`;
  }

  function create({ storage, progressIntegration, getProgressSnapshot, now = () => new Date() } = {}) {
    if (!storage || typeof storage.getCompletion !== 'function' || typeof storage.saveProgress !== 'function') {
      throw new Error('Daily Challenge storage is required');
    }
    if (!progressIntegration || typeof progressIntegration.completeDailyChallenge !== 'function') {
      throw new Error('Daily Challenge progress integration is required');
    }
    const inFlight = new Set();

    function isoNow() {
      const value = typeof now === 'function' ? now() : now;
      const date = value instanceof Date ? value : new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString();
    }

    function pendingReceipt(dateKey, completion) {
      return {
        status: 'pending',
        eventId: eventId({ dateKey, ...completion }),
        rewardVersion: Reward.POLICY.version
      };
    }

    function recordedReceipt(dateKey, completion, result) {
      const xp = result?.applied === true
        ? Number(result.rewards?.xp)
        : Reward.xpForOutcome(completion.isCorrect, Reward.POLICY.version);
      return {
        status: 'recorded',
        eventId: eventId({ dateKey, ...completion }),
        rewardVersion: Reward.POLICY.version,
        xpAwarded: Math.max(0, Math.floor(Number(xp) || 0)),
        recordedAt: isoNow()
      };
    }

    function recordCompletionProgress(dateKey, completion, challenge) {
      const current = storage.getCompletion(dateKey) || completion;
      if (!current || !challenge || current.challengeId !== challenge.id) {
        return { recorded: false, pending: false, reason: 'INVALID_COMPLETION' };
      }
      if (current.progress?.status === 'recorded') {
        return { recorded: true, duplicate: true, completion: clone(current), reason: 'ALREADY_RECORDED' };
      }
      if (current.progress?.status === 'legacy_uncredited') {
        return { recorded: false, pending: false, legacy: true, completion: clone(current) };
      }
      const expectedEventId = eventId({ dateKey, ...current });
      if (!expectedEventId) return { recorded: false, pending: true, reason: 'INVALID_EVENT_ID' };
      if (inFlight.has(expectedEventId)) {
        return { recorded: false, pending: true, reason: 'IN_FLIGHT', completion: clone(current) };
      }
      storage.saveProgress(dateKey, pendingReceipt(dateKey, current));
      let result;
      inFlight.add(expectedEventId);
      try {
        result = progressIntegration.completeDailyChallenge({
          dateKey,
          challengeId: current.challengeId,
          scheduleVersion: current.scheduleVersion,
          rewardVersion: Reward.POLICY.version,
          selectedAction: current.selectedAction,
          correctAction: current.correctAction,
          isCorrect: current.isCorrect,
          completedAt: current.completedAt,
          street: challenge.street,
          difficulty: challenge.difficulty
        });
      } catch (_) {
        result = { applied: false, duplicate: false, reason: 'PROGRESS_UNAVAILABLE' };
      } finally {
        inFlight.delete(expectedEventId);
      }
      if (result?.applied === true || result?.duplicate === true || result?.reason === 'DUPLICATE_EVENT') {
        const saved = storage.saveProgress(dateKey, recordedReceipt(dateKey, current, result));
        return {
          recorded: saved.saved,
          pending: !saved.saved,
          duplicate: result?.duplicate === true || result?.reason === 'DUPLICATE_EVENT',
          progressResult: result,
          completion: clone(saved.completion || storage.getCompletion(dateKey))
        };
      }
      return {
        recorded: false,
        pending: true,
        reason: result?.reason || 'PROGRESS_UNAVAILABLE',
        progressResult: result,
        completion: clone(storage.getCompletion(dateKey))
      };
    }

    function reconcilePendingProgress(todayKey, challengeById, isScheduledChallenge = () => true) {
      const state = storage.load();
      let recorded = 0;
      let legacy = 0;
      let pending = 0;
      Object.entries(state.completions).forEach(([dateKey, completion]) => {
        const challenge = typeof challengeById === 'function' ? challengeById(completion.challengeId) : null;
        if (!challenge || isScheduledChallenge(dateKey, completion.challengeId, completion.scheduleVersion) !== true) return;
        if (completion.progress === null) {
          if (dateKey < todayKey) {
            if (storage.saveProgress(dateKey, { status: 'legacy_uncredited' }).saved) legacy += 1;
            return;
          }
          storage.saveProgress(dateKey, pendingReceipt(dateKey, completion));
        }
        const current = storage.getCompletion(dateKey);
        if (current?.progress?.status === 'pending') {
          const result = recordCompletionProgress(dateKey, current, challenge);
          if (result.recorded) recorded += 1;
          else pending += 1;
        }
      });
      return { recorded, legacy, pending };
    }

    function getCurrentStreak() {
      const snapshot = typeof getProgressSnapshot === 'function' ? getProgressSnapshot() : null;
      const value = Number(snapshot?.streak?.current);
      return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : null;
    }

    return Object.freeze({ recordCompletionProgress, reconcilePendingProgress, getCurrentStreak });
  }

  const api = Object.freeze({ EVENT_TYPE, eventId, create });
  root.PokerPilotDailyChallengeProgress = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
