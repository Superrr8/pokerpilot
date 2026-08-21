'use strict';

(function attachLivePresentationState(root) {
  const HERO_AWAITING = new Set(['hero-preflop', 'hero-postflop']);
  const POSTFLOP_STREETS = new Set(['flop', 'turn', 'river']);

  function getHeroActionOptions({ street = null, toCall = 0 } = {}) {
    const facingAction = Number(toCall) > 0;
    if (street === 'preflop') {
      return Object.freeze(facingAction
        ? ['fold', 'call', 'raise']
        : ['check', 'raise']);
    }
    if (POSTFLOP_STREETS.has(street)) {
      return Object.freeze(facingAction
        ? ['fold', 'call', 'raise']
        : ['check', 'bet', 'allin']);
    }
    return Object.freeze([]);
  }

  function deriveHeroDecision(state = {}) {
    const flowCanHeroAct = state.flowCanHeroAct ?? state.canHeroAct;
    const flowPhase = state.flowPhase ?? (flowCanHeroAct === true ? 'playing' : 'idle');
    const street = state.street ?? 'preflop';
    const availableOptions = getHeroActionOptions({ street, toCall: state.toCall });
    const heroCanAct = flowCanHeroAct === true
      && flowPhase === 'playing'
      && state.heroFolded !== true
      && HERO_AWAITING.has(state.awaiting)
      && availableOptions.length > 0;
    const controlsAvailable = heroCanAct
      && state.route === 'live'
      && state.gameVisible === true;
    const actionOptions = controlsAvailable ? availableOptions : Object.freeze([]);
    return Object.freeze({
      heroTurn: heroCanAct,
      heroCanAct,
      controlsAvailable,
      compact: controlsAvailable,
      actionOptions
    });
  }

  function isHeroTurn(state = {}) {
    return deriveHeroDecision(state).compact;
  }

  function apply(nodes = {}, active) {
    nodes.shell?.classList.toggle('is-live-hero-turn', active);
    nodes.game?.classList.toggle('is-hero-turn', active);
    nodes.decisionPanel?.classList.toggle('is-hero-turn', active);
    return active;
  }

  function setDiagnostic(game, name, value) {
    if (game?.dataset) game.dataset[name] = String(value);
  }

  function syncDiagnostics(game, decision, diagnostics = {}) {
    setDiagnostic(game, 'liveHeroTurn', decision.heroTurn);
    setDiagnostic(game, 'liveHeroCanAct', decision.heroCanAct);
    setDiagnostic(game, 'liveActionsVisible', diagnostics.actionsVisible === true);
    setDiagnostic(game, 'liveCompact', decision.compact);
    setDiagnostic(game, 'liveCurrentActor', diagnostics.currentActor ?? (decision.heroCanAct ? 'hero' : 'none'));
    setDiagnostic(game, 'liveHeroSeat', diagnostics.heroSeat ?? 'none');
    setDiagnostic(game, 'liveStreet', diagnostics.street ?? 'none');
  }

  function sync(nodes, state, diagnostics = {}) {
    const decision = typeof state?.compact === 'boolean'
      && typeof state?.heroCanAct === 'boolean'
      && Array.isArray(state?.actionOptions)
      ? state
      : deriveHeroDecision(state);
    apply(nodes, decision.compact);
    syncDiagnostics(nodes?.game, decision, diagnostics);
    return decision.compact;
  }

  function clear(nodes) {
    apply(nodes, false);
    syncDiagnostics(nodes?.game, Object.freeze({
      heroTurn: false,
      heroCanAct: false,
      compact: false
    }));
    return false;
  }

  const api = Object.freeze({
    getHeroActionOptions,
    deriveHeroDecision,
    isHeroTurn,
    sync,
    clear
  });
  root.PokerPilotLivePresentationState = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
