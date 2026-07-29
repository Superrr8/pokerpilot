'use strict';

(function attachLiveUxController(root) {
  function createHistoryPanel({ onChange = () => {} } = {}) {
    let state = {
      expanded: false,
      manuallyExpanded: false
    };

    function commit(next) {
      if (
        next.expanded === state.expanded &&
        next.manuallyExpanded === state.manuallyExpanded
      ) return false;
      state = next;
      onChange({ ...state });
      return true;
    }

    function setExpanded(expanded, { manual = false } = {}) {
      const nextExpanded = Boolean(expanded);
      return commit({
        expanded: nextExpanded,
        manuallyExpanded: manual && nextExpanded
      });
    }

    function toggle() {
      return setExpanded(!state.expanded, { manual: !state.expanded });
    }

    function onHeroTurn() {
      if (state.manuallyExpanded || !state.expanded) return false;
      return setExpanded(false);
    }

    function startHand() {
      return commit({
        expanded: false,
        manuallyExpanded: false
      });
    }

    function getState() {
      return { ...state };
    }

    return Object.freeze({
      setExpanded,
      toggle,
      onHeroTurn,
      startHand,
      getState
    });
  }

  function createActionFeed({ maxEntries = 160 } = {}) {
    const seen = new Set();
    const order = [];

    function consume(eventId) {
      const key = String(eventId || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      order.push(key);
      while (order.length > maxEntries) seen.delete(order.shift());
      return true;
    }

    function startHand() {
      seen.clear();
      order.length = 0;
    }

    return Object.freeze({
      consume,
      startHand
    });
  }

  function cardKey(card) {
    return `${Number(card?.r) || 0}${String(card?.s || '')}`;
  }

  function cardSignature(cards) {
    return (Array.isArray(cards) ? cards : []).map(cardKey).join('|');
  }

  function createCardNode(container, card, {
    small = false,
    dealIndex = 0,
    className = ''
  } = {}) {
    if (!container?.ownerDocument || !root.PokerCardUI) return null;
    const template = container.ownerDocument.createElement('template');
    template.innerHTML = root.PokerCardUI.render(card, { small, dealIndex }).trim();
    const node = template.content.firstElementChild;
    if (!node) return null;
    node.dataset.liveCardKey = cardKey(card);
    if (className) node.classList.add(className);
    return node;
  }

  function syncCardCollection(container, cards, {
    small = false,
    className = '',
    revealIndex = -1,
    collectionKey = ''
  } = {}) {
    if (!container) return { created: 0, reused: 0, total: 0 };
    const list = Array.isArray(cards) ? cards : [];
    let children = [...container.children];
    const normalizedCollectionKey = String(collectionKey || '');
    const collectionChanged =
      normalizedCollectionKey &&
      container.dataset.collectionKey !== normalizedCollectionKey;
    const prefixMatches =
      !collectionChanged &&
      children.length <= list.length &&
      children.every((node, index) => node.dataset.liveCardKey === cardKey(list[index]));

    if (!prefixMatches) {
      container.replaceChildren();
      children = [];
    }

    let created = 0;
    for (let index = children.length; index < list.length; index += 1) {
      const node = createCardNode(container, list[index], {
        small,
        dealIndex: index,
        className
      });
      if (node) {
        container.appendChild(node);
        created += 1;
      }
    }

    children = [...container.children];
    children.forEach((node, index) => {
      if (className) node.classList.add(className);
      node.classList.toggle('is-revealing', index === revealIndex);
    });
    container.dataset.cardSignature = cardSignature(list);
    container.dataset.collectionKey = normalizedCollectionKey;

    return {
      created,
      reused: Math.max(0, children.length - created),
      total: children.length
    };
  }

  const api = Object.freeze({
    createHistoryPanel,
    createActionFeed,
    cardSignature,
    syncCardCollection
  });

  root.PokerPilotLiveUX = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
