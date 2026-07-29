'use strict';

(function attachLiveMotion(root) {
  const PRESETS = Object.freeze({
    FAST: Object.freeze({
      durationMs: 160,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    }),
    NORMAL: Object.freeze({
      durationMs: 260,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    }),
    SLOW: Object.freeze({
      durationMs: 1000,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
    })
  });

  const LIVE_TIMING = Object.freeze({
    dealCardMs: PRESETS.FAST.durationMs,
    dealGapMs: 55,
    boardRevealMs: PRESETS.NORMAL.durationMs,
    boardGapMs: 80,
    chipTravelMs: PRESETS.NORMAL.durationMs,
    winnerGlowMs: PRESETS.SLOW.durationMs
  });

  const REDUCED_TIMING = Object.freeze({
    dealCardMs: 60,
    dealGapMs: 20,
    boardRevealMs: 60,
    boardGapMs: 25,
    chipTravelMs: 60,
    winnerGlowMs: 80
  });

  function createDealSequence(cardCount, timing = LIVE_TIMING) {
    const count = Math.max(0, Math.floor(Number(cardCount) || 0));
    const gapMs = Math.max(0, Number(timing.dealGapMs) || 0);
    const durationMs = Math.max(0, Number(timing.dealCardMs) || 0);
    return Array.from({ length: count }, (_, index) => {
      const atMs = index * gapMs;
      return Object.freeze({
        index,
        atMs,
        durationMs,
        endsAtMs: atMs + durationMs
      });
    });
  }

  function getMotionProfile(reducedMotion = false) {
    const timing = reducedMotion ? REDUCED_TIMING : LIVE_TIMING;
    return Object.freeze({
      reducedMotion: Boolean(reducedMotion),
      fade: true,
      flight: !reducedMotion,
      scale: !reducedMotion,
      durationMs: reducedMotion ? REDUCED_TIMING.winnerGlowMs : PRESETS.NORMAL.durationMs,
      timing
    });
  }

  function createMotionLedger({ maxEntries = 512 } = {}) {
    const seen = new Set();
    const order = [];
    let handToken = '';

    function startHand(token) {
      handToken = String(token ?? '');
      seen.clear();
      order.length = 0;
      return handToken;
    }

    function consume(kind, eventId, token = handToken) {
      const normalizedToken = String(token ?? '');
      if (!normalizedToken || normalizedToken !== handToken) return false;
      const key = `${normalizedToken}:${String(kind || 'motion')}:${String(eventId || '')}`;
      if (!eventId || seen.has(key)) return false;
      seen.add(key);
      order.push(key);
      while (order.length > maxEntries) seen.delete(order.shift());
      return true;
    }

    function getState() {
      return Object.freeze({
        handToken,
        consumed: seen.size
      });
    }

    return Object.freeze({
      startHand,
      consume,
      getState
    });
  }

  const api = Object.freeze({
    PRESETS,
    LIVE_TIMING,
    REDUCED_TIMING,
    createDealSequence,
    getMotionProfile,
    createMotionLedger
  });

  root.PokerPilotLiveMotion = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
