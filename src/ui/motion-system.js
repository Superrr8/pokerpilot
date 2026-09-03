'use strict';

(function attachMotionSystem(root) {
  const EVENTS = Object.freeze({
    NAVIGATION: 'navigation',
    PROGRESS: 'progress',
    DAILY_STATE: 'daily-state',
    CORRECT: 'correct',
    INCORRECT: 'incorrect',
    CARD_DEAL: 'card-deal',
    CHIP: 'chip',
    FOLD: 'fold',
    CALL: 'call',
    RAISE: 'raise',
    REWARD: 'reward'
  });

  const TRANSIENT_CLASSES = Object.freeze([
    'is-motion-entering',
    'is-motion-emphasis'
  ]);

  function createMotionSystem({
    documentRef = root.document,
    mediaQuery = query => root.matchMedia?.(query),
    setTimeoutFn = root.setTimeout?.bind(root),
    clearTimeoutFn = root.clearTimeout?.bind(root)
  } = {}) {
    const active = new Map();
    const values = new WeakMap();

    function prefersReducedMotion() {
      return Boolean(mediaQuery?.('(prefers-reduced-motion: reduce)')?.matches);
    }

    function settle(element) {
      if (!element) return false;
      const state = active.get(element);
      if (state?.timer !== undefined) clearTimeoutFn?.(state.timer);
      if (state?.onEnd) element.removeEventListener?.('animationend', state.onEnd);
      TRANSIENT_CLASSES.forEach(className => element.classList?.remove(className));
      if (element.dataset) delete element.dataset.motionEvent;
      active.delete(element);
      return Boolean(state);
    }

    function start(element, className, eventName, durationMs) {
      if (!element) return false;
      settle(element);
      if (prefersReducedMotion()) return false;
      const onEnd = event => {
        if (event?.target && event.target !== element) return;
        settle(element);
      };
      element.dataset.motionEvent = eventName;
      element.classList.add(className);
      element.addEventListener?.('animationend', onEnd);
      const timer = setTimeoutFn?.(() => settle(element), durationMs);
      active.set(element, { className, onEnd, timer });
      return true;
    }

    function enterView(element, eventName = EVENTS.NAVIGATION) {
      const entering = documentRef?.querySelectorAll?.('.is-motion-entering') || [];
      Array.from(entering).forEach(current => {
        if (current !== element) settle(current);
      });
      return start(element, 'is-motion-entering', eventName, 420);
    }

    function emphasize(element, eventName = EVENTS.REWARD) {
      return start(element, 'is-motion-emphasis', eventName, 380);
    }

    function trackValue(element, value, eventName = EVENTS.PROGRESS) {
      if (!element) return false;
      const nextValue = String(value ?? '');
      if (!values.has(element)) {
        values.set(element, nextValue);
        return false;
      }
      if (values.get(element) === nextValue) return false;
      values.set(element, nextValue);
      return emphasize(element, eventName);
    }

    function settleAll() {
      Array.from(active.keys()).forEach(settle);
    }

    return Object.freeze({
      events: EVENTS,
      prefersReducedMotion,
      enterView,
      emphasize,
      trackValue,
      settle,
      settleAll
    });
  }

  const api = Object.freeze({ EVENTS, createMotionSystem });
  root.PokerPilotMotion = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
