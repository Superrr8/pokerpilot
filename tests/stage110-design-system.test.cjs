'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const TOKENS_PATH = path.join(ROOT, 'src', 'styles', 'design-tokens.css');
const REFRESH_PATH = path.join(ROOT, 'src', 'styles', 'stage11-refresh.css');

const html = fs.readFileSync(HTML_PATH, 'utf8');
const tokens = fs.readFileSync(TOKENS_PATH, 'utf8');
const refresh = fs.existsSync(REFRESH_PATH) ? fs.readFileSync(REFRESH_PATH, 'utf8') : '';

test('Stage 11 stylesheet is loaded last as a presentation-only compatibility layer', () => {
  const link = '<link rel="stylesheet" href="src/styles/stage11-refresh.css">';
  assert.ok(html.includes(link));
  assert.ok(html.indexOf(link) > html.indexOf('src/styles/progress-feedback.css'));
  assert.doesNotMatch(refresh, /localStorage|PokerCore|ProgressSystem|analyzerPreflop|analyzerPostflop/);
});

test('central tokens expose semantic typography, control, layout and elevation scales', () => {
  for (const token of [
    '--surface-canvas', '--surface-section', '--separator',
    '--font-size-screen', '--font-size-section', '--font-size-card', '--font-size-stat',
    '--control-height', '--control-height-compact', '--content-max', '--content-narrow',
    '--elevation-card', '--elevation-overlay'
  ]) assert.ok(tokens.includes(token), `Missing Stage 11 token ${token}`);
});

test('global typography and numeric content use one readable hierarchy', () => {
  assert.match(refresh, /\.screen\s+h1[\s\S]*--font-size-screen/);
  assert.match(refresh, /\.panel\s+h2[\s\S]*--font-size-section/);
  assert.match(refresh, /font-variant-numeric:\s*tabular-nums/);
});

test('panels are visually lighter and nested panels are flattened', () => {
  assert.match(refresh, /\.panel\s*\{[\s\S]*box-shadow:\s*var\(--elevation-card\)/);
  assert.match(refresh, /\.panel\s+\.panel[\s\S]*box-shadow:\s*none/);
  assert.match(refresh, /\.panel\s+\.panel[\s\S]*border-color:\s*var\(--border-subtle\)/);
});

test('buttons and form controls share consistent touch-safe primitives', () => {
  assert.match(refresh, /\.ui-button-primary,[\s\S]*\.primary[\s\S]*min-height:\s*var\(--control-height\)/);
  assert.match(refresh, /\.field\s+input,[\s\S]*\.card-select[\s\S]*min-height:\s*var\(--control-height\)/);
  assert.match(refresh, /:focus-visible[\s\S]*--shadow-focus/);
});

test('bottom navigation has a stable native-like active state and safe area', () => {
  assert.match(refresh, /\.bottom-nav\s*\{[\s\S]*env\(safe-area-inset-bottom\)/);
  assert.match(refresh, /\.bottom-nav button\.active[\s\S]*::before/);
  assert.match(refresh, /\.bottom-nav button[\s\S]*min-height:\s*var\(--control-height\)/);
});

test('Dashboard hierarchy is compact and avoids another oversized hero surface', () => {
  assert.match(refresh, /\.home-dashboard[\s\S]*--content-narrow/);
  assert.match(refresh, /\.home-primary-card\s*\{[\s\S]*box-shadow:\s*var\(--elevation-card\)/);
  assert.match(refresh, /@media\s*\(max-width:\s*430px\)[\s\S]*\.home-primary-card\s*\{[\s\S]*padding:/);
});

test('Daily Challenge becomes a compact mobile row without losing both actions', () => {
  assert.match(refresh, /@media\s*\(max-width:\s*430px\)[\s\S]*\.daily-challenge-card\s*\{[\s\S]*padding:\s*var\(--space-3\)/);
  assert.match(refresh, /@media\s*\(max-width:\s*430px\)[\s\S]*\.daily-challenge-progress\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(html, /id="dailyChallengeCta"/);
  assert.match(html, /id="dailyChallengeHistoryCta"/);
});

test('Trainer, Ranges, Hand Lab and Progress receive shared screen-level spacing', () => {
  for (const selector of ['#screen-study', '#screen-ranges', '#screen-analyzer', '#screen-profile']) {
    assert.ok(refresh.includes(selector), `Missing refresh coverage for ${selector}`);
  }
});

test('Live shell keeps Hero bottom-center and standardizes table presentation', () => {
  assert.match(html, /const angle=\(90\+360\*i\/session\.n\)\*Math\.PI\/180/);
  assert.match(refresh, /#screen-live \.poker-table[\s\S]*--felt-base/);
  assert.match(refresh, /#screen-live \.seat\.hero[\s\S]*bottom/);
});

test('390px contract clips horizontal overflow and preserves bottom clearance', () => {
  assert.match(refresh, /@media\s*\(max-width:\s*430px\)/);
  assert.match(refresh, /overflow-x:\s*clip/);
  assert.match(refresh, /padding-bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)/);
});

test('Stage 11 motion remains restrained and respects reduced motion', () => {
  assert.match(refresh, /transform:\s*translateY\(-1px\)/);
  assert.match(refresh, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(refresh, /transition-duration:\s*0\.01ms\s*!important/);
});
