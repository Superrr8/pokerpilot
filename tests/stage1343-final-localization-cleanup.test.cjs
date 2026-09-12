'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const I18n = require('../src/ui/translations.js');
const CYRILLIC = /[А-Яа-яЁё]/;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function activateLocale(locale) {
  const manager = I18n.createLocalization({
    storage: memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: locale }),
    navigatorRef: {},
    documentRef: null
  });
  global.PokerElevateI18n = manager;
  global.PokerPilotI18n = manager;
  return manager;
}

function reload(relative) {
  const filename = path.join(root, relative);
  delete require.cache[require.resolve(filename)];
  return require(filename);
}

test('History review explanation follows the active locale without changing stored copy', () => {
  const stored = 'С натсовым флешем нужно искать дополнительное вэлью, а не просто закрывать действие. Какие худшие флеши и сильные пары способны оплатить рейз?';

  activateLocale('en');
  let HistoryUI = reload('src/ui/daily-challenge-history.js');
  const english = HistoryUI.localizeExplanation(stored);
  assert.equal(english, 'With the nut flush, look for additional value instead of simply closing the action. Which worse flushes and strong pairs can pay off a raise?');
  assert.doesNotMatch(english, CYRILLIC);

  activateLocale('ru');
  HistoryUI = reload('src/ui/daily-challenge-history.js');
  assert.equal(HistoryUI.localizeExplanation(stored), stored);
});

test('Live Coach preflop guidance uses one locale-aware template', () => {
  const start = html.indexOf("$('#liveHint').addEventListener");
  const source = html.slice(start, html.indexOf("$('#liveMathToggle').addEventListener", start));
  assert.match(source, /i18nText\('live\.coachPreflopGuidance'\)/);
  assert.doesNotMatch(source, /Trainer: сначала назови позицию/);

  const english = activateLocale('en').t('live.coachPreflopGuidance');
  assert.doesNotMatch(english, CYRILLIC);
  assert.match(english, /position.*action before you.*hand category/i);

  const russian = activateLocale('ru').t('live.coachPreflopGuidance');
  assert.equal(russian, 'Trainer: сначала назови позицию, действие до тебя и категорию руки. Не принимай решение только по красивым картам.');
});

test('Profile removes duplicate language cards while header switching and Appearance remain intact', () => {
  const profileStart = html.indexOf('<section id="screen-profile"');
  const profileEnd = html.indexOf('<section id="screen-achievements"', profileStart);
  const profile = html.slice(profileStart, profileEnd);
  const appearanceStart = profile.indexOf('<section id="profileAppearance"');
  const appearance = profile.slice(appearanceStart, profile.indexOf('<section id="progressAnalytics"', appearanceStart));

  assert.doesNotMatch(profile, /id="profileLanguage"|profile-language-setting|data-locale-choice/);
  assert.match(appearance, /id="profileAppearanceTitle"/);
  assert.match(appearance, /data-theme-choice="obsidian"/);
  assert.equal((appearance.match(/data-theme-choice=/g) || []).length, 10);

  assert.match(html, /id="headerLocaleToggle"[^>]*aria-haspopup="menu"[^>]*>🇺🇸<\/button>/);
  assert.match(html, /data-locale-choice="en"[^>]*>[\s\S]*?USA[\s\S]*?🇺🇸/);
  assert.match(html, /data-locale-choice="ru"[^>]*>[\s\S]*?Russia[\s\S]*?🇷🇺/);

  const storage = memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: 'en' });
  const manager = I18n.createLocalization({ storage, navigatorRef: {}, documentRef: null });
  manager.setLocale('ru');
  assert.equal(manager.getLocale(), 'ru');
  assert.equal(storage.getItem(I18n.LOCALE_STORAGE_KEY), 'ru');
  const reopened = I18n.createLocalization({ storage, navigatorRef: { languages: ['en-US'] }, documentRef: null });
  assert.equal(reopened.getLocale(), 'ru');
});
