'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src', 'ui', 'translations.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function documentStub() {
  return {
    documentElement: {
      lang: '',
      dataset: {},
      setAttribute(name, value) { this[name] = String(value); }
    },
    body: null,
    readyState: 'loading',
    addEventListener() {},
    dispatchEvent() {},
    querySelector() { return null; }
  };
}

function loadApi() {
  delete require.cache[require.resolve(sourcePath)];
  return require(sourcePath);
}

test('Stage 13.4 exposes one canonical en/ru localization system with U.S. English semantics', () => {
  const api = loadApi();
  assert.deepEqual(Array.from(api.SUPPORTED_LOCALES), ['en', 'ru']);
  assert.equal(api.DEFAULT_LOCALE, 'en');
  assert.equal(api.LOCALE_TAGS.en, 'en-US');
  assert.equal(api.LOCALE_TAGS.ru, 'ru-RU');
  assert.equal(api.messages.es, undefined);
  assert.equal(api.resolveDeviceLocale({ languages: ['en-GB'], language: 'en-GB' }), 'en');
  assert.equal(api.resolveDeviceLocale({ languages: ['es-US'], language: 'es-US' }), 'en');
});

test('device locale resolution detects Russian variants and otherwise falls back to English', () => {
  const api = loadApi();
  for (const language of ['ru', 'ru-RU', 'ru-KZ']) {
    assert.equal(api.resolveDeviceLocale({ languages: [language], language }), 'ru', language);
  }
  for (const language of ['en-US', 'en-GB', 'es-US', 'de-DE', '']) {
    assert.equal(api.resolveDeviceLocale({ languages: language ? [language] : [], language }), 'en', language || 'empty');
  }
});

test('manual locale preference overrides the device and survives manager recreation', () => {
  const api = loadApi();
  const storage = memoryStorage();
  const firstDocument = documentStub();
  const first = api.createLocalization({
    storage,
    navigatorRef: { languages: ['ru-RU'], language: 'ru-RU' },
    documentRef: firstDocument
  });

  assert.equal(first.getLocale(), 'ru');
  first.setLocale('en');
  assert.equal(storage.getItem(api.LOCALE_STORAGE_KEY), 'en');
  assert.equal(first.getLocale(), 'en');
  assert.equal(firstDocument.documentElement.lang, 'en-US');

  const reopened = api.createLocalization({
    storage,
    navigatorRef: { languages: ['ru-RU'], language: 'ru-RU' },
    documentRef: documentStub()
  });
  assert.equal(reopened.getLocale(), 'en');

  reopened.setLocale('ru');
  const secondReopen = api.createLocalization({
    storage,
    navigatorRef: { languages: ['en-US'], language: 'en-US' },
    documentRef: documentStub()
  });
  assert.equal(secondReopen.getLocale(), 'ru');
  assert.equal(secondReopen.getLocaleTag(), 'ru-RU');
  assert.equal(secondReopen.translateCopy('Home'), 'Главная');
});

test('translations interpolate values, fall back safely to English, and never expose raw keys', () => {
  const api = loadApi();
  const manager = api.createLocalization({
    storage: memoryStorage({ [api.LOCALE_STORAGE_KEY]: 'ru' }),
    navigatorRef: { languages: ['ru-RU'] },
    documentRef: documentStub()
  });

  assert.equal(manager.t('profile.level', { level: 4 }), 'Level 4');
  assert.equal(manager.t('fallback.englishOnly'), 'English fallback');
  assert.equal(manager.t('missing.raw.localization.key'), '');
  assert.equal(manager.t('missing.withFallback', {}, 'Safe fallback'), 'Safe fallback');
  assert.doesNotMatch(manager.t('missing.raw.localization.key'), /missing\.raw\.localization\.key/);
  assert.equal(manager.translateCopy('Analysis'), 'Разбор');
  assert.equal(
    manager.translateCopy('Exam / Training / Review and practice settings'),
    'Экзамен / Тренировка / Разбор и настройки практики'
  );
});

test('required production translations are complete in both English and Russian', () => {
  const api = loadApi();
  assert.ok(api.REQUIRED_KEYS.length > 40);
  for (const key of api.REQUIRED_KEYS) {
    assert.equal(typeof api.messages.en[key], 'string', `missing en ${key}`);
    assert.ok(api.messages.en[key].length > 0, `empty en ${key}`);
    assert.equal(typeof api.messages.ru[key], 'string', `missing ru ${key}`);
    assert.ok(api.messages.ru[key].length > 0, `empty ru ${key}`);
  }
});

test('Header exposes only English and Russian and applies through the canonical manager', () => {
  assert.doesNotMatch(html, /id="profileLanguage"/);
  assert.match(html, /id="headerLocaleToggle"[^>]*aria-haspopup="menu"/);
  assert.match(html, /data-locale-choice="en"[^>]*>[\s\S]*?USA[\s\S]*?🇺🇸/);
  assert.match(html, /data-locale-choice="ru"[^>]*>[\s\S]*?Russia[\s\S]*?🇷🇺/);
  assert.doesNotMatch(html, /data-locale-choice="es"/);
  assert.match(source, /PokerElevateI18n/);
  assert.match(html, /src\/ui\/translations\.js/);
});

test('localization loads before navigation and the accepted viewport contract remains untouched', () => {
  const translations = '<script src="src/ui/translations.js"></script>';
  const navigation = '<script src="src/ui/navigation.js"></script>';
  assert.ok(html.indexOf(translations) >= 0);
  assert.ok(html.indexOf(translations) < html.indexOf(navigation));
  assert.match(html, /<html lang="en-US">/);
  assert.match(html, /width=device-width,initial-scale=1,minimum-scale=1,viewport-fit=cover/);
});

test('locale-aware formatting uses U.S. English and Russian conventions without changing stored values', () => {
  const api = loadApi();
  const storage = memoryStorage({ [api.LOCALE_STORAGE_KEY]: 'en' });
  const manager = api.createLocalization({ storage, navigatorRef: {}, documentRef: documentStub() });
  const instant = new Date(Date.UTC(2026, 8, 8, 17, 5));

  assert.equal(manager.formatDate(instant, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
  }), '09/08/2026');
  manager.setLocale('ru');
  assert.equal(manager.formatDate(instant, {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
  }), '08.09.2026');
  assert.equal(instant.toISOString(), '2026-09-08T17:05:00.000Z');

  const localizedCallsites = [
    'index.html',
    'src/daily/daily-challenge-history.js',
    'src/profile/profile-store.js',
    'src/ui/achievement-center.js',
    'src/ui/profile.js',
    'src/ui/progress-analytics-view.js',
    'src/ui/progress-overview.js'
  ];
  for (const relative of localizedCallsites) {
    const contents = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(contents, /toLocale(?:String|UpperCase)\(['"]ru-RU['"]\)/, relative);
    assert.doesNotMatch(contents, /(?:\|\||\?\?)\s*['"]ru-RU['"]/, `${relative} must fall back to en-US`);
  }
});

test('current learning and Trainer content catalogs have complete English coverage', () => {
  const api = loadApi();
  const manager = api.createLocalization({
    storage: memoryStorage({ [api.LOCALE_STORAGE_KEY]: 'en' }),
    navigatorRef: {},
    documentRef: documentStub()
  });
  const catalogs = [
    require(path.join(root, 'src', 'data', 'learning-course.js')),
    require(path.join(root, 'src', 'data', 'postflop-scenarios.js'))
  ];
  const misses = [];
  const inspect = (value, trail = 'root') => {
    if (typeof value === 'string') {
      const translated = manager.translateCopy(value);
      if (/[А-Яа-яЁё]/.test(translated)) misses.push(`${trail}: ${value}`);
      return;
    }
    if (Array.isArray(value)) return value.forEach((item, index) => inspect(item, `${trail}[${index}]`));
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => inspect(item, `${trail}.${key}`));
    }
  };
  catalogs.forEach((catalog, index) => inspect(catalog, `catalog${index}`));
  assert.deepEqual(misses, []);
});

test('static UI copy and accessibility labels have no unexplained Russian output in English mode', () => {
  const api = loadApi();
  const manager = api.createLocalization({
    storage: memoryStorage({ [api.LOCALE_STORAGE_KEY]: 'en' }),
    navigatorRef: {},
    documentRef: documentStub()
  });
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const candidates = [];
  for (const match of markup.matchAll(/>([^<>]+)</g)) candidates.push(match[1].trim());
  for (const match of markup.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)) candidates.push(match[1].trim());
  const allowedAutonyms = new Set(['Русский']);
  const misses = [...new Set(candidates.filter(Boolean).filter(value => /[А-Яа-яЁё]/.test(value))
    .filter(value => !allowedAutonyms.has(value))
    .filter(value => /[А-Яа-яЁё]/.test(manager.translateCopy(value))))];
  assert.deepEqual(misses, []);
});
