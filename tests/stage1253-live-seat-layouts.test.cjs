'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const layoutPath = path.join(root, 'src/live/live-seat-layouts.js');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/live-session.css'), 'utf8');

function layouts() {
  assert.equal(fs.existsSync(layoutPath), true, 'shared Live seat-layout module must exist');
  delete require.cache[require.resolve(layoutPath)];
  return require(layoutPath);
}

test('6-max layout exposes exactly six stable occupied slots including Hero', () => {
  const { sixMaxLayout } = layouts();
  assert.equal(sixMaxLayout.seatCount, 6);
  assert.equal(sixMaxLayout.slots.length, 6);
  assert.equal(new Set(sixMaxLayout.slots.map(slot => slot.id)).size, 6);
  assert.deepEqual(sixMaxLayout.slots[0], { id: 'hero', x: 50, y: 100 });
});

test('9-max layout exposes exactly nine stable occupied slots including Hero', () => {
  const { nineMaxLayout } = layouts();
  assert.equal(nineMaxLayout.seatCount, 9);
  assert.equal(nineMaxLayout.slots.length, 9);
  assert.equal(new Set(nineMaxLayout.slots.map(slot => slot.id)).size, 9);
  assert.deepEqual(nineMaxLayout.slots[0], { id: 'hero', x: 50, y: 100 });
});

test('layout selection is deterministic and does not mutate canonical player data', () => {
  const { getLayout } = layouts();
  assert.equal(getLayout(6).id, 'six-max');
  assert.equal(getLayout(9).id, 'nine-max');
  assert.equal(getLayout('9').id, 'nine-max');
  assert.throws(() => getLayout(7), /Unsupported Live seat count/);
  assert.equal(Object.isFrozen(getLayout(6)), true);
  assert.equal(Object.isFrozen(getLayout(6).slots), true);
});

test('seat renderer consumes the shared layout and no longer derives a tall equal-angle ellipse', () => {
  assert.match(html, /src\/live\/live-seat-layouts\.js/);
  assert.match(html, /PokerPilotLiveSeatLayouts\.getLayout\(session\.n\)/);
  assert.match(html, /dataset\.layout=layout\.id/);
  assert.match(html, /const \{x,y\}=layout\.slots\[i\]/);
  assert.doesNotMatch(html, /const angle=\(90\+360\*i\/session\.n\)/);
  assert.doesNotMatch(html, /radiusY=session\.n>=9\?42:43/);
});

test('6-max uses a spacious wide oval and larger readable Player Pods', () => {
  assert.match(css, /\[data-table-size="6"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-width:\s*min\(calc\(100vw - 24px\), 378px\);[^}]*--live-table-camera-height:\s*334px/s);
  assert.match(css, /\[data-table-size="6"\] \.seat\.player-pod:not\(\.hero\)\s*\{[^}]*width:\s*104px/s);
});

test('9-max uses a wider clipped camera table instead of the old portrait egg', () => {
  assert.match(css, /\[data-table-size="9"\]\.live-v2-poker-table\s*\{[^}]*--live-table-camera-width:\s*clamp\(410px, 112vw, 440px\);[^}]*--live-table-camera-height:\s*330px/s);
  assert.match(css, /\.live-v2-table-stage\s*\{[^}]*overflow-x:\s*clip/s);
  assert.match(css, /\[data-table-size="9"\] \.seat\.player-pod:not\(\.hero\)\s*\{[^}]*width:\s*86px/s);
  assert.doesNotMatch(css, /--live-v2-table-height:\s*clamp\(420px, 50dvh, 455px\)/);
});

test('table-size setup remains 9-max by default and is stable when the session starts', () => {
  assert.match(html, /id="tableSize"[\s\S]*?<option value="6">6-max<\/option>[\s\S]*?<option value="9" selected>9-max<\/option>/);
  assert.match(html, /buyIn=\+\$\('#buyIn'\)\.value,n=\+\$\('#tableSize'\)\.value/);
  assert.match(html, /session=\{id:`session-\$\{Date\.now\(\)\}`,initial:buyIn,n,/);
});

test('both layouts keep one canonical action dock and Hero decision source', () => {
  assert.equal((html.match(/id="liveDecisionCore"/g) || []).length, 1);
  assert.match(html, /const decision=getCanonicalLiveHeroDecision\(\)/);
  assert.match(html, /decision\.actionOptions\.forEach/);
  assert.doesNotMatch(html, /session\.n\s*===\s*(?:6|9)[\s\S]{0,120}actionOptions/);
});
