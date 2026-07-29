'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles', 'app-shell.css'), 'utf8');
const translationsPath = path.join(root, 'src', 'ui', 'translations.js');
const navigationPath = path.join(root, 'src', 'ui', 'navigation.js');

function readOptional(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function loadNavigation() {
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox, {
    name: 'PokerPilot information architecture sandbox',
    codeGeneration: { strings: false, wasm: false }
  });
  for (const [filePath, filename] of [
    [translationsPath, 'src/ui/translations.js'],
    [navigationPath, 'src/ui/navigation.js']
  ]) {
    const source = readOptional(filePath);
    assert.ok(source, `Нет ${filename}`);
    new vm.Script(source, { filename }).runInContext(sandbox, { timeout: 2_000 });
  }
  return {
    i18n: sandbox.window.PokerPilotI18n,
    navigation: sandbox.window.PokerPilotNavigation || sandbox.module.exports
  };
}

test('Stage 8.1 выделяет словарь и навигацию в classic-script модули', () => {
  assert.ok(fs.existsSync(translationsPath), 'Нет src/ui/translations.js');
  assert.ok(fs.existsSync(navigationPath), 'Нет src/ui/navigation.js');
  const translationsScript = '<script src="src/ui/translations.js"></script>';
  const navigationScript = '<script src="src/ui/navigation.js"></script>';
  assert.match(html, new RegExp(translationsScript.replaceAll('/', '\\/')));
  assert.match(html, new RegExp(navigationScript.replaceAll('/', '\\/')));
  assert.ok(html.indexOf(translationsScript) < html.indexOf(navigationScript));
  assert.ok(html.indexOf(navigationScript) < html.indexOf("const C = window.PokerCore;"));
});

test('централизованный русский словарь содержит обязательные названия и действия', () => {
  const { i18n } = loadNavigation();
  assert.ok(i18n);
  for (const [key, expected] of Object.entries({
    'nav.home': 'Главная',
    'nav.learning': 'Обучение',
    'nav.training': 'Тренировка',
    'nav.analysis': 'Разбор',
    'nav.profile': 'Профиль',
    'action.continue': 'Продолжить',
    'action.startTraining': 'Начать тренировку',
    'action.analyzeHand': 'Разобрать раздачу',
    'profile.insufficientData': 'Недостаточно решений для оценки'
  })) assert.equal(i18n.t(key), expected, `Неверный перевод ${key}`);
});

test('нижняя навигация содержит ровно пять постоянных разделов', () => {
  const { navigation } = loadNavigation();
  assert.deepEqual(
    Array.from(navigation.sections, section => section.id),
    ['home', 'learning', 'training', 'analysis', 'profile']
  );
  assert.deepEqual(
    Array.from(navigation.sections, section => section.label),
    ['Главная', 'Обучение', 'Тренировка', 'Разбор', 'Профиль']
  );
});

test('вложенные инструменты подсвечивают правильный основной раздел', () => {
  const { navigation } = loadNavigation();
  const expected = {
    home: 'home',
    learning: 'learning',
    ranges: 'learning',
    training: 'training',
    study: 'training',
    live: 'training',
    analyzer: 'analysis',
    coach: 'profile',
    profile: 'profile'
  };
  for (const [route, section] of Object.entries(expected)) {
    assert.equal(navigation.sectionForRoute(route), section, route);
  }
});

test('HTML содержит каркас пяти разделов и постоянную нижнюю навигацию', () => {
  for (const screen of ['home', 'learning', 'training', 'analyzer', 'profile']) {
    assert.match(html, new RegExp(`id="screen-${screen}"`), `Нет screen-${screen}`);
  }
  assert.match(html, /id="primaryNavigation"/);
  assert.match(html, /aria-label="Основная навигация"/);
  assert.match(html, /PokerPilotNavigation\.render/);
});

test('существующие инструменты доступны через новые разделы без копирования логики', () => {
  assert.match(html, /id="learningTools"[\s\S]*data-route="ranges"/);
  assert.match(html, /id="trainingTools"[\s\S]*data-route="study"/);
  assert.match(html, /id="trainingTools"[\s\S]*data-route="live"/);
  assert.match(html, /id="screen-analyzer"[\s\S]*id="analyzeHand"/);
  assert.match(html, /id="screen-profile"[\s\S]*id="coachSummary"/);
  assert.equal((html.match(/id="analyzeHand"/g) || []).length, 1);
  assert.equal((html.match(/id="studyActions"/g) || []).length, 1);
});

test('при запуске открывается Главная, а legacy Coach безопасно ведёт в Профиль', () => {
  assert.match(html, /route\('home'\);/);
  assert.match(html, /resolveRoute\(name\)/);
  assert.equal(loadNavigation().navigation.resolveRoute('coach'), 'profile');
});

test('обычное переключение разделов сохраняет состояние Learning и Trainer', () => {
  assert.match(html, /else if \(learningMode\) learningMode\.render\(\)/);
  assert.match(html, /if \(name === 'study' && !currentStudy\) renderStudy\(\)/);
  assert.doesNotMatch(html, /if \(name === 'study'\) renderStudy\(\)/);
});

test('профиль показывает только реальные локальные данные и честный empty state', () => {
  assert.match(html, /Недостаточно решений для оценки/);
  assert.doesNotMatch(html, />\s*(?:Poker IQ|XP|Рейтинг пользователя)\s*</i);
  assert.match(html, /progress\.decisions/);
  assert.match(html, /progress\.history/);
});

test('мобильная навигация учитывает safe area, touch target и запас контента', () => {
  assert.match(css, /\.bottom-nav[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.bottom-nav[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.bottom-nav button[\s\S]*min-height:\s*48px/);
  assert.match(css, /\.app-shell[\s\S]*calc\([^;]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width:\s*390px\)[\s\S]*overflow-x:\s*(?:clip|hidden)/);
});
