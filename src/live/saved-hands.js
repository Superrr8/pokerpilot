'use strict';

(function attachSavedHands(root) {
  const SCHEMA_VERSION = 1;
  const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const STREET_LABELS = Object.freeze({
    preflop: 'Preflop',
    flop: 'Flop',
    turn: 'Turn',
    river: 'River',
    showdown: 'Showdown'
  });
  const ACTION_TYPES = new Set([
    'POST_BLIND',
    'CHECK',
    'CALL',
    'BET',
    'RAISE',
    'FOLD',
    'ALL_IN',
    'SHOWDOWN',
    'RESULT',
    'INFO'
  ]);

  function finiteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function cardCode(card) {
    if (typeof card === 'string' && /^(14|13|12|11|10|[2-9])[shdc]$/.test(card)) {
      return card;
    }
    if (!card || !Number.isInteger(Number(card.r))) return null;
    const rank = Number(card.r);
    const suit = String(card.s || '');
    if (rank < 2 || rank > 14 || !'shdc'.includes(suit)) return null;
    return `${rank}${suit}`;
  }

  function normalizeCards(cards) {
    if (!Array.isArray(cards)) return [];
    const normalized = cards.map(cardCode);
    return normalized.every(Boolean) ? normalized : [];
  }

  function normalizeStreet(street) {
    return STREETS.includes(street) ? street : 'preflop';
  }

  function normalizeAction(action, index) {
    const rawType = String(action?.type || 'INFO').toUpperCase().replace('-', '_');
    const type = ACTION_TYPES.has(rawType) ? rawType : 'INFO';
    const amount = finiteNumber(action?.amount, 0);
    const toAmount = action?.toAmount == null ? null : finiteNumber(action.toAmount, 0);
    return {
      sequence: Number.isInteger(Number(action?.sequence)) ? Number(action.sequence) : index + 1,
      street: normalizeStreet(action?.street),
      playerId: action?.playerId ?? null,
      playerName: String(action?.playerName || ''),
      position: String(action?.position || ''),
      type,
      amount: Math.max(0, amount),
      toAmount: toAmount == null ? null : Math.max(0, toAmount),
      text: String(action?.text || '')
    };
  }

  function normalizePlayer(player) {
    return {
      playerId: player?.playerId ?? player?.id ?? null,
      name: String(player?.name || ''),
      position: String(player?.position || ''),
      type: String(player?.type || ''),
      startingStack: Math.max(0, finiteNumber(player?.startingStack, 0)),
      endingStack: Math.max(0, finiteNumber(player?.endingStack, 0))
    };
  }

  function stableFingerprint(value) {
    const input = JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fh-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function formatMoney(value) {
    const amount = finiteNumber(value, 0);
    return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  }

  function formatAction(action) {
    const normalized = normalizeAction(action, 0);
    if (normalized.type === 'CALL') return `CALL ${formatMoney(normalized.amount)}`;
    if (normalized.type === 'BET') return `BET ${formatMoney(normalized.amount)}`;
    if (normalized.type === 'RAISE') {
      return `RAISE TO ${formatMoney(normalized.toAmount ?? normalized.amount)}`;
    }
    if (normalized.type === 'ALL_IN') {
      return normalized.amount > 0 ? `ALL-IN ${formatMoney(normalized.amount)}` : 'ALL-IN';
    }
    if (normalized.type === 'POST_BLIND') {
      return normalized.text || `POST ${formatMoney(normalized.amount)}`;
    }
    if (normalized.type === 'INFO' || normalized.type === 'RESULT' || normalized.type === 'SHOWDOWN') {
      return normalized.text;
    }
    return normalized.type.replace('_', '-');
  }

  function groupActions(actions) {
    const normalized = (Array.isArray(actions) ? actions : [])
      .map(normalizeAction)
      .sort((left, right) => left.sequence - right.sequence);
    return STREETS.map(street => ({
      street,
      label: STREET_LABELS[street],
      actions: normalized.filter(action => action.street === street)
    })).filter(group => group.actions.length);
  }

  function createHandRecord(input = {}) {
    const sessionId = String(input.sessionId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-');
    const handNumber = Math.max(0, Math.trunc(finiteNumber(input.handNumber, 0)));
    const hero = input.hero || {};
    const actions = (Array.isArray(input.actions) ? input.actions : []).map(normalizeAction);
    const players = (Array.isArray(input.players) ? input.players : []).map(normalizePlayer);
    const timestamp = Number.isNaN(Date.parse(input.timestamp))
      ? new Date().toISOString()
      : new Date(input.timestamp).toISOString();
    const table = {
      size: Math.max(0, Math.trunc(finiteNumber(input.table?.size, 0))),
      style: String(input.table?.style || ''),
      blinds: {
        small: Math.max(0, finiteNumber(input.table?.blinds?.small, 0)),
        big: Math.max(0, finiteNumber(input.table?.blinds?.big, 0)),
        label: String(input.table?.blinds?.label || '')
      }
    };
    const record = {
      schemaVersion: SCHEMA_VERSION,
      id: `live-${sessionId}-${handNumber}`,
      source: String(input.source || 'Live Session'),
      timestamp,
      table,
      hero: {
        playerId: hero.playerId ?? hero.id ?? 0,
        position: String(hero.position || ''),
        holeCards: normalizeCards(hero.holeCards || hero.cards),
        startingStack: Math.max(0, finiteNumber(hero.startingStack, 0)),
        endingStack: Math.max(0, finiteNumber(hero.endingStack, 0))
      },
      communityCards: normalizeCards(input.communityCards || input.board),
      players,
      effectiveStack: Math.max(0, finiteNumber(input.effectiveStack, 0)),
      potSize: Math.max(0, finiteNumber(input.potSize, 0)),
      actions,
      winner: input.winner ? {
        playerId: input.winner.playerId ?? input.winner.id ?? null,
        name: String(input.winner.name || ''),
        position: String(input.winner.position || '')
      } : null,
      result: input.result ? {
        heroNet: finiteNumber(input.result.heroNet, 0),
        summary: String(input.result.summary || '')
      } : { heroNet: 0, summary: '' },
      analysis: { status: 'not-analyzed' },
      coach: { status: 'pending' },
      favorite: false,
      notes: ''
    };
    record.fingerprint = stableFingerprint({
      source: record.source,
      table: record.table,
      hero: record.hero,
      communityCards: record.communityCards,
      players: record.players,
      effectiveStack: record.effectiveStack,
      potSize: record.potSize,
      actions: record.actions,
      winner: record.winner,
      result: record.result
    });
    return record;
  }

  function saveUnique(existingHands, hand) {
    const hands = Array.isArray(existingHands) ? existingHands.slice() : [];
    const duplicate = hands.some(existing =>
      existing?.id === hand?.id ||
      (existing?.fingerprint && hand?.fingerprint && existing.fingerprint === hand.fingerprint)
    );
    if (duplicate) return { hands, saved: false, hand: null };
    return { hands: [hand, ...hands], saved: true, hand };
  }

  const api = Object.freeze({
    SCHEMA_VERSION,
    STREET_LABELS,
    cardCode,
    createHandRecord,
    formatAction,
    groupActions,
    saveUnique
  });

  root.PokerPilotSavedHands = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
