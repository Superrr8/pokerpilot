'use strict';

(function attachProgressFeedback(root) {
  const ICONS = Object.freeze({
    spark: '✦',
    bolt: '↯',
    decision: '◎',
    mind: '◇',
    book: '▤',
    flame: '♨',
    calendar: '▦',
    exam: '✓',
    rank: '◆',
    chips: '●'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function integer(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
  }

  function notificationsFromResult(value) {
    const result = object(value);
    if (result.applied !== true || result.duplicate === true) return [];
    const eventId = text(object(result.event).id);
    if (!eventId) return [];
    const transition = object(result.transition);
    const items = [];
    const xp = object(transition.xp);
    const gained = integer(xp.gained);
    if (gained > 0) {
      items.push({
        id: `${eventId}:xp`,
        kind: 'xp',
        eyebrow: 'Прогресс',
        title: `+${gained} XP`,
        description: 'Опыт сохранён.',
        icon: '＋',
        rarity: null
      });
    }

    const achievements = object(transition.achievements);
    const newlyUnlocked = Array.isArray(achievements.newlyUnlocked)
      ? achievements.newlyUnlocked
      : [];
    for (const value of newlyUnlocked) {
      const achievement = object(value);
      const id = text(achievement.id);
      if (!id) continue;
      items.push({
        id: `${eventId}:achievement:${id}`,
        kind: 'achievement',
        eyebrow: 'Достижение открыто',
        title: text(achievement.title, id),
        description: text(achievement.description),
        icon: ICONS[text(achievement.iconKey)] || '✦',
        rarity: text(achievement.rarity, 'COMMON').toUpperCase()
      });
    }

    const level = object(transition.level);
    if (level.leveledUp === true && integer(level.current) > integer(level.previous)) {
      items.push({
        id: `${eventId}:level`,
        kind: 'level',
        eyebrow: 'Новый уровень',
        title: `Level ${integer(level.current)}`,
        description: `Level ${integer(level.previous)} → Level ${integer(level.current)}`,
        icon: '▲',
        rarity: null
      });
    }

    const rank = object(transition.rank);
    const previousRank = object(rank.previous);
    const currentRank = object(rank.current);
    if (rank.rankedUp === true && text(currentRank.id) && currentRank.id !== previousRank.id) {
      items.push({
        id: `${eventId}:rank`,
        kind: 'rank',
        eyebrow: 'Новый ранг',
        title: text(currentRank.label, currentRank.id),
        description: `${text(previousRank.label, 'Без ранга')} → ${text(currentRank.label, currentRank.id)}`,
        icon: '◆',
        rarity: null
      });
    }
    return items;
  }

  function createQueue({
    schedule = callback => root.setTimeout(callback, 1800),
    cancel = timer => root.clearTimeout(timer),
    onShow = () => {},
    onHide = () => {},
    onClear = () => {},
    holdMs = 1800,
    exitMs = 220,
    reducedMotion = false
  } = {}) {
    const pending = [];
    const seen = new Set();
    let active = null;
    let timer = null;
    let destroyed = false;

    function clearTimer() {
      if (timer !== null) cancel(timer);
      timer = null;
    }

    function drain() {
      if (destroyed || active || !pending.length) return;
      active = pending.shift();
      onShow(active);
      timer = schedule(() => {
        timer = null;
        if (destroyed || !active) return;
        const completed = active;
        onHide(completed);
        timer = schedule(() => {
          timer = null;
          onClear(completed);
          active = null;
          drain();
        }, reducedMotion ? 0 : exitMs);
      }, holdMs);
    }

    function consume(result) {
      if (destroyed) return 0;
      let added = 0;
      for (const item of notificationsFromResult(result)) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        pending.push(item);
        added += 1;
      }
      drain();
      return added;
    }

    return Object.freeze({
      consume,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        clearTimer();
        pending.length = 0;
        onClear(active);
        active = null;
      },
      getState() {
        return { active: active ? { ...active } : null, pending: pending.length, destroyed };
      }
    });
  }

  function create({ documentRef = root.document, container, reducedMotion } = {}) {
    const host = container || documentRef?.querySelector?.('#progressFeedback');
    const prefersReducedMotion = reducedMotion === true
      || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    function render(item) {
      if (!host || !documentRef) return;
      const card = documentRef.createElement('article');
      card.className = `progress-feedback-card progress-feedback-${item.kind}`;
      card.dataset.notificationId = item.id;
      if (item.rarity) card.dataset.rarity = item.rarity;

      const icon = documentRef.createElement('span');
      icon.className = 'progress-feedback-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.icon;

      const copy = documentRef.createElement('span');
      copy.className = 'progress-feedback-copy';
      const eyebrow = documentRef.createElement('small');
      eyebrow.textContent = item.eyebrow;
      const title = documentRef.createElement('strong');
      title.textContent = item.title;
      const description = documentRef.createElement('span');
      description.textContent = item.description;
      copy.append(eyebrow, title, description);
      card.append(icon, copy);
      host.replaceChildren(card);
      host.dataset.active = 'true';
      const reveal = () => card.classList.add('is-visible');
      if (prefersReducedMotion) reveal();
      else root.requestAnimationFrame?.(reveal) || reveal();
    }

    function hide() {
      const card = host?.querySelector?.('.progress-feedback-card');
      if (card) card.classList.remove('is-visible');
      if (host) host.dataset.active = 'false';
    }

    function clear() {
      if (!host) return;
      host.replaceChildren();
      host.dataset.active = 'false';
    }

    return createQueue({
      schedule: (callback, delay) => root.setTimeout(callback, delay),
      cancel: timer => root.clearTimeout(timer),
      onShow: render,
      onHide: hide,
      onClear: clear,
      reducedMotion: prefersReducedMotion
    });
  }

  const api = Object.freeze({ notificationsFromResult, createQueue, create });
  root.PokerPilotProgressFeedback = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
