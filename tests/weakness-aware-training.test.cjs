'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODEL_PATH = path.join(ROOT, 'src', 'progress', 'weakness-model.js');
const DASHBOARD_PATH = path.join(ROOT, 'src', 'ui', 'dashboard.js');
const HTML_PATH = path.join(ROOT, 'index.html');
const HOME_CSS_PATH = path.join(ROOT, 'src', 'styles', 'home.css');

let WeaknessModel = null;
let modelLoadError = null;
try {
  WeaknessModel = require(MODEL_PATH);
} catch (error) {
  modelLoadError = error;
}

const ProgressSystem = require('../src/progress/progress-system.js');
const ProgressIntegration = require('../src/progress/progress-integration.js');

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function api() {
  assert.ifError(modelLoadError);
  assert.ok(WeaknessModel);
  return WeaknessModel;
}

function skill(score = null, attempts = 0, confidence = 'insufficient', recentTrend = 'INSUFFICIENT_DATA') {
  return { score, attempts, confidence, recentTrend, updatedAt: null };
}

function snapshot(skills = {}) {
  return {
    skills: {
      preflop: skill(),
      value: skill(),
      bluffing: skill(),
      discipline: skill(),
      pokerMath: skill(),
      postflop: skill(),
      ...skills
    }
  };
}

function decisionRecord(index, score, topic = 'passive') {
  const date = new Date(Date.UTC(2026, 7, 1, 12, index)).toISOString();
  return {
    topic,
    record: {
      decisionId: `weakness-${topic}-${index}`,
      date,
      street: topic === 'preflop' ? 'preflop' : 'river',
      decisionMode: 'TRAINING',
      trainerSnapshot: { confidence: 'high', isMarginal: false },
      decisionQuality: {
        schemaVersion: 1,
        score,
        classification: score < 60 ? 'POOR' : 'ACCEPTABLE',
        confidence: 'high',
        isRated: true,
        isMarginal: false,
        modelVersion: 'stage-10.7-fixture',
        evaluatedAt: date
      }
    }
  };
}

function realProgressSnapshot(records) {
  const storage = new MemoryStorage();
  let minute = 0;
  const system = ProgressSystem.create({
    storage,
    now: () => new Date(Date.UTC(2026, 7, 1, 12, minute++)).toISOString(),
    createPlayerId: () => 'weakness-player'
  });
  const integration = ProgressIntegration.create({
    system,
    now: () => new Date(Date.UTC(2026, 7, 1, 12, minute++)).toISOString(),
    timezoneOffsetMinutes: () => 0
  });
  records.forEach(({ record, topic }) => {
    const result = integration.recordTrainingDecision({ decisionRecord: record, topic, source: 'training' });
    assert.equal(result.applied, true);
  });
  return system.getSnapshot();
}

test('weakness summary derives from real ProgressSystem decision events', () => {
  const records = Array.from({ length: 12 }, (_, index) => decisionRecord(index, 52, 'passive'));
  const progressSnapshot = realProgressSnapshot(records);
  const summary = api().derive(progressSnapshot);
  assert.equal(summary.primary.id, 'discipline');
  assert.equal(summary.primary.relevantDecisions, 12);
  assert.equal(summary.primary.score, 52);
  assert.equal(summary.primary.eligible, true);
});

test('ranking is deterministic and uses score, sample and stable id ordering', () => {
  const input = snapshot({
    value: skill(62, 30, 'high', 'STABLE'),
    discipline: skill(62, 30, 'high', 'STABLE'),
    pokerMath: skill(70, 30, 'high', 'STABLE')
  });
  const first = api().derive(input);
  const second = api().derive(input);
  assert.deepEqual(first, second);
  assert.deepEqual(first.ranked.map(item => item.id), ['value', 'discipline', 'pokerMath']);
});

test('insufficient data produces a truthful neutral state', () => {
  const summary = api().derive(snapshot());
  assert.equal(summary.primary, null);
  assert.equal(summary.hasReliableData, false);
  assert.match(summary.emptyMessage, /решен/i);
});

test('one or two poor decisions cannot become a weekly focus', () => {
  const summary = api().derive(snapshot({ value: skill(10, 2, 'insufficient', 'DOWN') }));
  const value = summary.categories.find(item => item.id === 'value');
  assert.equal(value.eligible, false);
  assert.equal(value.priority, null);
  assert.equal(summary.primary, null);
});

test('recent DOWN signal increases priority without overpowering sample protection', () => {
  const down = api().derive(snapshot({ value: skill(70, 20, 'medium', 'DOWN') }));
  const up = api().derive(snapshot({ value: skill(70, 20, 'medium', 'UP') }));
  assert.ok(down.primary.priority > up.primary.priority);
  const tiny = api().derive(snapshot({ value: skill(20, 2, 'insufficient', 'DOWN') }));
  assert.equal(tiny.primary, null);
});

test('unsupported mistake counts and accuracy remain null rather than fabricated', () => {
  const item = api().derive(snapshot({ preflop: skill(68, 14, 'medium', 'STABLE') })).primary;
  assert.equal(item.mistakes, null);
  assert.equal(item.accuracy, null);
  assert.equal(item.recentMistakes, null);
});

test('training targets map to existing flows with graceful fallback', () => {
  assert.deepEqual(api().trainingTargetFor('preflop'), {
    skillId: 'preflop', route: 'ranges', scenarioIds: [], fallback: false
  });
  const math = api().trainingTargetFor('pokerMath');
  assert.equal(math.route, 'study');
  assert.ok(math.scenarioIds.includes('flop-nfd'));
  assert.deepEqual(api().trainingTargetFor('unknown'), {
    skillId: null, route: 'study', scenarioIds: [], fallback: true
  });
});

test('derivation never mutates historical snapshot data', () => {
  const input = snapshot({ discipline: skill(55, 18, 'medium', 'DOWN') });
  input.recentChanges = [{ eventId: 'keep', metadata: { unknown: true } }];
  const before = JSON.stringify(input);
  api().derive(input);
  assert.equal(JSON.stringify(input), before);
});

test('Dashboard uses the derived weakness model and exposes focus context to CTA', () => {
  const dashboardSource = fs.readFileSync(DASHBOARD_PATH, 'utf8');
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(dashboardSource, /PokerPilotWeaknessModel/);
  assert.match(dashboardSource, /dataSet|dataset\.focusSkill|focusSkill/);
  assert.match(html, /src="src\/progress\/weakness-model\.js"/);
  assert.match(html, /id="studyFocusContext"/);
  assert.match(html, /id="homeFocusAction"[^>]*data-route="study"/);
});

test('Focus card mobile contract remains compact and overflow-safe', () => {
  const css = fs.readFileSync(HOME_CSS_PATH, 'utf8');
  assert.match(css, /\.home-focus-card/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)[\s\S]*?\.home-focus-card/);
  assert.match(css, /overflow-wrap:\s*anywhere|word-break:\s*break-word/);
  assert.match(css, /#homeFocusAction[\s\S]*?min-height:\s*44px/);
});

test('new ProgressSystem decisions update weakness summary without a reload or storage fork', () => {
  const initial = realProgressSnapshot(Array.from({ length: 9 }, (_, index) => decisionRecord(index, 50, 'passive')));
  assert.equal(api().derive(initial).primary, null);
  const updated = realProgressSnapshot(Array.from({ length: 10 }, (_, index) => decisionRecord(index, 50, 'passive')));
  assert.equal(api().derive(updated).primary.id, 'discipline');
  assert.equal(api().STORAGE_KEY, undefined);
});

test('existing Study, Ranges and Live decision events publish stable weakness topics', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /topic:\s*context\.topic\s*\|\|\s*tag/);
  assert.match(html, /topic:\s*PokerPilotWeaknessModel\.topicForScenario\(s\.id\)/);
  assert.match(html, /topic:\s*'preflop'/);
  assert.match(html, /topic:\s*session\.street\s*===\s*'preflop'\s*\?\s*'preflop'\s*:\s*'postflop'/);
});
