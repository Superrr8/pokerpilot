'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cssPath = path.join(ROOT, 'src', 'styles', 'daily-challenge.css');
const uiPath = path.join(ROOT, 'src', 'ui', 'daily-challenge.js');

test('Dashboard содержит заметную карточку Раздача дня', () => {
  for (const id of ['dailyChallengeCard', 'dailyChallengeStatus', 'dailyChallengeCta']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Раздача дня/);
});

test('CTA ведёт на отдельный daily route', () => {
  assert.match(html, /id="dailyChallengeCta"[^>]*data-route="daily"/);
  assert.match(html, /id="screen-daily"/);
});

test('challenge view содержит карты, board, context, actions, confirm и feedback', () => {
  for (const id of [
    'dailyHeroCards', 'dailyBoard', 'dailyContext', 'dailyActions',
    'dailyConfirm', 'dailyFeedback', 'dailyCorrectAction', 'dailyExplanation'
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
});

test('результат доступен screen reader и действия semantic', () => {
  assert.match(html, /id="dailyFeedback"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="dailyActions"[^>]*role="group"[^>]*aria-label="[^"]+"/);
  assert.match(html, /id="dailyConfirm"[^>]*type="button"/);
});

test('правильный ответ не зашит в HTML или data attributes', () => {
  assert.doesNotMatch(html, /data-correct(?:-action)?=/i);
  const dailyScreen = html.match(/<section id="screen-daily"[\s\S]*?<\/section>/)?.[0] || '';
  assert.doesNotMatch(dailyScreen, /correctAction\s*[:=]/);
});

test('Daily Challenge modules подключены в безопасном порядке', () => {
  const scripts = [
    'src/daily/daily-date.js',
    'src/daily/daily-challenge-reward.js',
    'src/daily/daily-challenge-catalog.js',
    'src/daily/daily-challenge-schedule.js',
    'src/daily/daily-challenge-storage.js',
    'src/daily/daily-challenge-system.js',
    'src/ui/daily-challenge.js'
  ];
  scripts.forEach(script => assert.match(html, new RegExp(`<script src="${script.replaceAll('/', '\\/')}"><\\/script>`)));
  const indexes = scripts.map(script => html.indexOf(script));
  assert.ok(indexes.every(index => index >= 0));
  assert.ok(indexes.at(-1) < html.indexOf("const C = window.PokerCore;"));
});

test('Daily UI не вызывает ProgressSystem и не дублирует poker math', () => {
  assert.ok(fs.existsSync(uiPath));
  const source = fs.readFileSync(uiPath, 'utf8');
  assert.doesNotMatch(source, /ProgressSystem|PokerIQ|addXp|callEV|equity|Monte Carlo/i);
});

test('route daily относится к Home и не меняет нижнюю навигацию', () => {
  const navigation = fs.readFileSync(path.join(ROOT, 'src', 'ui', 'navigation.js'), 'utf8');
  assert.match(navigation, /daily:\s*'home'/);
  const definition = navigation.match(/const definition = \[([\s\S]*?)\];/)?.[1] || '';
  assert.equal((definition.match(/\{ id:/g) || []).length, 5);
});

test('Daily Challenge имеет отдельные responsive styles и safe-area запас', () => {
  assert.ok(fs.existsSync(cssPath));
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(html, /src\/styles\/daily-challenge\.css/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
});

test('UI bootstrap создаёт system один раз и refresh dashboard без reload', () => {
  assert.match(html, /DailyChallengeSystem\.create/);
  assert.match(html, /dailyChallengeUi\.renderDashboard/);
  assert.match(html, /if \(name === 'daily'\)/);
});
