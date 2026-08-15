'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = relativePath => {
  try {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  } catch (_) {
    return '';
  }
};

const html = read('index.html');
const tokens = read('src/styles/design-tokens.css');
const layout = read('src/styles/layout-foundation.css');

test('viewport-fit cover и финальный layout layer подключены после theme system', () => {
  const themeLink = '<link rel="stylesheet" href="src/styles/theme-system.css">';
  const layoutLink = '<link rel="stylesheet" href="src/styles/layout-foundation.css">';
  assert.match(html, /<meta\s+name="viewport"[^>]*viewport-fit=cover/);
  assert.ok(html.includes(layoutLink), 'layout-foundation.css must be linked');
  assert.ok(html.indexOf(layoutLink) > html.indexOf(themeLink));
});

test('central tokens expose safe-area edges and fixed navigation geometry', () => {
  for (const edge of ['top', 'right', 'bottom', 'left']) {
    assert.match(
      tokens,
      new RegExp(`--safe-area-${edge}:\\s*env\\(safe-area-inset-${edge},\\s*0px\\)`),
      `missing safe-area ${edge} token`
    );
  }
  for (const name of [
    '--bottom-navigation-height',
    '--bottom-navigation-offset',
    '--app-content-top-inset',
    '--app-content-bottom-inset'
  ]) assert.match(tokens, new RegExp(`${name}:`), `missing ${name}`);
});

test('content bottom inset derives from navigation, safe area and spacing', () => {
  const value = tokens.match(/--app-content-bottom-inset:\s*([^;]+);/)?.[1] || '';
  assert.match(value, /var\(--bottom-navigation-height\)/);
  assert.match(value, /var\(--bottom-navigation-offset\)/);
  assert.match(value, /var\(--safe-area-bottom\)/);
  assert.match(value, /var\(--app-content-bottom-gap\)/);
});

test('app shell is the single owner of outer top and bottom safe-area insets', () => {
  assert.match(layout, /\.app-shell\s*\{[\s\S]*?padding-block-start:\s*var\(--app-content-top-inset\)/);
  assert.match(layout, /\.app-shell\s*\{[\s\S]*?padding-block-end:\s*var\(--app-content-bottom-inset\)/);
  assert.doesNotMatch(layout, /#screen-[\w-]+[\s\S]*?safe-area-inset/);
});

test('viewport height has vh fallback followed by dynamic viewport units', () => {
  assert.match(layout, /body[\s\S]*?min-height:\s*100vh[\s\S]*?min-height:\s*100dvh/);
  assert.match(layout, /\.app-shell\s*\{[\s\S]*?min-height:\s*100vh[\s\S]*?min-height:\s*100dvh/);
});

test('fixed bottom navigation consumes the same centralized geometry', () => {
  assert.match(layout, /\.bottom-nav\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(layout, /\.bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-area-bottom\)\s*\+\s*var\(--bottom-navigation-offset\)\)/);
  assert.match(layout, /\.bottom-nav\s*\{[\s\S]*?min-height:\s*var\(--bottom-navigation-height\)/);
});

test('scroll targets reserve the top safe area and fixed navigation inset', () => {
  assert.match(layout, /html\s*\{[\s\S]*?scroll-padding-top:\s*var\(--app-content-top-inset\)/);
  assert.match(layout, /html\s*\{[\s\S]*?scroll-padding-bottom:\s*var\(--app-content-bottom-inset\)/);
});

test('route changes normalize scroll position without exposing a new screen mid-scroll', () => {
  const routeBody = html.match(/function route\(name, options = \{\}\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(routeBody, /window\.scrollTo\(\{\s*top:\s*0,\s*behavior:\s*'auto'\s*\}\)/);
  assert.doesNotMatch(routeBody, /behavior:\s*'smooth'/);
});

test('layout foundation remains presentation-only and route-agnostic', () => {
  assert.ok(layout.length > 0, 'layout foundation must exist');
  assert.doesNotMatch(layout, /PokerCore|ProgressSystem|analyzerPreflop|analyzerPostflop|callEV|equity|Monte Carlo/);
  assert.doesNotMatch(layout, /#screen-(?:home|study|ranges|training|live|analyzer|profile|daily)/);
});
