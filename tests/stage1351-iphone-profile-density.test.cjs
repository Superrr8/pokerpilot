'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const html = read('index.html');
const stageCss = read('src/styles/stage1351-iphone-profile-density.css');
const dashboardCss = read('src/styles/stage1101-redesign.css');
const liveCss = read('src/styles/live-session.css');
const profileCss = read('src/styles/profile.css');
const progressCss = read('src/styles/progress-overview.css');
const dashboard = read('src/ui/dashboard.js');
const translations = read('src/ui/translations.js');

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing section ${start}`);
  return source.slice(from, to);
}

test('Dashboard next-step icon owns a clean mobile column without changing the CTA', () => {
  assert.match(stageCss, /Stage 13\.5\.1[\s\S]*?\.dashboard-learning-row\s*\{[\s\S]*?grid-template-columns:\s*40px minmax\(0,\s*1fr\) 136px;[\s\S]*?column-gap:\s*10px;/);
  assert.match(stageCss, /\.dashboard-learning-icon\s*\{[\s\S]*?justify-self:\s*center;/);
  assert.match(dashboardCss, /\.dashboard-learning-row #dashboardContinue\s*\{[\s\S]*?width:\s*136px;[\s\S]*?min-height:\s*48px;/);
  assert.match(dashboard, /continueButton\.textContent\s*=\s*model\.nextAction\.actionLabel/);
  assert.match(dashboard, /setRoute\(continueButton,\s*model\.nextAction\.target\)/);
});

test('Live Coach spacing is touch-safe while accepted table and dock geometry stay fixed', () => {
  assert.match(stageCss, /\.live-v2-coach-trigger\s*\{[\s\S]*?right:\s*14px;[\s\S]*?min-height:\s*48px;/);
  assert.match(liveCss, /--live-table-camera-height:\s*330px/);
  assert.match(liveCss, /grid-template-rows:\s*var\(--live-v2-table-stage-height\) var\(--live-v2-hero-stage-height\) var\(--live-v2-action-stage-height\)/);
  assert.match(html, /id="liveHint"[^>]*aria-haspopup="dialog"[^>]*aria-controls="liveCoachSheet"/);
});

test('primary Profile progress remains visible outside every disclosure', () => {
  const profile = section(html, '<section id="screen-profile"', '<section id="screen-coach"');
  const firstDisclosure = profile.indexOf('<details');
  for (const id of [
    'profileHeader', 'profileXpProgress', 'progressPokerIq', 'progressDecisionQualityTitle',
    'progressSkillsList', 'progressFocusTitle'
  ]) {
    const position = profile.indexOf(`id="${id}"`);
    assert.ok(position >= 0, `${id} must remain rendered`);
    assert.ok(id === 'profileHeader' || position < firstDisclosure, `${id} must remain visible by default`);
  }
});

test('Achievements use a closed native disclosure with their existing cards and action', () => {
  const block = section(html, '<details id="progressAchievementsDisclosure"', '</details>');
  assert.doesNotMatch(block.slice(0, block.indexOf('>') + 1), /\sopen(?:\s|=|>)/);
  assert.match(block, /<summary[^>]*aria-controls="progressAchievementsContent"/);
  assert.match(block, /id="progressAchievementsCount"/);
  assert.match(block, /id="progressAchievementsOpen"/);
  assert.match(block, /id="progressAchievementsList"/);
  assert.match(stageCss, /\.progress-disclosure-summary/);
});

test('Coach keeps its useful summary visible and closes only deep insights', () => {
  const block = section(html, '<section id="profileCoachPanel"', '</section>');
  const summaryPosition = block.indexOf('id="coachSummary"');
  const detailsPosition = block.indexOf('<details id="profileCoachDisclosure"');
  const deepPosition = block.indexOf('id="coachDetails"');
  assert.ok(summaryPosition >= 0 && detailsPosition > summaryPosition && deepPosition > detailsPosition);
  assert.doesNotMatch(block.slice(detailsPosition, block.indexOf('>', detailsPosition) + 1), /\sopen(?:\s|=|>)/);
  assert.match(block, /<summary[^>]*aria-controls="coachDetails"/);
  assert.match(html, /coachDetails\.innerHTML/);
  assert.match(stageCss, /\.profile-disclosure-summary/);
});

test('decision History is collapsed by default and retains the existing renderer', () => {
  const block = section(html, '<section id="profileHistoryPanel"', '</section>');
  assert.match(block, /<details id="profileHistoryDisclosure"/);
  assert.doesNotMatch(block.slice(0, block.indexOf('>') + 1), /\sopen(?:\s|=|>)/);
  assert.match(block, /<summary[^>]*aria-controls="historyList"/);
  assert.match(block, /id="profileHistoryCount"/);
  assert.match(block, /id="historyList"/);
  assert.match(html, /DecisionQualityUI\.renderHistory\(document,\$\('#historyList'\),progress\.history,15\)/);
});

test('native disclosures are session-local, accessible, and never mutate product state', () => {
  const profile = section(html, '<section id="screen-profile"', '<section id="screen-coach"');
  assert.equal((profile.match(/<details\b/g) || []).length, 3);
  assert.equal((profile.match(/<summary\b/g) || []).length, 3);
  assert.doesNotMatch(profile, /data-route="(?:study|profile)"[^>]*aria-expanded/);
  assert.doesNotMatch(stageCss, /localStorage|recordEvent|addXp|updateProgress|PokerCore/);
});

test('new disclosure labels are complete in English and Russian', () => {
  assert.match(translations, /'profile\.coachInsights':\s*\['Coach insights',\s*'Рекомендации Coach'\]/);
  assert.match(translations, /'profile\.recentDecisionCount':\s*\['\{count\} recent decisions',\s*'Последних решений: \{count\}'\]/);
  assert.match(html, /i18nText\('profile\.recentDecisionCount',\{count:progress\.history\.length\}\)/);
});

test('Profile disclosure styling is mobile-safe and reduced-motion safe', () => {
  assert.match(stageCss, /min-width:\s*0/);
  assert.match(stageCss, /min-height:\s*48px/);
  assert.match(stageCss, /@media\s*\(max-width:\s*440px\)/);
  assert.match(stageCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(stageCss, /^\s*width:\s*(?:390|430|440)px/m);
});
