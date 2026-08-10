'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/styles/daily-challenge.css'), 'utf8');
const uiSource = fs.readFileSync(path.join(ROOT, 'src/ui/daily-challenge.js'), 'utf8');
const DailyUI = require('../src/ui/daily-challenge.js');
const DailyStorage = require('../src/daily/daily-challenge-storage.js');
const DailySystem = require('../src/daily/daily-challenge-system.js');
const DailyProgress = require('../src/daily/daily-challenge-progress.js');
const DailyHistory = require('../src/daily/daily-challenge-history.js');
const ProgressSystem = require('../src/progress/progress-system.js');
const ProgressIntegration = require('../src/progress/progress-integration.js');

const TODAY = new Date(2026, 7, 4, 12, 0);
const TODAY_KEY = '2026-08-04';
const NOW_ISO = '2026-08-04T19:00:00.000Z';

class MemoryStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  snapshot() { return Object.fromEntries(this.values); }
}

function createEnvironment(initial = {}) {
  const storage = new MemoryStorage(initial);
  const progressSystem = ProgressSystem.create({
    storage,
    now: () => NOW_ISO,
    createPlayerId: () => 'stage-106-player'
  });
  const progressIntegration = ProgressIntegration.create({
    system: progressSystem,
    now: () => NOW_ISO,
    timezoneOffsetMinutes: () => TODAY.getTimezoneOffset()
  });
  const dailyStorage = DailyStorage.create({ storage });
  const dailyProgress = DailyProgress.create({
    storage: dailyStorage,
    progressIntegration,
    now: () => TODAY
  });
  const system = DailySystem.create({ storage: dailyStorage, progress: dailyProgress, now: () => TODAY });
  const history = DailyHistory.create({ storage: dailyStorage, now: () => TODAY });
  return { storage, progressSystem, dailyStorage, system, history };
}

test('opening today exposes full situation but not the answer', () => {
  const { system } = createEnvironment();
  const status = system.getTodayStatus();
  assert.equal(status.status, 'new');
  for (const field of ['street', 'position', 'heroCards', 'board', 'pot', 'effectiveStack', 'context', 'actions']) {
    assert.ok(field in status.challenge, field);
  }
  assert.equal('correctAction' in status.challenge, false);
  assert.equal('explanation' in status.challenge, false);
});

test('valid action completes once and invalid action cannot create a completion', () => {
  const invalidEnvironment = createEnvironment();
  assert.equal(invalidEnvironment.system.submitAnswer('DANCE').reason, 'INVALID_ACTION');
  assert.equal(invalidEnvironment.dailyStorage.getCompletion(TODAY_KEY), null);

  const { system } = createEnvironment();
  const challenge = system.getTodayChallenge();
  const result = system.submitAnswer(challenge.actions[0].actionClass);
  assert.equal(result.accepted, true);
  assert.equal(result.completion.selectedAction, challenge.actions[0].actionClass);
});

test('completion awards XP once and duplicate submit preserves the first answer', () => {
  const env = createEnvironment();
  const challenge = env.system.getTodayChallenge();
  const first = env.system.submitAnswer(challenge.correctAction);
  const afterFirst = env.progressSystem.getSnapshot();
  const duplicate = env.system.submitAnswer(challenge.actions.at(-1).actionClass);
  const afterDuplicate = env.progressSystem.getSnapshot();
  assert.equal(first.completion.progress.xpAwarded, 25);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.completion.selectedAction, first.completion.selectedAction);
  assert.equal(afterDuplicate.lifetimeXp, afterFirst.lifetimeXp);
  assert.equal(env.progressSystem.export().history.length, 1);
});

test('solved challenge reopens as the same read-only review and remains in History', () => {
  const first = createEnvironment();
  const challenge = first.system.getTodayChallenge();
  const selected = challenge.actions.at(-1).actionClass;
  first.system.submitAnswer(selected);
  const reloaded = createEnvironment(first.storage.snapshot());
  const status = reloaded.system.getTodayStatus();
  const history = reloaded.history.getCompletionByDate(TODAY_KEY);
  assert.equal(status.status, 'completed');
  assert.equal(status.review.readOnly, true);
  assert.equal(status.review.selectedAction, selected);
  assert.equal(history.selectedAction, selected);
  assert.equal(reloaded.progressSystem.export().history.length, 1);
});

test('result presentation compares selected and recommended actions deterministically', () => {
  assert.equal(typeof DailyUI.resultPresentation, 'function');
  const status = {
    status: 'completed',
    challenge: { actions: [
      { actionClass: 'CALL', amount: 18, amountUnit: 'ADDITIONAL' },
      { actionClass: 'RAISE', amount: 54, amountUnit: 'TOTAL' }
    ] },
    review: { isCorrect: false, selectedAction: 'CALL', correctAction: 'RAISE', explanation: 'Вэлью-рейз получает оплату.' }
  };
  assert.deepEqual(DailyUI.resultPresentation(status), {
    title: 'Ошибка',
    stateLabel: 'Раздача завершена',
    selectedActionLabel: 'Call $18',
    correctActionLabel: 'Raise to $54',
    explanation: 'Вэлью-рейз получает оплату.',
    tone: 'bad'
  });
});

test('gameplay DOM exposes selection, completion and educational result regions', () => {
  for (const id of [
    'dailySelectionStatus', 'dailyCompletionState', 'dailyResultComparison',
    'dailySelectedAction', 'dailyCorrectAction', 'dailyWhyTitle', 'dailyExplanation'
  ]) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /class="panel daily-decision-panel"/);
});

test('UI locks completed actions and renders the stored first selection', () => {
  assert.match(uiSource, /button\.disabled\s*=\s*status\.status\s*===\s*'completed'/);
  assert.match(uiSource, /status\.review\?\.selectedAction/);
  assert.match(uiSource, /#dailySelectionStatus/);
  assert.match(uiSource, /#dailySelectedAction/);
  assert.match(uiSource, /#dailyCompletionState/);
});

test('correct and incorrect outcomes use explicit text and semantic tones', () => {
  assert.match(uiSource, /resultPresentation\(status\)/);
  assert.match(css, /\.daily-result\.good/);
  assert.match(css, /\.daily-result\.bad/);
  assert.match(html, /id="dailyFeedback"[^>]*role="status"/);
});

test('mobile gameplay has one-column hierarchy, safe-area clearance and no overflow contract', () => {
  assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*?\.daily-meta-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*?\.daily-result-comparison\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.daily-challenge-layout[\s\S]*?padding-bottom:\s*calc\([^;]*env\(safe-area-inset-bottom\)/);
  assert.match(css, /#screen-daily[\s\S]*?overflow-x:\s*hidden/);
});

test('presentation keeps ProgressSystem and poker calculations outside Daily UI', () => {
  assert.doesNotMatch(uiSource, /ProgressSystem|PokerCore|callEV|equity|addXp|recordEvent/);
});
