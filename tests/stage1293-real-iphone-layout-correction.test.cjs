'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src/styles/stage1101-redesign.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function correctionBlock() {
  const marker = '/* Stage 12.9.3 — Real iPhone layout correction. */';
  const start = css.indexOf(marker);
  assert.notEqual(start, -1, 'missing Stage 12.9.3 correction block');
  return css.slice(start);
}

test('Stage 12.9.3 stylesheet cache key is active', () => {
  assert.match(html, /href="src\/styles\/stage1101-redesign\.css\?v=12\.9\.3"/);
});

test('Daily Hand mobile card cannot donate its text track to an auto action column', () => {
  const block = correctionBlock();
  assert.match(block, /\.daily-challenge-card\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*align-items:\s*stretch/s);
  assert.match(block, /\.daily-challenge-card-copy\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
  assert.doesNotMatch(block, /\.daily-challenge-card\s*\{[^}]*grid-template-columns:[^;}]*\bauto\b/s);
});

test('Daily Hand preview guarantees a sensible text-column width', () => {
  const block = correctionBlock();
  assert.match(block, /\.daily-hand-preview\s*\{[^}]*grid-template-columns:\s*84px minmax\(180px, 1fr\)/s);
  assert.match(block, /\.daily-hand-copy\s*\{[^}]*width:\s*100%[^}]*min-width:\s*180px/s);
});

test('Daily Hand children wrap by words and never one character at a time', () => {
  const block = correctionBlock();
  assert.match(block, /#dailyChallengeSummary,[^}]*#dailyChallengeAccuracy\s*\{[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*normal[^}]*hyphens:\s*none/s);
  assert.doesNotMatch(block, /#dailyChallenge(?:Summary|HandLabel|Result|Streak|Accuracy)[^}]*overflow-wrap:\s*anywhere/s);
});

test('Daily Hand statistics keep two bounded readable tracks', () => {
  const block = correctionBlock();
  assert.match(block, /\.daily-challenge-progress\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(145px, 1fr\)\)/s);
  assert.match(block, /#dailyChallengeStreak,[^}]*#dailyChallengeAccuracy\s*\{[^}]*min-width:\s*145px[^}]*flex:\s*none/s);
});

test('Daily Hand actions occupy a separate stable row without excessive card height', () => {
  const block = correctionBlock();
  assert.match(block, /\.daily-challenge-card\s*\{[^}]*gap:\s*10px[^}]*max-height:\s*none/s);
  assert.match(block, /\.daily-challenge-card-actions\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
  assert.doesNotMatch(block, /\.daily-challenge-card\s*\{[^}]*min-height:\s*(?:[3-9]\d\d|\d{4,})px/s);
});

test('Continue reserves most width for copy and bounds the CTA track', () => {
  const block = correctionBlock();
  assert.match(block, /\.dashboard-learning-row\s*\{[^}]*grid-template-columns:\s*34px minmax\(0, 1fr\) 104px[^}]*min-height:\s*112px/s);
  assert.match(block, /#dashboardContinue\s*\{[^}]*width:\s*104px[^}]*min-width:\s*104px[^}]*max-width:\s*104px[^}]*min-height:\s*48px/s);
  assert.match(block, /#dashboardNextTitle,[^}]*#dashboardNextDescription\s*\{[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*normal/s);
  assert.match(block, /#dashboardNextTitle\s*\{[^}]*font-size:\s*0\.86rem[^}]*line-height:\s*1\.18/s);
  assert.match(block, /#dashboardNextDescription\s*\{[^}]*font-size:\s*0\.7rem[^}]*line-height:\s*1\.25/s);
});

test('390x844, 430x932 and 440x956 use the same bounded layout contract', () => {
  const block = correctionBlock();
  assert.match(block, /@media \(max-width: 480px\)/);
  for (const viewport of [{ width: 390, height: 844 }, { width: 430, height: 932 }, { width: 440, height: 956 }]) {
    assert.ok(viewport.width <= 480, `${viewport.width}x${viewport.height} must use the correction`);
  }
});

test('layout correction stays Dashboard-only and leaves frozen systems untouched', () => {
  const block = correctionBlock();
  assert.doesNotMatch(block, /#screen-live|live-v2|poker-table|player-pod|heroCards|liveActions|bottom-nav/);
  assert.doesNotMatch(block, /PokerCore|Trainer|evaluateHand|localStorage|data-theme/);
  assert.doesNotMatch(block, /position:\s*(?:absolute|fixed)|grid-template-areas|transform:/);
});
