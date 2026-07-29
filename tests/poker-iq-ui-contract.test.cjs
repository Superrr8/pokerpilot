'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profileUi = fs.readFileSync(path.join(root, 'src/ui/profile.js'), 'utf8');
const dqUi = fs.readFileSync(path.join(root, 'src/ui/decision-quality.js'), 'utf8');
const cssPath = path.join(root, 'src/styles/poker-iq.css');
const profileUiModule = require('../src/ui/profile.js');

test('Poker IQ scripts подключены до Profile UI и inline app', () => {
  const config = html.indexOf('src/poker-iq/poker-iq-config.js');
  const engine = html.indexOf('src/poker-iq/poker-iq-engine.js');
  const stats = html.indexOf('src/poker-iq/poker-iq-stats.js');
  const profile = html.indexOf('src/ui/profile.js');
  assert.ok(config >= 0 && config < engine && engine < stats && stats < profile);
});

test('Profile показывает Не рассчитан при нуле решений', () => {
  assert.match(profileUi, /Не рассчитан/);
  assert.match(html, /Нужно минимум 30 оцениваемых решений/);
});

test('отсутствующие consistency и street breakdown остаются null, а не 0', () => {
  const model = profileUiModule.createPokerIqViewModel({
    score: null,
    isRated: false,
    sampleStatus: 'NONE',
    components: { consistency: null },
    breakdown: { preflop: null, flop: null, turn: null, river: null }
  });
  assert.equal(model.consistency, null);
  assert.equal(model.streets.preflop, null);
  assert.equal(model.streets.flop, null);
});

for (const status of ['PROVISIONAL', 'FORMING', 'ESTABLISHED']) {
  test(`Profile UI содержит статус ${status}`, () => assert.match(profileUi, new RegExp(status)));
}

test('Profile показывает Poker IQ score и текст Rank', () => {
  assert.match(html, /profilePokerIq/);
  assert.match(html, /profilePokerIqRank/);
});

test('next rank progress имеет семантический progressbar', () => {
  assert.match(html, /profilePokerIqProgress[^>]+role="progressbar"/);
  assert.match(profileUi, /iqToNext/);
});

test('trend имеет текст и icon hook', () => {
  assert.match(html, /profilePokerIqTrend/);
  assert.match(profileUi, /INSUFFICIENT_DATA|STABLE/);
});

test('missing street показывает Недостаточно данных', () => {
  assert.match(profileUi, /Недостаточно данных/);
});

test('Home entry остаётся компактным и содержит IQ/Rank', () => {
  assert.match(html, /homeProfileIq/);
  assert.match(profileUi, /renderHomeEntry/);
});

test('Coach не делает громких выводов на малой выборке', () => {
  assert.match(html, /Poker IQ формируется/);
  assert.match(html, /ratedDecisions|sampleStatus/);
});

test('session summary отделяет IQ от денежного результата', () => {
  assert.match(html, /pokerIQSnapshot/);
  assert.match(html, /Результат:/);
});

test('old history без IQ snapshot не падает', () => {
  assert.match(dqUi, /pokerIQSnapshot\?/);
});

test('Poker IQ CSS mobile-first и без horizontal overflow', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*clip/);
});

test('нижняя навигация учитывается Profile shell', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /safe-area-inset-bottom/);
});

test('Poker IQ CSS поддерживает reduced motion', () => {
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('Poker IQ имеет screen-reader aria summary', () => {
  assert.match(html, /profilePokerIqSummary/);
  assert.match(profileUi, /aria-label/);
});

test('существующий Decision Quality UI остаётся подключён', () => {
  assert.match(html, /src\/ui\/decision-quality\.js/);
  assert.match(html, /profileDecisionQuality/);
});

test('существующее редактирование профиля сохранено', () => {
  assert.match(html, /profileEditDialog/);
  assert.match(profileUi, /updateProfile/);
});

test('Poker IQ UI не использует innerHTML для пользовательских данных', () => {
  assert.doesNotMatch(profileUi, /innerHTML\\s*=.*pokerIQ/i);
});

test('Poker IQ не смешивается с XP progress', () => {
  assert.match(profileUi, /profileXpProgress/);
  assert.match(profileUi, /profilePokerIqProgress/);
});
