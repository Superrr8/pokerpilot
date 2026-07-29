'use strict';

(function attachDecisionQualityUi(root) {
  const LABELS = Object.freeze({
    EXCELLENT: 'Отличное решение',
    GOOD: 'Хорошее решение',
    ACCEPTABLE: 'Допустимое решение',
    MISTAKE: 'Ошибка',
    BLUNDER: 'Серьёзная ошибка',
    UNRATED: 'Недостаточно данных'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function createResultViewModel(value = {}) {
    const result = object(value);
    const isRated = result.isRated === true && Number.isFinite(Number(result.score));
    const classification = isRated ? String(result.classification || 'UNRATED') : 'UNRATED';
    return {
      isRated,
      score: isRated ? String(Math.round(Number(result.score))) : '—',
      grade: isRated ? String(result.grade || '—') : '—',
      stars: isRated && Number.isFinite(Number(result.stars)) ? Number(result.stars) : null,
      classification,
      label: LABELS[classification] || LABELS.UNRATED,
      confidence: isRated ? String(result.confidence || 'medium') : 'low',
      reason: Array.isArray(result.reasons) && result.reasons.length
        ? String(result.reasons[0])
        : 'Недостаточно данных для честной оценки решения.'
    };
  }

  function createProfileViewModel(value = {}) {
    const summary = object(value);
    const count = Number.isFinite(Number(summary.ratedCount)) ? Number(summary.ratedCount) : 0;
    const average = summary.average !== null && summary.average !== undefined && Number.isFinite(Number(summary.average))
      ? Number(summary.average)
      : null;
    const status = String(summary.sampleStatus || 'NONE');
    const details = {
      NONE: 'Сыграйте минимум одно оцениваемое решение.',
      PROVISIONAL: `Предварительная оценка · ${count} реш.`,
      FORMING: `Оценка формируется · ${count} реш.`,
      ESTABLISHED: `${summary.grade || '—'} · ${LABELS[summary.classification] || 'Оценка сформирована'} · ${count} реш.`
    };
    return {
      value: average === null ? 'Не рассчитана' : status === 'ESTABLISHED' ? `${Math.round(average)} / 100` : `${Math.round(average)}`,
      detail: details[status] || details.NONE,
      trend: summary.trend?.direction === 'UP'
        ? `Тренд +${summary.trend.delta}`
        : summary.trend?.direction === 'DOWN'
          ? `Тренд ${summary.trend.delta}`
          : summary.trend?.direction === 'STABLE' ? 'Тренд стабилен' : 'Тренд пока недоступен',
      sampleStatus: status
    };
  }

  function createHistoryItemViewModel(record = {}) {
    const result = createResultViewModel(record.decisionQuality);
    return {
      ...result,
      action: String(record.choice || record.userAction || '—').toUpperCase(),
      recommendedAction: String(record.trainerSnapshot?.actionClass || record.preferred || '').toUpperCase(),
      title: String(record.title || record.mode || 'Решение')
    };
  }

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function renderResult(document, container, result) {
    if (!container || !document) return null;
    const model = createResultViewModel(result);
    container.replaceChildren();
    container.className = `decision-quality-card ${model.isRated ? 'is-rated' : 'is-unrated'}`;
    container.dataset.classification = model.classification;
    container.setAttribute(
      'aria-label',
      model.isRated
        ? `Decision Quality ${model.score} из 100, оценка ${model.grade}, ${model.label}.`
        : 'Decision Quality: недостаточно данных.'
    );
    const top = element(document, 'div', 'decision-quality-card__top');
    top.append(
      element(document, 'span', 'decision-quality-card__label', 'Decision Quality'),
      element(document, 'strong', 'decision-quality-card__score', model.score)
    );
    const meta = element(document, 'div', 'decision-quality-card__meta');
    meta.append(
      element(document, 'span', 'decision-quality-grade', model.grade),
      element(document, 'span', 'decision-quality-label', model.label)
    );
    const reason = element(document, 'p', 'decision-quality-reason', model.reason);
    container.append(top, meta, reason);
    container.classList.remove('hidden');
    return model;
  }

  function renderProfile(document, summary) {
    const model = createProfileViewModel(summary);
    const set = (selector, value) => {
      const node = document?.querySelector(selector);
      if (node) node.textContent = String(value);
    };
    set('#profileDecisionQuality', model.value);
    set('#profileDecisionQualityDetail', model.detail);
    set('#profileDecisionQualityTrend', model.trend);
    set('#profileDecisionQualityLifetime', summary?.lifetimeAverage === null || summary?.lifetimeAverage === undefined ? '—' : Math.round(summary.lifetimeAverage));
    set('#profileDecisionQualityRecent', summary?.recent20Average === null || summary?.recent20Average === undefined ? '—' : Math.round(summary.recent20Average));
    set('#profileDecisionQualityRated', summary?.ratedCount ?? 0);
    set('#profileDecisionQualityBestSession', summary?.bestSession?.average === null || summary?.bestSession?.average === undefined ? '—' : Math.round(summary.bestSession.average));
    const metric = document?.querySelector('#profileDecisionQuality');
    if (metric) {
      metric.setAttribute(
        'aria-label',
        summary?.average === null || summary?.average === undefined
          ? 'Decision Quality: не рассчитана.'
          : `Decision Quality ${Math.round(summary.average)} из 100, ${summary.grade || 'без оценки'}.`
      );
    }
    const street = document?.querySelector('#profileDecisionQualityStreets');
    if (street) {
      street.replaceChildren();
      const rows = Object.entries(summary?.byStreet || {});
      if (!rows.length) street.appendChild(element(document, 'span', 'muted', 'Нет данных по улицам'));
      rows.forEach(([name, data]) => {
        street.appendChild(element(document, 'span', 'decision-quality-street', `${name.toUpperCase()} ${Math.round(data.average)}`));
      });
    }
    return model;
  }

  function renderHistory(document, container, history, limit = 15) {
    if (!container || !document) return;
    container.replaceChildren();
    const records = Array.isArray(history) ? history.slice(0, limit) : [];
    if (!records.length) {
      container.appendChild(element(document, 'p', 'muted', 'История пока пуста.'));
      return;
    }
    records.forEach(record => {
      const model = createHistoryItemViewModel(record);
      const item = element(document, 'div', 'history-item decision-quality-history-item');
      item.append(
        element(document, 'strong', '', model.title),
        element(document, 'small', '', `${model.score}${model.grade !== '—' ? ` · ${model.grade}` : ''} · ${model.label}`),
        element(document, 'span', 'decision-quality-action', model.recommendedAction && model.recommendedAction !== model.action
          ? `${model.action} вместо ${model.recommendedAction}`
          : model.action),
        element(document, 'span', 'muted', model.reason)
      );
      container.appendChild(item);
    });
  }

  const api = Object.freeze({
    createResultViewModel,
    createProfileViewModel,
    createHistoryItemViewModel,
    renderResult,
    renderProfile,
    renderHistory
  });
  root.DecisionQualityUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
