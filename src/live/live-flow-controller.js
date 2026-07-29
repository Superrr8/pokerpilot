'use strict';

(function attachLiveFlowController(root) {
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function immutableSnapshot(value) {
    return deepFreeze(JSON.parse(JSON.stringify(value)));
  }

  function canRevealHoleCards({
    folded = false,
    reachedShowdown = false
  } = {}) {
    return !folded && reachedShowdown;
  }

  function nextStreet(street) {
    return ({
      preflop: 'flop',
      flop: 'turn',
      turn: 'river',
      river: 'showdown'
    })[street] || null;
  }

  function create({
    setTimeoutFn = root.setTimeout.bind(root),
    clearTimeoutFn = root.clearTimeout.bind(root),
    nowFn = Date.now,
    onAutoNext = () => {}
  } = {}) {
    let state = {
      phase: 'idle',
      heroState: 'active',
      activePlayerId: null,
      handToken: 0,
      pendingTimers: 0,
      autoNextScheduled: false
    };
    let lastCompletedHand = null;
    let completedToken = null;
    let pausedFrom = null;
    let nextTaskId = 1;
    const tasks = new Map();

    function syncPendingState() {
      state.pendingTimers = tasks.size;
      state.autoNextScheduled = [...tasks.values()].some(task => task.kind === 'auto-next');
    }

    function clearTask(task) {
      if (task.nativeId != null) clearTimeoutFn(task.nativeId);
      task.nativeId = null;
    }

    function cancelAll() {
      tasks.forEach(clearTask);
      tasks.clear();
      state.activePlayerId = null;
      syncPendingState();
    }

    function armTask(task, delay) {
      task.remaining = Math.max(0, Number(delay) || 0);
      task.dueAt = nowFn() + task.remaining;
      task.nativeId = setTimeoutFn(() => {
        if (!tasks.has(task.id)) return;
        tasks.delete(task.id);
        task.nativeId = null;
        syncPendingState();
        if (
          task.token !== state.handToken ||
          state.phase === 'paused' ||
          state.phase === 'exited'
        ) return;
        if (task.kind === 'ai') state.activePlayerId = null;
        task.callback(task.token);
      }, task.remaining);
    }

    function schedule(kind, playerId, callback, delay) {
      if (
        state.phase === 'idle' ||
        state.phase === 'paused' ||
        state.phase === 'exited'
      ) return null;
      const task = {
        id: nextTaskId++,
        kind,
        playerId,
        callback,
        token: state.handToken,
        nativeId: null,
        remaining: Math.max(0, Number(delay) || 0),
        dueAt: 0
      };
      tasks.set(task.id, task);
      if (kind === 'ai') state.activePlayerId = playerId;
      armTask(task, task.remaining);
      syncPendingState();
      return task.id;
    }

    function startHand() {
      cancelAll();
      state = {
        phase: 'playing',
        heroState: 'active',
        activePlayerId: null,
        handToken: state.handToken + 1,
        pendingTimers: 0,
        autoNextScheduled: false
      };
      completedToken = null;
      pausedFrom = null;
      return state.handToken;
    }

    function foldHero(activeOpponentCount) {
      if (state.phase !== 'playing') {
        return { continues: false, phase: state.phase };
      }
      state.heroState = 'folded';
      const continues = Number(activeOpponentCount) >= 2;
      if (continues) state.phase = 'observing';
      return { continues, phase: state.phase };
    }

    function canHeroAct() {
      return state.phase === 'playing' && state.heroState === 'active';
    }

    function scheduleAi(playerId, callback, delay = 320) {
      if (!['playing', 'observing'].includes(state.phase)) return null;
      return schedule('ai', playerId, callback, delay);
    }

    function scheduleUi(callback, delay = 0) {
      return schedule('ui', null, callback, delay);
    }

    function completeHand(snapshot, { autoDelay = 1600 } = {}) {
      if (
        !snapshot ||
        state.phase === 'idle' ||
        state.phase === 'exited' ||
        completedToken === state.handToken
      ) return false;
      cancelAll();
      lastCompletedHand = immutableSnapshot(snapshot);
      completedToken = state.handToken;
      state.phase = 'completed';
      state.activePlayerId = null;
      schedule('auto-next', null, token => onAutoNext(token), autoDelay);
      return true;
    }

    function pause() {
      if (state.phase === 'paused' || state.phase === 'exited' || state.phase === 'idle') {
        return false;
      }
      pausedFrom = state.phase;
      const currentTime = nowFn();
      tasks.forEach(task => {
        task.remaining = Math.max(0, task.dueAt - currentTime);
        clearTask(task);
      });
      state.phase = 'paused';
      state.activePlayerId = null;
      syncPendingState();
      return true;
    }

    function resume() {
      if (state.phase !== 'paused') return false;
      state.phase = pausedFrom || 'playing';
      pausedFrom = null;
      tasks.forEach(task => {
        if (task.kind === 'ai' && state.activePlayerId == null) {
          state.activePlayerId = task.playerId;
        }
        armTask(task, task.remaining);
      });
      syncPendingState();
      return true;
    }

    function exit() {
      cancelAll();
      pausedFrom = null;
      state.phase = 'exited';
      state.heroState = 'inactive';
      return true;
    }

    function getState() {
      syncPendingState();
      return { ...state };
    }

    return Object.freeze({
      startHand,
      foldHero,
      canHeroAct,
      scheduleAi,
      scheduleUi,
      completeHand,
      pause,
      resume,
      exit,
      cancelAll,
      getState,
      getLastCompletedHand: () => lastCompletedHand
    });
  }

  const api = Object.freeze({
    create,
    canRevealHoleCards,
    immutableSnapshot,
    nextStreet
  });

  root.PokerPilotLiveFlow = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
