'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const themesCss = read('src/styles/themes.css');
const tokensCss = read('src/styles/design-tokens.css');
const indexHtml = read('index.html');
const managerPath = path.join(ROOT, 'src/ui/theme-manager.js');

function themeBlock(id) {
  return themesCss.match(new RegExp(`html\\[data-theme="${id}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
}

function token(block, name) {
  return block.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() || '';
}

function hexRgb(value) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
}

function luminance(color) {
  const channels = color.map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function colorDistance(first, second) {
  return Math.sqrt(first.reduce((sum, channel, index) => sum + ((channel - second[index]) ** 2), 0));
}

function loadThemeManager() {
  delete require.cache[require.resolve(managerPath)];
  return require(managerPath);
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function rootElement() {
  return { dataset: {}, style: {}, setAttribute() {} };
}

test('existing theme registry remains stable and exposes Glass through the shared selector', () => {
  const api = loadThemeManager();
  assert.deepEqual(api.THEME_IDS, [
    'emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'
  ]);
  assert.equal(api.THEME_OPTIONS.find(option => option.id === 'glass')?.name, 'Glass');
  assert.match(indexHtml, /data-theme-choice="glass"/);
});

test('Glass preference persists through the existing key and invalid values still fall back safely', () => {
  const api = loadThemeManager();
  const storage = memoryStorage();
  const manager = api.createThemeManager({ storage, rootElement: rootElement() });
  manager.setTheme('glass');
  assert.equal(storage.getItem(api.THEME_STORAGE_KEY), 'glass');
  assert.equal(api.normalizePreference('unknown-theme'), 'emerald');
});

test('Amber is a clean warm-light environment rather than another dark wood palette', () => {
  const api = loadThemeManager();
  const amber = themeBlock('amber');
  const root = rootElement();
  const manager = api.createThemeManager({ storage: memoryStorage(), rootElement: root });
  manager.setTheme('amber');

  assert.match(amber, /color-scheme:\s*light/);
  assert.equal(root.style.colorScheme, 'light');
  assert.ok(luminance(hexRgb(token(amber, '--app-bg'))) >= 0.72, 'Amber canvas must be visibly light');
  assert.ok(luminance(hexRgb(token(amber, '--surface-primary'))) >= 0.82, 'Amber cards must be crisp and light');
});

test('Warm Wood stays deep and has a clearly separate overall palette from Amber', () => {
  const amber = themeBlock('amber');
  const wood = themeBlock('warm-wood');
  const amberBackground = hexRgb(token(amber, '--app-bg'));
  const woodBackground = hexRgb(token(wood, '--app-bg'));
  const amberSurface = hexRgb(token(amber, '--surface-primary'));
  const woodSurface = hexRgb(token(wood, '--surface-primary'));

  assert.match(wood, /color-scheme:\s*dark/);
  assert.ok(luminance(woodBackground) <= 0.03, 'Warm Wood canvas must remain lounge-dark');
  assert.ok(colorDistance(amberBackground, woodBackground) >= 180, 'theme canvases must be immediately distinct');
  assert.ok(colorDistance(amberSurface, woodSurface) >= 180, 'primary cards must be immediately distinct');
  assert.notEqual(token(amber, '--nav-surface'), token(wood, '--nav-surface'));
});

test('Glass defines a complete premium material hierarchy with a readable opaque fallback', () => {
  const glass = themeBlock('glass');
  [
    '--nav-surface', '--interactive-surface', '--surface-overlay', '--material-border',
    '--material-highlight', '--material-blur', '--material-saturation', '--surface-translucent'
  ].forEach(name => assert.ok(token(glass, name), `Glass missing ${name}`));
  assert.match(token(glass, '--material-blur'), /^1[2-8]px$/);
  assert.match(themesCss, /@supports\s+not\s+\(\(backdrop-filter:\s*blur\(1px\)\)\)/);
});

test('Glass applies progressive material treatment without changing component geometry', () => {
  assert.match(themesCss, /html\[data-theme="glass"\][\s\S]*?backdrop-filter:\s*blur\(var\(--material-blur\)\)/);
  assert.match(themesCss, /-webkit-backdrop-filter:\s*blur\(var\(--material-blur\)\)/);
  assert.doesNotMatch(themesCss, /html\[data-theme="glass"\][^{]*\{[^}]*(?:width|height|padding|margin):/);
});

test('material defaults do not create circular surface aliases for existing themes', () => {
  assert.match(tokensCss, /--interactive-surface:\s*var\(--surface-secondary\)/);
  assert.doesNotMatch(tokensCss, /--interactive-surface:\s*var\(--surface-interactive\)/);
});

test('accent and semantic success/error remain separate in Amber, Warm Wood and Glass', () => {
  ['amber', 'warm-wood', 'glass'].forEach(id => {
    const block = themeBlock(id);
    assert.notEqual(token(block, '--accent'), token(block, '--success'), `${id} success must not use accent`);
    assert.notEqual(token(block, '--accent'), token(block, '--danger'), `${id} danger must not use accent`);
    assert.notEqual(token(block, '--success'), token(block, '--danger'), `${id} success and danger must differ`);
  });
});

test('Stage 12.2 theme presentation stays isolated from poker and progress engines', () => {
  assert.doesNotMatch(
    themesCss,
    /PokerCore|ProgressSystem|evaluateHand|equity|callEV|Monte Carlo|analyzerPreflop|analyzerPostflop/
  );
});
