'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const themesCss = read('src/styles/themes.css');
const redesignCss = read('src/styles/stage1101-redesign.css');
const dashboardSource = read('src/ui/dashboard.js');

const THEME_IDS = ['emerald', 'amber', 'indigo', 'minimal', 'cyber', 'glass', 'warm-wood', 'soft-pastel'];

function themeBlock(id) {
  return themesCss.match(new RegExp(`html\\[data-theme="${id}"\\] \\{([\\s\\S]*?)\\n\\}`))?.[1] || '';
}

function token(block, name) {
  return block.match(new RegExp(`${name}:\\s*([^;]+)`))?.[1]?.trim() || '';
}

function rgb(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  return rgba ? [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] == null ? 1 : Number(rgba[4])] : null;
}

function composite(foreground, background) {
  const alpha = foreground[3] == null ? 1 : foreground[3];
  return foreground.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

function luminance(color) {
  const channels = color.slice(0, 3).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const high = Math.max(luminance(first), luminance(second));
  const low = Math.min(luminance(first), luminance(second));
  return (high + 0.05) / (low + 0.05);
}

test('muted text remains readable on primary and secondary surfaces in every theme', () => {
  THEME_IDS.forEach(id => {
    const block = themeBlock(id);
    const backdrop = rgb(token(block, '--app-bg'));
    const muted = rgb(token(block, '--text-muted'));
    const primaryRaw = rgb(token(block, '--surface-primary'));
    const secondaryRaw = rgb(token(block, '--surface-secondary'));
    const primary = composite(primaryRaw, backdrop);
    const secondary = composite(secondaryRaw, backdrop);
    assert.ok(contrast(muted, primary) >= 4.5, `${id} muted/primary contrast is too low`);
    assert.ok(contrast(muted, secondary) >= 4.5, `${id} muted/secondary contrast is too low`);
  });
});

test('shared theme aliases expose the complete presentation role vocabulary', () => {
  ['--background', '--surface', '--accent-strong', '--border', '--shadow-glow']
    .forEach(name => assert.match(themesCss, new RegExp(`${name}:\\s*var\\(`), `missing ${name}`));
  THEME_IDS.forEach(id => {
    const block = themeBlock(id);
    ['--surface-elevated', '--text-primary', '--text-secondary', '--text-muted', '--accent']
      .forEach(name => assert.ok(token(block, name), `${id} missing ${name}`));
  });
});

test('bottom navigation uses theme surfaces and readable semantic text', () => {
  assert.match(redesignCss, /\.bottom-nav\s*\{[\s\S]*?background:\s*var\(--surface-translucent\)/);
  assert.match(redesignCss, /\.bottom-nav button\s*\{[\s\S]*?color:\s*var\(--text-secondary\)/);
  assert.doesNotMatch(redesignCss, /\.bottom-nav\s*\{[^}]*rgba\(10,\s*17,\s*21/i);
});

test('mobile quick actions use short symmetric labels without shrinking typography', () => {
  assert.match(dashboardSource, /label:\s*'Тренировка'/);
  assert.doesNotMatch(dashboardSource, /label:\s*'Быстрая тренировка'/);
  assert.match(redesignCss, /\.home-quick-action strong[\s\S]*?font-size:\s*clamp\(0\.65rem/);
  assert.match(redesignCss, /\.home-quick-action[\s\S]*?min-height:\s*50px/);
});

test('Amber keeps a restrained premium glow and a gold accent', () => {
  const block = themeBlock('amber');
  const glowAlpha = Number(token(block, '--glow-accent').match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1]);
  assert.ok(glowAlpha <= 0.13, 'Amber glow should remain restrained');
  assert.match(token(block, '--accent'), /^#[c-e][0-9a-f]{5}$/i);
});

test('Minimal keeps three distinct light surface levels without a hard dark navigation override', () => {
  const block = themeBlock('minimal');
  const levels = new Set(['--app-bg', '--surface-primary', '--surface-secondary', '--surface-elevated'].map(name => token(block, name)));
  assert.equal(levels.size, 4);
  assert.match(token(block, '--surface-translucent'), /^rgba\(255,\s*255,\s*255/);
});

test('Daily Challenge mobile height and Dashboard information architecture stay fixed', () => {
  assert.match(redesignCss, /\.daily-challenge-card\s*\{[\s\S]*?max-height:\s*230px/);
  assert.match(redesignCss, /\.home-dashboard-pro\s*\{[\s\S]*?gap:\s*9px/);
  assert.doesNotMatch(redesignCss, /\.daily-challenge-card\s*\{[^}]*min-height:\s*(?:2[4-9]\d|[3-9]\d\d)px/);
});

test('micro-polish presentation remains isolated from poker and progress engines', () => {
  const presentation = `${themesCss}\n${redesignCss}`;
  assert.doesNotMatch(presentation, /PokerCore|ProgressSystem|callEV|Monte Carlo|analyzerPreflop|analyzerPostflop/);
});
