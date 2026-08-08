'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dailyUi = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge.js'), 'utf8');
const historyUi = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge-history.js'), 'utf8');
const history = fs.readFileSync(path.join(ROOT, 'src/daily/daily-challenge-history.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');

test('Dashboard contains compact Daily Challenge progress hooks', () => {
  assert.match(html, /id="dailyChallengeProgress"/);
  assert.match(html, /id="dailyChallengeTodayState"/);
});
test('History summary exposes streak, best streak, accuracy and solved hooks', () => {
  for (const id of [
    'dailyHistoryCurrentStreak', 'dailyHistoryBestStreak',
    'dailyHistoryAccuracy', 'dailyHistoryTotal'
  ]) assert.match(html, new RegExp(`id="${id}"`));
});

test('Dashboard consumes the shared read-only progress snapshot', () => {
  assert.match(dailyUi, /getProgressSnapshot/);
  assert.match(dailyUi, /completedToday/);
  assert.match(dailyUi, /currentStreak/);
  assert.doesNotMatch(dailyUi, /saveCompletion|saveProgress|ProgressSystem|recordEvent/);
});

test('History summary and recent days consume one shared snapshot', () => {
  assert.match(historyUi, /getProgressSnapshot/);
  assert.match(historyUi, /snapshot\.recentDays/);
  assert.match(historyUi, /snapshot\.bestStreak/);
  assert.doesNotMatch(historyUi, /saveCompletion|saveProgress|ProgressSystem|recordEvent/);
});

test('progress snapshot is calculated once in the read-only history layer', () => {
  assert.match(history, /function getProgressSnapshot/);
  assert.match(history, /currentStreak/);
  assert.match(history, /bestStreak/);
  assert.doesNotMatch(history, /localStorage|setItem|saveCompletion|saveProgress/);
});

test('Stage 10.4 styles preserve compact desktop and 390px layouts', () => {
  assert.match(css, /daily-challenge-progress/);
  assert.match(css, /daily-history-summary-core/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
});
