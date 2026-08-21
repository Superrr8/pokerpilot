'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dailyCss = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const liveCss = fs.readFileSync(path.join(ROOT, 'src/styles/live-session.css'), 'utf8');

function mobileDailyRule(selector) {
  const mobile = dailyCss.match(/@media\s*\(max-width:\s*430px\)\s*\{([\s\S]*?)\n\}/)?.[1] || '';
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return mobile.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1] || '';
}

test('Daily Challenge card uses an explicit vertical mobile flow through 430px', () => {
  const rule = mobileDailyRule('.daily-challenge-card');
  assert.match(rule, /display:\s*flex/);
  assert.match(rule, /flex-direction:\s*column/);
  assert.match(rule, /align-items:\s*stretch/);
});

test('Daily Challenge mobile content and statistics keep the full card width', () => {
  assert.match(mobileDailyRule('.daily-challenge-card-copy'), /width:\s*100%/);
  assert.match(mobileDailyRule('.daily-challenge-progress'), /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(mobileDailyRule('.daily-challenge-card-head .tag'), /display:\s*inline-flex/);
});

test('Daily Challenge mobile actions render below content with primary visual priority', () => {
  const actions = mobileDailyRule('.daily-challenge-card-actions');
  assert.match(actions, /width:\s*100%/);
  assert.match(actions, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
  assert.match(mobileDailyRule('.daily-challenge-primary'), /width:\s*100%/);
});

test('Live table rotates presentation so Hero is bottom-center', () => {
  assert.match(html, /PokerPilotLiveSeatLayouts\.getLayout\(session\.n\)/);
  assert.match(html, /const \{x,y\}=layout\.slots\[i\]/);
  assert.match(html, /layout\.slots\[i\]\.id/);
  assert.match(html, /const positions=positionsFor\(session\.n,session\.button\)/);
  assert.match(html, /textContent=`\$\{positions\[i\]\}[^`]*\$\{i===session\.button\?/);
});

test('visual rotation preserves player ownership for seats, actions, cards and bets', () => {
  assert.match(html, /data-player-id',String\(playerId\)/);
  assert.match(html, /activeId===i\?'active-player'/);
  assert.match(html, /syncLiveHoleCards\([^;]*,p,\{x,y\}\)/);
  assert.match(html, /syncLiveActionBubble\(el,p\)/);
  assert.match(html, /syncLiveBetZone\([^;]*,p\)/);
});

test('mobile Live table reserves clearance below bottom-center Hero without overflow', () => {
  assert.match(liveCss, /@media\s*\(max-width:\s*390px\)[\s\S]*?#screen-live \.poker-table\s*\{[\s\S]*?margin-bottom:\s*2[0-9]px/);
  assert.doesNotMatch(liveCss, /#screen-live \.poker-table[^}]*overflow-x:\s*(?:auto|scroll)/);
});
