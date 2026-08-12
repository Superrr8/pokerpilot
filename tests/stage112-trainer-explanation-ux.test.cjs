'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../src/ui/trainer-explanation.js');

const root = path.resolve(__dirname, '..');
const uiSource = fs.readFileSync(path.join(root, 'src/ui/trainer-explanation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/trainer-explanation.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function explanation(overrides = {}) {
  return {
    summary: 'Fold сохраняет стек против сильного диапазона.',
    reasons: ['Рука часто доминирована.', 'Цена продолжения слишком высока.'],
    keyFactors: ['позиция CO', '3-bet', 'effective stack'],
    alternatives: ['Меньший 3-bet сделал бы Call ближе.'],
    takeaway: 'Сначала оцени цену продолжения и риск доминации.',
    math: {},
    confidenceExplanation: 'Уверенность высокая.',
    decisionQualityExplanation: 'Выбранное действие совпало с рекомендацией.',
    ...overrides
  };
}

class FakeNode {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.open = false;
    this.id = '';
    this.className = '';
    this.textContent = '';
    this.classList = { remove: () => {} };
  }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  querySelector(selector) {
    if (selector === 'summary') return this.children.find(child => child.tagName === 'SUMMARY') || null;
    return null;
  }
  find(className) {
    if (this.className.split(/\s+/).includes(className)) return this;
    for (const child of this.children) {
      const match = child.find?.(className);
      if (match) return match;
    }
    return null;
  }
}

const fakeDocument = { createElement(tag) { return new FakeNode(tag); } };

test('immediate verdict использует существующую Decision Quality classification', () => {
  const good = UI.createViewModel(explanation(), { actionClass: 'FOLD' }, { isRated: true, classification: 'EXCELLENT' });
  const mistake = UI.createViewModel(explanation(), { actionClass: 'FOLD' }, { isRated: true, classification: 'MISTAKE' });
  assert.equal(good.status, 'strong');
  assert.match(good.verdict, /Хорошее решение.*Fold/);
  assert.equal(mistake.status, 'mistake');
  assert.match(mistake.verdict, /Лучше сыграть.*Fold/);
});

test('Why остаётся сразу видимым, supporting detail свёрнут по умолчанию', () => {
  const model = UI.createViewModel(explanation(), { actionClass: 'FOLD' }, { isRated: true, classification: 'GOOD' });
  assert.deepEqual(model.primaryReasons, explanation().reasons);
  assert.deepEqual(model.supportingSections.map(section => section.title), ['Ключевые факторы', 'Что изменило бы решение', 'Запомнить']);
  assert.ok(model.supportingSections.every(section => section.open === false));
});

test('empty optional sections omitted without placeholder cards', () => {
  const model = UI.createViewModel(explanation({ keyFactors: [], alternatives: [], takeaway: '', math: {} }), { actionClass: 'CHECK' });
  assert.deepEqual(model.supportingSections, []);
  assert.equal(model.hasMath, false);
});

test('math remains secondary and uses only supplied explanation values', () => {
  const model = UI.createViewModel(explanation({ math: { equity: 0.34, requiredEquity: 0.25, callEV: 4.2, outs: 9 } }), { actionClass: 'CALL', amount: 20 });
  const math = model.sections.find(section => section.title === 'Математика');
  assert.equal(math.kind, 'math');
  assert.match(math.items.join(' '), /34%/);
  assert.match(math.items.join(' '), /\+\$4/);
});

test('disclosure state synchronizes open and aria-expanded in both directions', () => {
  const attributes = {};
  const summary = { setAttribute(name, value) { attributes[name] = String(value); } };
  const details = { open: false, querySelector(selector) { return selector === 'summary' ? summary : null; } };
  UI.setDisclosureExpanded(details, true);
  assert.equal(details.open, true);
  assert.equal(attributes['aria-expanded'], 'true');
  UI.setDisclosureExpanded(details, false);
  assert.equal(details.open, false);
  assert.equal(attributes['aria-expanded'], 'false');
});

test('render builds verdict, visible Why and interactive supporting disclosures', () => {
  const container = new FakeNode('div');
  container.id = 'coachFixture';
  const model = UI.render(fakeDocument, container, explanation(), { actionClass: 'FOLD' }, { isRated: true, classification: 'EXCELLENT' });
  assert.equal(container.dataset.status, 'strong');
  assert.equal(container.find('trainer-explanation__verdict').textContent, model.verdict);
  assert.equal(container.find('trainer-explanation__why').tagName, 'SECTION');
  const details = container.find('trainer-explanation__section');
  const summary = details.querySelector('summary');
  assert.equal(summary.attributes['aria-expanded'], 'false');
  details.open = true;
  details.listeners.toggle();
  assert.equal(summary.attributes['aria-expanded'], 'true');
});

test('rated result keeps a compact accessible Decision Quality badge inside Coach', () => {
  const container = new FakeNode('div');
  container.id = 'ratedCoach';
  UI.render(fakeDocument, container, explanation(), { actionClass: 'CALL' }, { isRated: true, score: 96, grade: 'A+', classification: 'EXCELLENT' });
  const badge = container.find('trainer-explanation__quality-badge');
  assert.equal(badge.textContent, '96 · A+');
  assert.match(badge.attributes['aria-label'], /Качество решения.*96.*Отлично/);
  assert.doesNotMatch(badge.attributes['aria-label'], /Decision Quality/);
});

test('primary verdict does not render a second Decision Quality explanation block', () => {
  const container = new FakeNode('div');
  UI.render(fakeDocument, container, explanation(), { actionClass: 'FOLD' }, {
    isRated: true,
    score: 98,
    grade: 'A+',
    classification: 'EXCELLENT'
  });
  assert.equal(container.find('trainer-explanation__quality'), null);
  assert.equal(container.find('trainer-explanation__quality-badge').textContent, '98 · A+');
});

test('Study and Ranges suppress the legacy verdict block once Coach is ready', () => {
  const supersededAssignments = html.match(/className\s*=\s*`feedback \$\{[^}]+\} trainer-feedback-superseded`/g) || [];
  assert.equal(supersededAssignments.length, 2);
  assert.match(css, /\.trainer-feedback-superseded\s*\{[^}]*display:\s*none/);
});

test('summary removes a duplicated leading recommended action', () => {
  const model = UI.createViewModel(explanation({
    summary: 'Fold — базовая линия Trainer для 96o из позиции BTN.'
  }), { actionClass: 'FOLD' }, { isRated: true, classification: 'EXCELLENT' });
  assert.equal(model.verdict, 'Хорошее решение: Fold');
  assert.equal(model.summary, 'Базовая линия Trainer для 96o из позиции BTN.');
});

test('presentation-only range detail is folded into existing key factors', () => {
  const model = UI.createViewModel(
    explanation(),
    { actionClass: 'FOLD' },
    { isRated: true, classification: 'EXCELLENT' },
    { keyFactors: ['Учебный диапазон: 22+, A2s+, K9s+'] }
  );
  const factors = model.supportingSections.find(section => section.kind === 'factors');
  assert.ok(factors);
  assert.match(factors.items.join(' '), /Учебный диапазон: 22\+, A2s\+, K9s\+/);
});

test('native summary keeps keyboard semantics and toggle updates aria-expanded', () => {
  assert.match(uiSource, /createElement\(['"]summary['"]\)|element\(document,\s*['"]summary['"]/);
  assert.match(uiSource, /addEventListener\(['"]toggle['"]/);
  assert.match(uiSource, /aria-expanded/);
});

test('status presentation combines text and icon instead of color alone', () => {
  assert.match(uiSource, /trainer-explanation__status-icon/);
  assert.match(uiSource, /trainer-explanation__status-label/);
  assert.match(css, /data-status="strong"/);
  assert.match(css, /data-status="mistake"/);
  assert.doesNotMatch(css, /data-status="strong"[^}]*trainer-explanation__verdict/);
});

test('premium compact layout has bounded desktop width and 390px contract', () => {
  assert.match(css, /width:\s*min\(100%,\s*720px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /trainer-explanation__factor-list/);
  assert.match(css, /trainer-explanation__math-grid/);
});

test('subtle entrance/disclosure motion has reduced-motion fallback', () => {
  assert.match(css, /@keyframes\s+coach-result-enter/);
  assert.match(css, /transform:\s*translateY/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('Hand Lab, Study and Ranges pass existing Decision Quality to presentation only', () => {
  assert.match(html, /TrainerExplanationUI\.render\(document,\s*container,\s*explanation,\s*trainerResult,\s*decisionQuality,\s*presentationDetails\)/);
  assert.ok(html.indexOf('id="studyExplanation"') < html.indexOf('id="studyDecisionQuality"'));
  assert.ok(html.indexOf('id="rangeExplanation"') < html.indexOf('id="rangeDecisionQuality"'));
  assert.doesNotMatch(uiSource, /PokerCore|calculateEquity|callEV\s*\(/);
});

test('Ranges moves raw training range into Coach details and keeps it off the exposed legacy footer', () => {
  assert.match(html, /Учебный диапазон:\s*\$\{s\.range\}/);
  assert.match(html, /keyFactors:\s*\[`Учебный диапазон:/);
  assert.doesNotMatch(html, /rangeCoachAnswer[^\n]*innerHTML[^\n]*Учебный диапазон/);
});

test('Study and Ranges reserve safe bottom space above fixed navigation', () => {
  assert.match(css, /#screen-study,\s*\n#screen-ranges\s*\{[\s\S]*?padding-bottom:\s*calc\([^;]*safe-area-inset-bottom/);
});
