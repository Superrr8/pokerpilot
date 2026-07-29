'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const profileUiPath = path.join(root, 'src', 'ui', 'profile.js');
const profileCssPath = path.join(root, 'src', 'styles', 'profile.css');
const profileStorePath = path.join(root, 'src', 'profile', 'profile-store.js');
const profileStatsPath = path.join(root, 'src', 'profile', 'profile-statistics.js');

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function loadProfileUi() {
  const source = read(profileUiPath);
  assert.ok(source, 'Нет src/ui/profile.js');
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox, {
    name: 'PokerPilot profile UI contract sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  new vm.Script(source, { filename: 'src/ui/profile.js' })
    .runInContext(sandbox, { timeout: 2_000 });
  return sandbox.window.PokerPilotProfileUI || sandbox.module.exports;
}

test('профильные classic-script модули подключены в безопасном порядке', () => {
  const html = read(htmlPath);
  for (const filePath of [profileStorePath, profileStatsPath, profileUiPath, profileCssPath]) {
    assert.ok(fs.existsSync(filePath), `Нет ${path.relative(root, filePath)}`);
  }
  const storeScript = '<script src="src/profile/profile-store.js"></script>';
  const statsScript = '<script src="src/profile/profile-statistics.js"></script>';
  const uiScript = '<script src="src/ui/profile.js"></script>';
  assert.match(html, /src\/styles\/profile\.css/);
  assert.ok(html.indexOf(storeScript) < html.indexOf(statsScript));
  assert.ok(html.indexOf(statsScript) < html.indexOf(uiScript));
  assert.ok(html.indexOf(uiScript) < html.indexOf("const C = window.PokerCore;"));
});

test('Profile UI показывает null ratings честными placeholders', () => {
  const ui = loadProfileUi();
  const model = ui.createViewModel({
    profile: {
      displayName: 'Player',
      avatar: { type: 'initials', value: 'PL' },
      bio: '',
      preferredGame: '$1/$3 Cash',
      progression: {
        totalXp: 0,
        level: 1,
        xpIntoLevel: 0,
        xpToNextLevel: 500
      },
      ratings: {
        pokerIQ: null,
        decisionQuality: null,
        elo: null,
        rank: 'Unranked'
      }
    },
    statistics: { isEmpty: true }
  });
  assert.equal(model.ratings.pokerIQ, 'Не рассчитан');
  assert.equal(model.ratings.decisionQuality, 'Не рассчитана');
  assert.equal(model.ratings.rating, 'Без рейтинга');
  assert.equal(model.ratings.rank, 'Без ранга');
  assert.equal(model.progressLabel, '0 / 500 XP');
});

test('Home содержит компактный профильный entry point', () => {
  const html = read(htmlPath);
  assert.match(html, /id="homeProfileEntry"/);
  assert.match(html, /id="homeProfileAvatar"/);
  assert.match(html, /id="homeProfileName"/);
  assert.match(html, /id="homeProfileLevel"/);
  assert.match(html, /data-route="profile"/);
});

test('Profile screen содержит header, реальные stats, ratings и achievements placeholders', () => {
  const html = read(htmlPath);
  assert.match(html, /id="screen-profile"[\s\S]*id="profileHeader"/);
  assert.match(html, /id="profileXpProgress"[^>]*role="progressbar"/);
  assert.match(html, /id="profileRatings"/);
  assert.match(html, /id="profileActivity"/);
  assert.match(html, /id="profileAchievements"/);
  for (const title of [
    'Первая раздача',
    '10 правильных решений',
    'Серия 3 дня',
    '100 сыгранных раздач'
  ]) assert.match(html, new RegExp(title));
});

test('редактирование профиля использует доступный dialog и ограничения полей', () => {
  const html = read(htmlPath);
  assert.match(html, /<dialog id="profileEditDialog"[^>]*aria-labelledby="profileEditTitle"/);
  assert.match(html, /id="profileDisplayName"[^>]*maxlength="24"/);
  assert.match(html, /id="profileBio"[^>]*maxlength="120"/);
  assert.match(html, /id="profilePreferredGame"/);
  assert.match(html, /id="profileAvatarOptions"/);
  assert.match(html, /id="profileSave"/);
  assert.match(html, /id="profileCancel"/);
});

test('пользовательский текст рендерится только через textContent', () => {
  const source = read(profileUiPath);
  assert.match(source, /\.textContent\s*=/);
  assert.doesNotMatch(source, /innerHTML\s*=[^;]*(?:displayName|bio|preferredGame)/);
});

test('Profile UI обновляет локальные узлы, а не перерисовывает приложение', () => {
  const source = read(profileUiPath);
  assert.match(source, /renderHomeEntry/);
  assert.match(source, /renderProfile/);
  assert.doesNotMatch(source, /document\.body\.innerHTML|app-shell[^;]*innerHTML|replaceChildren\(\)/);
});

test('Profile CSS обеспечивает mobile 390px, safe area, focus и touch targets', () => {
  const css = read(profileCssPath);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('Profile dialog поддерживает Escape, focus trap и возврат фокуса', () => {
  const source = read(profileUiPath);
  assert.match(source, /Escape/);
  assert.match(source, /Tab/);
  assert.match(source, /\.focus\(\)/);
  assert.match(source, /showModal/);
});

test('UI сообщает об ошибке storage и сохраняет работоспособность', () => {
  const source = read(profileUiPath);
  assert.match(source, /getStatus\(\)/);
  assert.match(source, /showToast/);
  assert.match(source, /Не удалось сохранить профиль/);
});

