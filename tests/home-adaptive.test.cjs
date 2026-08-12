'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCourseProgress } = require('./learning-course-loader.cjs');

const root = path.resolve(__dirname, '..');
const dashboardPath = path.join(root, 'src', 'ui', 'dashboard.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeCssPath = path.join(root, 'src', 'styles', 'home.css');

function loadDashboard() {
  const source = fs.readFileSync(dashboardPath, 'utf8');
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox, {
    name: 'PokerPilot adaptive Home sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, { filename: 'src/ui/dashboard.js' })
    .runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.PokerPilotDashboard || sandbox.module.exports;
}

function state(overrides = {}) {
  const { course, api } = loadCourseProgress();
  return {
    progress: {
      decisions: 0,
      scorePoints: 0,
      maxPoints: 0,
      streak: 0,
      mistakes: {},
      history: [],
      savedHands: [],
      learning: api.defaultState(),
      ...(overrides.progress || {})
    },
    course,
    courseProgress: api,
    profile: {
      displayName: 'Player',
      progression: {
        level: 1,
        totalXp: 0,
        xpIntoLevel: 0,
        xpToNextLevel: 500
      },
      ...(overrides.profile || {})
    },
    pokerIQ: overrides.pokerIQ || null,
    statistics: overrides.statistics || {},
    now: overrides.now || new Date('2026-07-31T19:00:00Z')
  };
}

test('Adaptive Home экспортирует чистые selector и view-model helpers', () => {
  const dashboard = loadDashboard();
  for (const name of ['getHomeNextAction', 'getHomeProgressSnapshot', 'buildHomeViewModel']) {
    assert.equal(typeof dashboard[name], 'function', name);
  }
});

test('resumable lesson имеет приоритет над weak topic и recent hand', () => {
  const input = state();
  const module = input.course.modules[0];
  input.progress.learning.current = {
    moduleId: module.id,
    lessonId: module.lessons[0].id,
    view: 'lesson'
  };
  input.progress.mistakes.position = 4;
  input.progress.savedHands.push({ id: 'saved-1', timestamp: '2026-07-31T18:00:00.000Z' });
  const action = loadDashboard().getHomeNextAction(input);
  assert.equal(action.type, 'resume-learning');
  assert.equal(action.target, 'learning');
  assert.equal(action.resume, true);
});

test('reliable weak topic имеет приоритет над recent activity', () => {
  const input = state({
    progress: {
      mistakes: { pot_odds: 3 },
      savedHands: [{ id: 'saved-1', timestamp: '2026-07-31T18:00:00.000Z' }]
    }
  });
  const action = loadDashboard().getHomeNextAction(input);
  assert.equal(action.type, 'weak-topic-training');
  assert.equal(action.target, 'study');
  assert.match(action.title, /пот-оддс/i);
});

test('recent saved hand используется, когда нет resumable learning и weakness', () => {
  const input = state({
    progress: {
      savedHands: [{ id: 'saved-1', timestamp: '2026-07-31T18:00:00.000Z' }]
    }
  });
  const action = loadDashboard().getHomeNextAction(input);
  assert.equal(action.type, 'review-hand');
  assert.equal(action.target, 'analyzer');
});

test('default next action стабильно ведёт в быструю тренировку', () => {
  const action = loadDashboard().getHomeNextAction(state());
  assert.deepEqual(
    {
      type: action.type,
      title: action.title,
      description: action.description,
      meta: action.meta,
      actionLabel: action.actionLabel,
      target: action.target
    },
    {
      type: 'quick-training',
      title: 'Быстрая тренировка',
      description: 'Короткая серия решений для поддержания формы.',
      meta: '5 раздач · около 4 минут',
      actionLabel: 'Начать тренировку',
      target: 'study'
    }
  );
});

test('missing и malformed state безопасно дают default action', () => {
  const dashboard = loadDashboard();
  assert.doesNotThrow(() => dashboard.buildHomeViewModel(null));
  assert.doesNotThrow(() => dashboard.buildHomeViewModel({
    progress: 'broken',
    course: { modules: 'broken' },
    profile: null,
    pokerIQ: { score: Infinity }
  }));
  assert.equal(dashboard.getHomeNextAction({ progress: null }).type, 'quick-training');
});

test('progress adapter не придумывает IQ или day streak', () => {
  const progress = loadDashboard().getHomeProgressSnapshot(state());
  assert.equal(progress.pokerIQ.value, '—');
  assert.equal(progress.pokerIQ.detail, 'Не рассчитан');
  assert.equal(progress.level.value, '1');
  assert.equal(progress.level.detail, '0 / 500 XP');
  assert.equal(progress.streak.value, '0');
  assert.match(progress.streak.detail, /нет серии/i);
});

test('progress adapter использует реальные Poker IQ, XP и decision streak', () => {
  const progress = loadDashboard().getHomeProgressSnapshot(state({
    progress: { streak: 7 },
    profile: {
      displayName: 'Vlad',
      progression: { level: 4, totalXp: 1700, xpIntoLevel: 450, xpToNextLevel: 1000 }
    },
    pokerIQ: {
      isRated: true,
      score: 1899,
      rank: { label: 'Эксперт' }
    },
    statistics: { currentDecisionStreak: 7 }
  }));
  assert.deepEqual({ ...progress.pokerIQ }, { label: 'Poker IQ', value: '1899', detail: 'Эксперт' });
  assert.deepEqual({ ...progress.level }, {
    label: 'Уровень',
    value: '4',
    detail: '450 / 1000 XP',
    percent: 45
  });
  assert.equal(progress.streak.value, '7');
  assert.equal(progress.streak.detail, 'решений подряд');
});

test('Home view model содержит ровно три action shortcuts с валидными routes', () => {
  const model = loadDashboard().buildHomeViewModel(state());
  assert.deepEqual(
    Array.from(model.quickActions, action => action.label),
    ['Тренировка', 'Ввести раздачу', 'Equity']
  );
  assert.deepEqual(
    Array.from(model.quickActions, action => action.target),
    ['study', 'analyzer', 'analyzer']
  );
  const validTargets = new Set(['learning', 'training', 'study', 'analyzer', 'profile', 'live']);
  assert.ok(validTargets.has(model.nextAction.target));
  assert.ok(model.quickActions.every(action => validTargets.has(action.target)));
});

test('Home markup имеет один primary CTA и не дублирует top-level navigation cards', () => {
  assert.match(html, /id="dashboardContinue"[^>]+data-route=/);
  assert.match(html, /id="dashboardQuickActions"/);
  assert.equal((html.match(/class="[^"]*home-primary-action[^"]*"/g) || []).length, 1);
  const home = html.match(/<section id="screen-home"[\s\S]*?<\/section>\s*<section id="screen-learning"/)?.[0] || '';
  assert.doesNotMatch(home, /dashboard-mode-card/);
  for (const label of ['Обучение', 'Тренировка', 'Разбор', 'Профиль']) {
    assert.doesNotMatch(home, new RegExp(`<strong>${label}<\\/strong>`));
  }
});

test('compact Home header скрывает contextual controls, сохраняя их в приложении', () => {
  assert.match(html, /id="homeProfileEntry"/);
  assert.match(html, /class="[^"]*top-navigation-actions/);
  assert.match(html, /id="soundToggle"/);
  assert.match(html, /id="soundVolume"/);
  assert.match(html, /class="[^"]*top-stakes/);
});

test('Adaptive Home CSS подключён и поддерживает mobile, safe area и reduced motion', () => {
  assert.ok(fs.existsSync(homeCssPath), 'Нет src/styles/home.css');
  const css = fs.readFileSync(homeCssPath, 'utf8');
  assert.match(html, /<link rel="stylesheet" href="src\/styles\/home\.css">/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /env\(safe-area-inset-(?:top|bottom)\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  const componentDeclarations = css
    .split('\n')
    .filter((line) => !line.trim().startsWith('@media'))
    .join('\n');
  assert.doesNotMatch(componentDeclarations, /min-width:\s*(?:4[4-9]\d|[5-9]\d\d)px/);
});
