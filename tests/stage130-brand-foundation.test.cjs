'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('canonical product brand exposes PokerElevate presentation identity', () => {
  const Brand = require('../src/config/product-brand.js');
  assert.deepEqual(
    {
      productName: Brand.productName,
      shortName: Brand.shortName,
      wordmark: Brand.wordmark,
      monogram: Brand.monogram,
      tagline: Brand.tagline
    },
    {
      productName: 'PokerElevate',
      shortName: 'PokerElevate',
      wordmark: 'PokerElevate',
      monogram: 'PE',
      tagline: 'Тренировка и разбор решений'
    }
  );
  assert.equal(Object.isFrozen(Brand), true);
});

test('document and install metadata use the PokerElevate identity', () => {
  const html = read('index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.match(html, /<title>PokerElevate<\/title>/);
  assert.match(html, /<meta name="application-name" content="PokerElevate">/);
  assert.match(html, /<meta name="apple-mobile-web-app-title" content="PokerElevate">/);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.equal(manifest.name, 'PokerElevate');
  assert.equal(manifest.short_name, 'PokerElevate');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});

test('primary wordmark uses the centralized brand hooks and PE monogram', () => {
  const html = read('index.html');
  assert.match(html, /<script src="src\/config\/product-brand\.js"><\/script>/);
  assert.match(html, /class="logo" data-brand="monogram">PE<\/span>/);
  assert.match(html, /<strong data-brand="wordmark">PokerElevate<\/strong>/);
  assert.match(html, /<small data-brand="tagline">Тренировка и разбор решений<\/small>/);
  assert.match(html, /const BRAND = window\.ProductBrand;\s*BRAND\.apply\(document\)/);
});

test('critical current user-facing PokerPilot labels are migrated', () => {
  const html = read('index.html');
  assert.doesNotMatch(html, />PokerPilot</);
  assert.doesNotMatch(html, /PokerPilot v2\.0|PokerPilot intelligence|статистику PokerPilot|— PokerPilot/);
  for (const relativePath of [
    'src/training/focus-session.js',
    'src/data/learning-course.js',
    'src/ui/ui-feedback.js'
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /Продолжай[^\n]*PokerPilot|интерфейс PokerPilot|Как читать PokerPilot|title \|\| 'PokerPilot'/);
    assert.match(source, /ProductBrand|Brand\.productName/);
  }
});

test('legacy persistence and public runtime identifiers remain compatible', () => {
  const storage = read('src/storage/progress-storage.js');
  const progress = read('src/progress/progress-config.js');
  const profile = read('src/profile/profile-store.js');
  const theme = read('src/ui/theme-manager.js');
  assert.match(storage, /pokerpilot_v1_6_progress/);
  assert.match(progress, /pokerpilot_progress_system/);
  assert.match(profile, /pokerpilot_profile/);
  assert.match(theme, /pokerpilot\.appearance\.v1/);
  assert.match(read('src/ui/dashboard.js'), /root\.PokerPilotDashboard = api/);
  assert.match(read('src/data/learning-course.js'), /root\.POKERPILOT_COURSE = course/);
});

test('mobile brand containment is responsive without changing frozen geometry', () => {
  const css = read('src/styles/app-shell.css');
  const brandCss = css.slice(css.indexOf('/* Stage 13.0 — responsive product wordmark containment. */'));
  assert.match(css, /\.brand-copy\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.brand strong\s*\{[^}]*overflow-wrap:\s*normal[^}]*white-space:\s*nowrap/s);
  assert.match(brandCss, /@media \(max-width: 480px\)[\s\S]*\.brand\s*\{[^}]*max-width:/s);
  assert.doesNotMatch(brandCss, /\.bottom-nav|\.dashboard-learning-row|\.daily-challenge-card|\.poker-table|\.live-v2/);
});

test('brand config can apply identity without storing or routing anything', () => {
  const source = read('src/config/product-brand.js');
  assert.match(source, /function apply\(documentRef/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|history\.|location\.|fetch\(|XMLHttpRequest/);
});
