'use strict';

(function attachLiveFeedback(root) {
  const EVENTS = Object.freeze({
    CARD_DEAL: 'CARD_DEAL',
    BOARD_REVEAL: 'BOARD_REVEAL',
    CHECK: 'CHECK',
    FOLD: 'FOLD',
    CALL: 'CALL',
    BET: 'BET',
    RAISE: 'RAISE',
    ALL_IN: 'ALL_IN',
    POT_COLLECT: 'POT_COLLECT',
    POT_AWARD: 'POT_AWARD',
    SHOWDOWN: 'SHOWDOWN',
    HAND_COMPLETE: 'HAND_COMPLETE'
  });

  const ACTION_SOUNDS = Object.freeze({
    CHECK: 'live.action.check',
    FOLD: 'live.action.fold',
    CALL: 'live.action.call',
    BET: 'live.action.bet',
    RAISE: 'live.action.raise',
    ALL_IN: 'live.action.allIn'
  });

  const BOARD_SOUNDS = Object.freeze({
    flop: 'live.board.flop',
    turn: 'live.board.turn',
    river: 'live.board.river'
  });

  function create({ feedback = null, maxEntries = 256 } = {}) {
    const seen = new Set();
    const order = [];
    let handToken = '';

    function startHand(token) {
      handToken = String(token ?? '');
      seen.clear();
      order.length = 0;
      return handToken;
    }

    function emit(eventId, soundKey, channels = {}) {
      if (!handToken || !eventId || !soundKey) {
        return { sound: false, haptic: false, invalid: true };
      }
      const key = `${handToken}:${eventId}`;
      if (seen.has(key)) return { sound: false, haptic: false, duplicate: true };
      seen.add(key);
      order.push(key);
      while (order.length > maxEntries) seen.delete(order.shift());
      try {
        return feedback?.trigger?.(soundKey, channels) || { sound: false, haptic: false };
      } catch (_) {
        return { sound: false, haptic: false };
      }
    }

    function cardDeal(index) {
      const cardIndex = Number(index) || 0;
      return emit(`deal:${cardIndex}`, 'live.card.deal', {
        sound: cardIndex === 0,
        haptic: false
      });
    }

    function boardReveal(street, index) {
      const normalizedStreet = String(street || '').toLowerCase();
      return emit(
        `board:${normalizedStreet}:${Number(index) || 0}`,
        BOARD_SOUNDS[normalizedStreet],
        {
          sound: Number(index) === 0,
          haptic: Number(index) === 0
        }
      );
    }

    function action(value = {}) {
      const type = String(value.type || '').toUpperCase();
      const sequence = Number(value.sequence);
      const eventId = Number.isFinite(sequence)
        ? `action:${sequence}`
        : `action:${type}:${value.playerId ?? 'table'}`;
      const haptic = value.playerId === 0;
      const sound = value.playerId === 0;
      return emit(eventId, ACTION_SOUNDS[type], { sound, haptic });
    }

    function potCollect(street) {
      return emit(`pot-collect:${String(street || 'table')}`, 'live.pot.collect', {
        sound: false,
        haptic: false
      });
    }

    function potAward(winnerId) {
      return emit(`pot-award:${winnerId ?? 'split'}`, 'live.pot.award', {
        sound: true,
        haptic: true
      });
    }

    function showdown() {
      return emit('showdown', 'live.showdown', { sound: false, haptic: false });
    }

    function handComplete() {
      return emit('hand-complete', 'live.hand.complete', { sound: false, haptic: false });
    }

    return Object.freeze({
      startHand,
      cardDeal,
      boardReveal,
      action,
      potCollect,
      potAward,
      showdown,
      handComplete,
      getState: () => Object.freeze({ handToken, consumed: seen.size })
    });
  }

  const api = Object.freeze({ EVENTS, ACTION_SOUNDS, BOARD_SOUNDS, create });
  root.LiveFeedback = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
