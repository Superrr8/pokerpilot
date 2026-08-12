'use strict';

(function attachTrainerExplanationUi(root) {
  const ACTION_LABELS = Object.freeze({
    FOLD: 'Fold', CHECK: 'Check', CALL: 'Call', BET: 'Bet', RAISE: 'Raise', ALL_IN: 'All-in'
  });
  const STATUS = Object.freeze({
    strong: Object.freeze({ icon: '✓', label: 'Сильное решение' }),
    mixed: Object.freeze({ icon: '≈', label: 'Пограничное решение' }),
    mistake: Object.freeze({ icon: '!', label: 'Есть ошибка' }),
    neutral: Object.freeze({ icon: '◆', label: 'Рекомендация Coach' })
  });
  const QUALITY_LABELS = Object.freeze({
    EXCELLENT: 'Отлично', GOOD: 'Хорошо', ACCEPTABLE: 'Допустимо', MISTAKE: 'Ошибка', BLUNDER: 'Серьёзная ошибка'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value) {
    const number = Number(value);
    return value !== null && value !== undefined && value !== '' && Number.isFinite(number) ? number : null;
  }

  function percent(value) {
    return `${Math.round(Number(value) * 100)}%`;
  }

  function money(value) {
    const number = Number(value);
    const amount = Math.abs(number) >= 10 ? Math.round(Math.abs(number)) : Math.round(Math.abs(number) * 10) / 10;
    return `${number >= 0 ? '+' : '-'}$${amount}`;
  }

  function mathItems(value) {
    const math = object(value);
    const items = [];
    if (finite(math.equity) !== null) items.push(`Equity: ${percent(math.equity)}`);
    if (finite(math.requiredEquity) !== null) items.push(`Нужно для Call: ${percent(math.requiredEquity)}`);
    if (finite(math.outs) !== null) items.push(`Сильные outs: ${Math.round(Number(math.outs))}`);
    if (finite(math.conditionalOuts) !== null) items.push(`Условные outs: ${Math.round(Number(math.conditionalOuts))}`);
    if (finite(math.nextCardProbability) !== null) items.push(`Попадание следующей картой: ${percent(math.nextCardProbability)}`);
    if (finite(math.byRiverProbability) !== null) items.push(`Попадание к river: ${percent(math.byRiverProbability)}`);
    if (finite(math.callEV) !== null) items.push(`EV Call относительно Fold: ${money(math.callEV)}`);
    if (finite(math.spr) !== null) items.push(`SPR: ${Math.round(Number(math.spr) * 10) / 10}`);
    return items;
  }

  function qualityStatus(value) {
    const quality = object(value);
    if (quality.isRated !== true) return 'neutral';
    const classification = String(quality.classification || '').toUpperCase();
    if (['EXCELLENT', 'GOOD'].includes(classification)) return 'strong';
    if (classification === 'ACCEPTABLE') return 'mixed';
    if (['MISTAKE', 'BLUNDER'].includes(classification)) return 'mistake';
    return 'neutral';
  }

  function verdict(status, actionLabel) {
    if (status === 'strong') return `Хорошее решение: ${actionLabel}`;
    if (status === 'mixed') return `Рабочая линия: ${actionLabel}`;
    if (status === 'mistake') return `Лучше сыграть: ${actionLabel}`;
    return `Лучшее действие: ${actionLabel}`;
  }

  function compactSummary(value, actionLabel) {
    const summary = String(value || '').trim();
    const action = String(actionLabel || '').split(/\s+/)[0];
    if (!summary || !action) return summary;
    const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const compact = summary.replace(new RegExp(`^${escaped}\\s*(?:—|:)\\s*`, 'i'), '');
    return compact ? compact.charAt(0).toUpperCase() + compact.slice(1) : summary;
  }

  function createViewModel(value = {}, trainerResult = {}, decisionQuality = {}, presentationDetails = {}) {
    const explanation = object(value);
    const result = object(trainerResult);
    const quality = object(decisionQuality);
    const presentation = object(presentationDetails);
    const action = String(result.actionClass || '').toUpperCase();
    const amount = finite(result.amount);
    let actionLabel = ACTION_LABELS[action] || action || '—';
    if (amount !== null) {
      if (action === 'RAISE') actionLabel = `Raise до $${Math.round(amount)}`;
      else if (action === 'BET') actionLabel = `Bet $${Math.round(amount)}`;
      else if (action === 'CALL') actionLabel = `Call $${Math.round(amount)}`;
      else if (action === 'ALL_IN') actionLabel = `All-in $${Math.round(amount)}`;
    }
    const sections = [];
    const reasons = Array.isArray(explanation.reasons) ? explanation.reasons.map(String).filter(Boolean) : [];
    const factors = Array.from(new Set([
      ...(Array.isArray(explanation.keyFactors) ? explanation.keyFactors : []),
      ...(Array.isArray(presentation.keyFactors) ? presentation.keyFactors : [])
    ].map(String).map(item => item.trim()).filter(Boolean)));
    const alternatives = Array.isArray(explanation.alternatives) ? explanation.alternatives.map(String).filter(Boolean) : [];
    if (reasons.length) sections.push({ title: 'Почему', items: reasons, open: true, kind: 'why' });
    if (factors.length) sections.push({ title: 'Ключевые факторы', items: factors, open: false, kind: 'factors' });
    if (alternatives.length) sections.push({ title: 'Что изменило бы решение', items: alternatives, open: false, kind: 'alternatives' });
    if (explanation.takeaway) sections.push({ title: 'Запомнить', items: [String(explanation.takeaway)], open: false, kind: 'takeaway' });
    const math = mathItems(explanation.math);
    if (math.length) sections.push({ title: 'Математика', items: math, open: false, kind: 'math' });
    const status = qualityStatus(quality);
    const qualityScore = quality.isRated === true ? finite(quality.score) : null;
    const qualityGrade = qualityScore !== null ? String(quality.grade || '') : '';
    const qualityLabel = qualityScore !== null ? (QUALITY_LABELS[String(quality.classification || '').toUpperCase()] || '') : '';
    return {
      actionLabel,
      status,
      statusIcon: STATUS[status].icon,
      statusLabel: STATUS[status].label,
      verdict: verdict(status, actionLabel),
      qualityScore,
      qualityGrade,
      qualityLabel,
      summary: compactSummary(explanation.summary, actionLabel),
      confidenceExplanation: String(explanation.confidenceExplanation || ''),
      decisionQualityExplanation: String(explanation.decisionQualityExplanation || ''),
      hasMath: math.length > 0,
      primaryReasons: reasons,
      supportingSections: sections.filter(section => section.kind !== 'why'),
      sections
    };
  }

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function setDisclosureExpanded(details, expanded) {
    if (!details) return false;
    details.open = Boolean(expanded);
    const summary = details.querySelector?.('summary');
    summary?.setAttribute('aria-expanded', String(details.open));
    return details.open;
  }

  function bindDisclosure(details) {
    if (!details?.addEventListener) return details;
    setDisclosureExpanded(details, details.open);
    details.addEventListener('toggle', () => setDisclosureExpanded(details, details.open));
    return details;
  }

  function appendList(document, parent, items, className) {
    const list = element(document, 'ul', className);
    items.forEach(item => list.appendChild(element(document, 'li', '', item)));
    parent.appendChild(list);
    return list;
  }

  function appendSectionContent(document, details, section) {
    if (section.kind === 'factors') {
      appendList(document, details, section.items, 'trainer-explanation__factor-list');
      return;
    }
    if (section.kind === 'math') {
      const grid = element(document, 'dl', 'trainer-explanation__math-grid');
      section.items.forEach(item => {
        const separator = item.indexOf(':');
        const label = separator >= 0 ? item.slice(0, separator) : item;
        const value = separator >= 0 ? item.slice(separator + 1).trim() : '';
        const cell = element(document, 'div', 'trainer-explanation__math-item');
        cell.append(element(document, 'dt', '', label), element(document, 'dd', '', value));
        grid.appendChild(cell);
      });
      details.appendChild(grid);
      return;
    }
    appendList(document, details, section.items, `trainer-explanation__list trainer-explanation__list--${section.kind}`);
  }

  function render(document, container, explanation, trainerResult, decisionQuality = {}, presentationDetails = {}) {
    if (!document || !container) return null;
    const model = createViewModel(explanation, trainerResult, decisionQuality, presentationDetails);
    container.replaceChildren();
    container.className = 'trainer-explanation';
    container.dataset.coachExplanation = 'ready';
    container.dataset.status = model.status;
    container.setAttribute('aria-label', 'Разбор Coach');

    const header = element(document, 'header', 'trainer-explanation__hero');
    const status = element(document, 'div', 'trainer-explanation__status');
    const statusIcon = element(document, 'span', 'trainer-explanation__status-icon', model.statusIcon);
    statusIcon.setAttribute('aria-hidden', 'true');
    status.append(statusIcon, element(document, 'span', 'trainer-explanation__status-label', model.statusLabel));
    if (model.qualityScore !== null) {
      const qualityBadge = element(document, 'span', 'trainer-explanation__quality-badge', `${Math.round(model.qualityScore)}${model.qualityGrade ? ` · ${model.qualityGrade}` : ''}`);
      qualityBadge.setAttribute('aria-label', `Качество решения: ${Math.round(model.qualityScore)}${model.qualityLabel ? `, ${model.qualityLabel}` : ''}${model.qualityGrade ? `, оценка ${model.qualityGrade}` : ''}`);
      status.appendChild(qualityBadge);
    }
    header.append(
      status,
      element(document, 'h3', 'trainer-explanation__verdict', model.verdict),
      element(document, 'p', 'trainer-explanation__summary', model.summary)
    );
    if (model.confidenceExplanation) header.appendChild(element(document, 'p', 'trainer-explanation__confidence', model.confidenceExplanation));
    container.appendChild(header);

    if (model.primaryReasons.length) {
      const why = element(document, 'section', 'trainer-explanation__why');
      why.appendChild(element(document, 'h4', '', 'Почему'));
      appendList(document, why, model.primaryReasons, 'trainer-explanation__list trainer-explanation__list--why');
      container.appendChild(why);
    }

    const sections = element(document, 'div', 'trainer-explanation__sections');
    const idBase = container.id || 'coach-explanation';
    model.supportingSections.forEach((section, index) => {
      const details = element(document, 'details', `trainer-explanation__section trainer-explanation__section--${section.kind}`);
      details.open = section.open;
      details.dataset.section = section.title;
      const contentId = `${idBase}-detail-${index + 1}`;
      const summary = element(document, 'summary', '', section.title);
      summary.setAttribute('aria-expanded', String(details.open));
      summary.setAttribute('aria-controls', contentId);
      details.appendChild(summary);
      const content = element(document, 'div', 'trainer-explanation__detail');
      content.id = contentId;
      appendSectionContent(document, content, section);
      details.appendChild(content);
      bindDisclosure(details);
      sections.appendChild(details);
    });
    if (model.supportingSections.length) container.appendChild(sections);
    container.classList.remove('hidden');
    return model;
  }

  const api = Object.freeze({ createViewModel, setDisclosureExpanded, bindDisclosure, render });
  root.TrainerExplanationUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
