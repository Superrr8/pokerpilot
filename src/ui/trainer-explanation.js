'use strict';

(function attachTrainerExplanationUi(root) {
  const ACTION_LABELS = Object.freeze({
    FOLD: 'Fold', CHECK: 'Check', CALL: 'Call', BET: 'Bet', RAISE: 'Raise', ALL_IN: 'All-in'
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

  function createViewModel(value = {}, trainerResult = {}) {
    const explanation = object(value);
    const result = object(trainerResult);
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
    const factors = Array.isArray(explanation.keyFactors) ? explanation.keyFactors.map(String).filter(Boolean) : [];
    const alternatives = Array.isArray(explanation.alternatives) ? explanation.alternatives.map(String).filter(Boolean) : [];
    if (reasons.length) sections.push({ title: 'Почему', items: reasons, open: true });
    if (factors.length) sections.push({ title: 'Ключевые факторы', items: factors, open: false });
    if (alternatives.length) sections.push({ title: 'Что изменило бы решение', items: alternatives, open: false });
    if (explanation.takeaway) sections.push({ title: 'Запомнить', items: [String(explanation.takeaway)], open: false });
    const math = mathItems(explanation.math);
    if (math.length) sections.push({ title: 'Математика', items: math, open: false });
    return {
      actionLabel,
      summary: String(explanation.summary || ''),
      confidenceExplanation: String(explanation.confidenceExplanation || ''),
      decisionQualityExplanation: String(explanation.decisionQualityExplanation || ''),
      hasMath: math.length > 0,
      sections
    };
  }

  function element(document, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }

  function render(document, container, explanation, trainerResult) {
    if (!document || !container) return null;
    const model = createViewModel(explanation, trainerResult);
    container.replaceChildren();
    container.className = 'trainer-explanation';
    container.dataset.coachExplanation = 'ready';

    const header = element(document, 'header', 'trainer-explanation__hero');
    header.append(
      element(document, 'span', 'trainer-explanation__eyebrow', 'Лучшее действие'),
      element(document, 'strong', 'trainer-explanation__action', model.actionLabel),
      element(document, 'p', 'trainer-explanation__summary', model.summary)
    );
    if (model.confidenceExplanation) header.appendChild(element(document, 'p', 'trainer-explanation__confidence', model.confidenceExplanation));
    container.appendChild(header);

    if (model.decisionQualityExplanation) {
      container.appendChild(element(document, 'p', 'trainer-explanation__quality', model.decisionQualityExplanation));
    }

    const sections = element(document, 'div', 'trainer-explanation__sections');
    model.sections.forEach(section => {
      const details = element(document, 'details', 'trainer-explanation__section');
      details.open = section.open;
      details.dataset.section = section.title;
      details.appendChild(element(document, 'summary', '', section.title));
      const list = element(document, 'ul', 'trainer-explanation__list');
      section.items.forEach(item => list.appendChild(element(document, 'li', '', item)));
      details.appendChild(list);
      sections.appendChild(details);
    });
    container.appendChild(sections);
    container.classList.remove('hidden');
    return model;
  }

  const api = Object.freeze({ createViewModel, render });
  root.TrainerExplanationUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
