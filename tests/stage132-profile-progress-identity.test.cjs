'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profileCss = fs.readFileSync(path.join(root, 'src/styles/profile.css'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'src/ui/profile.js'), 'utf8');
const overviewSource = fs.readFileSync(path.join(root, 'src/ui/progress-overview.js'), 'utf8');
const ProfileUI = require('../src/ui/profile.js');
const ProgressOverview = require('../src/ui/progress-overview.js');

function canonicalSnapshot(overrides = {}) {
  return {
    lifetimeXp: 1749,
    level: {
      totalXp: 1749,
      level: 3,
      xpIntoLevel: 749,
      xpToNextLevel: 1000
    },
    pokerIq: {
      score: 78,
      isRated: true,
      sampleStatus: 'ESTABLISHED',
      ratedDecisions: 42,
      rank: { id: 'ADVANCED', label: 'Продвинутый' },
      trend: { direction: 'UP', delta: 3 }
    },
    rank: { id: 'ADVANCED', label: 'Продвинутый' },
    decisionQuality: {
      score: 86,
      isRated: true,
      classification: 'GOOD',
      ratedDecisions: 42
    },
    streak: { current: 4, best: 9, lastQualifiedDate: '2026-09-03' },
    achievements: { unlockedCount: 2, totalCount: 10, items: [] },
    recentChanges: [],
    ...overrides
  };
}

function profile(overrides = {}) {
  return {
    displayName: 'Мария',
    avatar: { type: 'initials', value: 'МР' },
    bio: 'Учусь принимать точные решения.',
    preferredGame: '$1/$3 Cash',
    progression: {
      totalXp: 5,
      level: 1,
      xpIntoLevel: 5,
      xpToNextLevel: 500
    },
    ratings: { pokerIQ: 1, decisionQuality: 2, elo: null, rank: 'Legacy' },
    ...overrides
  };
}

class FakeNode {
  constructor() {
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.style = { setProperty: (name, value) => { this.style[name] = value; } };
    this.classList = { toggle() {}, add() {}, remove() {} };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  querySelector() {
    return null;
  }
}

class FakeDocument {
  constructor(selectors) {
    this.nodes = Object.fromEntries(selectors.map(selector => [selector, new FakeNode()]));
  }

  querySelector(selector) {
    return this.nodes[selector] || null;
  }

  querySelectorAll() {
    return [];
  }
}

test('Profile identity получает Level, XP, Poker IQ, rank и streak из canonical snapshot', () => {
  const model = ProfileUI.createViewModel({
    profile: profile(),
    progressSnapshot: canonicalSnapshot(),
    statistics: { isEmpty: false }
  });

  assert.equal(model.level, 3);
  assert.equal(model.totalXp, 1749);
  assert.equal(model.xpIntoLevel, 749);
  assert.equal(model.xpToNextLevel, 1000);
  assert.equal(model.progressLabel, '749 / 1000 XP');
  assert.equal(model.pokerIQ.displayScore, '78');
  assert.equal(model.playerTitle, 'Продвинутый');
  assert.equal(model.streak.current, 4);
  assert.equal(model.streak.best, 9);
  assert.equal(model.decisionQuality.displayValue, '86');
  assert.equal(model.achievements.countLabel, '2 / 10');
});

test('Profile identity безопасно нормализует partial snapshot без отдельного state', () => {
  const model = ProfileUI.createViewModel({
    profile: profile(),
    progressSnapshot: {
      level: { totalXp: -1, level: -2, xpIntoLevel: 'bad', xpToNextLevel: 0 },
      pokerIq: null,
      rank: null,
      streak: { current: -3, best: 'bad' },
      decisionQuality: null,
      achievements: null
    }
  });

  assert.equal(model.level, 1);
  assert.equal(model.totalXp, 0);
  assert.equal(model.xpIntoLevel, 0);
  assert.equal(model.xpToNextLevel, 1);
  assert.equal(model.playerTitle, 'Без ранга');
  assert.deepEqual(model.streak, { current: 0, best: 0 });
  assert.equal(model.decisionQuality.displayValue, 'Не рассчитана');
  assert.equal(model.achievements.countLabel, '0 / 0');
});

test('Profile hero рендерит каноническую identity/progression сводку локально', () => {
  const selectors = [
    '#profileAvatar', '#profileName', '#profileGame', '#profileBioText', '#profilePlayerTitle',
    '#profileLevel', '#profileXpLabel', '#profileLifetimeXp', '#profileXpProgress',
    '#profileHeroPokerIq', '#profileHeroPokerIqMeta', '#profileHeroStreak',
    '#profileHeroStreakMeta', '#profileHeroDecisionQuality', '#profileHeroDecisionQualityMeta',
    '#profileHeroAchievements', '#profileHeroAchievementsMeta'
  ];
  const document = new FakeDocument(selectors);
  const model = ProfileUI.createViewModel({
    profile: profile(),
    progressSnapshot: canonicalSnapshot(),
    statistics: { isEmpty: false }
  });

  ProfileUI.renderProfile(document, model);

  assert.equal(document.querySelector('#profilePlayerTitle').textContent, 'Продвинутый');
  assert.equal(document.querySelector('#profileLevel').textContent, 'Level 3');
  assert.equal(document.querySelector('#profileLifetimeXp').textContent, '1749 XP всего');
  assert.equal(document.querySelector('#profileHeroPokerIq').textContent, '78');
  assert.equal(document.querySelector('#profileHeroStreak').textContent, '4 дня');
  assert.equal(document.querySelector('#profileHeroDecisionQuality').textContent, '86');
  assert.equal(document.querySelector('#profileHeroAchievements').textContent, '2 / 10');
  assert.equal(document.querySelector('#profileXpProgress').attributes['aria-valuenow'], '75');
});

test('Profile markup образует identity → progression → appearance и остаётся future-ready', () => {
  const profileStart = html.indexOf('id="screen-profile"');
  const identity = html.indexOf('id="profileHeader"', profileStart);
  const progress = html.indexOf('id="progressOverview"', identity);
  const appearance = html.indexOf('id="profileAppearance"', progress);

  assert.ok(profileStart >= 0 && identity > profileStart);
  assert.ok(progress > identity, 'Progress должен следовать за identity');
  assert.ok(appearance > progress, 'Оформление не должно разрывать identity и progress');
  assert.match(html, /id="profileHeader"[^>]*data-profile-identity/);
  assert.match(html, /id="profilePlayerTitle"/);
  assert.match(html, /id="profileIdentityStats"[^>]*aria-label="Краткая сводка игрока"/);
  assert.match(html, /id="profileXpProgress"[^>]*role="progressbar"/);
  assert.match(html, /id="profileHeroPokerIq"/);
  assert.match(html, /id="profileHeroStreak"/);
  assert.match(html, /id="profileHeroDecisionQuality"/);
  assert.match(html, /id="profileHeroAchievements"/);
});

test('Achievement preview ограничен тремя canonical earned/locked карточками', () => {
  const items = [
    { id: 'A', unlocked: true },
    { id: 'B', unlocked: true },
    { id: 'C', unlocked: true },
    { id: 'D', unlocked: false },
    { id: 'E', unlocked: false }
  ];
  const preview = ProgressOverview.selectAchievementPreview(items);

  assert.equal(ProgressOverview.ACHIEVEMENT_PREVIEW_LIMIT, 3);
  assert.equal(preview.length, 3);
  assert.equal(preview.some(item => item.unlocked), true);
  assert.equal(preview.some(item => !item.unlocked), true);
  assert.deepEqual(items.map(item => item.id), ['A', 'B', 'C', 'D', 'E']);
  assert.match(overviewSource, /model\.achievements\.previewItems\.map/);
});

test('Recent Progress остаётся canonical read-only projection до трёх событий', () => {
  const model = ProgressOverview.createViewModel({
    snapshot: {
      recentChanges: [
        { eventId: 'a', type: 'LESSON_COMPLETED', timestamp: '2026-09-03T10:00:00Z', xp: 30 },
        { eventId: 'b', type: 'EXAM_COMPLETED', timestamp: '2026-09-02T10:00:00Z', xp: 60 },
        { eventId: 'c', type: 'TRAINING_SESSION_COMPLETED', timestamp: '2026-09-01T10:00:00Z', xp: 40 },
        { eventId: 'd', type: 'HAND_REVIEW_COMPLETED', timestamp: '2026-08-31T10:00:00Z', xp: 35 }
      ]
    }
  });

  assert.deepEqual(model.recentEvents.map(item => item.id), ['a', 'b', 'c']);
  assert.doesNotMatch(overviewSource, /recordEvent|addXp|localStorage/);
});

test('Stage 13.2 wiring использует общий ProgressSystem snapshot', () => {
  assert.match(profileSource, /getProgressSnapshot/);
  assert.match(html, /getProgressSnapshot:\s*\(\)\s*=>\s*ProgressSystem\.getSnapshot\(\)/);
  assert.doesNotMatch(profileSource, /localStorage|recordEvent|addXp/);
});

test('Profile visual system theme-safe, mobile-safe и accessibility-safe', () => {
  assert.match(profileCss, /var\(--accent/);
  assert.match(profileCss, /var\(--surface-/);
  assert.match(profileCss, /var\(--motion-/);
  assert.match(profileCss, /env\(safe-area-inset-bottom\)/);
  assert.match(profileCss, /@media\s*\(max-width:\s*440px\)/);
  assert.match(profileCss, /@media\s*\(max-width:\s*390px\)/);
  assert.match(profileCss, /minmax\(0,\s*1fr\)/);
  assert.match(profileCss, /min-height:\s*44px/);
  assert.match(profileCss, /:focus-visible/);
  assert.match(profileCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(profileCss, /#69d9a7|#31b77d|rgba\(105,\s*217,\s*167/i);
  assert.match(html, /id="profileIdentityStats"[^>]*role="list"/);
  assert.match(html, /class="profile-identity-stat"[^>]*role="listitem"/);
});
