'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const navigation = fs.readFileSync(path.join(ROOT, 'src/ui/navigation.js'), 'utf8');
const uiPath = path.join(ROOT, 'src/ui/daily-challenge-history.js');
const ui = fs.existsSync(uiPath) ? fs.readFileSync(uiPath, 'utf8') : '';

test('Dashboard exposes a compact History entry', () => {
  assert.match(html, /id="dailyChallengeHistoryCta"[^>]+data-route="daily-history"/);
});

test('History screen has the required Russian title', () => {
  assert.match(html, /id="screen-daily-history"[\s\S]*История раздач дня/);
});

test('History screen contains summary, seven-day strip and list', () => {
  assert.match(html, /id="dailyHistorySummary"/);
  assert.match(html, /id="dailyHistoryWeek"/);
  assert.match(html, /id="dailyHistoryList"/);
});

test('Summary exposes the latest real completion result', () => {
  assert.match(html, /id="dailyHistoryRecent"/);
  assert.match(ui, /stats\.recent\.outcomeLabel/);
});

test('History screen contains a truthful empty state', () => {
  assert.match(html, /id="dailyHistoryEmpty"[\s\S]*История пока пуста/);
});

test('Historical review has its own route and back navigation', () => {
  assert.match(html, /id="screen-daily-review"/);
  assert.match(html, /data-route="daily-history"[^>]*>‹ К истории/);
});

test('Historical review contains no answer submission control', () => {
  const section = html.match(/<section id="screen-daily-review"[\s\S]*?<\/section>\s*<section id=/)?.[0] || '';
  assert.doesNotMatch(section, /dailyConfirm|Подтвердить решение|daily-action/);
});

test('Historical review exposes selected action, correct action, outcome and XP hooks', () => {
  for (const id of ['dailyReviewSelected', 'dailyReviewCorrect', 'dailyReviewOutcome', 'dailyReviewXp']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('Historical review includes cards, board, context and explanation hooks', () => {
  for (const id of ['dailyReviewHeroCards', 'dailyReviewBoard', 'dailyReviewContext', 'dailyReviewExplanation']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('History routes belong to the Home navigation section', () => {
  assert.match(navigation, /'daily-history':\s*'home'/);
  assert.match(navigation, /'daily-review':\s*'home'/);
});

test('History module is loaded after history data API', () => {
  const dataIndex = html.indexOf('src/daily/daily-challenge-history.js');
  const uiIndex = html.indexOf('src/ui/daily-challenge-history.js');
  assert.ok(dataIndex > 0 && uiIndex > dataIndex);
});

test('History UI is initialized with read-only history service', () => {
  assert.match(html, /PokerPilotDailyChallengeHistory\.create/);
  assert.match(html, /PokerPilotDailyChallengeHistoryUI\.create/);
});

test('route opens History screen without page reload', () => {
  assert.match(html, /name === 'daily-history'[\s\S]*dailyChallengeHistoryUi\.openHistory/);
});

test('route opens the selected historical review', () => {
  assert.match(html, /name === 'daily-review'[\s\S]*dailyChallengeHistoryUi\.openReview/);
});

test('History UI renders rows with semantic articles and buttons', () => {
  assert.match(ui, /createElement\('article'\)/);
  assert.match(ui, /createElement\('button'\)/);
});

test('History row exposes visible outcome text', () => {
  assert.match(ui, /outcomeLabel/);
  assert.match(ui, /outcome\.textContent\s*=\s*entry\.outcomeLabel/);
});

test('History UI displays stored xpAwarded and never reward policy constants', () => {
  assert.match(ui, /xpAwarded/);
  assert.doesNotMatch(ui, /correctXp|incorrectXp|\+25 XP|\+10 XP/);
});

test('History UI does not expose internal event IDs or reward version', () => {
  assert.doesNotMatch(ui, /eventId|rewardVersion|scheduleVersion/);
});

test('History UI uses textContent for user-visible data', () => {
  assert.match(ui, /textContent/);
  assert.doesNotMatch(ui, /innerHTML\s*=/);
});

test('History UI never calls progress, rewards or reconciliation', () => {
  assert.doesNotMatch(ui, /ProgressSystem|addXp|submitAnswer|saveProgress|reconcile/);
});

test('History row has an accessible label', () => {
  assert.match(ui, /aria-label/);
  assert.match(ui, /ariaLabel/);
});

test('Seven-day cells expose aria labels and current-day semantics', () => {
  assert.match(ui, /aria-current/);
  assert.match(ui, /day\.ariaLabel/);
});

test('Outcome is represented by visible text and not color alone', () => {
  assert.match(ui, /daily-history-outcome/);
  assert.match(ui, /outcomeLabel/);
});

test('History buttons preserve at least 44px touch targets', () => {
  assert.match(css, /daily-history[^\{]*[\s\S]*?min-height:\s*44px/);
});

test('History layouts constrain content width and horizontal overflow', () => {
  assert.match(css, /daily-history-layout[\s\S]*overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
});

test('Seven-day strip fits seven equal cells without intrinsic overflow', () => {
  assert.match(css, /daily-history-week[\s\S]*grid-template-columns:\s*repeat\(7,\s*minmax\(0,\s*1fr\)\)/);
});

test('History list reserves bottom navigation and safe-area space', () => {
  assert.match(css, /daily-history-layout[\s\S]*env\(safe-area-inset-bottom\)/);
});

test('History controls keep visible focus treatment', () => {
  assert.match(css, /daily-history[^\{]*:focus-visible|daily-history[^,]*,[\s\S]*:focus-visible/);
});

test('History module exports a controller with history and review entry points', () => {
  assert.match(ui, /openHistory/);
  assert.match(ui, /openReview/);
});

test('Unknown challenge fallback remains visible instead of crashing UI', () => {
  assert.match(ui, /challengeAvailable/);
  assert.match(ui, /unavailableMessage/);
});

test('History does not display internal storage status text', () => {
  assert.doesNotMatch(ui, /legacy_uncredited|recorded|raw storage status/i);
});

test('History empty state CTA returns to today Daily Challenge', () => {
  assert.match(html, /id="dailyHistoryEmptyCta"[^>]+data-route="daily"/);
});

test('Daily History source does not mutate card renderer state', () => {
  assert.doesNotMatch(ui, /saveCompletion|replace.*challenge|submit/);
});
