'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function declarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] || '';
}

test('Continue idle, hover and pressed states use the active theme accent tokens', () => {
  const css = read('src/styles/home.css');
  const idle = declarations(css, '.home-primary-card .ui-button-primary');
  const hover = declarations(css, '.home-primary-card .ui-button-primary:hover');
  const active = declarations(css, '.home-primary-card .ui-button-primary:active');
  const focus = declarations(css, '.home-primary-card .ui-button-primary:focus-visible');

  assert.match(idle, /border-color:\s*var\(--accent-border\)/);
  assert.match(idle, /background:\s*var\(--accent\)/);
  assert.match(idle, /color:\s*var\(--accent-foreground\)/);
  assert.match(idle, /box-shadow:\s*var\(--glow-accent\)/);
  assert.match(hover, /background:\s*var\(--accent-hover\)/);
  assert.match(hover, /box-shadow:\s*var\(--glow-accent\)/);
  assert.match(active, /background:\s*var\(--accent-active\)/);
  assert.match(active, /box-shadow:\s*var\(--glow-accent\)/);
  assert.match(focus, /box-shadow:\s*var\(--focus-ring\)/);
});

test('Continue interaction rules contain no legacy Emerald color literals', () => {
  const css = read('src/styles/home.css');
  const interaction = [
    declarations(css, '.home-primary-card .ui-button-primary'),
    declarations(css, '.home-primary-card .ui-button-primary:hover'),
    declarations(css, '.home-primary-card .ui-button-primary:active'),
    declarations(css, '.home-primary-card .ui-button-primary:focus-visible')
  ].join('\n');

  assert.doesNotMatch(interaction, /#(?:84ddb5|6dd1a4|91e4be|76d8ab)\b/i);
  assert.doesNotMatch(interaction, /rgba?\(\s*49\s*,\s*183\s*,\s*125\b/i);
});

test('shared primary interaction and focus states remain semantic and theme-driven', () => {
  const css = read('src/styles/theme-system.css');
  assert.match(declarations(css, '.ui-button-primary:hover,\n.primary:hover'), /background:\s*var\(--accent-hover\)/);
  assert.match(declarations(css, '.ui-button-primary:active,\n.primary:active'), /background:\s*var\(--accent-active\)/);
  assert.match(css, /button:focus-visible,[\s\S]*?box-shadow:\s*var\(--focus-ring\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
});

test('iOS tap highlight stays suppressed and Stage 13.1 pressed motion stays unchanged', () => {
  const shell = read('src/styles/app-shell.css');
  const motion = read('src/styles/motion.css');
  assert.match(declarations(shell, 'button'), /-webkit-tap-highlight-color:\s*transparent/);
  assert.match(motion, /#dashboardContinue:active:not\(:disabled\),[\s\S]*?transform:\s*translate3d\(0, 1px, 0\) scale\(0\.985\)/);
});
