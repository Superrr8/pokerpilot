'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ProfileStore = require('../src/profile/profile-store.js');
const ProgressSystem = require('../src/progress/progress-system.js');
const Onboarding = require('../src/onboarding/onboarding-system.js');
const I18n = require('../src/ui/translations.js');

const NOW = '2026-09-13T12:00:00.000Z';
const CYRILLIC = /[А-Яа-яЁё]/;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function harness(storage = memoryStorage()) {
  const profileStore = ProfileStore.createProfileStore({
    storage,
    now: () => NOW,
    createId: () => 'new-player',
    detectEstablishedProgress: true
  });
  const progressSystem = ProgressSystem.create({
    storage,
    now: () => NOW,
    createPlayerId: () => 'new-player'
  });
  const onboarding = Onboarding.create({
    profileStore,
    progressSystem,
    now: () => NOW,
    timezoneOffsetMinutes: () => 0
  });
  return { storage, profileStore, progressSystem, onboarding };
}

function completeAssessment(env, choose = question => Onboarding.correctActionFor(question.id)) {
  env.onboarding.advanceWelcome();
  assert.equal(env.onboarding.acceptTerms(true).accepted, true);
  while (env.onboarding.getState().step === 'assessment') {
    const question = env.onboarding.getState().question;
    env.onboarding.submitAnswer(choose(question));
  }
  return env.onboarding.getState();
}

test('new profiles enter onboarding while established profile/progress users bypass it', () => {
  const fresh = harness();
  assert.equal(fresh.onboarding.shouldStart(), true);
  assert.equal(fresh.onboarding.getState().step, 'welcome');
  assert.equal(fresh.profileStore.getOnboarding().onboardingCompleted, false);

  const legacy = ProfileStore.defaultProfile({ now: () => NOW, createId: () => 'legacy-player' });
  delete legacy.onboarding;
  legacy.schemaVersion = 1;
  const existingProfile = harness(memoryStorage({
    [ProfileStore.PROFILE_STORAGE_KEY]: JSON.stringify(legacy)
  }));
  assert.equal(existingProfile.onboarding.shouldStart(), false);

  const existingProgress = harness(memoryStorage({
    pokerpilot_progress_system: JSON.stringify({ schemaVersion: 3, lifetimeXp: 0 })
  }));
  assert.equal(existingProgress.onboarding.shouldStart(), false);
});

test('consent gates assessment and persists the versioned acceptance timestamp', () => {
  const env = harness();
  env.onboarding.advanceWelcome();
  assert.equal(env.onboarding.getState().step, 'consent');
  assert.deepEqual(env.onboarding.acceptTerms(false), { accepted: false, reason: 'CONSENT_REQUIRED' });
  assert.equal(env.onboarding.getState().step, 'consent');

  assert.equal(env.onboarding.acceptTerms(true).accepted, true);
  const state = env.profileStore.getOnboarding();
  assert.equal(state.termsVersion, Onboarding.TERMS_VERSION);
  assert.equal(state.termsAcceptedAt, NOW);
  assert.equal(env.onboarding.getState().step, 'assessment');
});

test('interrupted onboarding resumes at the exact unanswered deterministic decision', () => {
  const env = harness();
  env.onboarding.advanceWelcome();
  env.onboarding.acceptTerms(true);
  const first = env.onboarding.getState().question;
  env.onboarding.submitAnswer(Onboarding.correctActionFor(first.id));
  env.onboarding.submitAnswer(Onboarding.correctActionFor(env.onboarding.getState().question.id));

  const resumed = harness(env.storage);
  const state = resumed.onboarding.getState();
  assert.equal(state.step, 'assessment');
  assert.equal(state.questionNumber, 3);
  assert.equal(state.answers.length, 2);
  assert.equal(state.question.id, Onboarding.getAssessmentQuestions()[2].id);
});

test('assessment contains exactly ten canonical range/scenario decisions without answer coaching', () => {
  const questions = Onboarding.getAssessmentQuestions();
  assert.equal(questions.length, 10);
  assert.equal(new Set(questions.map(question => question.id)).size, 10);
  assert.ok(questions.filter(question => question.source.type === 'preflop-range').length >= 4);
  assert.ok(questions.filter(question => question.source.type === 'study-scenario').length >= 4);
  for (const question of questions) {
    assert.ok(question.source.id);
    assert.ok(question.actions.length >= 2);
    assert.equal('correctAction' in question, false);
    assert.equal('grades' in question, false);
    assert.equal('explanation' in question, false);
    assert.ok(question.hero.length === 2);
  }
});

test('classification is deterministic and initializes canonical Poker IQ once without XP', () => {
  const env = harness();
  const completed = completeAssessment(env);
  assert.equal(completed.step, 'result');
  assert.equal(completed.result.bandId, 'EXPERT');
  assert.equal(completed.result.pokerIq, env.progressSystem.getSnapshot().pokerIq.score);
  assert.equal(env.progressSystem.getSnapshot().pokerIq.ratedDecisions, 10);
  assert.equal(env.progressSystem.getSnapshot().lifetimeXp, 0);
  assert.equal(env.profileStore.getOnboarding().assessmentCompleted, true);
  assert.equal(env.profileStore.getOnboarding().assessmentVersion, Onboarding.ASSESSMENT_VERSION);

  const exported = env.progressSystem.export();
  const reloaded = harness(env.storage);
  assert.equal(reloaded.onboarding.getState().step, 'result');
  assert.deepEqual(reloaded.progressSystem.export(), exported);
  assert.equal(reloaded.progressSystem.getSnapshot().pokerIq.ratedDecisions, 10);
  assert.equal(reloaded.progressSystem.getSnapshot().lifetimeXp, 0);

  reloaded.onboarding.completeOnboarding();
  assert.equal(reloaded.onboarding.shouldStart(), false);
  assert.equal(reloaded.profileStore.getOnboarding().onboardingCompleted, true);
});

test('all-wrong deterministic path uses the same canonical engine and reaches Starter', () => {
  const env = harness();
  const completed = completeAssessment(env, question =>
    question.actions.find(action => Onboarding.gradeFor(question.id, action) === 'mistake')
      || question.actions.find(action => action !== Onboarding.correctActionFor(question.id))
  );
  assert.equal(completed.result.bandId, 'STARTER');
  assert.equal(completed.result.pokerIq, env.progressSystem.getSnapshot().pokerIq.score);
  assert.equal(env.progressSystem.getSnapshot().pokerIq.ratedDecisions, 10);
});

test('English and Russian onboarding dictionaries are complete without wrong-locale copy', () => {
  const english = I18n.createLocalization({ storage: memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: 'en' }), navigatorRef: {}, documentRef: null });
  const russian = I18n.createLocalization({ storage: memoryStorage({ [I18n.LOCALE_STORAGE_KEY]: 'ru' }), navigatorRef: {}, documentRef: null });
  for (const key of Onboarding.REQUIRED_I18N_KEYS) {
    const en = english.t(key);
    const ru = russian.t(key);
    assert.ok(en && en !== key, `missing English ${key}`);
    assert.ok(ru && ru !== key, `missing Russian ${key}`);
    assert.doesNotMatch(en, CYRILLIC, `English contains Cyrillic: ${key}`);
    assert.match(ru, CYRILLIC, `Russian lacks Cyrillic: ${key}`);
  }
});

test('UI keeps one header language picker, accessible legal actions, and no solution leak', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/ui/onboarding.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/styles/onboarding.css'), 'utf8');
  assert.equal((html.match(/id="headerLocaleToggle"/g) || []).length, 1);
  assert.match(html, /id="screen-onboarding"/);
  assert.match(html, /src\/ui\/onboarding\.js/);
  assert.match(html, /src\/styles\/onboarding\.css/);
  assert.match(html, /data-onboarding-legal="terms"/);
  assert.match(html, /data-onboarding-legal="privacy"/);
  assert.match(ui, /consent\.checked/);
  assert.match(ui, /continueButton\.disabled\s*=\s*!consent\.checked/);
  assert.doesNotMatch(ui, /correctAction|\.grades|explanation/);
  assert.match(css, /\.app-shell\[data-active-route="onboarding"\]\s+#headerLocaleControl\s*\{[^}]*display:\s*block/s);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /max-width:\s*100%/);
  assert.match(css, /env\(safe-area-inset-(?:top|bottom)(?:,\s*0px)?\)/);
});

test('startup routing gates only incomplete onboarding and Dashboard consumes assessment focus', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const dashboard = fs.readFileSync(path.join(root, 'src/ui/dashboard.js'), 'utf8');
  assert.match(html, /onboardingUi\.shouldStart\(\)\s*\?\s*'onboarding'\s*:\s*'home'/);
  assert.match(html, /if\s*\(onboardingUi\.shouldStart\(\)\s*&&\s*name\s*!==\s*'onboarding'\)/);
  assert.match(dashboard, /assessmentResult/);
  assert.match(dashboard, /assessment-focus/);
});
