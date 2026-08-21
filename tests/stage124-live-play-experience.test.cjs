'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const liveHtml = html.slice(html.indexOf('<section id="screen-live"'), html.indexOf('</main>'));

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `missing start marker: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('Hero cards stay on the table while price and actions remain in the persistent action dock', () => {
  const game = between(liveHtml, '<div id="liveGame"', '</section>');
  const core = between(game, '<div id="liveDecisionCore"', '</div><!-- /live-decision-core -->');
  assert.match(core, /id="heroPosition"/);
  assert.match(core, /id="toCallChip"/);
  assert.match(core, /id="liveActions"/);
  assert.match(game, /id="pokerTable"[\s\S]*?id="heroCards"[\s\S]*?id="liveDecisionCore"/);
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveHistoryPanel"'));
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveLearningPanel"'));
});

test('hand history stays secondary, collapsed and accessible', () => {
  assert.match(html, /id="liveHistoryToggle"[^>]*aria-expanded="false"[^>]*aria-controls="liveHistoryBody"/);
  assert.ok(html.indexOf('id="liveDecisionCore"') < html.indexOf('id="liveHistoryPanel"'));
  assert.match(html, /historyPanel\.onHeroTurn\(\)/);
});

test('post-decision teaching is an on-demand disclosure with a concise result first', () => {
  const panel = between(html, '<dialog id="liveCoachSheet"', '</dialog>');
  assert.match(panel, /id="liveResultSummary"[^>]*class="live-result-summary hidden"[^>]*aria-live="polite"/);
  assert.match(panel, /<details id="liveLearningPanel"[^>]*class="live-learning-panel hidden"/);
  assert.doesNotMatch(panel, /<details id="liveLearningPanel"[^>]*\sopen(?:\s|>)/);
  assert.match(panel, /<summary[^>]*>[\s\S]*Разбор решения[\s\S]*<\/summary>/);
  assert.ok(panel.indexOf('id="liveResultSummary"') < panel.indexOf('id="liveLearningPanel"'));
  assert.ok(panel.indexOf('id="liveExplanation"') > panel.indexOf('id="liveLearningPanel"'));
});

test('Live keeps the shared Stage 12.3 structured explanation renderer', () => {
  assert.match(html, /renderTrainerExplanation\('#liveExplanation',[\s\S]*?liveTrainerResult,[\s\S]*?record\.decisionQuality/);
  assert.match(html, /id="liveExplanation"[^>]*class="trainer-explanation hidden"/);
});

test('Hero-turn presentation state is synchronized on the Live game and app shell only', () => {
  assert.match(html, /PokerPilotLivePresentationState\.sync\(\{/);
  assert.match(html, /game,\s*decisionPanel:\s*\$\('#screen-live \.decision-panel'\)/);
  assert.doesNotMatch(html, /PokerCore[\s\S]{0,80}is-hero-turn/);
});

test('new hand clears old learning, while the next Hero turn only closes the disclosure', () => {
  assert.match(
    html,
    /function resetLiveLearningPanel\(\{clear=false\}=\{\}\)[\s\S]*?panel\.open=false;[\s\S]*?if\(clear\)panel\.classList\.add\('hidden'\)/
  );
  assert.match(html, /function dealLiveHand\(\)[\s\S]*?resetLiveLearningPanel\(\{clear:true\}\)/);
  assert.match(html, /function showHeroActions\(\)[\s\S]*?resetLiveLearningPanel\(\)/);
  assert.doesNotMatch(html, /function showHeroActions\(\)[\s\S]{0,800}?\$\('#liveExplanation'\)\.classList\.add\('hidden'\)/);
});

test('post-decision result remains compact while structured learning stays available', () => {
  assert.match(html, /function showLiveResultSummary\(evaluation\)/);
  assert.match(html, /showLiveResultSummary\(evaluation\)/);
  assert.match(html, /liveLearningPanel[\s\S]*?classList\.remove\('hidden'\)/);
  assert.match(css, /\.live-result-summary/);
  assert.match(css, /\.live-learning-panel/);
});

test('math can be prepared without forcing the learning disclosure open', () => {
  assert.match(html, /function showLiveMath\(precomputed=null,\{openLearning=true\}=\{\}\)/);
  assert.match(html, /showLiveMath\(evaluation\.math\|\|null,\{openLearning:false\}\)/);
});

test('mobile Live layout keeps poker context in one stable session-wide table', () => {
  assert.match(css, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\)[\s\S]*?#screen-live \.poker-table\.live-v2-poker-table/);
  assert.match(css, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[\s\S]*?min-height:\s*0/);
  assert.doesNotMatch(css, /\.live-v2-poker-table\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(css, /#liveGame\.is-hero-turn \.poker-table\s*\{[^}]*height:/);
});

test('real session stats remain available in the compact More sheet', () => {
  assert.match(html, /id="liveMoreSheet"[\s\S]*?id="liveStack"[\s\S]*?id="liveProfit"[\s\S]*?id="liveHands"[\s\S]*?id="liveTilt"/);
  assert.match(css, /\.live-v2-session-meta \.stats-grid\.four\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,/);
  assert.doesNotMatch(html, /data-fake-live-stat/);
});

test('mobile decision surfaces protect width, tap targets and fixed-nav clearance', () => {
  assert.match(css, /\.live-decision-core\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(css, /#screen-live \.live-v2-action-dock #liveActions button\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(css, /\.app-shell\[data-active-route="live"\]\.is-live-game-active\s*\{[\s\S]*?padding-block-end:\s*max\(/);
  assert.doesNotMatch(css, /\.live-decision-core\s*\{[^}]*position:\s*fixed/);
});

test('compact Live surfaces remain theme-driven and reduced-motion safe', () => {
  assert.match(css, /\.live-learning-panel\s*\{[\s\S]*?background:\s*var\(--surface-/);
  assert.match(css, /\.live-result-summary\s*\{[\s\S]*?border:[^;]*var\(--border-/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.live-learning-panel/);
});
