'use strict';

(function attachAchievementCenter(root) {
  const Config = root.PokerPilotAchievementConfig
    || (typeof require === 'function' ? require('../progress/achievement-config.js') : null);

  const FILTERS = Object.freeze(['all', 'unlocked', 'locked']);
  const RARITY_LABELS = Object.freeze({
    COMMON: 'Обычное',
    RARE: 'Редкое',
    EPIC: 'Эпическое',
    LEGENDARY: 'Легендарное'
  });
  const ICONS = Object.freeze({
    spark: '✦', bolt: '↯', decision: '◎', mind: '◇', book: '▤',
    flame: '♨', calendar: '▦', exam: '✓', rank: '◆', chips: '●'
  });
  const RANK_LABELS = Object.freeze({
    BEGINNER: 'Новичок',
    LEARNING: 'Обучение',
    INTERMEDIATE: 'Средний уровень',
    ADVANCED: 'Продвинутый',
    EXPERT: 'Эксперт',
    MASTER: 'Мастер',
    GRANDMASTER: 'Гроссмейстер',
    ELITE: 'Элита',
    LEGEND: 'Легенда',
    POKERPILOT: 'PokerPilot'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function finite(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function safeInteger(value) {
    const numeric = finite(value, 0);
    return Math.max(0, Math.floor(numeric));
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeFilter(value) {
    return FILTERS.includes(value) ? value : 'all';
  }

  function normalizeRarity(value) {
    const rarity = text(value).toUpperCase();
    return RARITY_LABELS[rarity] ? rarity : 'COMMON';
  }

  function dateLabel(value) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(timestamp)) return null;
    const date = new Date(timestamp);
    return [
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      date.getUTCFullYear()
    ].join('.');
  }

  function metricValue(metric, snapshot) {
    const current = object(snapshot);
    const counters = object(current.counters);
    if (metric === 'trainingScenarios') return finite(counters.trainingScenarios, 0);
    if (metric === 'trainerDecisions') return finite(counters.trainerDecisions, 0);
    if (metric === 'exams') return finite(counters.exams, 0);
    if (metric === 'pokerIq') return finite(object(current.pokerIq).score, 0);
    if (metric === 'level') return finite(object(current.level).level, 0);
    if (metric === 'streak') return finite(object(current.streak).current, 0);
    if (metric === 'lifetimeXp') return finite(current.lifetimeXp, 0);
    return null;
  }

  function numericProgressLabel(metric, current, target) {
    if (metric === 'trainingScenarios') return `${current} / ${target} сценариев`;
    if (metric === 'trainerDecisions') return `${current} / ${target} решений Trainer`;
    if (metric === 'pokerIq') return `Poker IQ ${current} / ${target}`;
    if (metric === 'level') return `Level ${current} / ${target}`;
    if (metric === 'streak') return `${current} / ${target} дня`;
    if (metric === 'exams') return `${current} / ${target} экзамен`;
    if (metric === 'lifetimeXp') return `${current} / ${target} XP`;
    return `${current} / ${target}`;
  }

  function unavailableProgress() {
    return { available: false, current: 0, target: 0, percent: 0, label: null };
  }

  function getAchievementPresentationProgress(achievement, snapshot) {
    const definition = object(achievement);
    const condition = object(definition.condition);
    if (definition.hidden === true) return unavailableProgress();

    if (condition.comparator === 'gte') {
      const targetValue = finite(condition.target);
      const currentValue = metricValue(condition.metric, snapshot);
      if (targetValue === null || targetValue <= 0 || currentValue === null) return unavailableProgress();
      const target = Math.max(1, Math.floor(targetValue));
      const current = clamp(Math.floor(Math.max(0, currentValue)), 0, target);
      return {
        available: true,
        current,
        target,
        percent: Math.round(current / target * 100),
        label: numericProgressLabel(condition.metric, current, target)
      };
    }

    if (condition.comparator === 'rankAbove') {
      const rankOrder = Array.isArray(Config?.RANK_ORDER) ? Config.RANK_ORDER : [];
      const targetBase = rankOrder.indexOf(text(condition.target));
      const requiredIndex = targetBase + 1;
      if (targetBase < 0 || requiredIndex >= rankOrder.length) return unavailableProgress();
      const rank = object(object(snapshot).rank);
      const currentIndex = rankOrder.indexOf(text(rank.id));
      const target = requiredIndex + 1;
      const current = clamp(currentIndex + 1, 0, target);
      const currentLabel = text(rank.label, currentIndex >= 0 ? RANK_LABELS[rankOrder[currentIndex]] : 'Без ранга');
      const requiredId = rankOrder[requiredIndex];
      return {
        available: true,
        current,
        target,
        percent: Math.round(current / target * 100),
        label: `${currentLabel || 'Без ранга'} → ${RANK_LABELS[requiredId] || requiredId}`
      };
    }

    return unavailableProgress();
  }

  function conditionLabel(definition, progress, hidden) {
    if (hidden) return 'Условие пока скрыто.';
    if (progress.available && progress.label) return `Условие: ${progress.label}`;
    return text(definition.description, 'Условие пока недоступно.');
  }

  function createViewModel({ catalog, snapshot, filter } = {}) {
    const current = object(snapshot);
    const achievementState = object(current.achievements);
    const statusItems = Array.isArray(achievementState.items) ? achievementState.items : [];
    const statusById = new Map();
    statusItems.forEach(value => {
      const item = object(value);
      const id = text(item.id);
      if (id && !statusById.has(id)) statusById.set(id, item);
    });

    const historyById = new Map();
    const history = Array.isArray(achievementState.history) ? achievementState.history : [];
    history.forEach(value => {
      const item = object(value);
      const id = text(item.id);
      if (id && !historyById.has(id)) historyById.set(id, item);
    });

    const definitions = Array.isArray(catalog) ? catalog : [];
    const allItems = definitions.map((value, catalogIndex) => {
      const definition = object(value);
      const id = text(definition.id);
      const title = text(definition.title);
      if (!id || !title) return null;
      const status = statusById.get(id) || {};
      const unlocked = status.unlocked === true;
      const hidden = definition.hidden === true && !unlocked;
      const progress = unlocked
        ? unavailableProgress()
        : getAchievementPresentationProgress(definition, current);
      const unlockedAt = text(status.unlockedAt)
        || text(object(historyById.get(id)).unlockedAt)
        || null;
      const rarity = normalizeRarity(definition.rarity);
      const displayTitle = hidden ? 'Скрытое достижение' : title;
      return {
        id,
        catalogIndex,
        title: displayTitle,
        description: hidden ? 'Продолжайте развиваться, чтобы открыть детали.' : text(definition.description),
        conditionLabel: conditionLabel(definition, progress, hidden),
        icon: hidden ? '?' : ICONS[text(definition.iconKey)] || '✦',
        rarity,
        rarityLabel: RARITY_LABELS[rarity],
        unlocked,
        hidden,
        statusLabel: unlocked ? 'Открыто' : 'Не открыто',
        unlockedAt: unlocked ? unlockedAt : null,
        dateLabel: unlocked ? dateLabel(unlockedAt) : null,
        progress: {
          ...progress,
          ariaLabel: progress.available
            ? `${displayTitle}: ${progress.label}`
            : `${displayTitle}: прогресс недоступен`
        }
      };
    }).filter(Boolean).sort((left, right) => {
      if (left.unlocked !== right.unlocked) return left.unlocked ? -1 : 1;
      return left.catalogIndex - right.catalogIndex;
    });

    const normalizedFilter = normalizeFilter(filter);
    const unlockedCount = allItems.filter(item => item.unlocked).length;
    const totalCount = allItems.length;
    const lockedCount = totalCount - unlockedCount;
    const items = allItems.filter(item => {
      if (normalizedFilter === 'unlocked') return item.unlocked;
      if (normalizedFilter === 'locked') return !item.unlocked;
      return true;
    });
    return {
      filter: normalizedFilter,
      items: clone(items),
      unlockedCount,
      lockedCount,
      totalCount,
      completionPercent: totalCount ? Math.round(unlockedCount / totalCount * 100) : 0,
      countLabel: `${unlockedCount} из ${totalCount} открыто`,
      filterCounts: { all: totalCount, unlocked: unlockedCount, locked: lockedCount },
      emptyMessage: totalCount
        ? 'В этой категории пока нет достижений.'
        : 'Пока нет данных о достижениях.'
    };
  }

  function createController({ getSnapshot, getCatalog, onRender = () => {}, onVisibilityChange = () => {} } = {}) {
    let filter = 'all';
    let visible = false;
    let destroyed = false;

    function refresh(snapshotOverride) {
      if (destroyed) return false;
      const snapshot = snapshotOverride === undefined
        ? (typeof getSnapshot === 'function' ? getSnapshot() : {})
        : snapshotOverride;
      const catalog = typeof getCatalog === 'function' ? getCatalog() : [];
      onRender(createViewModel({ catalog, snapshot, filter }));
      return true;
    }

    function open() {
      if (destroyed) return false;
      visible = true;
      onVisibilityChange(true);
      return refresh();
    }

    function close() {
      if (destroyed) return false;
      visible = false;
      onVisibilityChange(false);
      return true;
    }

    function setFilter(value) {
      if (destroyed) return false;
      filter = normalizeFilter(value);
      return refresh();
    }

    return Object.freeze({
      open,
      close,
      refresh,
      setFilter,
      destroy() {
        if (destroyed) return;
        destroyed = true;
        visible = false;
      },
      getState() {
        return { filter, visible, destroyed };
      }
    });
  }

  function find(documentRef, selector) {
    return documentRef?.querySelector?.(selector) || null;
  }

  function setText(documentRef, selector, value) {
    const node = find(documentRef, selector);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function createCard(documentRef, item) {
    const card = documentRef.createElement('article');
    card.className = `achievement-center-card ${item.unlocked ? 'is-unlocked' : 'is-locked'}`;
    card.dataset.achievementId = item.id;
    card.dataset.rarity = item.rarity;
    card.dataset.status = item.unlocked ? 'unlocked' : 'locked';

    const icon = documentRef.createElement('span');
    icon.className = 'achievement-center-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = item.icon;

    const body = documentRef.createElement('div');
    body.className = 'achievement-center-card-body';
    const meta = documentRef.createElement('div');
    meta.className = 'achievement-center-card-meta';
    const rarity = documentRef.createElement('span');
    rarity.className = 'achievement-rarity';
    rarity.textContent = item.rarityLabel;
    const status = documentRef.createElement('span');
    status.className = 'achievement-status';
    status.textContent = item.statusLabel;
    meta.append(rarity, status);

    const title = documentRef.createElement('h3');
    title.textContent = item.title;
    const description = documentRef.createElement('p');
    description.textContent = item.description;
    const condition = documentRef.createElement('small');
    condition.className = 'achievement-condition';
    condition.textContent = item.conditionLabel;
    body.append(meta, title, description, condition);

    if (item.unlocked && item.dateLabel) {
      const date = documentRef.createElement('small');
      date.className = 'achievement-unlock-date';
      date.textContent = `Открыто ${item.dateLabel}`;
      body.append(date);
    } else if (!item.unlocked && item.progress.available) {
      const progress = documentRef.createElement('progress');
      progress.className = 'achievement-center-meter';
      progress.max = Math.max(1, item.progress.target);
      progress.value = item.progress.current;
      progress.setAttribute('aria-label', item.progress.ariaLabel);
      const label = documentRef.createElement('small');
      label.className = 'achievement-progress-label';
      label.textContent = item.progress.label;
      body.append(progress, label);
    }

    card.append(icon, body);
    return card;
  }

  function render(documentRef, model) {
    const center = find(documentRef, '#achievementCenter');
    if (!center || !model) return false;
    setText(documentRef, '#achievementCenterCount', model.countLabel);
    setText(documentRef, '#achievementCenterPercent', `${model.completionPercent}%`);
    const completion = find(documentRef, '#achievementCenterCompletion');
    if (completion) {
      completion.max = 100;
      completion.value = model.completionPercent;
      completion.setAttribute('aria-label', `Достижения: ${model.countLabel}, ${model.completionPercent}%`);
    }
    const filters = {
      all: '#achievementFilterAll',
      unlocked: '#achievementFilterUnlocked',
      locked: '#achievementFilterLocked'
    };
    Object.entries(filters).forEach(([id, selector]) => {
      const button = find(documentRef, selector);
      if (!button) return;
      const active = model.filter === id;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('is-active', active);
      const count = model.filterCounts[id];
      button.dataset.count = String(count);
    });
    const grid = find(documentRef, '#achievementCenterGrid');
    if (grid) grid.replaceChildren(...model.items.map(item => createCard(documentRef, item)));
    const empty = find(documentRef, '#achievementCenterEmpty');
    if (empty) {
      empty.textContent = model.emptyMessage;
      empty.hidden = model.items.length > 0;
    }
    if (grid) grid.hidden = model.items.length === 0;
    center.dataset.ready = 'true';
    return true;
  }

  let activeMount = null;

  function create({ documentRef = root.document, getSnapshot, getCatalog } = {}) {
    if (activeMount && activeMount.documentRef === documentRef && !activeMount.api.getState().destroyed) {
      return activeMount.api;
    }
    const center = find(documentRef, '#achievementCenter');
    const profile = find(documentRef, '#screen-profile');
    const openButton = find(documentRef, '#progressAchievementsOpen');
    const backButton = find(documentRef, '#achievementCenterBack');
    const filterButtons = Array.from(documentRef?.querySelectorAll?.('[data-achievement-filter]') || []);
    const removers = [];
    let restoreFocusOnClose = true;

    const controller = createController({
      getSnapshot,
      getCatalog,
      onRender: model => render(documentRef, model),
      onVisibilityChange: visible => {
        if (center) {
          center.hidden = !visible;
          center.setAttribute('aria-hidden', String(!visible));
        }
        if (profile) profile.dataset.profileView = visible ? 'achievements' : 'overview';
        if (!visible && restoreFocusOnClose) openButton?.focus?.();
      }
    });

    function listen(node, type, handler) {
      if (!node?.addEventListener) return;
      node.addEventListener(type, handler);
      removers.push(() => node.removeEventListener(type, handler));
    }

    listen(openButton, 'click', () => controller.open());
    listen(backButton, 'click', () => {
      restoreFocusOnClose = true;
      controller.close();
    });
    filterButtons.forEach(button => listen(button, 'click', () => {
      controller.setFilter(button.dataset.achievementFilter);
    }));

    const api = Object.freeze({
      documentRef,
      open: controller.open,
      refresh: controller.refresh,
      setFilter: controller.setFilter,
      close({ restoreFocus = true } = {}) {
        restoreFocusOnClose = restoreFocus;
        const result = controller.close();
        restoreFocusOnClose = true;
        return result;
      },
      destroy() {
        removers.splice(0).forEach(remove => remove());
        controller.destroy();
        if (activeMount?.api === api) activeMount = null;
      },
      getState: controller.getState
    });
    activeMount = { documentRef, api };
    return api;
  }

  const api = Object.freeze({
    FILTERS,
    RARITY_LABELS,
    normalizeFilter,
    getAchievementPresentationProgress,
    createViewModel,
    createController,
    render,
    create
  });

  root.PokerPilotAchievementCenter = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
