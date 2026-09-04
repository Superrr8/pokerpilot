'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profileCss = fs.readFileSync(path.join(root, 'src/styles/profile.css'), 'utf8');
const overviewCss = fs.readFileSync(path.join(root, 'src/styles/progress-overview.css'), 'utf8');
const overviewSource = fs.readFileSync(path.join(root, 'src/ui/progress-overview.js'), 'utf8');
const ProfileUI = require('../src/ui/profile.js');

class FakeNode {
  constructor() {
    this.textContent = '';
    this.hidden = false;
    this.dataset = {};
    this.attributes = {};
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
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

test('Profile first screen presents identity, progression and performance before detail/settings', () => {
  const profile = html.indexOf('id="profileHeader"');
  const toolbar = html.indexOf('class="profile-hero-toolbar"', profile);
  const identity = html.indexOf('class="profile-identity-core"', toolbar);
  const progression = html.indexOf('class="profile-progression"', identity);
  const performance = html.indexOf('id="profileIdentityStats"', progression);
  const detail = html.indexOf('id="progressOverview"', performance);
  const appearance = html.indexOf('id="profileAppearance"', detail);

  assert.ok(profile >= 0 && toolbar > profile);
  assert.ok(identity > toolbar);
  assert.ok(progression > identity);
  assert.ok(performance > progression);
  assert.ok(detail > performance);
  assert.ok(appearance > detail);
});

test('detailed Progress Overview does not immediately repeat identity or Level/XP', () => {
  const start = html.indexOf('id="progressOverview"');
  const end = html.indexOf('id="profileAppearance"', start);
  const overview = html.slice(start, end);

  assert.match(overview, /id="progressPokerIq"/);
  assert.match(overview, /id="progressIqSample"/);
  assert.doesNotMatch(overview, /id="progressPlayerName"/);
  assert.doesNotMatch(overview, /id="progressLevel"|id="progressXpBar"/);
});

test('Profile stylesheet is cache-versioned for physical-device delivery', () => {
  assert.match(html, /src\/styles\/profile\.css\?v=13\.2\.1/);
  assert.match(html, /src\/styles\/progress-overview\.css\?v=13\.2\.1/);
  assert.match(html, /src\/ui\/profile\.js\?v=13\.2\.1/);
  assert.match(html, /src\/ui\/progress-overview\.js\?v=13\.2\.1/);
});

test('unrated Poker IQ uses a compact placeholder instead of numeric display scale', () => {
  assert.match(overviewSource, /pokerIqValue\.dataset\.state\s*=\s*model\.pokerIq\.available\s*\?\s*'rated'\s*:\s*'empty'/);
  assert.match(overviewCss, /\.progress-iq-value\[data-state="empty"\]\s*\{[^}]*font-size:\s*var\(--font-size-xl\)/s);
});

test('premium identity presentation is flat, semantic and balanced on iPhone', () => {
  assert.match(profileCss, /#screen-profile\s+\.profile-hero-card\s*\{/);
  assert.match(profileCss, /\.profile-hero-toolbar\s*\{/);
  assert.match(profileCss, /\.profile-identity-core\s*\{/);
  assert.match(profileCss, /\.profile-identity-stats\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
  assert.match(profileCss, /@media\s*\(max-width:\s*440px\)[\s\S]*\.profile-identity-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,/);
  assert.match(profileCss, /\.profile-identity-stats\s*\{[^}]*background:\s*var\(--surface-interactive\)/s);
  assert.doesNotMatch(profileCss, /#69d9a7|#31b77d|rgba\(105,\s*217,\s*167/i);
});

test('empty bio is omitted while a real local bio remains visible', () => {
  const document = new FakeDocument([
    '#profileAvatar', '#profileName', '#profileGame', '#profileBioText', '#profilePlayerTitle',
    '#profileLevel', '#profileXpLabel', '#profileLifetimeXp', '#profileXpProgress',
    '#profileHeroPokerIq', '#profileHeroPokerIqMeta', '#profileHeroStreak',
    '#profileHeroStreakMeta', '#profileHeroDecisionQuality', '#profileHeroDecisionQualityMeta',
    '#profileHeroAchievements', '#profileHeroAchievementsMeta'
  ]);
  const base = {
    displayName: 'Player',
    avatar: { type: 'initials', value: 'PL' },
    preferredGame: '$1/$3 Cash'
  };

  ProfileUI.renderProfile(document, ProfileUI.createViewModel({ profile: { ...base, bio: '' } }));
  assert.equal(document.querySelector('#profileBioText').hidden, true);

  ProfileUI.renderProfile(document, ProfileUI.createViewModel({ profile: { ...base, bio: 'Играю осознанно.' } }));
  assert.equal(document.querySelector('#profileBioText').hidden, false);
  assert.equal(document.querySelector('#profileBioText').textContent, 'Играю осознанно.');
});
