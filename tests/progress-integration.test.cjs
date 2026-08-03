'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const learningUiPath = path.join(root, 'src', 'ui', 'learning-mode.js');
const integrationPath = path.join(root, 'src', 'progress', 'progress-integration.js');

const Config = require('../src/progress/progress-config.js');
const ProgressSystem = require('../src/progress/progress-system.js');
let Integration = null;
let loadError = null;
try {
  Integration = require(integrationPath);
} catch (error) {
  loadError = error;
}

const NOW = '2026-08-03T12:00:00.000Z';

class FakeStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.get(key) ?? null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }
}

function api() {
  assert.ifError(loadError);
  assert.ok(Integration);
  return Integration;
}

function createHarness(onSnapshot = null) {
  const system = ProgressSystem.create({
    storage: new FakeStorage(),
    now: () => NOW,
    createPlayerId: () => 'integration-player'
  });
  const integration = api().create({
    system,
    now: () => NOW,
    timezoneOffsetMinutes: () => 0,
    onSnapshot
  });
  return { system, integration };
}

function createHarnessWithResult(onResult) {
  const system = ProgressSystem.create({
    storage: new FakeStorage(),
    now: () => NOW,
    createPlayerId: () => 'integration-player'
  });
  const integration = api().create({
    system,
    now: () => NOW,
    timezoneOffsetMinutes: () => 0,
    onResult
  });
  return { system, integration };
}

function decisionRecord(id, score = 88) {
  return {
    decisionId: id,
    date: NOW,
    street: 'flop',
    decisionMode: 'TRAINING',
    trainerSnapshot: { confidence: 'high', isMarginal: false },
    decisionQuality: {
      schemaVersion: 1,
      score,
      classification: 'GOOD',
      confidence: 'high',
      isRated: true,
      isMarginal: false,
      modelVersion: 'dq-1.0.0',
      evaluatedAt: NOW
    }
  };
}

test('новый TRAINING_SCENARIO_COMPLETED имеет централизованную положительную награду', () => {
  api();
  assert.ok(Config.EVENT_TYPES.includes('TRAINING_SCENARIO_COMPLETED'));
  assert.equal(Config.XP_REWARDS.TRAINING_SCENARIO_COMPLETED, 15);
  assert.ok(Config.XP_REWARDS.TRAINING_SCENARIO_COMPLETED < Config.XP_REWARDS.EXAM_COMPLETED);
});

test('завершённый training scenario выдаёт XP, обновляет Level и квалифицирует streak', () => {
  const { integration, system } = createHarness();
  const first = integration.completeTrainingScenario({
    scenarioId: 'flop-nfd',
    decisionId: 'decision-1',
    source: 'study',
    topic: 'outs'
  });
  assert.equal(first.applied, true);
  assert.equal(first.rewards.xp, 15);
  assert.equal(system.getSnapshot().lifetimeXp, 15);
  assert.equal(system.getSnapshot().level.level, 1);
  assert.deepEqual(system.getSnapshot().streak, {
    current: 1,
    best: 1,
    lastQualifiedDate: '2026-08-03'
  });

  for (let index = 2; index <= 34; index += 1) {
    integration.completeTrainingScenario({
      scenarioId: `scenario-${index}`,
      decisionId: `decision-${index}`,
      source: 'study'
    });
  }
  assert.equal(system.getSnapshot().lifetimeXp, 510);
  assert.equal(system.getSnapshot().level.level, 2);
});

test('повторное завершение того же scenario decision не выдаёт XP дважды', () => {
  const { integration, system } = createHarness();
  const input = { scenarioId: 'turn-combo', decisionId: 'decision-same', source: 'study' };
  assert.equal(integration.completeTrainingScenario(input).applied, true);
  const duplicate = integration.completeTrainingScenario(input);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, 'DUPLICATE_EVENT');
  assert.equal(system.getSnapshot().lifetimeXp, 15);
});

test('реальное решение Trainer обновляет Decision Quality, Poker IQ и derived Rank без XP', () => {
  const { integration, system } = createHarness();
  const result = integration.recordTrainingDecision({
    decisionRecord: decisionRecord('rated-decision'),
    source: 'study',
    topic: 'outs'
  });
  const snapshot = system.getSnapshot();
  assert.equal(result.applied, true);
  assert.equal(result.rewards.xp, 0);
  assert.equal(snapshot.decisionQuality.score, 88);
  assert.equal(snapshot.pokerIq.isRated, true);
  assert.notEqual(snapshot.rank.id, 'UNRANKED');
  assert.equal(snapshot.lifetimeXp, 0);
});

test('завершённый course exam выдаёт существующую награду EXAM_COMPLETED', () => {
  const { integration, system } = createHarness();
  const result = integration.completeExam({
    moduleId: 'holdem-foundations',
    attemptId: 'attempt-1',
    score: 80,
    source: 'learning'
  });
  assert.equal(result.applied, true);
  assert.equal(result.rewards.xp, Config.XP_REWARDS.EXAM_COMPLETED);
  assert.equal(system.getSnapshot().lifetimeXp, Config.XP_REWARDS.EXAM_COMPLETED);
  assert.equal(system.getSnapshot().recentChanges[0].type, 'EXAM_COMPLETED');
});

test('повторная доставка одного exam attempt идемпотентна', () => {
  const { integration, system } = createHarness();
  const input = { moduleId: 'positions', attemptId: 'attempt-2', score: 70 };
  assert.equal(integration.completeExam(input).applied, true);
  assert.equal(integration.completeExam(input).applied, false);
  assert.equal(system.getSnapshot().lifetimeXp, Config.XP_REWARDS.EXAM_COMPLETED);
});

test('каждое применённое событие обновляет UI-подписчика без reload', () => {
  const snapshots = [];
  const { integration } = createHarness(snapshot => snapshots.push(snapshot));
  integration.completeTrainingScenario({
    scenarioId: 'range-btn-a5s',
    decisionId: 'decision-refresh',
    source: 'ranges'
  });
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0].lifetimeXp, 15);

  integration.completeExam({ moduleId: 'preflop-ranges', attemptId: 'exam-refresh', score: 90 });
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].lifetimeXp, 75);
  integration.destroy();
});

test('неверные integration inputs безопасно отклоняются без UI refresh', () => {
  let refreshes = 0;
  const { integration, system } = createHarness(() => { refreshes += 1; });
  assert.equal(integration.completeTrainingScenario({ scenarioId: '', decisionId: '' }).applied, false);
  assert.equal(integration.completeExam({ moduleId: '', attemptId: '', score: NaN }).applied, false);
  assert.equal(integration.recordTrainingDecision({ decisionRecord: null }).applied, false);
  assert.equal(refreshes, 0);
  assert.equal(system.getSnapshot().lifetimeXp, 0);
});

test('browser wiring подключает integration после ProgressSystem и реальные handlers публикуют события', () => {
  api();
  const html = fs.readFileSync(htmlPath, 'utf8');
  const learningSource = fs.readFileSync(learningUiPath, 'utf8');
  const systemScript = '<script src="src/progress/progress-system.js"></script>';
  const integrationScript = '<script src="src/progress/progress-integration.js"></script>';
  assert.ok(html.indexOf(systemScript) < html.indexOf(integrationScript));
  assert.ok(html.indexOf(integrationScript) < html.indexOf('const C = window.PokerCore;'));
  assert.match(html, /progressIntegration\.recordTrainingDecision\(/);
  assert.match(html, /progressIntegration\.completeTrainingScenario\(/);
  assert.match(html, /onExamCompleted:\s*event\s*=>\s*progressIntegration\.completeExam\(event\)/);
  assert.match(html, /rangeState\.number\s*%\s*10\s*===\s*0[\s\S]*progressIntegration\.completeExam\(/);
  assert.match(learningSource, /onExamCompleted/);
  assert.match(learningSource, /action === 'finish-exam'[\s\S]*onExamCompleted\(/);
});

test('Progress Overview знает новый meaningful scenario event', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'ui', 'progress-overview.js'), 'utf8');
  assert.match(source, /TRAINING_SCENARIO_COMPLETED:\s*'Сценарий тренировки завершён'/);
});

test('integration передаёт structured result feedback только для accepted события', () => {
  const results = [];
  const { integration } = createHarnessWithResult(result => results.push(result));
  const input = { scenarioId: 'feedback-spot', decisionId: 'feedback-decision', source: 'study' };
  integration.completeTrainingScenario(input);
  integration.completeTrainingScenario(input);
  assert.equal(results.length, 1);
  assert.equal(results[0].transition.xp.gained, 15);
  assert.equal(results[0].transition.achievements.newlyUnlocked[0].id, 'FIRST_STEP');
  integration.destroy();
});

test('Live и Hand Lab не публикуют XP events в progress integration', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const liveSection = html.slice(html.indexOf('function startLiveSession'), html.indexOf('function answerStudy'));
  const handLabSection = html.slice(html.indexOf('function analyzeHand'), html.indexOf('function renderStudy'));
  assert.doesNotMatch(liveSection, /completeTrainingScenario|completeExam|TRAINING_SCENARIO_COMPLETED/);
  assert.doesNotMatch(handLabSection, /completeTrainingScenario|completeExam|TRAINING_SCENARIO_COMPLETED/);
});
