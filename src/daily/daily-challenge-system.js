'use strict';

(function attachDailyChallengeSystem(root) {
  const DateUtils = root.PokerPilotDailyDate
    || (typeof require === 'function' ? require('./daily-date.js') : null);
  const Catalog = root.PokerPilotDailyChallengeCatalog
    || (typeof require === 'function' ? require('./daily-challenge-catalog.js') : null);
  const Schedule = root.PokerPilotDailyChallengeSchedule
    || (typeof require === 'function' ? require('./daily-challenge-schedule.js') : null);
  const Storage = root.PokerPilotDailyChallengeStorage
    || (typeof require === 'function' ? require('./daily-challenge-storage.js') : null);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function publicChallenge(challenge) {
    if (!challenge) return null;
    const { correctAction, acceptedActions, explanation, ...visible } = challenge;
    return clone(visible);
  }

  function create({ storage = Storage.create(), progress = null, now = () => new Date() } = {}) {
    function todayDate() {
      const value = typeof now === 'function' ? now() : now;
      return value instanceof Date ? new Date(value.getTime()) : new Date(value);
    }

    function selection() {
      const dateKey = DateUtils.localDateKey(todayDate());
      return dateKey ? Schedule.selectForDate(dateKey) : { status: 'unavailable', dateKey: null, reason: 'INVALID_DATE' };
    }

    function getTodayChallenge() {
      const selected = selection();
      return selected.status === 'available' ? Catalog.getById(selected.challengeId) : null;
    }

    function reviewState(challenge, completion) {
      return {
        readOnly: true,
        selectedAction: completion.selectedAction,
        correctAction: completion.correctAction,
        isCorrect: completion.isCorrect,
        completedAt: completion.completedAt,
        explanation: challenge.explanation,
        progressStatus: completion.progress?.status || null,
        xpAwarded: completion.progress?.status === 'recorded'
          ? Number(completion.progress.xpAwarded)
          : null,
        streak: typeof progress?.getCurrentStreak === 'function' ? progress.getCurrentStreak() : null
      };
    }

    function reconcileProgress() {
      const selected = selection();
      if (selected.status !== 'available' || typeof progress?.reconcilePendingProgress !== 'function') {
        return { recorded: 0, legacy: 0, pending: 0 };
      }
      return progress.reconcilePendingProgress(
        selected.dateKey,
        id => Catalog.getById(id),
        (dateKey, challengeId, scheduleVersion) => {
          const scheduled = Schedule.selectForDate(dateKey);
          return scheduled.status === 'available'
            && scheduled.challengeId === challengeId
            && scheduled.scheduleVersion === scheduleVersion;
        }
      );
    }

    function getTodayStatus() {
      const selected = selection();
      if (selected.status !== 'available') return selected;
      reconcileProgress();
      const challenge = Catalog.getById(selected.challengeId);
      if (!challenge) return { ...selected, status: 'unavailable', reason: 'UNKNOWN_CHALLENGE' };
      const completion = storage.getCompletion(selected.dateKey);
      if (!completion) return { ...selected, status: 'new', challenge: publicChallenge(challenge) };
      if (completion.challengeId !== selected.challengeId) {
        return { ...selected, status: 'unavailable', reason: 'COMPLETION_MISMATCH' };
      }
      return {
        ...selected,
        status: 'completed',
        challenge: publicChallenge(challenge),
        completion: clone(completion),
        review: reviewState(challenge, completion)
      };
    }

    function submitAnswer(value) {
      const selected = selection();
      const challenge = selected.status === 'available' ? Catalog.getById(selected.challengeId) : null;
      if (!challenge) return { accepted: false, duplicate: false, reason: 'UNAVAILABLE' };
      const action = String(value || '').toUpperCase().replace('-', '_');
      if (!challenge.actions.some(option => option.actionClass === action)) {
        return { accepted: false, duplicate: false, reason: 'INVALID_ACTION' };
      }
      const existing = storage.getCompletion(selected.dateKey);
      if (existing) {
        return { accepted: false, duplicate: true, reason: 'ALREADY_COMPLETED', completion: clone(existing) };
      }
      const currentDate = todayDate();
      const completion = {
        challengeId: challenge.id,
        scheduleVersion: selected.scheduleVersion,
        selectedAction: action,
        correctAction: challenge.correctAction,
        isCorrect: action === challenge.correctAction,
        completedAt: Number.isFinite(currentDate.getTime()) ? currentDate.toISOString() : new Date(0).toISOString(),
        progress: progress ? { status: 'pending' } : null
      };
      const saved = storage.saveCompletion(selected.dateKey, completion);
      if (!saved.saved) {
        return {
          accepted: false,
          duplicate: Boolean(saved.duplicate),
          reason: saved.reason || 'ALREADY_COMPLETED',
          completion: clone(saved.completion)
        };
      }
      let finalCompletion = saved.completion;
      let progressResult = null;
      if (typeof progress?.recordCompletionProgress === 'function') {
        progressResult = progress.recordCompletionProgress(selected.dateKey, saved.completion, challenge);
        finalCompletion = storage.getCompletion(selected.dateKey) || saved.completion;
      }
      return {
        accepted: true,
        duplicate: false,
        reason: 'COMPLETED',
        completion: clone(finalCompletion),
        progressResult: clone(progressResult),
        review: reviewState(challenge, finalCompletion)
      };
    }

    function getStoredCompletion(dateKey = selection().dateKey) {
      return dateKey ? storage.getCompletion(dateKey) : null;
    }

    function getReviewState() {
      const status = getTodayStatus();
      return status.status === 'completed' ? clone(status.review) : null;
    }

    return Object.freeze({
      getTodayChallenge, getTodayStatus, submitAnswer, getStoredCompletion, getReviewState, reconcileProgress
    });
  }

  const api = Object.freeze({ create, publicChallenge });
  root.PokerPilotDailyChallengeSystem = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
