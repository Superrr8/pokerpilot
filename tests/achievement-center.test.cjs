'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src', 'ui', 'achievement-center.js');
const cssPath = path.join(root, 'src', 'styles', 'achievement-center.css');
const htmlPath = path.join(root, 'index.html');
let Config = null;
let Center = null;
let loadError = null;
try {
  Config = require('../src/progress/achievement-config.js');
  Center = require(modulePath);
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(Center);
  return Center;
}

function currentSnapshot() {
  return {
    lifetimeXp: 45,
    counters: { trainingScenarios: 4, trainerDecisions: 18, exams: 0 },
    pokerIq: { score: 55, isRated: true },
    level: { level: 2 },
    streak: { current: 1 },
    rank: { id: 'INTERMEDIATE', label: 'Средний уровень' },
    achievements: {
      unlockedCount: 2,
      totalCount: 10,
      items: [
        { id: 'FIRST_STEP', unlocked: true, unlockedAt: '2026-08-03T12:00:00.000Z' },
        { id: 'EXAM_READY', unlocked: true, unlockedAt: null },
        { id: 'UNKNOWN_OLD', unlocked: true, unlockedAt: '2020-01-01T00:00:00Z' }
      ],
      history: [
        { id: 'FIRST_STEP', unlockedAt: '2026-08-03T12:00:00.000Z' },
        { id: 'FIRST_STEP', unlockedAt: '2026-08-04T12:00:00.000Z' },
        { id: 'UNKNOWN_OLD', unlockedAt: '2020-01-01T00:00:00Z' }
      ]
    }
  };
}

test('All, Unlocked и Locked фильтры показывают правильные карточки и counters', () => {
  const center = api();
  const catalog = Config.getAchievementCatalog();
  const all = center.createViewModel({ catalog, snapshot: currentSnapshot(), filter: 'all' });
  const unlocked = center.createViewModel({ catalog, snapshot: currentSnapshot(), filter: 'unlocked' });
  const locked = center.createViewModel({ catalog, snapshot: currentSnapshot(), filter: 'locked' });
  assert.equal(all.items.length, 10);
  assert.equal(unlocked.items.length, 2);
  assert.equal(locked.items.length, 8);
  assert.equal(all.unlockedCount, 2);
  assert.equal(all.totalCount, 10);
  assert.equal(all.completionPercent, 20);
  assert.equal(center.createViewModel({ catalog, snapshot: currentSnapshot(), filter: 'wat' }).filter, 'all');
});

test('карточки идут детерминированно: unlocked, затем locked, внутри — catalog order', () => {
  const model = api().createViewModel({
    catalog: Config.getAchievementCatalog(), snapshot: currentSnapshot(), filter: 'all'
  });
  assert.deepEqual(model.items.slice(0, 2).map(item => item.id), ['FIRST_STEP', 'EXAM_READY']);
  assert.deepEqual(model.items.slice(2).map(item => item.id),
    Config.ACHIEVEMENT_IDS.filter(id => !['FIRST_STEP', 'EXAM_READY'].includes(id)));
});

test('unlock date берётся безопасно, duplicate history и unknown ID не создают карточки', () => {
  const model = api().createViewModel({
    catalog: Config.getAchievementCatalog(), snapshot: currentSnapshot(), filter: 'all'
  });
  assert.equal(model.items.filter(item => item.id === 'FIRST_STEP').length, 1);
  assert.equal(model.items.find(item => item.id === 'FIRST_STEP').dateLabel, '03.08.2026');
  assert.equal(model.items.find(item => item.id === 'EXAM_READY').dateLabel, null);
  assert.equal(model.items.some(item => item.id === 'UNKNOWN_OLD'), false);
});

test('locked/unlocked, rarity и accessible progress представлены в view model', () => {
  const model = api().createViewModel({
    catalog: Config.getAchievementCatalog(), snapshot: currentSnapshot(), filter: 'all'
  });
  const unlocked = model.items.find(item => item.id === 'FIRST_STEP');
  const locked = model.items.find(item => item.id === 'QUICK_LEARNER');
  assert.equal(unlocked.statusLabel, 'Открыто');
  assert.equal(locked.statusLabel, 'Не открыто');
  assert.equal(locked.rarity, 'COMMON');
  assert.equal(locked.rarityLabel, 'Обычное');
  assert.equal(locked.progress.label, '4 / 10 сценариев');
  assert.match(locked.progress.ariaLabel, /Быстро учусь.*4.*10/);
});

test('повреждённый snapshot и пустой catalog дают безопасное состояние', () => {
  const center = api();
  const malformed = center.createViewModel({ catalog: Config.getAchievementCatalog(), snapshot: null });
  assert.equal(malformed.items.length, 10);
  assert.equal(malformed.unlockedCount, 0);
  assert.equal(malformed.completionPercent, 0);
  const empty = center.createViewModel({ catalog: [], snapshot: currentSnapshot() });
  assert.equal(empty.items.length, 0);
  assert.match(empty.emptyMessage, /Пока нет/);
});

test('controller refresh использует snapshot, фильтр локален, duplicate refresh не меняет business state', () => {
  const center = api();
  const source = currentSnapshot();
  const renders = [];
  const controller = center.createController({
    getSnapshot: () => source,
    getCatalog: () => Config.getAchievementCatalog(),
    onRender: model => renders.push(model),
    onVisibilityChange: () => {}
  });
  controller.open();
  controller.setFilter('locked');
  controller.refresh();
  assert.equal(renders.at(-1).filter, 'locked');
  assert.equal(renders.at(-1).items.length, 8);
  assert.equal(source.achievements.unlockedCount, 2);
  controller.destroy();
  assert.equal(controller.getState().destroyed, true);
  assert.equal(controller.refresh(), false);
});

test('source contract не содержит XP/event/storage mutation и подключён в Profile', () => {
  api();
  const source = fs.existsSync(modulePath) ? fs.readFileSync(modulePath, 'utf8') : '';
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.doesNotMatch(source, /localStorage|recordEvent|addXp|evaluateAchievements|applyProgressEvent/);
  assert.match(html, /id="achievementCenter"/);
  assert.match(html, /id="progressAchievementsOpen"/);
  assert.match(html, /id="achievementFilterAll"[^>]+aria-pressed/);
  assert.match(html, /src\/ui\/achievement-center\.js/);
  assert.match(html, /src\/styles\/achievement-center\.css/);
  assert.ok(fs.existsSync(cssPath));
});

test('render contract использует semantic progress, стабильные data attributes и безопасный textContent', () => {
  api();
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.match(source, /createElement\(['"]article['"]\)/);
  assert.match(source, /dataset\.achievementId/);
  assert.match(source, /dataset\.rarity/);
  assert.match(source, /dataset\.status/);
  assert.match(source, /createElement\(['"]progress['"]\)/);
  assert.match(source, /setAttribute\(['"]aria-label['"]/);
  assert.match(source, /replaceChildren/);
  assert.match(source, /\.textContent\s*=/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test('повторная инициализация возвращает тот же mount и не дублирует listeners', () => {
  const center = api();
  class FakeNode {
    constructor() {
      this.listeners = new Map();
      this.dataset = {};
      this.hidden = false;
    }
    addEventListener(type, handler) {
      const list = this.listeners.get(type) || [];
      list.push(handler);
      this.listeners.set(type, list);
    }
    removeEventListener(type, handler) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== handler));
    }
    setAttribute() {}
    focus() {}
  }
  const nodes = {
    '#achievementCenter': new FakeNode(),
    '#screen-profile': new FakeNode(),
    '#progressAchievementsOpen': new FakeNode(),
    '#achievementCenterBack': new FakeNode()
  };
  const filters = ['all', 'unlocked', 'locked'].map(filter => {
    const node = new FakeNode();
    node.dataset.achievementFilter = filter;
    return node;
  });
  const documentRef = {
    querySelector: selector => nodes[selector] || null,
    querySelectorAll: selector => selector === '[data-achievement-filter]' ? filters : []
  };
  const options = {
    documentRef,
    getSnapshot: currentSnapshot,
    getCatalog: () => Config.getAchievementCatalog()
  };
  const first = center.create(options);
  const second = center.create(options);
  assert.strictEqual(second, first);
  assert.equal(nodes['#progressAchievementsOpen'].listeners.get('click').length, 1);
  first.destroy();
  assert.equal(nodes['#progressAchievementsOpen'].listeners.get('click').length, 0);
});

test('CSS обеспечивает focus, reduced motion, safe area и mobile без horizontal overflow', () => {
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
});
