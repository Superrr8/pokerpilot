'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const presentationSource = fs.readFileSync(path.join(root, 'src/live/live-presentation-state.js'), 'utf8');
const liveHtml = html.slice(html.indexOf('<section id="screen-live"'), html.indexOf('</main>'));

function indexOfOrFail(source, value) {
  const index = source.indexOf(value);
  assert.notEqual(index, -1, `missing ${value}`);
  return index;
}

test('Live V2 provides one dedicated stable game shell', () => {
  assert.match(liveHtml, /id="liveGame"[^>]*class="hidden live-v2-game"/);
  assert.match(liveHtml, /class="live-v2-game-shell"/);
  assert.match(liveHtml, /class="live-v2-table-stage"/);
  assert.match(liveHtml, /class="live-v2-hero-zone"/);
  assert.match(liveHtml, /class="live-v2-action-zone"/);
  assert.match(liveHtml, /class="panel decision-panel live-v2-action-dock"/);
  assert.match(css, /Stage 12\.5\.3 — Live Mode V2 stable premium shell/);
});

test('active Live uses a stable session state instead of Hero-only shell geometry', () => {
  assert.match(html, /classList\.toggle\('is-live-game-active',\s*gameActive\)/);
  assert.match(css, /\.app-shell\[data-active-route="live"\]\.is-live-game-active/);
  assert.doesNotMatch(css, /Stage 12\.5\.2 — Canonical Hero-decision viewport compression/);
  assert.doesNotMatch(css, /#liveGame\.is-hero-turn \.poker-table\s*\{[^}]*height:/);
});

test('dedicated Live chrome hides dashboard header and global navigation for the whole active session', () => {
  assert.match(html, /id="liveBackControl"/);
  assert.match(html, /id="liveMoreToggle"/);
  assert.match(css, /\.is-live-game-active \.brand\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.is-live-game-active #primaryNavigation\s*\{[^}]*display:\s*none/s);
  assert.match(css, /\.is-live-game-active \.sound-volume\s*\{[^}]*display:\s*none/s);
});

test('player pods keep logical player identity while adding presentation-only identity markers', () => {
  assert.match(html, /setAttribute\('data-player-id',String\(playerId\)\)/);
  assert.match(html, /dataset\.seatPart='avatar'/);
  assert.match(html, /className='player-pod-avatar'/);
  assert.match(html, /positions\[i\]/);
  assert.match(html, /p\.stack/);
  assert.match(html, /i===0\?'hero'/);
});

test('Hero remains bottom-center with cards in a dedicated zone below the rail', () => {
  assert.match(html, /PokerPilotLiveSeatLayouts\.getLayout\(session\.n\)/);
  assert.match(html, /const \{x,y\}=layout\.slots\[i\]/);
  assert.ok(indexOfOrFail(liveHtml, 'id="pokerTable"') < indexOfOrFail(liveHtml, 'id="heroCards"'));
  assert.ok(indexOfOrFail(liveHtml, 'id="heroCards"') < indexOfOrFail(liveHtml, 'id="liveDecisionCore"'));
  assert.match(liveHtml, /class="live-v2-hero-zone"[\s\S]*?id="heroCards"/);
  assert.match(css, /#screen-live #heroCards\.live-v2-hero-cards\s*\{[^}]*position:\s*relative/s);
  assert.doesNotMatch(css, /#screen-live #heroCards\.live-v2-hero-cards\s*\{[^}]*position:\s*absolute/s);
});

test('approved mobile tables use dedicated wide 6-max and camera-clipped 9-max geometry', () => {
  assert.match(css, /--live-v2-table-stage-height:\s*clamp\(360px,[^;]*380px\)/);
  assert.match(css, /\[data-table-size="6"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-height:\s*334px/s);
  assert.match(css, /\[data-table-size="9"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-width:\s*clamp\(410px, 112vw, 440px\)/s);
  assert.match(css, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[^}]*border-radius:\s*46% \/ 42%/s);
  assert.doesNotMatch(css, /#screen-live \.poker-table\.live-v2-poker-table\s*\{[^}]*height:\s*100%/s);
});

test('Player Pods prioritize readable stack and visible identity markers', () => {
  assert.match(css, /#screen-live \.seat\.player-pod strong\s*\{[^}]*font-size:\s*15px/s);
  assert.match(css, /\.player-pod-avatar\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px/s);
  assert.match(html, /dataset\.tableSize=String\(session\.n\)/);
});

test('board and pot remain bound to existing state and use a restrained table center', () => {
  assert.match(html, /id="streetLabel"/);
  assert.match(html, /id="potLabel"/);
  assert.match(html, /id="board"/);
  assert.match(html, /#potLabel'\)\.textContent=`POT \$\{money\(session\.presentedPot\?\?session\.pot\)\}`/);
  assert.doesNotMatch(html, /data-live-v2-pot-calculation/);
});

test('persistent action dock consumes canonical action options for every legal action', () => {
  assert.match(html, /decision\.actionOptions\.forEach/);
  assert.match(html, /if\(!decision\.controlsAvailable\)/);
  assert.match(html, /data-live-dock-state/);
  assert.match(css, /\.live-v2-action-dock\s*\{[^}]*min-height:/s);
  for (const action of ['fold', 'check', 'call', 'bet', 'raise', 'allin']) {
    assert.match(presentationSource, new RegExp(`['\"]${action}['\"]`));
  }
});

test('raise control stays inside the dock and preserves existing bounds and handler', () => {
  assert.ok(indexOfOrFail(liveHtml, 'id="betSizer"') < indexOfOrFail(liveHtml, 'id="liveActions"'));
  assert.match(html, /function toggleSizer\(action\)/);
  assert.match(html, /Math\.max\(session\.currentBet\*2,session\.currentBet\+3\)/);
  assert.match(html, /handleHeroAction\(a,\+\$\('#betRange'\)\.value\)/);
  assert.match(html, /id="cancelBet"/);
  assert.match(css, /\.live-v2-action-dock \.bet-sizer\s*\{[^}]*position:\s*static/s);
  assert.match(css, /\.live-v2-action-zone\s*\{[^}]*min-height:\s*232px/s);
  assert.doesNotMatch(css, /\.live-v2-action-dock \.bet-sizer\s*\{[^}]*bottom:\s*calc/s);
});

test('action buttons receive presentation semantics without changing their handlers', () => {
  assert.match(html, /b\.dataset\.liveAction=a/);
  for (const action of ['fold', 'call', 'check', 'raise', 'bet', 'allin']) {
    assert.match(css, new RegExp(`\\[data-live-action="${action}"\\]`));
  }
});

test('Coach sheet preserves Trainer explanation, math and history destinations', () => {
  assert.match(html, /<dialog id="liveCoachSheet"/);
  for (const id of ['liveHint', 'liveHintBox', 'liveResultSummary', 'liveLearningPanel', 'liveExplanation', 'liveDecisionQuality', 'liveMathToggle', 'mathBox', 'liveHistoryPanel']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /renderTrainerExplanation\('#liveExplanation'/);
  assert.match(html, /showLiveMath\(evaluation\.math\|\|null,\{openLearning:false\}\)/);
});

test('Coach does not bypass the existing hidden-answer guard', () => {
  assert.match(html, /assistMode\(\)==='exam'&&session\?\.awaiting\?\.startsWith\('hero'\)/);
  assert.match(html, /В режиме «Экзамен» ауты и эквити открываются после решения/);
  assert.match(html, /liveLearningPanel\.classList\.remove\('hidden'\)/);
});

test('More sheet keeps all secondary session controls and real metadata', () => {
  assert.match(html, /<dialog id="liveMoreSheet"/);
  for (const id of ['liveStack', 'liveProfit', 'liveHands', 'liveTilt', 'pauseLive', 'saveLiveHand', 'endSession']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /id="liveSessionMeta"/);
  assert.match(html, /id="liveMoreSheet"[\s\S]*?id="soundVolume"/);
});

test('Live V2 keeps existing save, pause, end-session and final result handlers', () => {
  assert.match(html, /\$\('#saveLiveHand'\)\.addEventListener\('click',saveCurrentLiveHand\)/);
  assert.match(html, /\$\('#pauseLive'\)\.addEventListener\('click'/);
  assert.match(html, /\$\('#endSession'\)\.addEventListener\('click'/);
  assert.match(html, /DecisionQualityStats\.getSessionSummary/);
  assert.match(html, /PokerIQStats\.getSummary/);
});

test('runtime diagnostics and canonical Hero state remain intact', () => {
  assert.match(html, /getCanonicalLiveHeroDecision/);
  assert.match(html, /PokerPilotLivePresentationState\.deriveHeroDecision/);
  for (const diagnostic of ['liveHeroTurn', 'liveHeroCanAct', 'liveActionsVisible', 'liveCompact', 'liveCurrentActor', 'liveHeroSeat', 'liveStreet']) {
    assert.match(presentationSource, new RegExp(diagnostic));
  }
});

test('mobile shell reserves safe areas and prevents horizontal overflow', () => {
  assert.match(css, /@media \(max-width:\s*480px\) and \(orientation:\s*portrait\)/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.live-v2-game-shell\s*\{[^}]*overflow-x:\s*clip/s);
  assert.match(css, /\.live-v2-action-dock[^}]*width:\s*100%/s);
});

test('Live V2 remains presentation-only', () => {
  const marker = css.indexOf('Stage 12.5.3 — Live Mode V2 stable premium shell');
  const v2Css = marker === -1 ? '' : css.slice(marker);
  assert.doesNotMatch(v2Css, /PokerCore|equityVsRange|analyzeOuts|callEV|Monte Carlo/);
  assert.doesNotMatch(html, /data-live-v2-(?:stack|pot|equity)-source/);
});

test('final fidelity palette uses muted felt, leather rail and walnut environment', () => {
  assert.match(css, /--live-v2-felt-center:\s*#15382c/);
  assert.match(css, /--live-v2-felt-edge:\s*#09251d/);
  assert.match(css, /--live-v2-rail-leather:\s*#1a1917/);
  assert.match(css, /--live-v2-walnut:\s*#160f0b/);
  assert.match(css, /\.poker-table\.live-v2-poker-table\s*\{[^}]*border:\s*11px solid var\(--live-v2-rail-leather\)/s);
  assert.doesNotMatch(css, /\.poker-table\.live-v2-poker-table\s*\{[^}]*#174c36/s);
});

test('final Player Pods use soft material and avatar-first identity', () => {
  assert.match(css, /\.seat\.player-pod\s*\{[^}]*border:\s*1px solid rgba\(226,\s*205,\s*178,\s*\.12\)/s);
  assert.match(css, /\.seat\.player-pod\s*\{[^}]*background:\s*linear-gradient/s);
  assert.match(css, /\.player-pod-avatar\s*\{[^}]*background:\s*radial-gradient/s);
  assert.match(css, /\.seat\.player-pod\.folded\s*\{[^}]*opacity:\s*\.26/s);
});

test('final action and top chrome use restrained warm materials without green glow', () => {
  assert.match(css, /--live-v2-dock-surface:\s*#17110e/);
  assert.match(css, /\.live-v2-action-dock\s*\{[^}]*background:\s*linear-gradient/s);
  assert.match(css, /\.live-v2-top-control\s*\{[^}]*background:\s*rgba\(24,\s*18,\s*14,\s*\.78\)/s);
  assert.match(css, /\[data-live-action="raise"\][\s\S]*?background:\s*linear-gradient\(180deg,\s*#ad672b,\s*#75421d\)/);
});

test('core Live viewport is non-scrolling and status titles remain complete', () => {
  assert.match(css, /\.is-live-game-active\s*\{[^}]*height:\s*100dvh;[^}]*overflow-y:\s*hidden/s);
  assert.match(css, /\.is-live-game-active main,[\s\S]*?#screen-live\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(html, /phase==='completed'\s*\?'Раздача завершена'/);
  assert.doesNotMatch(html, /phase==='completed'\s*\?\(session\.winnerSummary\|\|'Раздача завершена'\)/);
});
