'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const themes = read('src/styles/themes.css');
const live = read('src/styles/live-session.css');
const html = read('index.html');
const managerPath = path.join(root, 'src/ui/theme-manager.js');

function block(id) {
  return themes.match(new RegExp(`html\\[data-theme="${id}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
}

function token(source, name) {
  return source.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() || '';
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

test('Obsidian is a first-class persisted theme without replacing existing choices', () => {
  delete require.cache[require.resolve(managerPath)];
  const api = require(managerPath);
  const expectedExisting = ['emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'];
  expectedExisting.forEach(id => assert.ok(api.THEME_IDS.includes(id), `${id} must remain available`));
  assert.ok(api.THEME_IDS.includes('obsidian'));
  assert.equal(api.THEME_OPTIONS.find(item => item.id === 'obsidian')?.name, 'Obsidian');
  const memory = storage();
  const rootElement = { dataset: {}, style: {}, setAttribute() {} };
  const instance = api.createThemeManager({ storage: memory, rootElement });
  instance.setTheme('obsidian');
  assert.equal(memory.getItem(api.THEME_STORAGE_KEY), 'obsidian');
  assert.equal(rootElement.dataset.theme, 'obsidian');
  assert.equal(api.normalizePreference('unknown'), 'emerald');
});

test('Obsidian exposes a complete premium semantic palette with separate status colors', () => {
  const obsidian = block('obsidian');
  [
    '--app-bg', '--surface-primary', '--surface-secondary', '--surface-elevated',
    '--text-primary', '--text-secondary', '--text-muted', '--text-disabled',
    '--accent', '--accent-hover', '--accent-active', '--accent-soft', '--accent-border',
    '--border-subtle', '--border-strong', '--success', '--warning', '--danger',
    '--felt-primary', '--felt-secondary', '--card-face', '--chip-accent',
    '--nav-surface', '--interactive-surface', '--surface-overlay'
  ].forEach(name => assert.ok(token(obsidian, name), `missing ${name}`));
  assert.notEqual(token(obsidian, '--accent'), token(obsidian, '--success'));
  assert.notEqual(token(obsidian, '--accent'), token(obsidian, '--danger'));
  assert.notEqual(token(obsidian, '--success'), token(obsidian, '--danger'));
});

test('theme picker exposes an Obsidian preview while keeping Emerald as default', () => {
  assert.match(html, /data-theme-choice="obsidian"[\s\S]*?<strong>Obsidian<\/strong>/);
  assert.match(themes, /\[data-theme-choice="obsidian"\] \.theme-preview/);
  assert.match(html, /data-theme-choice="emerald" aria-pressed="true"/);
});

test('Obsidian skins Live materials and action semantics without geometry declarations', () => {
  const rules = themes.match(/\/\* Stage 12\.8[\s\S]*?(?=\n@media)/)?.[0] || '';
  assert.match(rules, /data-theme="obsidian"[\s\S]*live-v2-poker-table/);
  assert.match(rules, /data-live-action="fold"[\s\S]*var\(--status-danger\)/);
  assert.match(rules, /data-live-action="raise"[\s\S]*var\(--accent\)/);
  assert.match(rules, /live-v2-sheet/);
  assert.doesNotMatch(rules, /(?:width|height|padding|margin|grid-template|top|right|bottom|left|transform)\s*:/);
});

test('accepted portrait and landscape geometry sources remain present', () => {
  assert.match(live, /--live-v2-hero-stage-height:\s*clamp\(94px,\s*11\.5dvh,\s*100px\)/);
  assert.match(live, /@media \(orientation:\s*landscape\) and \(min-width:\s*700px\) and \(max-height:\s*500px\)/);
  assert.match(live, /--live-table-camera-width:\s*378px/);
  assert.match(live, /--live-table-camera-width:\s*440px/);
});

test('Stage 12.8 presentation remains isolated from protected engines', () => {
  assert.doesNotMatch(themes, /PokerCore|evaluateHand|callEV|Monte Carlo|seatMappings|ProgressSystem/);
});
