'use strict';

(function attachProgressAnalyticsView(root) {
  const PERIODS = Object.freeze(['7d', '30d', 'all']);
  const PERIOD_LABELS = Object.freeze({ '7d': '7 дней', '30d': '30 дней', all: 'Всё время' });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value, fallback = 0) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function nonNegative(value) {
    return Math.max(0, finite(value, 0));
  }

  function integer(value) {
    return Math.floor(nonNegative(value));
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function normalizePeriod(value) {
    return PERIODS.includes(value) ? value : '7d';
  }

  function dayLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    return match ? `${match[3]}.${match[2]}` : '—';
  }

  function dateTimeLabel(value) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(timestamp)) return 'Дата недоступна';
    const date = new Date(timestamp);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()} · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function compactSeries(value, limit = 60, mode = 'sum') {
    const rows = (Array.isArray(value) ? value : []).map(item => ({
      day: text(object(item).day),
      value: nonNegative(object(item).value)
    })).filter(item => item.day);
    if (rows.length <= limit) return rows.map(item => ({ ...item, rangeLabel: dayLabel(item.day) }));
    const size = Math.ceil(rows.length / limit);
    const compacted = [];
    for (let index = 0; index < rows.length; index += size) {
      const group = rows.slice(index, index + size);
      const value = mode === 'last'
        ? group.at(-1).value
        : group.reduce((sum, item) => sum + item.value, 0);
      const first = dayLabel(group[0].day);
      const last = dayLabel(group.at(-1).day);
      compacted.push({ day: group.at(-1).day, value, rangeLabel: first === last ? first : `${first}–${last}` });
    }
    return compacted;
  }

  function chartModel(value, unit, mode = 'sum') {
    const rows = compactSeries(value, 60, mode);
    const maximum = Math.max(0, ...rows.map(item => item.value));
    return {
      available: rows.length > 0 && rows.some(item => item.value > 0),
      maximum,
      bars: rows.map((item, index) => ({
        ...item,
        percent: maximum > 0 ? Math.round(item.value / maximum * 1000) / 10 : 0,
        labelVisible: rows.length <= 10 || index === 0 || index === rows.length - 1 || index % 5 === 0,
        ariaLabel: `${item.rangeLabel}: ${item.value} ${unit}`
      }))
    };
  }

  function createViewModel(value) {
    const raw = object(value);
    const current = object(raw.current);
    const summary = object(raw.periodSummary);
    const coverage = object(raw.coverage);
    const series = object(raw.series);
    const pokerIqHistory = object(raw.pokerIqHistory);
    const periodId = normalizePeriod(object(raw.period).id);
    const acceptedEvents = integer(summary.acceptedEvents);
    const activity = chartModel(series.dailyActivity, 'событий');
    const xp = chartModel(series.dailyXp, 'XP');
    const iq = chartModel(series.pokerIq, 'Poker IQ', 'last');
    const recent = (Array.isArray(raw.recentActivity) ? raw.recentActivity : []).slice(0, 8).map(value => {
      const item = object(value);
      return {
        label: text(item.label, 'Учебная активность'),
        dateLabel: dateTimeLabel(item.timestamp),
        xp: integer(item.xp),
        xpLabel: integer(item.xp) > 0 ? `+${integer(item.xp)} XP` : null
      };
    });
    const breakdown = (Array.isArray(raw.eventBreakdown) ? raw.eventBreakdown : []).map(value => {
      const item = object(value);
      return {
        id: text(item.id, 'other'),
        label: text(item.label, 'Другая учебная активность'),
        count: integer(item.count),
        percent: Math.min(100, integer(item.percent))
      };
    });
    return {
      period: periodId,
      periodLabel: PERIOD_LABELS[periodId],
      current: {
        pokerIq: finite(current.pokerIq, null),
        pokerIqLabel: finite(current.pokerIq, null) === null ? 'Не рассчитан' : String(Math.round(finite(current.pokerIq))),
        level: Math.max(1, integer(current.level) || 1),
        rank: text(current.rank, 'Без ранга'),
        currentStreak: integer(current.currentStreak),
        longestStreak: integer(current.longestStreak),
        lifetimeXp: integer(current.lifetimeXp)
      },
      summary: [
        { id: 'xp', label: 'XP получено', value: integer(summary.xpGained) },
        { id: 'days', label: 'Активных дней', value: integer(summary.activeDays) },
        { id: 'scenarios', label: 'Сценариев', value: integer(summary.trainingScenarios) },
        { id: 'decisions', label: 'Решений Trainer', value: integer(summary.trainerDecisions) },
        { id: 'exams', label: 'Экзаменов', value: integer(summary.exams) },
        { id: 'average', label: 'XP / активный день', value: Math.round(nonNegative(summary.averageXpPerActiveDay) * 10) / 10 }
      ],
      acceptedEvents,
      empty: acceptedEvents === 0,
      emptyMessage: 'История пока пуста. Завершите тренировочный сценарий, чтобы увидеть реальную динамику.',
      coverageNotice: coverage.isPartial === true
        ? 'Подробная история собирается с момента обновления аналитики. Текущие totals сохранены без искусственной реконструкции прошлых дней.'
        : null,
      activity,
      xp,
      pokerIq: {
        ...iq,
        available: pokerIqHistory.available === true && iq.bars.length > 0,
        isPartial: pokerIqHistory.isPartial === true,
        emptyMessage: 'История Poker IQ появится после новых оценённых решений.'
      },
      breakdown,
      recent
    };
  }

  function find(documentRef, selector) {
    return documentRef?.querySelector?.(selector) || null;
  }

  function setText(documentRef, selector, value) {
    const node = find(documentRef, selector);
    if (node) node.textContent = String(value ?? '');
  }

  function createSummaryCard(documentRef, item) {
    const card = documentRef.createElement('article');
    card.className = 'progress-analytics-stat';
    card.dataset.metric = item.id;
    const value = documentRef.createElement('strong');
    value.textContent = String(item.value);
    const label = documentRef.createElement('span');
    label.textContent = item.label;
    card.append(value, label);
    return card;
  }

  function createBars(documentRef, chart, kind) {
    return chart.bars.map(item => {
      const bar = documentRef.createElement('div');
      bar.className = `progress-analytics-bar progress-analytics-bar-${kind}`;
      bar.setAttribute('role', 'img');
      bar.setAttribute('aria-label', item.ariaLabel);
      bar.style.setProperty('--analytics-bar-value', `${item.percent}%`);
      const value = documentRef.createElement('strong');
      value.textContent = String(item.value);
      const track = documentRef.createElement('span');
      track.className = 'progress-analytics-bar-track';
      const fill = documentRef.createElement('i');
      track.appendChild(fill);
      const label = documentRef.createElement('small');
      label.textContent = item.labelVisible ? item.rangeLabel : '';
      bar.append(value, track, label);
      return bar;
    });
  }

  function createBreakdownRow(documentRef, item) {
    const row = documentRef.createElement('li');
    row.className = 'progress-analytics-breakdown-row';
    row.dataset.category = item.id;
    const label = documentRef.createElement('span');
    label.textContent = item.label;
    const value = documentRef.createElement('strong');
    value.textContent = `${item.count} · ${item.percent}%`;
    const meter = documentRef.createElement('progress');
    meter.max = 100;
    meter.value = item.percent;
    meter.setAttribute('aria-label', `${item.label}: ${item.count}, ${item.percent}%`);
    row.append(label, value, meter);
    return row;
  }

  function createRecentRow(documentRef, item) {
    const row = documentRef.createElement('li');
    row.className = 'progress-analytics-recent-row';
    const content = documentRef.createElement('span');
    const title = documentRef.createElement('strong');
    title.textContent = item.label;
    const date = documentRef.createElement('small');
    date.textContent = item.dateLabel;
    content.append(title, date);
    const xp = documentRef.createElement('b');
    xp.textContent = item.xpLabel || 'Без XP';
    row.append(content, xp);
    return row;
  }

  function render(documentRef, input) {
    const model = input?.summary ? input : createViewModel(input);
    const center = find(documentRef, '#progressAnalytics');
    if (!center) return false;
    setText(documentRef, '#progressAnalyticsPokerIq', model.current.pokerIqLabel);
    setText(documentRef, '#progressAnalyticsRank', model.current.rank);
    setText(documentRef, '#progressAnalyticsLevel', `Level ${model.current.level}`);
    setText(documentRef, '#progressAnalyticsLifetimeXp', `${model.current.lifetimeXp} lifetime XP`);
    setText(documentRef, '#progressAnalyticsStreak', `${model.current.currentStreak} / ${model.current.longestStreak}`);
    const coverage = find(documentRef, '#progressAnalyticsCoverage');
    if (coverage) { coverage.textContent = model.coverageNotice || ''; coverage.hidden = !model.coverageNotice; }
    const empty = find(documentRef, '#progressAnalyticsEmpty');
    if (empty) { empty.textContent = model.emptyMessage; empty.hidden = !model.empty; }
    const summary = find(documentRef, '#progressAnalyticsSummary');
    if (summary) summary.replaceChildren(...model.summary.map(item => createSummaryCard(documentRef, item)));
    const activity = find(documentRef, '#progressAnalyticsActivityChart');
    if (activity) { activity.replaceChildren(...createBars(documentRef, model.activity, 'activity')); activity.hidden = !model.activity.available; }
    const activityEmpty = find(documentRef, '#progressAnalyticsActivityEmpty');
    if (activityEmpty) activityEmpty.hidden = model.activity.available;
    const xp = find(documentRef, '#progressAnalyticsXpChart');
    if (xp) { xp.replaceChildren(...createBars(documentRef, model.xp, 'xp')); xp.hidden = !model.xp.available; }
    const xpEmpty = find(documentRef, '#progressAnalyticsXpEmpty');
    if (xpEmpty) xpEmpty.hidden = model.xp.available;
    const iq = find(documentRef, '#progressAnalyticsIqChart');
    if (iq) { iq.replaceChildren(...createBars(documentRef, model.pokerIq, 'iq')); iq.hidden = !model.pokerIq.available; }
    const iqEmpty = find(documentRef, '#progressAnalyticsIqEmpty');
    if (iqEmpty) { iqEmpty.textContent = model.pokerIq.emptyMessage; iqEmpty.hidden = model.pokerIq.available; }
    const iqNotice = find(documentRef, '#progressAnalyticsIqNotice');
    if (iqNotice) { iqNotice.hidden = !model.pokerIq.isPartial; }
    const breakdown = find(documentRef, '#progressAnalyticsBreakdown');
    if (breakdown) { breakdown.replaceChildren(...model.breakdown.map(item => createBreakdownRow(documentRef, item))); breakdown.hidden = model.breakdown.length === 0; }
    const breakdownEmpty = find(documentRef, '#progressAnalyticsBreakdownEmpty');
    if (breakdownEmpty) breakdownEmpty.hidden = model.breakdown.length > 0;
    const recent = find(documentRef, '#progressAnalyticsRecent');
    if (recent) { recent.replaceChildren(...model.recent.map(item => createRecentRow(documentRef, item))); recent.hidden = model.recent.length === 0; }
    const recentEmpty = find(documentRef, '#progressAnalyticsRecentEmpty');
    if (recentEmpty) recentEmpty.hidden = model.recent.length > 0;
    Array.from(documentRef.querySelectorAll?.('[data-analytics-period]') || []).forEach(button => {
      const active = button.dataset.analyticsPeriod === model.period;
      button.setAttribute('aria-pressed', String(active));
      button.classList?.toggle?.('is-active', active);
    });
    center.dataset.ready = 'true';
    return true;
  }

  function createController({ getAnalyticsSnapshot, onRender, onVisibilityChange } = {}) {
    let period = '7d';
    let visible = false;
    let destroyed = false;
    function refresh() {
      if (destroyed || typeof getAnalyticsSnapshot !== 'function') return false;
      const analytics = getAnalyticsSnapshot({ period });
      if (typeof onRender === 'function') onRender(createViewModel(analytics));
      return true;
    }
    function open() {
      if (destroyed) return false;
      visible = true;
      if (typeof onVisibilityChange === 'function') onVisibilityChange(true);
      return refresh();
    }
    function close() {
      if (destroyed) return false;
      visible = false;
      if (typeof onVisibilityChange === 'function') onVisibilityChange(false);
      return true;
    }
    function setPeriod(value) {
      if (destroyed) return false;
      period = normalizePeriod(value);
      return refresh();
    }
    return Object.freeze({
      open, close, refresh, setPeriod,
      destroy() { destroyed = true; visible = false; },
      getState() { return { period, visible, destroyed }; }
    });
  }

  let activeMount = null;

  function create({ documentRef = root.document, getAnalyticsSnapshot } = {}) {
    if (activeMount && activeMount.documentRef === documentRef && !activeMount.api.getState().destroyed) return activeMount.api;
    const center = find(documentRef, '#progressAnalytics');
    const profile = find(documentRef, '#screen-profile');
    const openButton = find(documentRef, '#progressAnalyticsOpen');
    const backButton = find(documentRef, '#progressAnalyticsBack');
    const periodButtons = Array.from(documentRef?.querySelectorAll?.('[data-analytics-period]') || []);
    const removers = [];
    let restoreFocusOnClose = true;
    const controller = createController({
      getAnalyticsSnapshot,
      onRender: model => render(documentRef, model),
      onVisibilityChange: visible => {
        if (center) { center.hidden = !visible; center.setAttribute('aria-hidden', String(!visible)); }
        if (profile) profile.dataset.profileView = visible ? 'analytics' : 'overview';
        if (!visible && restoreFocusOnClose) openButton?.focus?.();
      }
    });
    function listen(node, type, handler) {
      if (!node?.addEventListener) return;
      node.addEventListener(type, handler);
      removers.push(() => node.removeEventListener(type, handler));
    }
    listen(openButton, 'click', () => controller.open());
    listen(backButton, 'click', () => { restoreFocusOnClose = true; controller.close(); });
    periodButtons.forEach(button => listen(button, 'click', () => controller.setPeriod(button.dataset.analyticsPeriod)));
    const api = Object.freeze({
      documentRef,
      open: controller.open,
      refresh: controller.refresh,
      setPeriod: controller.setPeriod,
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
    PERIODS,
    normalizePeriod,
    compactSeries,
    chartModel,
    createViewModel,
    render,
    createController,
    create
  });

  root.PokerPilotProgressAnalyticsView = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
