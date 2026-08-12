'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch (_) {
    return '';
  }
};

const html = read('index.html');
const tokensCss = read('src/styles/design-tokens.css');
const themesCss = read('src/styles/themes.css');
const systemCss = read('src/styles/theme-system.css');
const managerPath = path.join(root, 'src/ui/theme-manager.js');

const PRIMARY_THEMES = ['emerald', 'amber', 'indigo', 'minimal'];

function themeBlock(id) {
  return themesCss.match(new RegExp(`html\\[data-theme="${id}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
}

function token(block, name) {
  return block.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() || '';
}

function loadThemeManager() {
  delete require.cache[require.resolve(managerPath)];
  return require(managerPath);
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
  return {
    dataset: {},
    style: { colorScheme: '' },
    setAttribute() {}
  };
}

test('Stage 12 semantic theme stylesheet is loaded after accepted Stage 11 presentation layers', () => {
  const link = '<link rel="stylesheet" href="src/styles/theme-system.css">';
  assert.ok(html.includes(link), 'theme-system.css must be linked');
  assert.ok(html.indexOf(link) > html.indexOf('src/styles/trainer-explanation.css'));
});

test('central design tokens expose complete interactive and semantic roles', () => {
  [
    '--accent-active', '--accent-border', '--accent-foreground',
    '--interactive-hover', '--interactive-active', '--interactive-selected',
    '--interactive-disabled', '--focus-ring', '--surface-muted',
    '--text-disabled', '--status-success-soft', '--status-warning-soft',
    '--status-danger-soft', '--status-info-soft'
  ].forEach(name => assert.match(tokensCss, new RegExp(`${name}:`), `missing ${name}`));
});

test('four primary themes define the complete palette contract', () => {
  const required = [
    '--accent', '--accent-hover', '--accent-active', '--accent-soft', '--accent-border',
    '--accent-contrast', '--surface-primary', '--surface-secondary', '--surface-elevated',
    '--surface-muted', '--text-primary', '--text-secondary', '--text-muted', '--text-disabled',
    '--border-subtle', '--border-strong', '--success', '--success-soft',
    '--warning', '--warning-soft', '--danger', '--danger-soft', '--info', '--info-soft'
  ];
  PRIMARY_THEMES.forEach(id => {
    const block = themeBlock(id);
    required.forEach(name => assert.ok(token(block, name), `${id} missing ${name}`));
  });
});

test('brand accent and semantic success stay independent in every primary theme', () => {
  PRIMARY_THEMES.forEach(id => {
    const block = themeBlock(id);
    assert.notEqual(token(block, '--accent'), token(block, '--success'), `${id} accent must not mean success`);
    assert.notEqual(token(block, '--accent-soft'), token(block, '--success-soft'), `${id} soft accent must not mean success`);
  });
});

test('shared aliases map interaction and status roles without fixed palette values', () => {
  [
    '--interactive-hover', '--interactive-active', '--interactive-selected', '--interactive-disabled',
    '--status-success-soft', '--status-warning-soft', '--status-danger-soft', '--status-info-soft'
  ].forEach(name => assert.match(themesCss, new RegExp(`${name}:\\s*var\\(`), `missing shared alias ${name}`));
  assert.match(themesCss, /--focus-ring:\s*[^;]*var\(--accent-soft\)/);
});

test('shared component layer contains no per-theme branches or engine references', () => {
  assert.ok(systemCss.length > 0, 'theme-system.css must exist');
  assert.doesNotMatch(systemCss, /data-theme\s*=|html\[data-theme/);
  assert.doesNotMatch(systemCss, /PokerCore|ProgressSystem|callEV|Monte Carlo|analyzerPreflop|analyzerPostflop/);
});

test('primary and secondary button families consume semantic interaction tokens', () => {
  assert.match(systemCss, /\.ui-button-primary,[\s\S]*?background:\s*var\(--accent\)/);
  assert.match(systemCss, /\.ui-button-primary:hover,[\s\S]*?background:\s*var\(--accent-hover\)/);
  assert.match(systemCss, /\.ui-button-primary:active,[\s\S]*?background:\s*var\(--accent-active\)/);
  assert.match(systemCss, /\.ui-button-secondary,[\s\S]*?background:\s*var\(--surface-control\)/);
});

test('navigation, tabs, pills and selected cards use the theme accent roles', () => {
  assert.match(systemCss, /\.bottom-nav button\.active,[\s\S]*?background:\s*var\(--interactive-selected\)/);
  assert.match(systemCss, /\.tag,[\s\S]*?background:\s*var\(--accent-soft\)/);
  assert.match(systemCss, /\[aria-selected="true"\][\s\S]*?border-color:\s*var\(--accent-border\)/);
});

test('correct and incorrect Trainer states use semantic status colors instead of brand accent', () => {
  assert.match(systemCss, /\.actions button\.selected-correct[\s\S]*?var\(--status-success\)/);
  assert.match(systemCss, /\.feedback\.good[\s\S]*?var\(--status-success-soft\)/);
  assert.match(systemCss, /\.feedback\.bad[\s\S]*?var\(--status-danger-soft\)/);
});

test('focus and disabled states are centralized and theme-aware', () => {
  assert.match(systemCss, /:focus-visible[\s\S]*?box-shadow:\s*var\(--focus-ring\)/);
  assert.match(systemCss, /:disabled[\s\S]*?color:\s*var\(--text-disabled\)/);
});

test('Dashboard and Daily Challenge actions inherit the shared button vocabulary', () => {
  assert.match(systemCss, /\.dashboard-learning-row \.ui-button-primary,[\s\S]*?\.daily-challenge-primary/);
  assert.match(systemCss, /\.home-quick-action[\s\S]*?background:\s*var\(--surface-control\)/);
  assert.match(systemCss, /\.dashboard-learning-row \.eyebrow,[\s\S]*?color:\s*var\(--accent\)/);
  assert.match(systemCss, /\.home-quick-action strong[\s\S]*?color:\s*var\(--text-primary\)/);
});

test('Light Minimal explicitly keeps readable light surfaces and accent contrast', () => {
  const block = themeBlock('minimal');
  assert.match(block, /color-scheme:\s*light/);
  assert.match(token(block, '--accent-contrast'), /^#(?:fff|ffffff)$/i);
  assert.notEqual(token(block, '--surface-primary'), token(block, '--surface-secondary'));
  assert.notEqual(token(block, '--text-primary'), token(block, '--text-muted'));
});

test('theme selection and Auto persistence remain unchanged', () => {
  const api = loadThemeManager();
  const storage = memoryStorage();
  const first = api.createThemeManager({ storage, rootElement: rootElement(), matchMedia: () => ({ matches: false }) });
  first.setTheme('indigo');
  assert.equal(storage.getItem(api.THEME_STORAGE_KEY), 'indigo');
  const secondRoot = rootElement();
  const second = api.createThemeManager({ storage, rootElement: secondRoot, matchMedia: () => ({ matches: false }) });
  assert.equal(secondRoot.dataset.theme, 'indigo');
  assert.equal(second.getPreference(), 'indigo');

  second.setTheme('auto');
  assert.equal(storage.getItem(api.THEME_STORAGE_KEY), 'auto');
  assert.equal(second.getResolvedTheme(), 'emerald');
});
