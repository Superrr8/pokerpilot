'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const Compliance = require('../src/compliance/release-compliance.js');

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const CYRILLIC = /[А-Яа-яЁё]/;

test('canonical EN and RU public destinations expose every accepted legal document', () => {
  const expectedSlugs = {
    terms: 'terms',
    privacy: 'privacy',
    support: 'support',
    responsiblePlay: 'responsible-play'
  };

  for (const [type, slug] of Object.entries(expectedSlugs)) {
    for (const locale of ['en', 'ru']) {
      const destination = Compliance.getDestination(type, locale);
      const url = new URL(destination.url);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.origin, 'https://superrr8.github.io');
      assert.equal(url.pathname, '/pokerpilot/legal/');
      assert.equal(url.searchParams.get('document'), slug);
      assert.equal(url.searchParams.get('lang'), locale);
      assert.equal(destination.documentId, Compliance.documentIdentity(type, locale));
      assert.equal(destination.version, Compliance.getDocument(type, locale).version);
    }
  }
});

test('public legal renderer consumes canonical Stage 13.6B copy without duplicating it', () => {
  const html = read('legal/index.html');
  const script = read('legal/legal-page.js');
  const css = read('legal/legal-page.css');

  assert.match(html, /src="\.\.\/src\/compliance\/release-compliance\.js"/);
  assert.match(html, /src="legal-page\.js"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(script, /compliance\.getDocument/);
  assert.match(script, /compliance\.getDestination/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(`${html}\n${script}`, /educational and training product|Poker combines skill, chance/i);
  assert.match(css, /@media\s*\(max-width:\s*440px\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
});

test('public legal request resolution is deterministic and locale-aware', () => {
  const LegalPage = require('../legal/legal-page.js');
  assert.deepEqual(
    LegalPage.resolveRequest('?document=privacy&lang=ru'),
    { type: 'privacy', locale: 'ru' }
  );
  assert.deepEqual(
    LegalPage.resolveRequest('?document=responsible-play&lang=en'),
    { type: 'responsiblePlay', locale: 'en' }
  );
  assert.deepEqual(
    LegalPage.resolveRequest('?document=unknown&lang=de'),
    { type: 'terms', locale: 'en' }
  );
});

test('public EN/RU documents are the exact canonical versions used by consent', () => {
  for (const type of ['terms', 'privacy', 'support', 'responsiblePlay']) {
    const english = Compliance.getDocument(type, 'en');
    const russian = Compliance.getDocument(type, 'ru');
    assert.doesNotMatch(english.plainText, CYRILLIC);
    assert.match(russian.plainText, CYRILLIC);
    assert.equal(Compliance.getDestination(type, 'en').documentId, english.documentId);
    assert.equal(Compliance.getDestination(type, 'ru').documentId, russian.documentId);
  }
});

test('provenance register covers every shipped content and asset class', () => {
  const provenance = read('RELEASE_PROVENANCE.md');
  for (const heading of [
    'Production code', 'UI and CSS', 'Poker educational content', 'Ranges and scenarios',
    'Generated audio', 'Branding and monogram', 'Fonts', 'Unicode symbols',
    'Production assets', 'Third-party and open-source inventory', 'Validation artifacts'
  ]) assert.match(provenance, new RegExp(heading, 'i'));
  assert.match(provenance, /tools\/audio-audition\.cjs/);
  assert.match(provenance, /no third-party audio samples/i);
  assert.match(provenance, /operator attestation/i);
  assert.match(provenance, /no license file/i);
});

test('release-readiness register contains required App Store Connect inputs without guessing a rating', () => {
  const readiness = read('APP_STORE_READINESS.md');
  for (const phrase of [
    'Primary product positioning', 'Privacy model', 'Simulated-gambling classification',
    'Public URL inventory', 'Content-rights status', 'Outstanding external decisions'
  ]) assert.match(readiness, new RegExp(phrase, 'i'));
  assert.match(readiness, /App Store Connect.?s age-rating questionnaire/i);
  assert.match(readiness, /must not be guessed/i);
  assert.match(readiness, /verified support contact/i);
  assert.match(readiness, /https:\/\/superrr8\.github\.io\/pokerpilot\/legal\//);
});

test('production source contains no third-party operator branding or prohibited assistance claim', () => {
  const production = [
    'index.html',
    ...fs.readdirSync(path.join(root, 'src'), { recursive: true })
      .filter(name => /\.(?:js|css)$/.test(name))
      .map(name => path.join('src', name))
  ].map(read).join('\n');

  assert.doesNotMatch(production, /PokerStars|GGPoker|WSOP|World Poker Tour|PartyPoker|BetMGM|888poker/i);
  assert.match(production, /not intended to be used as prohibited real-time assistance/i);
  assert.match(production, /not standardized IQ tests/i);
  assert.match(production, /does not offer or facilitate real-money gambling/i);
});

test('validation screenshots are excluded from the production tree and future tracking', () => {
  assert.equal(fs.existsSync(path.join(root, 'artifacts')), false);
  assert.match(read('.gitignore'), /^artifacts\/$/m);
  const productionReferences = [read('index.html'), read('manifest.webmanifest')].join('\n');
  assert.doesNotMatch(productionReferences, /artifacts\//);
});
