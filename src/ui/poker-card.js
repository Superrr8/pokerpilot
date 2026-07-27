'use strict';

(function attachPokerCard(root) {
  const RANKS = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: '10' };
  const SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };

  function render(card, options = {}) {
    const faceUp = options.faceUp !== false;
    const dealIndex = Number.isFinite(Number(options.dealIndex))
      ? Math.max(0, Math.floor(Number(options.dealIndex)))
      : 0;
    const classes = ['playing-card'];
    if (options.small) classes.push('small-card');
    if (!faceUp) classes.push('face-down');
    if (options.selected) classes.push('is-selected');
    if (options.winning) classes.push('is-winning');
    if (options.disabled) classes.push('is-disabled');

    if (!faceUp) {
      return `<div class="${classes.join(' ')}" role="img" aria-label="Закрытая карта" style="--deal-index:${dealIndex}" data-card-state="face-down"><span class="card-back-mark">PP</span></div>`;
    }

    const rank = RANKS[card?.r] || String(card?.r ?? '');
    const suit = SUITS[card?.s] || '';
    const isRed = card?.s === 'h' || card?.s === 'd';
    classes.push(isRed ? 'red' : '', isRed ? 'suit-red' : 'suit-black');
    const state = options.winning ? 'winning' : (options.selected ? 'selected' : 'face-up');
    return `<div class="${classes.filter(Boolean).join(' ')}" role="img" aria-label="${rank}${suit}" aria-disabled="${options.disabled ? 'true' : 'false'}" style="--deal-index:${dealIndex}" data-card-state="${state}"><span class="card-rank">${rank}</span><span class="card-suit">${suit}</span></div>`;
  }

  const api = { render };
  root.PokerCardUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

