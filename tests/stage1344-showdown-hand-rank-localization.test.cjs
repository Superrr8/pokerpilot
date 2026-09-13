'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPokerCore } = require('./poker-core-loader.cjs');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const I18n = require('../src/ui/translations.js');
const C = loadPokerCore();
const cards = text => text.split(/\s+/).map(C.parseCard);
const CYRILLIC = /[А-Яа-яЁё]/;

const fixtures = Object.freeze([
  ['As Kd 9c 6h 3s', 0, 'High Card', 'Старшая карта'],
  ['As Ad 9c 6h 3s', 1, 'One Pair', 'Пара'],
  ['As Ad 9c 9h 3s', 2, 'Two Pair', 'Две пары'],
  ['As Ad Ac 6h 3s', 3, 'Three of a Kind', 'Сет'],
  ['9s 8d 7c 6h 5s', 4, 'Straight', 'Стрит'],
  ['As Js 9s 6s 3s', 5, 'Flush', 'Флеш'],
  ['As Ad Ac 6h 6s', 6, 'Full House', 'Фулл-хаус'],
  ['As Ad Ac Ah 3s', 7, 'Four of a Kind', 'Каре'],
  ['9s 8s 7s 6s 5s', 8, 'Straight Flush', 'Стрит-флеш']
]);

function manager(locale) {
  return I18n.createLocalization({
    storage: {
      getItem: () => locale,
      setItem() {}
    },
    navigatorRef: {},
    documentRef: null
  });
}

test('all evaluator hand categories have Cyrillic-free U.S. English showdown labels', () => {
  const i18n = manager('en');
  for (const [input, category, english] of fixtures) {
    const evaluation = C.eval5(cards(input));
    assert.equal(evaluation[0], category);
    assert.equal(i18n.handRankLabel(evaluation), english);
    assert.doesNotMatch(i18n.handRankLabel(evaluation), CYRILLIC);
  }
});

test('Russian showdown labels remain correct without changing evaluated hand state', () => {
  const english = manager('en');
  const russian = manager('ru');
  for (const [input, category, englishLabel, russianLabel] of fixtures) {
    const evaluation = C.eval5(cards(input));
    const stateBeforePresentation = Array.from(evaluation);
    assert.equal(english.handRankLabel(evaluation), englishLabel);
    assert.equal(russian.handRankLabel(evaluation), russianLabel);
    assert.deepEqual(Array.from(evaluation), stateBeforePresentation);
    assert.equal(evaluation[0], category);
    assert.equal(C.handName(evaluation), russianLabel);
  }

  const royalFlush = C.eval5(cards('As Ks Qs Js Ts'));
  assert.deepEqual(Array.from(royalFlush), [8, 14]);
  assert.equal(english.handRankLabel(royalFlush), 'Straight Flush');
});

test('both Live showdown generators use locale-aware rank presentation', () => {
  assert.equal((html.match(/showdownLabel=i18nHandRank\((?:entry\.)?evaluation\)/g) || []).length, 2);
  assert.doesNotMatch(html, /showdownLabel=C\.handName\(evaluation\)/);
  assert.equal((html.match(/i18nText\('live\.showdown',\{player:[^}]+,hand:[^}]+\}\)/g) || []).length, 2);
});
