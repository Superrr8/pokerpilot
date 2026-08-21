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

test('save, pause и auto-next остаются доступны в компактном More sheet', () => {
  assert.match(html, /id="liveMoreToggle"[^>]*aria-controls="liveMoreSheet"/);
  assert.match(html, /id="liveMoreSheet"[\s\S]*?id="saveLiveHand"/);
  assert.match(html, /id="pauseLive"/);
  assert.match(html, /scheduleAutomaticNextHand/);
  assert.match(css, /\.live-v2-session-actions/);
  assert.match(css, /\.live-v2-more-control/);
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

test('Live UX подключает отдельный controller до inline-приложения', () => {
  assert.match(html, /<script src="src\/live\/live-ux-controller\.js"><\/script>/);
  assert.ok(
    html.indexOf('src/live/live-ux-controller.js') < html.indexOf('<script>'),
    'Live UX controller должен загружаться до inline-приложения'
  );
});

test('HistoryPanel имеет компактную доступную кнопку и анимируемое содержимое', () => {
  assert.match(html, /id="liveHistoryToggle"[^>]*aria-expanded="false"[^>]*aria-controls="liveHistoryBody"/);
  assert.match(html, /id="liveHistoryBody"/);
  assert.match(html, /id="liveHistoryCount"/);
  assert.match(css, /\.live-history-toggle/);
  assert.match(css, /\.live-history-panel\.is-expanded/);
  assert.match(css, /grid-template-rows/);
});

test('HistoryPanel обновляется отдельно от decision card', () => {
  assert.match(html, /historyPanel\.onHeroTurn\(\)/);
  assert.match(html, /historyPanel\.startHand\(\)/);
  assert.match(html, /function renderHistoryPanelState/);
  assert.match(html, /liveHistoryToggle[\s\S]*?historyPanel\.toggle/);
});

test('Hero и board cards синхронизируются без пересоздания при обычном rerender', () => {
  assert.match(html, /syncCardCollection\(\$\('#heroCards'\)/);
  assert.match(html, /syncCardCollection\(board/);
  assert.doesNotMatch(html, /\$\('#heroCards'\)\.innerHTML=cardsHTML/);
  assert.doesNotMatch(html, /board\.innerHTML=cardsHTML/);
});

test('action feed дедуплицирует enter-анимацию и сохраняет компактное последнее действие', () => {
  assert.match(html, /actionFeed\.consume\(action\.eventId\)/);
  assert.match(html, /seat-last-action/);
  assert.match(css, /\.player-action-bubble\.is-entering/);
  assert.match(css, /\.seat-last-action/);
});

test('Hero active state использует декоративный pulse без изменения геометрии', () => {
  assert.match(css, /\.seat\.hero\.hero-turn::after/);
  assert.match(css, /@keyframes live-hero-pulse/);
  assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*\.seat\.hero\.hero-turn::after[\s\S]*animation:\s*none/);
});
