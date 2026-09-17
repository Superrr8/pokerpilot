'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const Compliance = require('../src/compliance/release-compliance.js');
const ProfileStore = require('../src/profile/profile-store.js');
const ProgressSystem = require('../src/progress/progress-system.js');
const Onboarding = require('../src/onboarding/onboarding-system.js');
const ComplianceUI = require('../src/ui/release-compliance.js');

const NOW = '2026-09-17T12:00:00.000Z';
const CYRILLIC = /[А-Яа-яЁё]/;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); }
  };
}

function harness(storage = memoryStorage(), options = {}) {
  const profileStore = ProfileStore.createProfileStore({
    storage,
    now: () => NOW,
    createId: () => 'release-player',
    detectEstablishedProgress: true
  });
  const progressSystem = ProgressSystem.create({
    storage,
    now: () => NOW,
    createPlayerId: () => 'release-player'
  });
  const onboarding = Onboarding.create({
    profileStore,
    progressSystem,
    now: () => NOW,
    timezoneOffsetMinutes: () => 0,
    getLocale: () => options.locale || 'en',
    termsVersion: options.termsVersion,
    privacyVersion: options.privacyVersion
  });
  return { storage, profileStore, progressSystem, onboarding };
}

function acceptedOnboarding(overrides = {}) {
  return {
    onboardingCompleted: true,
    assessmentCompleted: true,
    assessmentVersion: Onboarding.ASSESSMENT_VERSION,
    termsVersion: Compliance.TERMS_VERSION,
    termsAcceptedAt: NOW,
    termsAcceptedLocale: 'en',
    termsDocumentId: Compliance.documentIdentity('terms', 'en', Compliance.TERMS_VERSION),
    privacyVersion: Compliance.PRIVACY_VERSION,
    privacyAcceptedAt: NOW,
    privacyAcceptedLocale: 'en',
    privacyDocumentId: Compliance.documentIdentity('privacy', 'en', Compliance.PRIVACY_VERSION),
    currentStep: 'complete',
    answers: [],
    result: { bandId: 'STARTER', recommendedFocus: 'preflop' },
    progressInitializedAt: NOW,
    ...overrides
  };
}

function storedProfile(onboarding) {
  return JSON.stringify({
    ...ProfileStore.defaultProfile({ now: () => NOW, createId: () => 'release-player' }),
    onboarding
  });
}

test('versioned local Terms, Privacy, support, and responsible-play documents are complete in EN and RU', () => {
  for (const type of ['terms', 'privacy', 'support', 'responsiblePlay']) {
    const english = Compliance.getDocument(type, 'en');
    const russian = Compliance.getDocument(type, 'ru');
    assert.equal(english.type, type);
    assert.equal(russian.type, type);
    assert.ok(english.version);
    assert.ok(english.documentId.includes(english.version));
    assert.ok(russian.documentId.includes(russian.version));
    assert.ok(english.sections.length >= 2);
    assert.ok(russian.sections.length >= 2);
    assert.doesNotMatch(JSON.stringify(english), CYRILLIC);
    assert.match(JSON.stringify(russian), CYRILLIC);
    assert.doesNotMatch(english.plainText, /pre-release dependency|placeholder/i);
    assert.doesNotMatch(russian.plainText, /зависимостью до публичного релиза/i);
  }
  assert.match(Compliance.getDocument('terms', 'en').plainText, /educational and training product/i);
  assert.match(Compliance.getDocument('terms', 'en').plainText, /prohibited real-time assistance/i);
  assert.match(Compliance.getDocument('terms', 'en').plainText, /not standardized IQ tests/i);
  assert.equal(Compliance.getDestination('terms').url, null);
  assert.equal(Compliance.getDestination('privacy').url, null);
  assert.equal(Compliance.getDestination('support').url, null);
});

test('clean first run accepts current Terms and Privacy identities before assessment', () => {
  const env = harness();
  assert.equal(env.onboarding.getState().step, 'welcome');
  env.onboarding.advanceWelcome();
  assert.equal(env.onboarding.getState().step, 'consent');
  assert.deepEqual(env.onboarding.acceptLegal(false), { accepted: false, reason: 'CONSENT_REQUIRED' });
  assert.equal(env.onboarding.acceptLegal(true).accepted, true);
  const state = env.profileStore.getOnboarding();
  assert.equal(state.termsVersion, Compliance.TERMS_VERSION);
  assert.equal(state.privacyVersion, Compliance.PRIVACY_VERSION);
  assert.equal(state.termsAcceptedAt, NOW);
  assert.equal(state.privacyAcceptedAt, NOW);
  assert.equal(state.termsAcceptedLocale, 'en');
  assert.equal(state.privacyAcceptedLocale, 'en');
  assert.equal(state.termsDocumentId, Compliance.documentIdentity('terms', 'en'));
  assert.equal(state.privacyDocumentId, Compliance.documentIdentity('privacy', 'en'));
  assert.equal(env.onboarding.getState().step, 'assessment');
});

test('established users without current legal acceptance receive non-destructive re-consent', () => {
  const storage = memoryStorage({
    pokerpilot_progress_system: JSON.stringify({
      schemaVersion: 3,
      playerId: 'release-player',
      lifetimeXp: 725,
      decisionRecords: [],
      counters: {},
      achievements: { unlocked: {}, history: [] },
      streak: {},
      skills: {},
      history: [],
      analyticsCoverage: {},
      processedEventIds: [],
      metadata: {}
    })
  });
  const env = harness(storage);
  const progressBefore = env.progressSystem.export();
  assert.equal(env.profileStore.getOnboarding().onboardingCompleted, true);
  assert.equal(env.onboarding.shouldStart(), true);
  assert.equal(env.onboarding.getState().step, 'consent');
  assert.equal(env.onboarding.getState().reconsent, true);
  const result = env.onboarding.acceptLegal(true);
  assert.equal(result.step, 'complete');
  assert.equal(env.onboarding.shouldStart(), false);
  assert.deepEqual(env.progressSystem.export(), progressBefore);
});

test('Terms and Privacy versions independently and deterministically require re-consent', () => {
  const base = acceptedOnboarding();
  const termsStorage = memoryStorage({
    [ProfileStore.PROFILE_STORAGE_KEY]: storedProfile(base)
  });
  const terms = harness(termsStorage, { termsVersion: '2.0' });
  assert.equal(terms.onboarding.getState().step, 'consent');
  terms.onboarding.acceptLegal(true);
  assert.equal(terms.profileStore.getOnboarding().termsVersion, '2.0');
  assert.equal(terms.profileStore.getOnboarding().privacyVersion, Compliance.PRIVACY_VERSION);

  const privacyStorage = memoryStorage({
    [ProfileStore.PROFILE_STORAGE_KEY]: storedProfile(base)
  });
  const privacy = harness(privacyStorage, { privacyVersion: '2.0' });
  assert.equal(privacy.onboarding.getState().step, 'consent');
  privacy.onboarding.acceptLegal(true);
  assert.equal(privacy.profileStore.getOnboarding().termsVersion, Compliance.TERMS_VERSION);
  assert.equal(privacy.profileStore.getOnboarding().privacyVersion, '2.0');
});

test('legal acceptance persists across reload with its accepted locale and document identities', () => {
  const storage = memoryStorage();
  const first = harness(storage, { locale: 'ru' });
  first.onboarding.advanceWelcome();
  first.onboarding.acceptLegal(true);
  const accepted = first.profileStore.getOnboarding();
  const reloaded = harness(storage, { locale: 'en' });
  assert.equal(reloaded.onboarding.getState().step, 'assessment');
  assert.equal(reloaded.profileStore.getOnboarding().termsAcceptedLocale, 'ru');
  assert.equal(reloaded.profileStore.getOnboarding().privacyAcceptedLocale, 'ru');
  assert.equal(reloaded.profileStore.getOnboarding().termsDocumentId, accepted.termsDocumentId);
  assert.equal(reloaded.profileStore.getOnboarding().privacyDocumentId, accepted.privacyDocumentId);
});

test('Delete All Local Data removes every PokerElevate namespace and preserves unrelated storage', () => {
  const seeded = Object.fromEntries(Compliance.OWNED_STORAGE_KEYS.map(key => [key, `value:${key}`]));
  const storage = memoryStorage({
    ...seeded,
    'pokerelevate.future.v2': 'future-owned',
    'pokerpilot.future.v2': 'future-owned',
    unrelated_application: 'preserve-me'
  });
  const result = Compliance.deleteAllLocalData(storage);
  assert.ok(result.removedKeys.length >= Compliance.OWNED_STORAGE_KEYS.length + 2);
  assert.deepEqual(storage.snapshot(), { unrelated_application: 'preserve-me' });
});

test('reload after deletion behaves like a clean first installation', () => {
  const storage = memoryStorage({
    [ProfileStore.PROFILE_STORAGE_KEY]: storedProfile(acceptedOnboarding()),
    pokerpilot_progress_system: JSON.stringify({ schemaVersion: 3, lifetimeXp: 900 }),
    'pokerelevate.locale.v1': 'ru',
    'pokerpilot.appearance.v1': 'obsidian'
  });
  Compliance.deleteAllLocalData(storage);
  const clean = harness(storage);
  assert.equal(clean.onboarding.shouldStart(), true);
  assert.equal(clean.onboarding.getState().step, 'welcome');
  assert.equal(clean.progressSystem.getSnapshot().lifetimeXp, 0);
  assert.equal(clean.profileStore.getProfile().displayName, 'Player');
});

test('Delete All Local Data UI requires confirmation, removes owned state, and reloads', () => {
  const storage = memoryStorage({
    [ProfileStore.PROFILE_STORAGE_KEY]: storedProfile(acceptedOnboarding()),
    pokerpilot_progress_system: JSON.stringify({ schemaVersion: 3, lifetimeXp: 900 }),
    unrelated_application: 'preserve-me'
  });
  let confirmed = false;
  let reloads = 0;
  const ui = ComplianceUI.create({
    documentRef: { querySelectorAll: () => [], querySelector: () => null },
    compliance: Compliance,
    i18n: { t: (_key, _values, fallback) => fallback, getLocale: () => 'en' },
    storage,
    confirmRef: () => confirmed,
    locationRef: { reload: () => { reloads += 1; } }
  });

  assert.deepEqual(ui.deleteData(), { deleted: false, reason: 'CANCELLED' });
  assert.equal(storage.getItem(ProfileStore.PROFILE_STORAGE_KEY) !== null, true);
  assert.equal(reloads, 0);

  confirmed = true;
  assert.equal(ui.deleteData().deleted, true);
  assert.deepEqual(storage.snapshot(), { unrelated_application: 'preserve-me' });
  assert.equal(reloads, 1);
});

test('Profile permanently exposes legal, support, responsible-play, and delete controls', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/ui/release-compliance.js'), 'utf8');
  assert.match(html, /id="profileCompliance"/);
  for (const type of ['terms', 'privacy', 'support', 'responsiblePlay']) {
    assert.match(html, new RegExp(`data-legal-document="${type}"`));
  }
  assert.equal((html.match(/data-delete-local-data/g) || []).length, 2);
  assert.doesNotMatch(html, /Сбросить статистику/);
  assert.match(ui, /deleteAllLocalData/);
  assert.match(ui, /locationRef\?\.reload/);
});

test('compliance controls are localized, touch-safe, and mobile-width safe', () => {
  const translations = fs.readFileSync(path.join(root, 'src/ui/translations.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'src/styles/profile.css'), 'utf8');
  for (const key of [
    'compliance.title', 'compliance.terms', 'compliance.privacy', 'compliance.support',
    'compliance.responsiblePlay', 'compliance.deleteData', 'compliance.deleteConfirm'
  ]) assert.match(translations, new RegExp(`'${key.replace('.', '\\.')}'`));
  assert.match(css, /\.profile-compliance-action[\s\S]*?min-height:\s*48px/);
  assert.match(css, /\.profile-compliance[\s\S]*?min-width:\s*0/);
  assert.match(css, /@media\s*\(max-width:\s*440px\)[\s\S]*?\.profile-compliance-actions/);
  assert.doesNotMatch(css, /^\s*width:\s*(?:390|430|440)px/m);
});
