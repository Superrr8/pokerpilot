'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createProgressStorageHarness } = require('./progress-storage-loader.cjs');

const ROOT = path.resolve(__dirname, '..');
const LIVE_MODE_PATH = path.join(ROOT, 'src', 'live', 'live-mode.js');
const HTML_PATH = path.join(ROOT, 'index.html');
const LEGACY_PATTERN = /sycuan|сайкан/i;
const NOW = '2026-08-03T18:00:00.000Z';

function loadLiveMode() {
  if (!fs.existsSync(LIVE_MODE_PATH)) return {};
  delete require.cache[require.resolve(LIVE_MODE_PATH)];
  return require(LIVE_MODE_PATH);
}

function legacyHand(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'live-legacy-7',
    mode: 'sycuan_live',
    source: 'Sycuan Live',
    timestamp: NOW,
    table: { size: 6, style: 'normal', blinds: { small: 1, big: 3, label: '$1/$3' } },
    hero: { position: 'BTN', holeCards: ['14s', '13s'], startingStack: 300, endingStack: 372 },
    communityCards: ['12s', '11s', '2d', '10s', '4c'],
    players: [{ playerId: 0, position: 'BTN', startingStack: 300, endingStack: 372 }],
    effectiveStack: 300,
    potSize: 144,
    actions: [{ sequence: 1, street: 'preflop', type: 'CALL', amount: 12 }],
    result: { heroNet: 72, summary: 'Hero wins $144' },
    fingerprint: 'legacy-fingerprint',
    unknown: { keep: true },
    ...overrides
  };
}

function legacyProgressEvent(overrides = {}) {
  return {
    eventId: 'legacy-live-event',
    type: 'LIVE_SESSION_REVIEWED',
    timestamp: NOW,
    localDate: '2026-08-03',
    timezoneOffsetMinutes: 0,
    source: 'sycuan',
    xp: 45,
    summary: 'Sycuan Live review · +45 XP',
    lifetimeXpAfter: 545,
    levelAfter: 2,
    rankAfter: 'ADVANCED',
    pokerIqAfter: 1725,
    streakAfter: 4,
    metadata: { sessionId: 'session-legacy', mode: 'sycuan_mode', score: 88 },
    ...overrides
  };
}

test('neutral Live mode module exposes the canonical contract', () => {
  const api = loadLiveMode();
  assert.equal(api.CANONICAL_ID, 'live_cash_1_3');
  assert.equal(api.FULL_LABEL, 'Live Cash $1/$3');
  assert.equal(api.SHORT_LABEL, 'Live Cash');
  assert.equal(api.CATEGORY_LABEL, 'Live Poker');
  assert.equal(typeof api.normalizeIdentifier, 'function');
});

test('legacy English identifiers normalize to live_cash_1_3', () => {
  const api = loadLiveMode();
  for (const value of ['sycuan', 'SYCUAN', 'sycuan_live', 'sycuan-live', 'sycuanLive', 'sycuanMode']) {
    assert.equal(api.normalizeIdentifier(value), 'live_cash_1_3', value);
  }
});

test('legacy Russian identifiers normalize to live_cash_1_3', () => {
  const api = loadLiveMode();
  for (const value of ['Сайкан', 'сайкан', 'САЙКАН LIVE']) {
    assert.equal(api.normalizeIdentifier(value), 'live_cash_1_3', value);
  }
});

test('canonical normalization is idempotent and preserves unknown identifiers', () => {
  const api = loadLiveMode();
  assert.equal(api.normalizeIdentifier('live_cash_1_3'), 'live_cash_1_3');
  assert.equal(api.normalizeIdentifier(api.normalizeIdentifier('sycuan')), 'live_cash_1_3');
  assert.equal(api.normalizeIdentifier('tournament'), 'tournament');
});

test('display labels use full, compact and category variants', () => {
  const api = loadLiveMode();
  assert.equal(api.getLabel('full'), 'Live Cash $1/$3');
  assert.equal(api.getLabel('short'), 'Live Cash');
  assert.equal(api.getLabel('category'), 'Live Poker');
});

test('legacy display text is replaced without changing unrelated text', () => {
  const api = loadLiveMode();
  assert.equal(api.normalizeDisplayText('Sycuan Live • 18 рук'), 'Live Cash $1/$3 • 18 рук');
  assert.equal(api.normalizeDisplayText('Сайкан — история'), 'Live Cash $1/$3 — история');
  assert.equal(api.normalizeDisplayText('Обычная тренировка'), 'Обычная тренировка');
});

test('current user-facing HTML contains no legacy branding', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.doesNotMatch(html, LEGACY_PATTERN);
});

test('Live mode uses the required full and compact product labels', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, />Live Cash \$1\/\$3</);
  assert.match(html, /Live Cash/);
  assert.match(html, /title:`Live Cash \$1\/\$3 • \$\{session\.hands\} рук`/);
});

test('accessibility labels contain no legacy branding and identify Live Cash', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const labels = [...html.matchAll(/aria-label="([^"]*)"/g)].map(match => match[1]);
  assert.equal(labels.some(label => LEGACY_PATTERN.test(label)), false);
  assert.ok(labels.some(label => /Live Cash/.test(label)));
});

test('neutral normalization module loads before storage, analytics and saved hands', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const identity = html.indexOf('src/live/live-mode.js');
  assert.ok(identity >= 0);
  assert.ok(identity < html.indexOf('src/progress/progress-analytics.js'));
  assert.ok(identity < html.indexOf('src/storage/progress-storage.js'));
  assert.ok(identity < html.indexOf('src/live/saved-hands.js'));
});

test('legacy saved hand normalizes branding without changing poker data', () => {
  const api = loadLiveMode();
  const source = legacyHand();
  const before = JSON.parse(JSON.stringify(source));
  const normalized = api.normalizeSavedHand(source);
  assert.equal(normalized.mode, 'live_cash_1_3');
  assert.equal(normalized.source, 'Live Cash $1/$3');
  for (const key of ['id', 'timestamp', 'table', 'hero', 'communityCards', 'players', 'effectiveStack', 'potSize', 'actions', 'result', 'fingerprint', 'unknown']) {
    assert.deepEqual(normalized[key], before[key], key);
  }
  assert.deepEqual(source, before);
});

test('new saved hands use canonical mode and neutral source', () => {
  const savedHands = require('../src/live/saved-hands.js');
  const hand = savedHands.createHandRecord({
    sessionId: 'neutral', handNumber: 1, timestamp: NOW,
    source: 'Sycuan Live', hero: { holeCards: ['14s', '13s'] }
  });
  assert.equal(hand.mode, 'live_cash_1_3');
  assert.equal(hand.source, 'Live Cash $1/$3');
});

test('duplicate protection treats legacy and canonical saved hands as the same hand', () => {
  const api = loadLiveMode();
  const savedHands = require('../src/live/saved-hands.js');
  const legacy = legacyHand();
  const canonical = api.normalizeSavedHand({ ...legacy, id: 'canonical-id', fingerprint: 'canonical-fingerprint' });
  const result = savedHands.saveUnique([legacy], canonical);
  assert.equal(result.saved, false);
  assert.equal(result.hands.length, 1);
});

test('legacy progress storage loads saved hands and session history with neutral branding', () => {
  const legacy = {
    decisions: 2,
    sessions: 1,
    history: [{ date: NOW, mode: 'session', liveMode: 'sycuan', title: 'Sycuan Live • 4 рук' }],
    savedHands: [legacyHand()]
  };
  const harness = createProgressStorageHarness({
    initial: { pokerpilot_v1_6_progress: JSON.stringify(legacy) }
  });
  const progress = JSON.parse(JSON.stringify(harness.getProgress()));
  assert.equal(progress.savedHands[0].mode, 'live_cash_1_3');
  assert.equal(progress.savedHands[0].source, 'Live Cash $1/$3');
  assert.equal(progress.history[0].liveMode, 'live_cash_1_3');
  assert.equal(progress.history[0].title, 'Live Cash $1/$3 • 4 рук');
  assert.equal(progress.decisions, 2);
  assert.equal(progress.sessions, 1);
});

test('legacy storage normalization stays idempotent after safe save and reload', () => {
  const first = createProgressStorageHarness({
    initial: { pokerpilot_v1_6_progress: JSON.stringify({ savedHands: [legacyHand()] }) }
  });
  first.saveProgress();
  const second = createProgressStorageHarness({ initial: first.snapshot() });
  second.saveProgress();
  assert.deepEqual(JSON.parse(second.snapshot().pokerpilot_v1_6_progress), JSON.parse(first.snapshot().pokerpilot_v1_6_progress));
});

test('Dashboard never re-displays a legacy session title', () => {
  delete require.cache[require.resolve('../src/ui/dashboard.js')];
  const dashboard = require('../src/ui/dashboard.js');
  const model = dashboard.buildHomeViewModel({
    progress: { history: [{ mode: 'session', title: 'Sycuan Live • 8 рук' }] },
    profile: { displayName: 'Player' }
  });
  assert.equal(model.secondaryActivity.title, 'Live Cash $1/$3 • 8 рук');
  assert.doesNotMatch(model.secondaryActivity.title, LEGACY_PATTERN);
});

test('ProgressSystem preserves legacy event values while normalizing branding', () => {
  const System = require('../src/progress/progress-system.js');
  const original = legacyProgressEvent();
  const migrated = System.migrateProgressState({
    schemaVersion: 3,
    lifetimeXp: 545,
    history: [original]
  }, { now: NOW, playerId: 'legacy-player' });
  const event = migrated.history[0];
  for (const key of ['eventId', 'type', 'timestamp', 'localDate', 'timezoneOffsetMinutes', 'xp', 'lifetimeXpAfter', 'levelAfter', 'rankAfter', 'pokerIqAfter', 'streakAfter']) {
    assert.equal(event[key], original[key], key);
  }
  assert.equal(event.source, 'live_cash_1_3');
  assert.equal(event.metadata.mode, 'live_cash_1_3');
  assert.doesNotMatch(event.summary, LEGACY_PATTERN);
});

test('ProgressSystem legacy migration is deterministic and idempotent', () => {
  const System = require('../src/progress/progress-system.js');
  const first = System.migrateProgressState({ schemaVersion: 3, lifetimeXp: 545, history: [legacyProgressEvent()] }, { now: NOW, playerId: 'p' });
  const second = System.migrateProgressState(first, { now: '2026-08-04T00:00:00.000Z', playerId: 'other' });
  assert.deepEqual(second, first);
  assert.equal(second.history.length, 1);
});

test('duplicate legacy progress event does not award XP twice', () => {
  const System = require('../src/progress/progress-system.js');
  const base = System.migrateProgressState({
    schemaVersion: 3,
    lifetimeXp: 545,
    processedEventIds: ['legacy-live-event'],
    history: [legacyProgressEvent()]
  }, { now: NOW, playerId: 'p' });
  const duplicate = System.applyProgressEvent(base, {
    id: 'legacy-live-event', type: 'LIVE_SESSION_REVIEWED', timestamp: NOW,
    source: 'sycuan', payload: { sessionId: 'session-legacy' }
  });
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.state.lifetimeXp, 545);
  assert.equal(duplicate.state.history.length, 1);
});

test('Analytics merges legacy and canonical Live events without changing totals', () => {
  const analytics = require('../src/progress/progress-analytics.js');
  const canonical = legacyProgressEvent({ eventId: 'canonical-live-event', source: 'live_cash_1_3', summary: 'Live Cash $1/$3 review' });
  const result = analytics.createAnalyticsSnapshot({
    snapshot: { lifetimeXp: 590 },
    history: [legacyProgressEvent(), canonical],
    period: '7d', now: NOW, timezoneOffsetMinutes: 0
  });
  assert.equal(result.periodSummary.acceptedEvents, 2);
  assert.equal(result.periodSummary.xpGained, 90);
  assert.equal(result.eventBreakdown.length, 1);
  assert.equal(result.eventBreakdown[0].id, 'other');
  assert.equal(result.eventBreakdown[0].count, 2);
});

test('Analytics recent activity exposes only neutral source labels', () => {
  const analytics = require('../src/progress/progress-analytics.js');
  const result = analytics.createAnalyticsSnapshot({
    snapshot: { lifetimeXp: 545 }, history: [legacyProgressEvent()],
    period: 'all', now: NOW, timezoneOffsetMinutes: 0
  });
  assert.equal(result.recentActivity.length, 1);
  assert.equal(result.recentActivity[0].source, 'live_cash_1_3');
  assert.doesNotMatch(JSON.stringify(result.recentActivity), LEGACY_PATTERN);
});

test('cleanup keeps Progress schema and retention contracts unchanged', () => {
  const Config = require('../src/progress/progress-config.js');
  assert.equal(Config.SCHEMA_VERSION, 3);
  assert.equal(Config.HISTORY_LIMIT, 2000);
});

test('profile statistics still counts legacy session hands without mutation', () => {
  const statistics = require('../src/profile/profile-statistics.js');
  const progress = { sessions: 1, history: [{ mode: 'session', title: 'Sycuan Live • 18 рук' }] };
  const before = JSON.stringify(progress);
  const result = statistics.fromProgress(progress);
  assert.equal(result.handsPlayed, 18);
  assert.equal(JSON.stringify(progress), before);
});

test('active product sources contain no legacy branding outside the compatibility layer and regression fixture', () => {
  const allowed = new Set([
    path.relative(ROOT, LIVE_MODE_PATH),
    path.relative(ROOT, __filename)
  ]);
  const roots = ['index.html', 'src', 'tests', 'PROGRESS_SYSTEM.md', 'TESTING.md'];
  const hits = [];
  function scan(relative) {
    const absolute = path.join(ROOT, relative);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute)) scan(path.join(relative, name));
      return;
    }
    if (allowed.has(relative) || !/\.(?:html|js|cjs|css|md|json)$/.test(relative)) return;
    if (LEGACY_PATTERN.test(fs.readFileSync(absolute, 'utf8'))) hits.push(relative);
  }
  roots.forEach(relative => scan(relative));
  assert.deepEqual(hits, []);
});
