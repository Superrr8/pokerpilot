'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const dailyUiSource = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge.js'), 'utf8');
const historyUiSource = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge-history.js'), 'utf8');
const HistoryUI = require('../src/ui/daily-challenge-history.js');

test('mobile Dashboard card has a dedicated compact contract through 430px', () => {
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.daily-challenge-card\s*\{[\s\S]*?padding:\s*var\(--space-3\)/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.daily-challenge-card\s*\{[\s\S]*?gap:\s*var\(--space-3\)/);
});

test('mobile Dashboard keeps progress compact without hiding streak or accuracy', () => {
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.daily-challenge-progress\s*\{[\s\S]*?grid-template-columns/);
  assert.match(html, /id="dailyChallengeStreak"/);
  assert.match(html, /id="dailyChallengeAccuracy"/);
});

test('new mobile card omits only the redundant one-decision helper line', () => {
  assert.match(css, /daily-challenge-card\[data-state="new"\]\s+#dailyChallengeResult\s*\{[\s\S]*?display:\s*none/);
  assert.match(html, /id="dailyChallengeSummary"/);
  assert.match(html, /id="dailyChallengeTodayState"/);
});

test('correct day uses a visible check mark', () => {
  assert.deepEqual(HistoryUI.dayStatusPresentation({ completed: true, correct: true, isToday: false }), {
    key: 'correct', symbol: '✓', todayLabel: ''
  });
});

test('incorrect day uses a visible multiplication mark', () => {
  assert.deepEqual(HistoryUI.dayStatusPresentation({ completed: true, correct: false, isToday: false }), {
    key: 'incorrect', symbol: '×', todayLabel: ''
  });
});

test('missed day uses a visible dash', () => {
  assert.deepEqual(HistoryUI.dayStatusPresentation({ completed: false, correct: null, isToday: false }), {
    key: 'missed', symbol: '—', todayLabel: ''
  });
});

test('today keeps its result symbol and an independent visible marker', () => {
  assert.deepEqual(HistoryUI.dayStatusPresentation({ completed: true, correct: true, isToday: true }), {
    key: 'correct', symbol: '✓', todayLabel: 'сег.'
  });
});

test('seven-day renderer uses semantic status nodes and full accessible labels', () => {
  assert.match(historyUiSource, /daily-history-day-status/);
  assert.match(historyUiSource, /dayStatusPresentation\(day\)/);
  assert.match(historyUiSource, /setAttribute\('aria-label',\s*day\.ariaLabel\)/);
  assert.match(historyUiSource, /setAttribute\('aria-current',\s*'date'\)/);
});

test('today marker is rendered separately from color and result symbol', () => {
  assert.match(historyUiSource, /daily-history-day-today/);
  assert.match(css, /\.daily-history-day-today\s*\{/);
  assert.match(css, /\.daily-history-day\[aria-current="date"\]/);
});

test('completion feedback exposes a prominent review CTA', () => {
  assert.match(html, /id="dailyResultReviewCta"[^>]*>Посмотреть разбор</);
  assert.match(dailyUiSource, /dailyResultReviewCta/);
  assert.match(dailyUiSource, /onReview/);
});

test('completion feedback distinguishes result, stored XP and Daily Challenge streak', () => {
  assert.match(dailyUiSource, /status\.review\.isCorrect\s*\?\s*'Правильно'\s*:\s*'Ошибка'/);
  assert.match(dailyUiSource, /status\.review\.xpAwarded/);
  assert.match(dailyUiSource, /Серия раздачи дня:/);
  assert.doesNotMatch(dailyUiSource, /status\.review\.streak/);
});

test('review CTA resolves today through the canonical read model', () => {
  assert.match(historyUiSource, /function reviewToday/);
  assert.match(historyUiSource, /getProgressSnapshot/);
  assert.match(historyUiSource, /day\.isToday\s*&&\s*day\.completed/);
  assert.match(html, /onReview:\s*\(\)\s*=>\s*dailyChallengeHistoryUi\.reviewToday\(\)/);
});

test('presentation remains read-only and cannot duplicate accepted progress', () => {
  assert.doesNotMatch(dailyUiSource, /saveCompletion|recordEvent|addXp|ProgressSystem/);
  assert.doesNotMatch(historyUiSource, /saveCompletion|recordEvent|addXp|ProgressSystem/);
});

test('mobile week uses compact status typography and preserves touch/overflow guards', () => {
  assert.match(css, /\.daily-history-day-status\s*\{/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.daily-history-day\s*\{[\s\S]*?min-height:\s*(?:6[4-9]|[7-9]\d)px/);
  assert.match(css, /daily-history-layout[\s\S]*overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /button\.daily-history-day[\s\S]*cursor:\s*pointer/);
});
