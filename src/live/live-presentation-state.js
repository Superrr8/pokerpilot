'use strict';

(function attachLivePresentationState(root) {
  const HERO_AWAITING = new Set(['hero-preflop', 'hero-postflop']);

  function isHeroTurn(state = {}) {
    return state.route === 'live'
      && state.gameVisible === true
      && state.canHeroAct === true
      && HERO_AWAITING.has(state.awaiting);
  }

  function apply(nodes = {}, active) {
    nodes.shell?.classList.toggle('is-live-hero-turn', active);
    nodes.game?.classList.toggle('is-hero-turn', active);
    nodes.decisionPanel?.classList.toggle('is-hero-turn', active);
    return active;
  }

  function sync(nodes, state) {
    return apply(nodes, isHeroTurn(state));
  }

  function clear(nodes) {
    return apply(nodes, false);
  }

  const api = Object.freeze({ isHeroTurn, sync, clear });
  root.PokerPilotLivePresentationState = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
