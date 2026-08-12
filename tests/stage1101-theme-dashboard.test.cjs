'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch (_) {
    return '';
  }
};

const index = read('index.html');
const themesCss = read('src/styles/themes.css');
const redesignCss = read('src/styles/stage1101-redesign.css');
const themeManagerSource = read('src/ui/theme-manager.js');
const dailyUi = read('src/ui/daily-challenge.js');

function loadThemeManager() {
  const modulePath = path.join(root, 'src/ui/theme-manager.js');
  assert.equal(fs.existsSync(modulePath), true, 'theme-manager.js must exist');
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function rootElement() {
  const attributes = new Map();
  return {
    dataset: {},
    style: { colorScheme: '' },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; }
  };
}

test('theme registry contains Auto and all eight published themes', () => {
  const api = loadThemeManager();
  assert.deepEqual(api.THEME_IDS, [
    'emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'
  ]);
  assert.equal(api.THEME_OPTIONS.some(theme => theme.id === 'auto'), true);
  assert.equal(api.THEME_OPTIONS.length, 9);
});

test('each theme defines the complete shared semantic token contract', () => {
  const ids = ['emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'];
  const tokens = [
    '--app-bg', '--surface-primary', '--surface-secondary', '--surface-elevated',
    '--text-primary', '--text-secondary', '--text-muted', '--accent', '--accent-hover',
    '--accent-soft', '--accent-contrast', '--border-subtle', '--border-strong',
    '--success', '--warning', '--danger', '--shadow-sm', '--shadow-md', '--shadow-lg',
    '--glow-accent', '--felt-primary', '--felt-secondary', '--card-face', '--chip-accent'
  ];
  ids.forEach(id => {
    const selector = new RegExp(`\\[data-theme=(?:"|')?${id}(?:"|')?\\]\\s*\\{([\\s\\S]*?)\\}`);
    const block = themesCss.match(selector)?.[1] || '';
    tokens.forEach(token => assert.match(block, new RegExp(`${token}\\s*:`), `${id} missing ${token}`));
  });
});

test('theme selection persists and reloads through one dedicated preference key', () => {
  const api = loadThemeManager();
  const storage = memoryStorage();
  const firstRoot = rootElement();
  const manager = api.createThemeManager({ storage, rootElement: firstRoot, matchMedia: () => ({ matches: false }) });
  manager.setTheme('amber');
  assert.equal(storage.getItem(api.THEME_STORAGE_KEY), 'amber');
  assert.equal(firstRoot.dataset.theme, 'amber');
  const secondRoot = rootElement();
  const reloaded = api.createThemeManager({ storage, rootElement: secondRoot, matchMedia: () => ({ matches: false }) });
  assert.equal(reloaded.getPreference(), 'amber');
  assert.equal(secondRoot.dataset.theme, 'amber');
});

test('Auto resolves dark to Emerald and light to Minimal', () => {
  const api = loadThemeManager();
  const dark = api.createThemeManager({ storage: memoryStorage({ [api.THEME_STORAGE_KEY]: 'auto' }), rootElement: rootElement(), matchMedia: () => ({ matches: false }) });
  const light = api.createThemeManager({ storage: memoryStorage({ [api.THEME_STORAGE_KEY]: 'auto' }), rootElement: rootElement(), matchMedia: () => ({ matches: true }) });
  assert.equal(dark.getResolvedTheme(), 'emerald');
  assert.equal(light.getResolvedTheme(), 'minimal');
});

test('invalid or unavailable storage safely falls back to Emerald', () => {
  const api = loadThemeManager();
  const failingStorage = {
    getItem() { throw new Error('unavailable'); },
    setItem() { throw new Error('quota'); }
  };
  const element = rootElement();
  const manager = api.createThemeManager({ storage: failingStorage, rootElement: element, matchMedia: () => ({ matches: false }) });
  assert.equal(manager.getPreference(), 'emerald');
  assert.doesNotThrow(() => manager.setTheme('unknown-theme'));
  assert.equal(manager.getResolvedTheme(), 'emerald');
});

test('theme manager loads before styles to prevent a wrong-theme flash', () => {
  const managerPosition = index.indexOf('src/ui/theme-manager.js');
  const tokenPosition = index.indexOf('src/styles/design-tokens.css');
  assert.ok(managerPosition > 0 && managerPosition < tokenPosition);
  assert.match(themeManagerSource, /documentElement/);
  assert.match(themeManagerSource, /data-theme|dataset\.theme/);
});

test('Profile includes an accessible visual picker for Auto and all eight themes', () => {
  assert.match(index, /id="profileAppearance"/);
  assert.match(index, /aria-labelledby="profileAppearanceTitle"/);
  ['auto', 'emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'].forEach(id => {
    assert.match(index, new RegExp(`data-theme-choice="${id}"`));
  });
  assert.match(index, /aria-pressed="(?:true|false)"/);
});

test('Dashboard uses a compact structural composition instead of stacked giant cards', () => {
  assert.match(index, /class="[^"]*home-dashboard-pro[^"]*"/);
  assert.match(index, /class="home-dashboard-summary"/);
  assert.match(index, /class="dashboard-learning-row/);
  assert.match(index, /class="daily-hand-preview/);
  assert.match(index, /id="dailyChallengePreviewCards"/);
  assert.match(index, /id="dailyChallengeHandLabel"/);
});

test('Dashboard daily preview renders real current challenge cards and title', () => {
  assert.match(dailyUi, /#dailyChallengePreviewCards/);
  assert.match(dailyUi, /status\.challenge\.heroCards/);
  assert.match(dailyUi, /#dailyChallengeHandLabel/);
  assert.match(dailyUi, /status\.challenge\.title/);
});

test('mobile Dashboard bounds Daily Hand and preserves readable quick actions', () => {
  assert.match(redesignCss, /@media\s*\(max-width:\s*430px\)/);
  assert.match(redesignCss, /\.daily-challenge-card[\s\S]*?max-height:\s*230px/);
  assert.match(redesignCss, /\.home-quick-action[\s\S]*?white-space:\s*nowrap/);
  assert.match(redesignCss, /overflow-x:\s*clip/);
});

test('theme picker, navigation and primary controls remain touch-safe and accessible', () => {
  assert.match(themesCss + redesignCss, /min-height:\s*44px/);
  assert.match(themesCss + redesignCss, /:focus-visible/);
  assert.match(redesignCss, /env\(safe-area-inset-bottom\)/);
});

test('themes provide distinct light, glass, wood and cyber identities without duplicated layouts', () => {
  assert.match(themesCss, /color-scheme:\s*light/);
  assert.match(themesCss, /backdrop-filter:\s*blur/);
  assert.match(themesCss, /data-theme="warm-wood"/);
  assert.match(themesCss, /data-theme="cyber"/);
  assert.doesNotMatch(themesCss, /\.home-dashboard\s*\{/);
});

test('Live summary and decision surfaces inherit theme tokens in light and dark modes', () => {
  assert.match(redesignCss, /#screen-live \.session-bar[\s\S]*?background:\s*var\(--surface-primary\)/);
  assert.match(redesignCss, /#screen-live \.session-bar \.stat[\s\S]*?background:\s*var\(--surface-secondary\)/);
  assert.match(redesignCss, /#screen-live \.decision-panel/);
});

test('theme transitions remain subtle and reduced motion is supported', () => {
  assert.match(themesCss + redesignCss, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(themesCss + redesignCss, /animation[^;]*(bounce|spin|pulse)/i);
});

test('presentation files do not reference protected poker engines or formulas', () => {
  const presentation = [themesCss, redesignCss, themeManagerSource].join('\n');
  assert.doesNotMatch(presentation, /PokerCore|callEV|Monte Carlo|evaluateHand|analyzerPreflop|analyzerPostflop/);
});
