'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeCss = fs.readFileSync(path.join(root, 'src', 'styles', 'home.css'), 'utf8');
const liveSessionCss = fs.readFileSync(path.join(root, 'src', 'styles', 'live-session.css'), 'utf8');
const localizationPath = path.join(root, 'src', 'ui', 'translations.js');
const I18n = require(localizationPath);
const CYRILLIC = /[А-Яа-яЁё]/;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function activateLocale(locale) {
  const storage = memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: locale });
  const manager = I18n.createLocalization({ storage, navigatorRef: {}, documentRef: null });
  global.PokerElevateI18n = manager;
  global.PokerPilotI18n = manager;
  return { manager, storage };
}

function reload(relative) {
  const filename = path.join(root, relative);
  delete require.cache[require.resolve(filename)];
  return require(filename);
}

function dashboardModel(locale) {
  activateLocale(locale);
  reload('src/progress/weakness-model.js');
  const Dashboard = reload('src/ui/dashboard.js');
  return Dashboard.buildHomeViewModel({
    now: new Date('2026-09-09T18:00:00.000Z'),
    profile: { displayName: 'Alex' },
    progress: {
      decisions: 12,
      maxPoints: 36,
      scorePoints: 27,
      history: [{ mode: 'session', title: 'Live Cash $1/$3 • 2 рук' }],
      savedHands: [],
      learning: {}
    },
    progressSnapshot: {
      pokerIq: { isRated: true, score: 68, rank: { label: locale === 'ru' ? 'Ученик' : 'Student' } },
      level: { level: 3, xpIntoLevel: 120, xpToNextLevel: 500 },
      streak: { current: 4 },
      skills: {
        discipline: { attempts: 18, score: 64, confidence: 'high', recentTrend: 'STABLE' }
      }
    },
    course: { modules: [] },
    courseProgress: {}
  });
}

function progressionSnapshot() {
  return {
    level: { level: 4, totalXp: 760, xpIntoLevel: 260, xpToNextLevel: 500 },
    rank: { label: 'Student' },
    pokerIq: {
      isRated: true,
      score: 67,
      ratedDecisions: 34,
      sampleStatus: 'ESTABLISHED',
      rank: { label: 'Student', progressPercent: 48 },
      trend: { direction: 'UP', delta: 3 },
      components: { consistency: 81 },
      breakdown: { preflop: 72, flop: 64 }
    },
    decisionQuality: {
      isRated: true,
      score: 78,
      ratedDecisions: 34,
      classification: 'GOOD'
    },
    streak: { current: 4, best: 7, lastQualifiedDate: '2026-09-09' },
    skills: {
      discipline: { attempts: 18, score: 64, confidence: 'high', recentTrend: 'STABLE' },
      preflop: { attempts: 12, score: 76, confidence: 'medium', recentTrend: 'UP' }
    },
    achievements: { items: [], totalCount: 10, unlockedCount: 3 },
    recentChanges: [{ eventId: 'e1', type: 'TRAINING_DECISION_RECORDED', xp: 15, timestamp: '2026-09-09T00:00:00.000Z' }]
  };
}

test('English Dashboard runtime copy localizes Weekly Focus and Recent Activity generators', () => {
  const model = dashboardModel('en');
  assert.doesNotMatch(JSON.stringify(model), CYRILLIC);
  assert.match(model.focus.title, /discipline/i);
  assert.match(model.focus.description, /18 decisions/i);
  assert.match(model.secondaryActivity.title, /2 hands/i);
  assert.match(model.secondaryActivity.description, /decision history/i);
});

test('English Dashboard dynamic next-step and activity branches cannot emit Russian copy', () => {
  activateLocale('en');
  reload('src/progress/weakness-model.js');
  const Dashboard = reload('src/ui/dashboard.js');
  const base = { progress: { learning: {}, history: [], savedHands: [], mistakes: {} }, course: { modules: [] }, courseProgress: {} };
  const states = [
    {
      ...base,
      course: { modules: [{ id: 'm1', title: 'Starting Hands', lessons: [{ id: 'l1', title: 'Blinds' }] }] },
      progress: { ...base.progress, learning: { current: { moduleId: 'm1', lessonId: 'l1', view: 'lesson' } } }
    },
    { ...base, progress: { ...base.progress, mistakes: { sizing: 3 } } },
    { ...base, progress: { ...base.progress, savedHands: [{ id: 'hand-1' }] } },
    { ...base, progress: { ...base.progress, history: [{ mode: 'session', title: 'Live Cash $1/$3 • 1 раздача' }] } },
    base
  ];
  states.map(state => Dashboard.getHomeNextAction(state)).forEach((value, index) => {
    assert.doesNotMatch(JSON.stringify(value), CYRILLIC, `next action branch ${index}`);
  });

  const savedActivity = Dashboard.buildHomeViewModel({
    ...base,
    profile: { displayName: 'Alex' },
    progress: { ...base.progress, savedHands: [{ id: 'hand-1' }] }
  }).secondaryActivity;
  assert.doesNotMatch(JSON.stringify(savedActivity), CYRILLIC);
});

test('English Profile and Progress models localize sample, confidence, trend, and support copy', () => {
  activateLocale('en');
  const ProgressOverview = reload('src/ui/progress-overview.js');
  const Profile = reload('src/ui/profile.js');
  const snapshot = progressionSnapshot();
  const overview = ProgressOverview.createViewModel({ snapshot, displayName: 'Alex', today: '2026-09-09' });
  const profile = Profile.createViewModel({
    profile: { displayName: 'Alex', preferredGame: '$1/$3 Cash', progression: {} },
    progressSnapshot: snapshot
  });
  assert.doesNotMatch(JSON.stringify(overview), CYRILLIC);
  assert.doesNotMatch(JSON.stringify(profile), CYRILLIC);
  assert.match(overview.pokerIq.sampleLabel, /stable sample/i);
  assert.match(overview.skills.find(skill => skill.id === 'discipline').confidenceLabel, /high confidence/i);
  assert.match(overview.skills.find(skill => skill.id === 'discipline').trendLabel, /stable/i);
});

test('English Coach and Trainer explanation generators cannot emit Russian factor or narrative copy', () => {
  activateLocale('en');
  const Engine = reload('src/training/trainer-explanation-engine.js');
  const UI = reload('src/ui/trainer-explanation.js');
  const explanation = Engine.generateExplanation({
    street: 'preflop',
    handClass: 'AKs',
    position: 'CO',
    opponents: 1,
    actionContext: 'vs_3bet',
    stack: 25,
    bet: 42,
    trainerResult: {
      actionClass: 'ALL_IN',
      amount: 25,
      confidence: 'high',
      isMarginal: false,
      alternatives: [],
      math: null
    },
    decisionQuality: { isRated: true, score: 88, grade: 'A' }
  });
  const presentation = UI.createViewModel(explanation, { actionClass: 'ALL_IN', amount: 25 }, {
    isRated: true, score: 88, grade: 'A', classification: 'GOOD'
  }, { keyFactors: ['Учебный диапазон: QQ+,AKs'] });
  assert.doesNotMatch(JSON.stringify(explanation), CYRILLIC);
  assert.doesNotMatch(JSON.stringify(presentation), CYRILLIC);
  assert.match(explanation.keyFactors.join(' '), /faces a 3-bet/i);
});

test('English Trainer explanation branches keep every generated factor and narrative free of Russian copy', () => {
  activateLocale('en');
  const Engine = reload('src/training/trainer-explanation-engine.js');
  const cases = [
    ['AA', 'UTG', 'firstin', 'RAISE', 1],
    ['88', 'MP', 'firstin', 'CALL', 1],
    ['22', 'BTN', 'firstin', 'CALL', 1],
    ['AQs', 'CO', 'vs_raise_early', 'CALL', 1],
    ['K6s', 'HJ', 'limpers', 'RAISE', 3],
    ['K6o', 'CO', 'vs_raise_late', 'FOLD', 1],
    ['A6o', 'BB', 'blind_defense', 'CALL', 1],
    ['76s', 'BTN', 'firstin', 'RAISE', 1],
    ['86s', 'CO', 'limpers', 'CALL', 2],
    ['98o', 'SB', 'vs_3bet', 'FOLD', 1]
  ];
  for (const [handClass, position, actionContext, actionClass, opponents] of cases) {
    const explanation = Engine.generateExplanation({
      street: 'preflop', handClass, position, actionContext, opponents, limpers: opponents,
      trainerResult: { actionClass, confidence: 'medium', alternatives: [], math: null }
    });
    assert.doesNotMatch(JSON.stringify(explanation), CYRILLIC, `${handClass}/${actionContext}`);
  }
  const postflop = Engine.generateExplanation({
    street: 'flop', position: 'BTN', positionState: 'ip', actionContext: 'facing_bet', opponents: 2,
    board: [{ r: 14, s: 's' }, { r: 10, s: 's' }, { r: 9, s: 'h' }],
    boardTexture: { twoTone: true, connected: true, wet: true },
    math: { handName: 'one pair', equity: 0.42, requiredEquity: 0.3, outs: 9, nextCardProbability: 0.19, callEV: 8, spr: 3.4 },
    trainerResult: { actionClass: 'CALL', confidence: 'high', alternatives: [], math: null }
  });
  assert.doesNotMatch(JSON.stringify(postflop), CYRILLIC);
});

test('Live Hand Flow formats structured actions in the active locale instead of leaking stored Russian text', () => {
  activateLocale('en');
  let SavedHands = reload('src/live/saved-hands.js');
  const blind = { type: 'POST_BLIND', amount: 1, text: 'YOU ставит SB $1' };
  assert.equal(SavedHands.formatAction(blind), 'POST $1');
  assert.doesNotMatch(SavedHands.formatAction(blind), CYRILLIC);
  assert.equal(SavedHands.formatAction({ type: 'SHOWDOWN', text: 'REG показывает flush.' }), 'REG shows flush.');
  assert.equal(SavedHands.formatAction({ type: 'RESULT', text: 'REG выигрывает $12.' }), 'REG wins $12.');
  assert.equal(SavedHands.formatAction({ type: 'RESULT', text: 'Банк $12 разделён между 2 игроками.' }), 'Pot $12 is split between 2 players.');
  assert.equal(SavedHands.formatAction({ type: 'INFO', text: 'Твой ход: SB • J4o' }), 'Your turn: SB • J4o');
  assert.equal(SavedHands.formatAction({ type: 'INFO', text: 'Твой ход на флоп' }), 'Your turn on flop');

  activateLocale('ru');
  SavedHands = reload('src/live/saved-hands.js');
  assert.equal(SavedHands.formatAction(blind), 'СТАВИТ $1');
});

test('Live paused and completed state labels use localized DOM copy instead of Russian CSS content', () => {
  assert.match(html, /liveActions\.dataset\.liveStateLabel\s*=\s*phase==='paused'/);
  assert.match(html, /i18nText\('live\.sessionPaused'\)/);
  assert.match(html, /i18nText\('live\.nextHandSoon'\)/);
  assert.match(liveSessionCss, /content:\s*attr\(data-live-state-label\)/);
  const stateCopy = liveSessionCss.slice(
    liveSessionCss.indexOf('.live-v2-action-dock[data-live-dock-state="paused"] #liveActions::before'),
    liveSessionCss.indexOf('.live-v2-coach-trigger')
  );
  assert.doesNotMatch(stateCopy, CYRILLIC);
});

test('Coach report runtime generator uses locale APIs instead of Russian-only narrative literals', () => {
  const start = html.indexOf('function renderCoachReport()');
  const end = html.indexOf("$('#startFocusTraining')", start);
  const source = html.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(source, /i18nText\('coach\./);
  assert.doesNotMatch(source, CYRILLIC);
});

test('Russian mode preserves localized runtime presentation without changing canonical metrics', () => {
  const english = dashboardModel('en');
  const russian = dashboardModel('ru');
  assert.match(JSON.stringify(russian), CYRILLIC);
  assert.equal(russian.progress.level.value, english.progress.level.value);
  assert.equal(russian.focus.skillId, english.focus.skillId);
  assert.equal(russian.focus.target, english.focus.target);
  assert.equal(russian.secondaryActivity.target, english.secondaryActivity.target);
});

class FakeNode {
  constructor(id = '') {
    this.id = id;
    this.hidden = false;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = { toggle() {} };
    this.textContent = '';
    this.focused = false;
    this.nodes = new Set([this]);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  emit(type, event) { this.listeners.get(type)?.(event); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  contains(node) { return this.nodes.has(node); }
  focus() { this.focused = true; }
}

function localePickerDocument() {
  const header = new FakeNode('headerLocaleControl');
  const toggle = new FakeNode('headerLocaleToggle');
  const picker = new FakeNode('headerLocalePicker');
  const english = new FakeNode();
  const russian = new FakeNode();
  picker.hidden = true;
  english.dataset.localeChoice = 'en';
  russian.dataset.localeChoice = 'ru';
  header.nodes = new Set([header, toggle, picker, english, russian]);
  const choices = [english, russian];
  const closest = (node, selector) => {
    if (selector === '#headerLocaleToggle') return node === toggle ? toggle : null;
    if (selector === '[data-locale-choice]') return choices.includes(node) ? node : null;
    return null;
  };
  [toggle, english, russian].forEach(node => { node.closest = selector => closest(node, selector); });
  const document = new FakeNode('document');
  document.documentElement = { lang: '', dataset: {}, setAttribute(name, value) { this[name] = String(value); } };
  document.readyState = 'complete';
  document.querySelector = selector => ({
    '#headerLocaleControl': header,
    '#headerLocaleToggle': toggle,
    '#headerLocalePicker': picker,
    '#profileLanguage': null
  })[selector] ?? null;
  document.querySelectorAll = selector => selector === '[data-locale-choice]' ? choices : [];
  return { document, header, toggle, picker, english, russian };
}

test('Dashboard header flag picker opens, switches the canonical locale, persists, closes, and dismisses outside', () => {
  const storage = memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: 'en' });
  const fixture = localePickerDocument();
  const manager = I18n.createLocalization({ storage, navigatorRef: {}, documentRef: fixture.document });
  manager.mount();

  assert.equal(fixture.toggle.textContent, '🇺🇸');
  assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'false');
  fixture.header.emit('click', { target: fixture.toggle, preventDefault() {} });
  assert.equal(fixture.picker.hidden, false);
  assert.equal(fixture.toggle.getAttribute('aria-expanded'), 'true');

  fixture.header.emit('click', { target: fixture.russian, preventDefault() {} });
  assert.equal(manager.getLocale(), 'ru');
  assert.equal(storage.getItem(I18n.LOCALE_STORAGE_KEY), 'ru');
  assert.equal(fixture.toggle.textContent, '🇷🇺');
  assert.equal(fixture.picker.hidden, true);

  fixture.header.emit('click', { target: fixture.toggle, preventDefault() {} });
  fixture.document.emit('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(fixture.picker.hidden, true);
  assert.equal(fixture.toggle.focused, true);

  fixture.header.emit('click', { target: fixture.toggle, preventDefault() {} });
  fixture.document.emit('click', { target: new FakeNode('outside') });
  assert.equal(fixture.picker.hidden, true);

  const reopened = I18n.createLocalization({ storage, navigatorRef: { languages: ['en-US'] }, documentRef: null });
  assert.equal(reopened.getLocale(), 'ru');
});

test('header locale control is flag-only, accessible, compact, and exposes only approved locale options', () => {
  assert.match(html, /id="headerLocaleControl"/);
  assert.match(html, /id="headerLocaleToggle"[^>]*aria-haspopup="menu"[^>]*>🇺🇸<\/button>/);
  assert.match(html, /id="headerLocalePicker"[^>]*role="menu"/);
  assert.match(html, /data-locale-choice="en"[^>]*>[\s\S]*?USA[\s\S]*?🇺🇸/);
  assert.match(html, /data-locale-choice="ru"[^>]*>[\s\S]*?Russia[\s\S]*?🇷🇺/);
  assert.match(html, /data-locale-choice="en"[^>]*><span data-i18n-ignore>USA<\/span>/);
  assert.match(html, /data-locale-choice="ru"[^>]*><span data-i18n-ignore>Russia<\/span>/);
  assert.doesNotMatch(html, /data-locale-choice="es"/);
  assert.match(homeCss, /\.header-locale-toggle\s*\{[^}]*min-height:\s*(?:44|46|48)px/s);
  assert.match(homeCss, /\.app-shell\[data-active-route="home"\][^{]*\.header-locale-control/);
  assert.match(homeCss, /\.app-shell:not\(\[data-active-route="home"\]\)[^{]*\.header-locale-control/);
});
