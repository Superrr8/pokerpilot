'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => {
  const file = path.join(root, relativePath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
};
const html = read('index.html');
const tokens = read('src/styles/design-tokens.css');
const liveCss = read('src/styles/live-session.css');
const motionSource = read('src/live/live-motion.js');

function loadMotion() {
  const file = path.join(root, 'src/live/live-motion.js');
  assert.ok(fs.existsSync(file), 'Нет src/live/live-motion.js');
  delete require.cache[require.resolve(file)];
  return require(file);
}

test('Live motion system имеет единые Fast, Normal и Slow presets', () => {
  assert.match(motionSource, /FAST/);
  assert.match(motionSource, /NORMAL/);
  assert.match(motionSource, /SLOW/);
  const { PRESETS } = loadMotion();
  assert.equal(PRESETS.FAST.durationMs, 160);
  assert.equal(PRESETS.NORMAL.durationMs, 260);
  assert.equal(PRESETS.SLOW.durationMs, 1000);
});

test('последовательная раздача использует 160 ms и gap 55 ms', () => {
  const { createDealSequence, LIVE_TIMING } = loadMotion();
  const sequence = createDealSequence(4);
  assert.equal(LIVE_TIMING.dealCardMs, 160);
  assert.equal(LIVE_TIMING.dealGapMs, 55);
  assert.deepEqual(sequence.map(step => step.atMs), [0, 55, 110, 165]);
  assert.equal(sequence.at(-1).endsAtMs, 325);
});

test('motion ledger не запускает одно событие повторно при rerender', () => {
  const { createMotionLedger } = loadMotion();
  const ledger = createMotionLedger();
  ledger.startHand('hand-1');
  assert.equal(ledger.consume('chip', 'action-7'), true);
  assert.equal(ledger.consume('chip', 'action-7'), false);
  assert.equal(ledger.consume('winner', 'player-2'), true);
  assert.equal(ledger.consume('winner', 'player-2'), false);
});

test('новая рука сбрасывает motion ledger и изолирует старый token', () => {
  const { createMotionLedger } = loadMotion();
  const ledger = createMotionLedger();
  ledger.startHand('hand-1');
  ledger.consume('deal', 'card-1');
  ledger.startHand('hand-2');
  assert.equal(ledger.consume('deal', 'card-1'), true);
  assert.equal(ledger.consume('deal', 'late-card', 'hand-1'), false);
});

test('reduced motion сохраняет fade, но отключает flight и scale', () => {
  const { getMotionProfile } = loadMotion();
  const profile = getMotionProfile(true);
  assert.equal(profile.fade, true);
  assert.equal(profile.flight, false);
  assert.equal(profile.scale, false);
  assert.ok(profile.durationMs <= 80);
  assert.match(liveCss, /@keyframes live-fade-only/);
  assert.match(liveCss, /prefers-reduced-motion:\s*reduce[\s\S]*live-fade-only/);
});

test('Live motion module загружается до presentation queue и приложения', () => {
  assert.match(html, /<script src="src\/live\/live-motion\.js"><\/script>/);
  assert.ok(
    html.indexOf('src/live/live-motion.js') < html.indexOf('src/live/live-presentation-queue.js'),
    'motion system должен загрузиться до presentation queue'
  );
  assert.match(html, /playDeal/);
});

test('Live design tokens централизуют deal, board, chip и winner motion', () => {
  for (const token of [
    '--motion-live-fast',
    '--motion-live-normal',
    '--motion-live-slow',
    '--motion-live-deal-gap',
    '--motion-live-board-gap',
    '--motion-live-ease-flight'
  ]) assert.ok(tokens.includes(token), `Нет токена ${token}`);
});

test('Live cards используют flight/reveal только через transform и opacity', () => {
  assert.match(liveCss, /@keyframes live-card-flight/);
  assert.match(liveCss, /@keyframes live-board-reveal/);
  assert.match(liveCss, /\.live-dealt-card/);
  assert.match(liveCss, /will-change:\s*transform,\s*opacity/);
  const liveKeyframes = [
    liveCss.match(/@keyframes live-card-flight\s*\{[\s\S]*?\n\}/)?.[0] || '',
    liveCss.match(/@keyframes live-board-reveal\s*\{[\s\S]*?\n\}/)?.[0] || ''
  ].join('\n');
  assert.doesNotMatch(liveKeyframes, /\b(?:left|top)\s*:/);
});

test('seat DOM синхронизируется локально без полной перерисовки', () => {
  assert.match(html, /function reconcileLiveSeats/);
  assert.match(html, /data-player-id/);
  assert.doesNotMatch(html, /function renderSeats\(\)\{[\s\S]*?seats\.replaceChildren\(\)/);
  assert.match(html, /motionLedger\.consume\('chip'/);
  assert.match(html, /motionLedger\.consume\('winner'/);
});

test('chip, winner и action badge имеют одноразовые premium states', () => {
  assert.match(liveCss, /\.seat-bet\.is-arriving/);
  assert.match(liveCss, /\.seat\.winner\.is-winner-reveal/);
  assert.match(liveCss, /\.player-action-bubble::before/);
  assert.match(liveCss, /backdrop-filter:\s*blur/);
  assert.match(html, /live-dealt-card/);
  assert.match(html, /is-winner-reveal/);
});

test('badge верхнего места получает edge-safe позицию внутри мобильного стола', () => {
  assert.match(html, /seat-edge-top/);
  assert.match(liveCss, /\.seat\.seat-edge-top\s+\.player-action-bubble/);
  assert.match(liveCss, /--live-badge-transform/);
});
