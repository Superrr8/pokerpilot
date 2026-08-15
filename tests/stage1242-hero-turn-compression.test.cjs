'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const liveCss = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');
const layoutCss = fs.readFileSync(path.join(root, 'src/styles/layout-foundation.css'), 'utf8');

function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing rule: ${selector}`);
  return match[1];
}

test('Hero turn exposes one presentation-only active-play state on the app shell', () => {
  assert.match(html, /function renderLive\(\)\{[\s\S]*?syncLivePresentationState\(\)/);
  assert.match(html, /PokerPilotLivePresentationState\.sync/);
  assert.match(html, /\.app-shell'\)\.dataset\.activeRoute = name;[\s\S]*?syncLivePresentationState\(name\)/);
  assert.doesNotMatch(html, /PokerCore[\s\S]{0,100}is-live-hero-turn/);
});

test('active-play compression is scoped to Live and the mobile breakpoint', () => {
  const marker = liveCss.indexOf('/* Stage 12.4.2 — Hero turn vertical compression. */');
  assert.notEqual(marker, -1);
  const media = liveCss.indexOf('@media (max-width: 430px)', marker);
  assert.notEqual(media, -1);
  assert.match(liveCss.slice(media), /\.app-shell\[data-active-route="live"\]\.is-live-hero-turn/);
});

test('active Live top navigation keeps brand and sound toggle while removing nonessential height', () => {
  const topbar = rule(liveCss, '.app-shell[data-active-route="live"].is-live-hero-turn .top-navigation');
  const sound = rule(liveCss, '.app-shell[data-active-route="live"].is-live-hero-turn .sound-control');
  assert.match(topbar, /min-height:\s*44px/);
  assert.match(topbar, /margin-bottom:\s*4px/);
  assert.match(sound, /min-height:\s*40px/);
  assert.match(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-hero-turn \.sound-volume\s*\{[^}]*display:\s*none/);
  assert.doesNotMatch(liveCss, /\.app-shell\[data-active-route="live"\]\.is-live-hero-turn \.sound-toggle\s*\{[^}]*display:\s*none/);
});

test('back control becomes compact only during an active mobile Hero decision', () => {
  const back = rule(liveCss, '.app-shell[data-active-route="live"].is-live-hero-turn #screen-live > .back');
  assert.match(back, /min-height:\s*32px/);
  assert.match(back, /margin-bottom:\s*2px/);
  assert.match(liveCss, /#screen-live > \.back::after\s*\{[^}]*inset:\s*-6px -4px/);
});

test('active-play header and back chrome fit an explicit 82px mobile budget', () => {
  const topbar = rule(liveCss, '.app-shell[data-active-route="live"].is-live-hero-turn .top-navigation');
  const back = rule(liveCss, '.app-shell[data-active-route="live"].is-live-hero-turn #screen-live > .back');
  const px = (body, property) => Number(body.match(new RegExp(`${property}:\\s*(\\d+)px`))[1]);
  const chromeBudget = px(topbar, 'height') + px(topbar, 'margin-bottom')
    + px(back, 'min-height') + px(back, 'margin-bottom');
  assert.equal(chromeBudget, 82);
});

test('real Live HUD metrics and controls remain available', () => {
  assert.match(html, /id="liveStack"/);
  assert.match(html, /id="liveProfit"/);
  assert.match(html, /id="liveHands"/);
  assert.match(html, /id="liveTilt"/);
  assert.match(html, /id="pauseLive"/);
  assert.match(html, /id="saveLiveHand"/);
  assert.doesNotMatch(liveCss, /\.is-live-hero-turn[^}]*\.session-bar[^}]*display:\s*none/);
});

test('accepted table, hole-card and action dimensions are preserved', () => {
  assert.match(liveCss, /height:\s*clamp\(220px,\s*27dvh,\s*232px\)/);
  assert.match(liveCss, /#screen-live #liveGame\.is-hero-turn #heroCards \.playing-card\s*\{[\s\S]*?width:\s*54px;[\s\S]*?height:\s*76px/);
  assert.match(liveCss, /#screen-live #liveActions button\s*\{[\s\S]*?min-height:\s*44px/);
});

test('decision ordering stays play-first and learning remains below actions', () => {
  assert.ok(html.indexOf('id="heroCards"') < html.indexOf('id="liveActions"'));
  assert.ok(html.indexOf('id="liveActions"') < html.indexOf('id="liveLearningPanel"'));
});

test('fixed navigation architecture and safe-area ownership remain unchanged', () => {
  assert.match(layoutCss, /\.bottom-nav\s*\{[\s\S]*?bottom:\s*calc\(var\(--safe-area-bottom\) \+ var\(--bottom-navigation-offset\)\)/);
  assert.match(layoutCss, /\.app-shell\s*\{[\s\S]*?padding-block-end:\s*var\(--app-content-bottom-inset\)/);
  assert.doesNotMatch(liveCss, /#liveActions[^}]*position:\s*(?:fixed|sticky)/);
});

test('compact header state does not alter gameplay or trainer calculations', () => {
  assert.doesNotMatch(liveCss, /PokerCore|analyzerPreflop|analyzerPostflop|callEV/);
  assert.match(html, /canHeroAct:\s*Boolean\(session && flowController\.canHeroAct\(\)\)/);
});
