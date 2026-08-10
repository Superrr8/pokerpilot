'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'src', 'training', 'focus-session.js');
const HTML_PATH = path.join(ROOT, 'index.html');
const CSS_PATH = path.join(ROOT, 'src', 'styles', 'focus-session.css');
const NAVIGATION_PATH = path.join(ROOT, 'src', 'ui', 'navigation.js');

let FocusSession = null;
let moduleLoadError = null;
try {
  FocusSession = require(MODULE_PATH);
} catch (error) {
  moduleLoadError = error;
}

const ProgressSystem = require('../src/progress/progress-system.js');
const ProgressIntegration = require('../src/progress/progress-integration.js');
const WeaknessModel = require('../src/progress/weakness-model.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function api() {
  assert.ifError(moduleLoadError);
  assert.ok(FocusSession);
  return FocusSession;
}

function createController() {
  let identity = 0;
  return api().create({ idFactory: () => `focus-session-${++identity}` });
}

function startValueSession(controller, overrides = {}) {
  return controller.start({
    topicId: 'value',
    topicLabel: 'Вэлью-беты',
    route: 'study',
    preferredScenarioIds: ['value-1', 'value-2', 'value-3', 'value-4', 'value-5'],
    availableScenarioIds: ['value-1', 'value-2', 'value-3', 'value-4', 'value-5', 'other-1'],
    baseline: { score: 70, attempts: 20 },
    ...overrides
  });
}

function record(controller, index, options = {}) {
  return controller.recordDecision({
    decisionId: `decision-${index}`,
    scenarioId: options.scenarioId || `value-${index}`,
    isCorrect: options.isCorrect ?? index % 2 === 1,
    decisionQualityScore: options.score === undefined ? 70 + index : options.score
  });
}

function decisionRecord(id, score = 55) {
  return {
    decisionId: id,
    date: '2026-08-10T12:00:00.000Z',
    street: 'river',
    decisionMode: 'TRAINING',
    trainerSnapshot: { confidence: 'high', isMarginal: false },
    decisionQuality: {
      schemaVersion: 1,
      score,
      classification: 'POOR',
      confidence: 'high',
      isRated: true,
      isMarginal: false,
      modelVersion: 'stage-10.8-fixture',
      evaluatedAt: '2026-08-10T12:00:00.000Z'
    }
  };
}

test('Focus Session exports an explicit five-decision lifecycle', () => {
  assert.equal(api().TOTAL_DECISIONS, 5);
  const controller = createController();
  const state = startValueSession(controller);
  assert.equal(state.status, 'active');
  assert.equal(state.progressLabel, '1/5');
  assert.equal(state.topicLabel, 'Вэлью-беты');
});

test('scenario filtering is deterministic and avoids duplicates when the pool allows', () => {
  const first = api().buildScenarioPlan({
    preferredScenarioIds: ['b', 'a', 'b', 'missing'],
    availableScenarioIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    total: 5
  });
  const second = api().buildScenarioPlan({
    preferredScenarioIds: ['b', 'a', 'b', 'missing'],
    availableScenarioIds: ['a', 'b', 'c', 'd', 'e', 'f'],
    total: 5
  });
  assert.deepEqual(first, second);
  assert.deepEqual(first.scenarioIds, ['b', 'a', 'c', 'd', 'e']);
  assert.equal(new Set(first.scenarioIds).size, 5);
  assert.equal(first.usedFallback, true);
});

test('an insufficient topic pool uses a deterministic graceful fallback', () => {
  const plan = api().buildScenarioPlan({
    preferredScenarioIds: ['only'],
    availableScenarioIds: ['only'],
    total: 5
  });
  assert.deepEqual(plan.scenarioIds, ['only', 'only', 'only', 'only', 'only']);
  assert.equal(plan.usedFallback, true);
});

test('the lifecycle advances from 1/5 to 5/5 and aggregates correct decisions', () => {
  const controller = createController();
  startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) {
    const result = record(controller, index);
    assert.equal(result.accepted, true);
    assert.equal(result.state.completedDecisions, index);
    assert.equal(result.state.progressLabel, index === 5 ? '5/5' : `${index + 1}/5`);
  }
  const result = controller.getResult();
  assert.equal(result.completedDecisions, 5);
  assert.equal(result.correctDecisions, 3);
  assert.equal(result.incorrectDecisions, 2);
  assert.equal(result.accuracy, 60);
  assert.equal(result.averageDecisionQuality, 73);
});

test('Decision Quality average is shown only when all five scores are valid', () => {
  const controller = createController();
  startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) {
    record(controller, index, { score: index === 3 ? NaN : 80 });
  }
  const result = controller.getResult();
  assert.equal(result.ratedDecisions, 4);
  assert.equal(result.averageDecisionQuality, null);
});

test('double submit is rejected without changing session counters', () => {
  const controller = createController();
  startValueSession(controller);
  const first = record(controller, 1);
  const duplicate = record(controller, 1);
  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.reason, 'DUPLICATE_DECISION');
  assert.equal(controller.getSnapshot().completedDecisions, 1);
});

test('a completed session cannot accept a sixth decision', () => {
  const controller = createController();
  startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) record(controller, index);
  const sixth = record(controller, 6);
  assert.equal(sixth.accepted, false);
  assert.equal(sixth.reason, 'SESSION_COMPLETED');
  assert.equal(controller.getSnapshot().completedDecisions, 5);
});

test('completed session cleanup removes stale focus context', () => {
  const controller = createController();
  startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) record(controller, index);
  assert.equal(controller.getSnapshot().status, 'completed');
  controller.clear();
  assert.equal(controller.getSnapshot(), null);
  assert.equal(controller.getResult(), null);
});

test('continue training creates a new session identity for the same topic', () => {
  const controller = createController();
  const first = startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) record(controller, index);
  const second = startValueSession(controller);
  assert.notEqual(first.id, second.id);
  assert.equal(second.topicId, first.topicId);
  assert.equal(second.completedDecisions, 0);
});

test('comparison feedback uses a reliable baseline without fabricating percentages', () => {
  const improving = createController();
  startValueSession(improving, { baseline: { score: 70, attempts: 20 } });
  for (let index = 1; index <= 5; index += 1) record(improving, index, { score: 80 });
  assert.equal(improving.getResult().comparison.id, 'IMPROVING');

  const neutral = createController();
  startValueSession(neutral, { baseline: { score: 70, attempts: 2 } });
  for (let index = 1; index <= 5; index += 1) record(neutral, index, { score: 90 });
  assert.equal(neutral.getResult().comparison.id, 'INSUFFICIENT_DATA');
  assert.doesNotMatch(neutral.getResult().comparison.text, /%/);
});

test('ProgressSystem receives each accepted Focus decision exactly once', () => {
  const storage = new MemoryStorage();
  const system = ProgressSystem.create({
    storage,
    now: () => '2026-08-10T12:00:00.000Z',
    createPlayerId: () => 'focus-player'
  });
  const integration = ProgressIntegration.create({
    system,
    now: () => '2026-08-10T12:00:00.000Z',
    timezoneOffsetMinutes: () => 0
  });
  const controller = createController();
  startValueSession(controller);
  for (let index = 1; index <= 5; index += 1) {
    const decisionId = `focus-progress-${index}`;
    const accepted = controller.recordDecision({
      decisionId,
      scenarioId: `value-${index}`,
      isCorrect: true,
      decisionQualityScore: 60
    });
    if (accepted.accepted) {
      integration.recordTrainingDecision({ decisionRecord: decisionRecord(decisionId), topic: 'value' });
      integration.completeTrainingScenario({ scenarioId: `value-${index}`, decisionId, topic: 'value' });
    }
    const duplicate = controller.recordDecision({
      decisionId,
      scenarioId: `value-${index}`,
      isCorrect: true,
      decisionQualityScore: 60
    });
    assert.equal(duplicate.accepted, false);
  }
  const snapshot = system.getSnapshot();
  assert.equal(snapshot.counters.trainerDecisions, 5);
  assert.equal(snapshot.counters.trainingScenarios, 5);
  assert.equal(snapshot.lifetimeXp, 75);
});

test('new focus decisions update the existing derived weakness snapshot', () => {
  const storage = new MemoryStorage();
  const system = ProgressSystem.create({
    storage,
    now: () => '2026-08-10T12:00:00.000Z',
    createPlayerId: () => 'weakness-focus-player'
  });
  const integration = ProgressIntegration.create({ system, now: () => '2026-08-10T12:00:00.000Z' });
  for (let index = 1; index <= 10; index += 1) {
    integration.recordTrainingDecision({
      decisionRecord: decisionRecord(`weakness-focus-${index}`, 55),
      topic: 'value'
    });
  }
  const summary = WeaknessModel.derive(system.getSnapshot());
  assert.equal(summary.primary.id, 'value');
  assert.equal(summary.primary.relevantDecisions, 10);
});

test('Dashboard CTA starts focus while direct Trainer routes clear focus state', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /PokerPilotFocusSession\.create/);
  assert.match(html, /b\.id === 'homeFocusAction'[\s\S]*startFocusSession/);
  assert.match(html, /b\.dataset\.route === 'study'[\s\S]*clearFocusSession/);
  assert.match(html, /b\.dataset\.route === 'ranges'[\s\S]*clearFocusSession/);
});

test('Study and Ranges render explicit Focus topic and 1\/5 through 5\/5 progress', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.match(html, /id="studyFocusContext"/);
  assert.match(html, /id="rangeFocusContext"/);
  assert.match(html, /focusSessionController\.getCurrentScenarioId/);
  assert.match(html, /focusState\.progressLabel/);
  assert.match(html, /recordFocusDecision/);
});

test('Focus result screen exposes truthful metrics and both completion actions', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const navigation = fs.readFileSync(NAVIGATION_PATH, 'utf8');
  assert.match(html, /id="screen-focus-result"/);
  assert.match(html, /id="focusResultTopic"/);
  assert.match(html, /id="focusResultAccuracy"/);
  assert.match(html, /id="focusResultDecisionQuality"/);
  assert.match(html, /id="focusResultContinue"/);
  assert.match(html, /id="focusResultHome"/);
  assert.match(navigation, /'focus-result':\s*'training'/);
});

test('Focus result CSS is compact, touch-safe and overflow-safe at 390px', () => {
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  assert.match(css, /\.focus-result/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /min-width:\s*0/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});
