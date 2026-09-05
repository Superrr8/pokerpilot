'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const profileCss = fs.readFileSync(path.join(root, 'src/styles/profile.css'), 'utf8');
const overviewCss = fs.readFileSync(path.join(root, 'src/styles/progress-overview.css'), 'utf8');
const profileSource = fs.readFileSync(path.join(root, 'src/ui/profile.js'), 'utf8');
const overviewSource = fs.readFileSync(path.join(root, 'src/ui/progress-overview.js'), 'utf8');

test('achievement preview remains readable through the full iPhone width range', () => {
  assert.match(overviewCss, /@media\s*\(max-width:\s*440px\)[\s\S]*\.progress-achievements-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(overviewCss, /\.progress-achievement-heading strong\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*(?:break-word|anywhere)/s);
  assert.doesNotMatch(
    overviewCss.match(/\.progress-achievement-heading strong\s*\{[^}]*\}/s)?.[0] || '',
    /text-overflow:\s*ellipsis|white-space:\s*nowrap/
  );
});

test('Recent Progress uses concise labels, two-line wrapping and aligned XP', () => {
  assert.match(overviewSource, /DAILY_HAND_COMPLETED:\s*'Раздача дня'/);
  assert.match(overviewSource, /TRAINING_SCENARIO_COMPLETED:\s*'Сценарий завершён'/);
  assert.match(overviewCss, /\.progress-event-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(overviewCss, /\.progress-event-row strong\s*\{[^}]*-webkit-line-clamp:\s*2[^}]*white-space:\s*normal/s);
  assert.doesNotMatch(
    overviewCss.match(/\.progress-event-row strong\s*\{[^}]*\}/s)?.[0] || '',
    /text-overflow:\s*ellipsis|white-space:\s*nowrap/
  );
});

test('Profile owns an iOS safe-area guard without altering shared navigation geometry', () => {
  assert.match(profileCss, /\.app-shell\[data-active-route="profile"\]::before\s*\{[^}]*position:\s*fixed[^}]*height:\s*var\(--safe-area-top\)[^}]*background:\s*var\(--app-bg\)/s);
  assert.match(profileCss, /pointer-events:\s*none/);
});

test('avatar picker is a semantic premium surface rather than a raw fieldset', () => {
  assert.match(html, /<fieldset class="field profile-avatar-field"/);
  assert.match(profileCss, /\.profile-avatar-field\s*\{[^}]*border:\s*0/s);
  assert.match(profileCss, /\.profile-avatar-options\s*\{[^}]*border:\s*1px solid var\(--border-subtle\)[^}]*background:\s*var\(--surface-interactive\)/s);
});

test('hero avatar edit control is real, opens the dialog and focuses avatar selection', () => {
  assert.match(html, /<button id="profileAvatarEdit"[^>]*aria-label="Изменить аватар"/);
  assert.match(profileSource, /querySelector\('#profileAvatarEdit'\)\?\.addEventListener\('click'/);
  assert.match(profileSource, /openDialog\(event\.currentTarget,\s*true\)/);
  assert.match(profileSource, /avatarTarget\?\.focus\(\)/);
});

test('local avatar presets have upgraded poker identities and versioned delivery', () => {
  for (const mark of ['A♠', 'K♦', 'Q♣', 'J♥']) assert.match(`${html}\n${profileSource}`, new RegExp(mark));
  assert.match(profileCss, /\.profile-avatar\[data-avatar-preset="diamond-blue"\]\s*\{[^}]*color:\s*var\(--status-danger\)/s);
  assert.match(html, /src\/styles\/profile\.css\?v=13\.2\.2/);
  assert.match(html, /src\/styles\/progress-overview\.css\?v=13\.2\.2/);
  assert.match(html, /src\/ui\/profile\.js\?v=13\.2\.2/);
  assert.match(html, /src\/ui\/progress-overview\.js\?v=13\.2\.2/);
});
