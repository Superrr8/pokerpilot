'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const progressIntegration = fs.readFileSync(path.join(ROOT, 'src/progress/progress-integration.js'), 'utf8');

test('result panel содержит доступные reward, streak и pending regions', () => {
  for (const id of ['dailyReward', 'dailyStreak', 'dailyProgressPending']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="dailyFeedback"[^>]*aria-live="polite"/);
});

test('Daily UI показывает receipt XP, streak и pending через безопасный textContent', () => {
  assert.match(ui, /xpAwarded/);
  assert.match(ui, /progressStatus|progress\.status/);
  assert.match(ui, /Награда будет зачислена при следующем открытии/);
  assert.doesNotMatch(ui, /dailyReward[^\n]*innerHTML/);
});

test('completed dashboard card показывает сохранённый XP, не пересчитывая policy', () => {
  assert.match(ui, /dailyChallengeResult/);
  assert.match(ui, /xpAwarded/);
  assert.doesNotMatch(ui, /correctXp|incorrectXp|\+25 XP|\+10 XP/);
});

test('ProgressIntegration публикует один canonical Daily Challenge event', () => {
  assert.match(progressIntegration, /completeDailyChallenge/);
  assert.match(progressIntegration, /DAILY_CHALLENGE_COMPLETED/);
  assert.match(progressIntegration, /daily_challenge/);
});

test('reward и progress modules подключены до Daily UI bootstrap', () => {
  const scripts = [
    'src/daily/daily-challenge-reward.js',
    'src/progress/progress-config.js',
    'src/progress/progress-integration.js',
    'src/daily/daily-challenge-progress.js',
    'src/ui/daily-challenge.js'
  ];
  const positions = scripts.map(file => html.indexOf(file));
  positions.forEach(position => assert.ok(position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('bootstrap injects progress integration вместо прямой storage mutation из UI', () => {
  assert.match(html, /PokerPilotDailyChallengeProgress\.create/);
  assert.match(html, /progress:\s*dailyChallengeProgress/);
  assert.doesNotMatch(ui, /localStorage|recordEvent|ProgressSystem/);
});

test('mobile reward block не создаёт overflow и сохраняет safe-area', () => {
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /\.daily-progress-result/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test('правильный ответ остаётся скрытым до submission после progress integration', () => {
  const dailyScreen = html.match(/<section id="screen-daily"[\s\S]*?<\/section>/)?.[0] || '';
  assert.doesNotMatch(dailyScreen, /data-correct|correctAction\s*[:=]/i);
  assert.doesNotMatch(ui, /data-correct/);
});
