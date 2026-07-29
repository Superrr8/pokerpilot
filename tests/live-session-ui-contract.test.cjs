'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const cssPath = path.join(root, 'src/styles/live-session.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

test('Live Session подключает отдельную модель сохранённых раздач и стили', () => {
  assert.match(html, /<script src="src\/live\/saved-hands\.js"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="src\/styles\/live-session\.css">/);
  assert.ok(
    html.indexOf('src/live/saved-hands.js') < html.indexOf('<script>'),
    'модель должна загружаться до прикладного скрипта'
  );
});

test('завершённая раздача предлагает заметное сохранение с подтверждением', () => {
  assert.match(html, /id="saveLiveHand"[^>]*>[^<]*Save Hand/);
  assert.match(html, /Hand saved successfully/);
  assert.match(html, /saveUnique\(/);
});

test('Разбор содержит Saved Hands и может открыть руку в Hand Lab', () => {
  assert.match(html, /id="savedHandsList"/);
  assert.match(html, /Сохранённые раздачи/);
  assert.match(html, /openSavedHandInAnalyzer/);
});

test('стол показывает отдельные action bubble и fold badge возле игроков', () => {
  assert.match(html, /player-action-bubble/);
  assert.match(html, /fold-badge/);
  assert.match(css, /\.player-action-bubble/);
  assert.match(css, /\.fold-badge/);
  assert.match(css, /\.seat\.folded/);
});

test('ставки игроков имеют chip stack и лёгкую анимацию сбора в банк', () => {
  assert.match(html, /seat-bet/);
  assert.match(html, /animateBetsToPot/);
  assert.match(css, /\.seat-bet/);
  assert.match(css, /@keyframes live-bet-to-pot/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('commitTo сохраняет единый математический pot state, а presented pot обновляется при сборе ставок', () => {
  assert.match(
    html,
    /function commitTo\(p,target\)\{[\s\S]*?session\.pot\+=add;[\s\S]*?renderLive\(\);return add;\}/
  );
  assert.match(
    html,
    /function finishBetCollection\(\)\{[\s\S]*?session\.presentedPot=session\.pot;[\s\S]*?streetContrib=0;/
  );
  assert.doesNotMatch(html, /visualPot|displayPot|animatedPot\s*=/);
});

test('панель истории использует структурированные действия и группировку по улицам', () => {
  assert.match(html, /id="actionLog"[^>]*aria-label="История раздачи"/);
  assert.match(html, /recordLiveAction/);
  assert.match(html, /groupActions/);
  assert.match(css, /\.action-history-street/);
});

test('Live Session сохраняет существующие точки вызова PokerCore без копии математики', () => {
  assert.match(html, /const C\s*=\s*window\.PokerCore/);
  assert.doesNotMatch(html, /function\s+(?:eval5|best7|equityVsRange|callEV)\s*\(/);
});

test('Fold Hero переводит стол в observer flow вместо немедленного awardPot', () => {
  assert.match(html, /function continueAfterHeroFold/);
  assert.match(html, /flowController\.foldHero/);
  assert.doesNotMatch(
    html,
    /if\(action==='fold'\)[\s\S]{0,240}awardPot\(session\.villain/
  );
});

test('Live Session подключает lifecycle controller до прикладного скрипта', () => {
  assert.match(html, /<script src="src\/live\/live-flow-controller\.js"><\/script>/);
  assert.ok(
    html.indexOf('src/live/live-flow-controller.js') < html.indexOf('<script>'),
    'контроллер должен загрузиться до inline-приложения'
  );
});

test('compact save, pause и auto-next не требуют крупной Next Hand кнопки', () => {
  assert.match(html, /id="saveLiveHand"[^>]*compact-hand-action/);
  assert.match(html, /id="pauseLive"/);
  assert.match(html, /scheduleAutomaticNextHand/);
  assert.match(css, /\.live-hand-controls/);
  assert.match(css, /\.compact-hand-action/);
});

test('визуальный стол различает скрытые, showdown и winning hole cards', () => {
  assert.match(html, /seat-hole-cards/);
  assert.match(html, /showCards/);
  assert.match(html, /winner/);
  assert.match(css, /\.seat-hole-cards/);
  assert.match(css, /\.seat\.winner/);
  assert.match(css, /#heroCards\.is-folded/);
});

test('Phase 1.1 подключает единую presentation queue и pacing до приложения', () => {
  assert.match(html, /<script src="src\/live\/live-presentation-queue\.js"><\/script>/);
  assert.ok(
    html.indexOf('src/live/live-presentation-queue.js') < html.indexOf('<script>'),
    'presentation queue должна загружаться до inline-приложения'
  );
  assert.match(html, /LIVE_PACING/);
  assert.match(html, /playStreetTransition/);
  assert.match(html, /playShowdown/);
});

test('action badges и стабильные bet zones имеют мобильный и reduced-motion контракт', () => {
  assert.match(css, /\.seat-bet-zone/);
  assert.match(css, /\.player-action-bubble\[data-action="CHECK"\]/);
  assert.match(css, /\.player-action-bubble\[data-action="FOLD"\]/);
  assert.match(css, /\.player-action-bubble\.is-exiting/);
  assert.match(css, /\.board-card\.is-revealing/);
  assert.match(css, /\.live-observing-status/);
  assert.match(css, /@media \(max-width:\s*390px\)[\s\S]*\.seat-bet-zone/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.player-action-bubble/);
});

test('showdown и результат не дублируются в action bubble', () => {
  assert.match(html, /LIVE_TABLE_ACTION_TYPES/);
  assert.match(
    html,
    /LIVE_TABLE_ACTION_TYPES\.has\(type\)[\s\S]*?player\.visualAction=/
  );
  assert.match(html, /session\.winnerSummary\|\|'Раздача завершена'/);
});
