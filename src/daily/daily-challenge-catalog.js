'use strict';

(function attachDailyChallengeCatalog(root) {
  const sourceScenarios = root.STUDY_SPOTS
    || (typeof require === 'function' ? require('../data/postflop-scenarios.js') : []);
  const DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'daily-river-aj-bluffcatch', source: 'river-aj-bluffcatch', difficulty: 'Продвинутая', stack: 190 }),
    Object.freeze({ id: 'daily-flop-kk-value', source: 'flop-kk-value', difficulty: 'Базовая', stack: 240 }),
    Object.freeze({ id: 'daily-turn-aq-nit', source: 'turn-aq-nit', difficulty: 'Продвинутая', stack: 220 }),
    Object.freeze({ id: 'daily-flop-nfd', source: 'flop-nfd', difficulty: 'Средняя', stack: 210 }),
    Object.freeze({ id: 'daily-flop-oesd', source: 'flop-oesd', difficulty: 'Средняя', stack: 195 }),
    Object.freeze({ id: 'daily-river-thin-value', source: 'river-thin-value', difficulty: 'Средняя', stack: 180 }),
    Object.freeze({ id: 'daily-turn-top-pair-control', source: 'turn-top-pair-control', difficulty: 'Продвинутая', stack: 195 }),
    Object.freeze({ id: 'daily-flop-set-wet', source: 'flop-set-wet', difficulty: 'Средняя', stack: 260, opponents: 2 }),
    Object.freeze({ id: 'daily-river-flush-value', source: 'river-flush-value', difficulty: 'Продвинутая', stack: 260 }),
    Object.freeze({ id: 'daily-turn-combo-draw', source: 'turn-combo-draw', difficulty: 'Продвинутая', stack: 145 })
  ]);
  const STREET = Object.freeze({ 'Префлоп': 'preflop', 'Флоп': 'flop', 'Тёрн': 'turn', 'Ривер': 'river' });
  const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
  const CARD_PATTERN = /^(?:[2-9TJQKA])[shdc]$/;

  function actionClass(value) {
    return String(value || '').toUpperCase().replace('-', '_').replace('ALLIN', 'ALL_IN');
  }

  function villainPosition(heroPosition) {
    if (heroPosition === 'BB') return 'BTN';
    if (heroPosition === 'BTN') return 'BB';
    return 'BTN';
  }

  function actionAmount(action, scenario) {
    if (action === 'CALL') return Number(scenario.bet) || null;
    if (action === 'BET') return Number(scenario.betSize) || null;
    if (action === 'RAISE') return Number(scenario.raiseSize) || null;
    if (action === 'ALL_IN') return Number(scenario.bet) || null;
    return null;
  }

  function createChallenge(definition) {
    const scenario = sourceScenarios.find(item => item.id === definition.source);
    if (!scenario) return null;
    const actions = scenario.actions.map(value => {
      const normalized = actionClass(value);
      return Object.freeze({
        actionClass: normalized,
        amount: actionAmount(normalized, scenario),
        amountUnit: normalized === 'RAISE' ? 'TOTAL' : 'ADDITIONAL'
      });
    });
    const correctAction = actionClass(Object.entries(scenario.grades)
      .find(([, grade]) => grade === 'best')?.[0]);
    const acceptedActions = Object.entries(scenario.grades)
      .filter(([, grade]) => grade === 'best' || grade === 'good')
      .map(([action]) => actionClass(action));
    return Object.freeze({
      id: definition.id,
      version: 1,
      title: scenario.title,
      shortTitle: scenario.category,
      difficulty: definition.difficulty,
      street: STREET[scenario.category] || 'flop',
      heroCards: Object.freeze([...scenario.hero]),
      board: Object.freeze([...scenario.board]),
      position: scenario.position,
      villainPosition: villainPosition(scenario.position),
      pot: Number(scenario.potBefore) || 0,
      amountToCall: Number(scenario.bet) || 0,
      effectiveStack: definition.stack,
      opponentCount: definition.opponents || 1,
      opponentType: scenario.villain,
      context: scenario.text,
      actions: Object.freeze(actions),
      correctAction,
      acceptedActions: Object.freeze(acceptedActions),
      explanation: `${scenario.summary} ${scenario.key}`,
      conceptTags: Object.freeze([scenario.category.toLowerCase(), scenario.villain]),
      sourceScenarioId: scenario.id
    });
  }

  const CATALOG = Object.freeze(DEFINITIONS.map(createChallenge).filter(Boolean));

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function list() {
    return clone(CATALOG);
  }

  function getById(id) {
    return clone(CATALOG.find(challenge => challenge.id === id) || null);
  }

  function validateCatalog() {
    const errors = [];
    const ids = new Set();
    const boardLength = { preflop: 0, flop: 3, turn: 4, river: 5 };
    CATALOG.forEach(challenge => {
      if (ids.has(challenge.id)) errors.push(`${challenge.id}:duplicate-id`);
      ids.add(challenge.id);
      const cards = [...challenge.heroCards, ...challenge.board];
      if (!cards.every(card => CARD_PATTERN.test(card))) errors.push(`${challenge.id}:invalid-card`);
      if (new Set(cards).size !== cards.length) errors.push(`${challenge.id}:duplicate-card`);
      if (challenge.board.length !== boardLength[challenge.street]) errors.push(`${challenge.id}:board-street`);
      if (!challenge.actions.some(action => action.actionClass === challenge.correctAction)) errors.push(`${challenge.id}:correct-action`);
      if (!challenge.explanation) errors.push(`${challenge.id}:explanation`);
      if (!challenge.actions.every(action => ACTIONS.has(action.actionClass))) errors.push(`${challenge.id}:actions`);
      if (![challenge.pot, challenge.amountToCall].every(value => Number.isFinite(value) && value >= 0)) errors.push(`${challenge.id}:money`);
      if (!Number.isFinite(challenge.effectiveStack) || challenge.effectiveStack <= 0) errors.push(`${challenge.id}:stack`);
    });
    return { valid: errors.length === 0, errors };
  }

  const api = Object.freeze({ VERSION: 1, list, getById, validateCatalog });
  root.PokerPilotDailyChallengeCatalog = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
