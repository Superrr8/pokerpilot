'use strict';

(function attachDailyChallengeReward(root) {
  const POLICY = Object.freeze({
    version: 1,
    correctXp: 25,
    incorrectXp: 10
  });

  function xpForOutcome(isCorrect, version = POLICY.version) {
    if (Number(version) !== POLICY.version || typeof isCorrect !== 'boolean') return null;
    return isCorrect ? POLICY.correctXp : POLICY.incorrectXp;
  }

  const api = Object.freeze({ POLICY, xpForOutcome });
  root.PokerPilotDailyChallengeReward = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
