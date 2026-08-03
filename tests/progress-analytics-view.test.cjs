'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src', 'ui', 'progress-analytics-view.js');
const cssPath = path.join(root, 'src', 'styles', 'progress-analytics-view.css');
const htmlPath = path.join(root, 'index.html');
let View = null;
let loadError = null;
try {
  View = require(modulePath);
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(View);
  return View;
}

function analytics(overrides = {}) {
  return {
    generatedAt: '2026-08-03T18:00:00.000Z',
    period: { id: '7d', label: '7 дней' },
    coverage: { isPartial: false, startsAt: '2026-08-01T12:00:00Z', reason: null },
    current: { lifetimeXp: 75, level: 1, rank: 'Новичок', pokerIq: 1550, currentStreak: 1, longestStreak: 2 },
    periodSummary: { xpGained: 75, activeDays: 2, acceptedEvents: 3, trainingScenarios: 1, trainerDecisions: 1, exams: 1, averageXpPerActiveDay: 37.5 },
    series: {
      dailyActivity: [{ day: '2026-08-02', value: 1 }, { day: '2026-08-03', value: 2 }],
      dailyXp: [{ day: '2026-08-02', value: 60 }, { day: '2026-08-03', value: 15 }],
      pokerIq: [{ day: '2026-08-03', value: 1550 }]
    },
    pokerIqHistory: { available: true, isPartial: false },
    eventBreakdown: [{ id: 'trainingScenarios', label: 'Тренировочные сценарии', count: 1, percent: 33 }],
    recentActivity: [{ type: 'TRAINING_SCENARIO_COMPLETED', label: 'Сценарий тренировки завершён', timestamp: '2026-08-03T12:00:00Z', xp: 15 }],
    ...overrides
  };
}

test('presentation model покрывает summary, charts, breakdown и recent activity', () => {
  const model = api().createViewModel(analytics());
  assert.equal(model.summary.length, 6);
  assert.equal(model.activity.bars.length, 2);
  assert.equal(model.xp.bars.length, 2);
  assert.equal(model.pokerIq.available, true);
  assert.equal(model.breakdown.length, 1);
  assert.equal(model.recent.length, 1);
  assert.doesNotMatch(JSON.stringify(model.recent), /scenario|eventId/i);
});

test('empty state и partial coverage отображаются честно', () => {
  const model = api().createViewModel(analytics({
    coverage: { isPartial: true, startsAt: '2026-08-03T00:00:00Z', reason: 'LEGACY_TOTALS_WITHOUT_DETAILED_HISTORY' },
    periodSummary: { xpGained: 0, activeDays: 0, acceptedEvents: 0, trainingScenarios: 0, trainerDecisions: 0, exams: 0, averageXpPerActiveDay: 0 },
    series: { dailyActivity: [], dailyXp: [], pokerIq: [] },
    pokerIqHistory: { available: false, isPartial: true },
    eventBreakdown: [], recentActivity: []
  }));
  assert.equal(model.empty, true);
  assert.match(model.coverageNotice, /с момента обновления аналитики/i);
  assert.equal(model.pokerIq.available, false);
});

test('malformed analytics input не создаёт NaN/Infinity', () => {
  const model = api().createViewModel(null);
  assert.doesNotMatch(JSON.stringify(model), /NaN|Infinity/);
  assert.equal(model.empty, true);
});

test('controller поддерживает 7d/30d/all и неизвестный fallback без mutations', () => {
  const periods = [];
  const controller = api().createController({
    getAnalyticsSnapshot: options => {
      periods.push(options.period);
      return analytics({ period: { id: options.period, label: options.period } });
    },
    onRender: () => {}, onVisibilityChange: () => {}
  });
  controller.open();
  controller.setPeriod('30d');
  controller.setPeriod('all');
  controller.setPeriod('unknown');
  assert.deepEqual(periods, ['7d', '30d', 'all', '7d']);
  controller.destroy();
});

test('HTML подключает Analytics из Progress Overview и содержит доступный контракт', () => {
  api();
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.match(html, /id="progressAnalyticsOpen"/);
  assert.match(html, /id="progressAnalytics"/);
  assert.match(html, /id="progressAnalyticsBack"/);
  assert.match(html, /data-analytics-period="7d"[^>]+aria-pressed="true"/);
  assert.match(html, /data-analytics-period="30d"[^>]+aria-pressed="false"/);
  assert.match(html, /data-analytics-period="all"[^>]+aria-pressed="false"/);
  assert.match(html, /src\/ui\/progress-analytics-view\.js/);
  assert.match(html, /src\/styles\/progress-analytics-view\.css/);
});

test('source read-only: нет storage/progress mutation и безопасный DOM rendering', () => {
  api();
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /localStorage|recordEvent|addXp|applyProgressEvent|evaluateAchievements/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
  assert.match(source, /textContent\s*=/);
  assert.match(source, /replaceChildren/);
  assert.match(source, /aria-pressed/);
});

test('CSS обеспечивает mobile, safe area, focus, reduced motion и no overflow', () => {
  api();
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /min-height:\s*44px/);
});

test('repeated create возвращает один mount и destroy снимает listeners', () => {
  const view = api();
  class FakeNode {
    constructor() { this.listeners = new Map(); this.dataset = {}; this.hidden = false; }
    addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
    removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler)); }
    setAttribute() {}
    focus() {}
  }
  const nodes = {
    '#progressAnalytics': new FakeNode(), '#screen-profile': new FakeNode(),
    '#progressAnalyticsOpen': new FakeNode(), '#progressAnalyticsBack': new FakeNode()
  };
  const periodButtons = ['7d', '30d', 'all'].map(period => { const node = new FakeNode(); node.dataset.analyticsPeriod = period; return node; });
  const documentRef = {
    querySelector: selector => nodes[selector] || null,
    querySelectorAll: selector => selector === '[data-analytics-period]' ? periodButtons : []
  };
  const options = { documentRef, getAnalyticsSnapshot: () => analytics() };
  const first = view.create(options);
  const second = view.create(options);
  assert.strictEqual(first, second);
  assert.equal(nodes['#progressAnalyticsOpen'].listeners.get('click').length, 1);
  first.destroy();
  assert.equal(nodes['#progressAnalyticsOpen'].listeners.get('click').length, 0);
});
