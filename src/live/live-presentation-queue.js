'use strict';

(function attachLivePresentationQueue(root) {
  const LIVE_MOTION = root.PokerPilotLiveMotion?.LIVE_TIMING || {
    dealCardMs: 160,
    dealGapMs: 55,
    boardRevealMs: 260,
    boardGapMs: 80,
    chipTravelMs: 260,
    winnerGlowMs: 1000
  };
  const REDUCED_LIVE_MOTION = root.PokerPilotLiveMotion?.REDUCED_TIMING || {
    dealCardMs: 60,
    dealGapMs: 20,
    boardRevealMs: 60,
    boardGapMs: 25,
    chipTravelMs: 60,
    winnerGlowMs: 80
  };
  const DEFAULT_PACING = Object.freeze({
    dealCardMs: LIVE_MOTION.dealCardMs,
    dealGapMs: LIVE_MOTION.dealGapMs,
    aiThinkMinMs: 560,
    aiThinkMaxMs: 820,
    actionBadgeHoldMs: 260,
    actionBadgeExitMs: 140,
    afterCheckPauseMs: 480,
    afterFoldPauseMs: 500,
    chipMoveMs: LIVE_MOTION.chipTravelMs,
    afterBetPauseMs: 500,
    streetTransitionPauseMs: 760,
    cardRevealGapMs: LIVE_MOTION.boardGapMs,
    showdownRevealGapMs: 620,
    winnerDisplayMs: 1900,
    nextHandDelayMs: 2200
  });

  const REDUCED_MOTION_PACING = Object.freeze({
    dealCardMs: REDUCED_LIVE_MOTION.dealCardMs,
    dealGapMs: REDUCED_LIVE_MOTION.dealGapMs,
    aiThinkMinMs: 80,
    aiThinkMaxMs: 110,
    actionBadgeHoldMs: 160,
    actionBadgeExitMs: 50,
    afterCheckPauseMs: 160,
    afterFoldPauseMs: 160,
    chipMoveMs: REDUCED_LIVE_MOTION.chipTravelMs,
    afterBetPauseMs: 140,
    streetTransitionPauseMs: 180,
    cardRevealGapMs: REDUCED_LIVE_MOTION.boardGapMs,
    showdownRevealGapMs: 180,
    winnerDisplayMs: 420,
    nextHandDelayMs: 650
  });

  const ZERO_DURATION_PACING = Object.freeze(
    Object.fromEntries(Object.keys(DEFAULT_PACING).map(key => [key, 0]))
  );

  const MONEY_ACTIONS = new Set(['CALL', 'BET', 'RAISE', 'ALL_IN']);

  function normalizePacing(pacing = {}) {
    return Object.freeze(Object.fromEntries(
      Object.entries(DEFAULT_PACING).map(([key, fallback]) => {
        const value = Number(pacing[key]);
        return [key, Number.isFinite(value) && value >= 0 ? value : fallback];
      })
    ));
  }

  function showdownPlayerIds(players) {
    return (Array.isArray(players) ? players : [])
      .filter(player => player && !player.folded && player.reachedShowdown !== false)
      .map(player => player.id);
  }

  function create({
    pacing = DEFAULT_PACING,
    setTimeoutFn = root.setTimeout.bind(root),
    clearTimeoutFn = root.clearTimeout.bind(root),
    nowFn = Date.now,
    onPhase = () => {}
  } = {}) {
    const config = normalizePacing(pacing);
    const steps = [];
    let state = {
      phase: 'idle',
      handToken: 0,
      activePlayerId: null,
      currentPhase: null,
      pendingSteps: 0,
      paused: false
    };
    let activeStep = null;
    let timerId = null;
    let dueAt = 0;
    let remaining = 0;
    let nextGroupId = 1;

    function syncState() {
      state.pendingSteps = steps.length + (activeStep ? 1 : 0);
      state.currentPhase = activeStep?.phase || null;
      state.activePlayerId = activeStep?.playerId ?? null;
    }

    function clearTimer() {
      if (timerId != null) clearTimeoutFn(timerId);
      timerId = null;
    }

    function cancel() {
      clearTimer();
      steps.length = 0;
      activeStep = null;
      dueAt = 0;
      remaining = 0;
      syncState();
      return true;
    }

    function durationOf(step) {
      const value = typeof step.duration === 'function' ? step.duration() : step.duration;
      return Math.max(0, Number(value) || 0);
    }

    function emit(step) {
      onPhase({
        phase: step.phase,
        playerId: step.playerId ?? null,
        street: step.street ?? null,
        index: step.index ?? null,
        token: step.token
      });
    }

    function finishActiveStep() {
      timerId = null;
      activeStep = null;
      dueAt = 0;
      remaining = 0;
      syncState();
      pump();
    }

    function armActiveStep(delay) {
      remaining = Math.max(0, Number(delay) || 0);
      if (remaining === 0) {
        finishActiveStep();
        return;
      }
      dueAt = nowFn() + remaining;
      timerId = setTimeoutFn(() => {
        if (!activeStep || activeStep.token !== state.handToken || state.paused) return;
        finishActiveStep();
      }, remaining);
    }

    function pump() {
      if (state.paused || state.phase === 'exited' || activeStep) return;
      while (steps.length) {
        const next = steps.shift();
        if (next.token !== state.handToken) continue;
        if (typeof next.when === 'function' && !next.when()) continue;
        activeStep = next;
        syncState();
        emit(next);
        if (typeof next.run === 'function') next.run();
        armActiveStep(durationOf(next));
        return;
      }
      syncState();
      onPhase({
        phase: 'idle',
        playerId: null,
        street: null,
        index: null,
        token: state.handToken
      });
    }

    function enqueue(groupSteps, { token = state.handToken } = {}) {
      if (
        token !== state.handToken ||
        state.phase === 'idle' ||
        state.phase === 'exited'
      ) return false;
      const groupId = nextGroupId++;
      (Array.isArray(groupSteps) ? groupSteps : []).forEach(step => {
        steps.push({ ...step, groupId, token });
      });
      syncState();
      pump();
      return groupId;
    }

    function thinkingDelay(playerId) {
      const min = config.aiThinkMinMs;
      const max = Math.max(min, config.aiThinkMaxMs);
      if (max === min) return min;
      const span = max - min + 1;
      return min + Math.abs((state.handToken * 31 + Number(playerId || 0) * 17 + nextGroupId * 13) % span);
    }

    function playAction({
      token = state.handToken,
      playerId,
      perform = () => ({ type: 'CHECK' }),
      onChipMove = () => {},
      onFoldVisual = () => {},
      onBadgeExit = () => {},
      onComplete = () => {},
      thinkMs
    } = {}) {
      let action = null;
      const actionType = () => String(action?.type || '').toUpperCase();
      const isMoneyAction = () => MONEY_ACTIONS.has(actionType());
      const isFold = () => actionType() === 'FOLD';
      const isCheck = () => actionType() === 'CHECK';
      return enqueue([
        {
          phase: 'thinking',
          playerId,
          duration: thinkMs == null ? thinkingDelay(playerId) : thinkMs
        },
        {
          phase: 'action',
          playerId,
          run: () => { action = perform() || { type: 'CHECK' }; },
          duration: config.actionBadgeHoldMs
        },
        {
          phase: 'chip-move',
          playerId,
          when: isMoneyAction,
          run: () => onChipMove(action),
          duration: config.chipMoveMs
        },
        {
          phase: 'fold-visual',
          playerId,
          when: isFold,
          run: () => onFoldVisual(action),
          duration: config.afterFoldPauseMs
        },
        {
          phase: 'reading',
          playerId,
          when: () => !isFold(),
          duration: () => isCheck() ? config.afterCheckPauseMs : config.afterBetPauseMs
        },
        {
          phase: 'action-exit',
          playerId,
          when: () => !isFold(),
          run: () => onBadgeExit(action),
          duration: config.actionBadgeExitMs
        },
        {
          phase: 'action-complete',
          playerId,
          run: () => onComplete(action),
          duration: 0
        }
      ], { token });
    }

    function playDeal({
      token = state.handToken,
      cardCount = 0,
      onStart = () => {},
      onComplete = () => {}
    } = {}) {
      const count = Math.max(0, Math.floor(Number(cardCount) || 0));
      const duration = count
        ? config.dealCardMs + Math.max(0, count - 1) * config.dealGapMs
        : 0;
      return enqueue([
        {
          phase: 'deal-cards',
          run: onStart,
          duration
        },
        {
          phase: 'deal-complete',
          run: onComplete,
          duration: 0
        }
      ], { token });
    }

    function playStreetTransition({
      token = state.handToken,
      street,
      cardCount = 1,
      onCollect = () => {},
      onCollected = () => {},
      onReveal = () => {},
      onComplete = () => {}
    } = {}) {
      const revealSteps = Array.from({ length: Math.max(0, cardCount) }, (_, index) => ({
        phase: 'reveal-card',
        street,
        index,
        run: () => onReveal(index),
        duration: config.cardRevealGapMs
      }));
      return enqueue([
        {
          phase: 'collect-bets',
          street,
          run: onCollect,
          duration: config.streetTransitionPauseMs
        },
        {
          phase: 'bets-collected',
          street,
          run: onCollected,
          duration: 0
        },
        ...revealSteps,
        {
          phase: 'street-ready',
          street,
          run: onComplete,
          duration: 0
        }
      ], { token });
    }

    function playShowdown({
      token = state.handToken,
      playerIds = [],
      wonWithoutShowdown = false,
      onCollect = () => {},
      onCollected = () => {},
      onReveal = () => {},
      onWinner = () => {},
      onComplete = () => {}
    } = {}) {
      const revealSteps = wonWithoutShowdown ? [] : playerIds.map((playerId, index) => ({
        phase: 'showdown-reveal',
        playerId,
        index,
        run: () => onReveal(playerId, index),
        duration: config.showdownRevealGapMs
      }));
      return enqueue([
        {
          phase: 'showdown-collect',
          street: 'showdown',
          run: onCollect,
          duration: config.streetTransitionPauseMs
        },
        {
          phase: 'showdown-collected',
          street: 'showdown',
          run: onCollected,
          duration: 0
        },
        ...revealSteps,
        {
          phase: 'winner',
          street: 'showdown',
          run: onWinner,
          duration: config.winnerDisplayMs
        },
        {
          phase: 'showdown-complete',
          street: 'showdown',
          run: onComplete,
          duration: 0
        }
      ], { token });
    }

    function startHand(token) {
      cancel();
      state.phase = 'playing';
      state.handToken = Number(token) || state.handToken + 1;
      state.paused = false;
      syncState();
      return state.handToken;
    }

    function pause() {
      if (state.paused || state.phase === 'idle' || state.phase === 'exited') return false;
      if (activeStep && timerId != null) {
        remaining = Math.max(0, dueAt - nowFn());
        clearTimer();
      }
      state.paused = true;
      state.phase = 'paused';
      syncState();
      return true;
    }

    function resume() {
      if (!state.paused || state.phase === 'exited') return false;
      state.paused = false;
      state.phase = 'playing';
      if (activeStep) armActiveStep(remaining);
      else pump();
      return true;
    }

    function exit() {
      cancel();
      state.phase = 'exited';
      state.paused = false;
      syncState();
      return true;
    }

    function getState() {
      syncState();
      return { ...state };
    }

    return Object.freeze({
      config,
      startHand,
      enqueue,
      playDeal,
      playAction,
      playStreetTransition,
      playShowdown,
      pause,
      resume,
      cancel,
      exit,
      getState
    });
  }

  const api = Object.freeze({
    DEFAULT_PACING,
    REDUCED_MOTION_PACING,
    ZERO_DURATION_PACING,
    normalizePacing,
    showdownPlayerIds,
    create
  });

  root.PokerPilotLivePresentation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
