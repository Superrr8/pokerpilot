'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const DailyUI = require('../src/ui/daily-challenge.js');
const card = html.match(/<section id="dailyChallengeCard"[\s\S]*?<\/section>/)?.[0] || '';

test('карточка использует русский заголовок Раздача дня', () => {
  assert.match(card, /id="dailyChallengeCardTitle">Раздача дня</);
});

test('старый user-facing заголовок Daily Challenge отсутствует в dashboard card', () => {
  assert.doesNotMatch(card, />Daily Challenge</);
});

test('main CTA нового состояния остаётся Решить', () => {
  assert.match(card, /id="dailyChallengeCta"[^>]*>Решить</);
});

test('main CTA completed state меняется на Посмотреть разбор', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge.js'), 'utf8');
  assert.match(source, /completed\s*\?\s*'Посмотреть разбор'\s*:\s*'Решить'/);
});

test('History action остаётся доступной из карточки', () => {
  assert.match(card, /id="dailyChallengeHistoryCta"[^>]*data-route="daily-history"[^>]*>История</);
});

test('History action использует компактный ghost visual contract', () => {
  assert.match(card, /id="dailyChallengeHistoryCta"[^>]*class="[^"]*ui-button-ghost[^"]*small/);
});

test('main CTA имеет более сильный primary visual contract', () => {
  assert.match(card, /id="dailyChallengeCta"[^>]*class="[^"]*ui-button-primary/);
});

test('correct completion показывает сохранённый +25 XP', () => {
  assert.equal(DailyUI.dashboardResultLabel({ isCorrect: true, xpAwarded: 25 }), 'Правильное решение · +25 XP');
});

test('incorrect completion показывает сохранённый +10 XP', () => {
  assert.equal(DailyUI.dashboardResultLabel({ isCorrect: false, xpAwarded: 10 }), 'Ошибка · +10 XP');
});

test('pending completion не выдумывает XP', () => {
  assert.equal(DailyUI.dashboardResultLabel({ isCorrect: false, xpAwarded: null }), 'Ошибка');
});

test('desktop layout использует горизонтальную content/actions композицию', () => {
  assert.match(css, /\.daily-challenge-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(/);
  assert.match(css, /\.daily-challenge-card-actions\s*\{[\s\S]*align-self:\s*center/);
});

test('desktop Dashboard даёт карточке всю ширину двухколоночной сетки', () => {
  assert.match(css, /@media\s*\(min-width:\s*760px\)[\s\S]*\.home-dashboard\s*>\s*\.daily-challenge-card\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
});

test('desktop заголовок естественно остаётся в одну строку', () => {
  assert.match(css, /\.daily-challenge-card h2\s*\{[\s\S]*white-space:\s*nowrap/);
});

test('mobile layout безопасно переключается в одну колонку', () => {
  assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*\.daily-challenge-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('mobile заголовок может переноситься без horizontal overflow', () => {
  assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*\.daily-challenge-card h2\s*\{[\s\S]*white-space:\s*normal/);
  assert.match(css, /#screen-daily,[\s\S]*overflow-x:\s*hidden/);
});

test('обе кнопки сохраняют touch target не меньше 44px', () => {
  assert.match(css, /daily-challenge-primary[\s\S]*min-height:\s*(?:4[4-9]|[5-9]\d)px/);
  assert.match(css, /daily-challenge-card-actions \.ui-button-ghost[\s\S]*min-height:\s*44px/);
});

test('focus-visible остаётся явно определённым для actions', () => {
  assert.match(css, /daily-challenge-card-actions button:focus-visible/);
});

test('main и History actions сохраняют SPA navigation routes', () => {
  assert.match(card, /id="dailyChallengeCta"[^>]*data-route="daily"/);
  assert.match(card, /id="dailyChallengeHistoryCta"[^>]*data-route="daily-history"/);
});

test('History и review routes остаются подключёнными', () => {
  assert.match(html, /name === 'daily-history'[\s\S]*openHistory/);
  assert.match(html, /name === 'daily-review'[\s\S]*openReview/);
});
