'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const iconPath = path.join(root, 'ios/PokerElevate/Assets.xcassets/AppIcon.appiconset/PokerElevate-AppIcon-1024.png');
const contentsPath = path.join(root, 'ios/PokerElevate/Assets.xcassets/AppIcon.appiconset/Contents.json');
const projectPath = path.join(root, 'ios/PokerElevate.xcodeproj/project.pbxproj');

test('canonical AppIcon artwork remains the accepted opaque 1024px RGB PNG', () => {
  const icon = fs.readFileSync(iconPath);

  assert.deepEqual(icon.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  assert.equal(icon.toString('ascii', 12, 16), 'IHDR');
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon[24], 8, 'icon must use 8-bit channels');
  assert.equal(icon[25], 2, 'PNG color type 2 is RGB without alpha');
  assert.equal(
    crypto.createHash('sha256').update(icon).digest('hex'),
    '0b60d473bbe326ec8c5f66889c64c03cd6a54873895ba156b3df5dc0d632a924'
  );
});

test('Xcode asset catalog exposes the canonical artwork as the iOS AppIcon set', () => {
  const contents = JSON.parse(fs.readFileSync(contentsPath, 'utf8'));
  const project = fs.readFileSync(projectPath, 'utf8');

  assert.deepEqual(contents.images, [{
    filename: 'PokerElevate-AppIcon-1024.png',
    idiom: 'universal',
    platform: 'ios',
    size: '1024x1024'
  }]);
  assert.deepEqual(contents.info, { author: 'xcode', version: 1 });
  assert.match(project, /Assets\.xcassets in Resources/);
  assert.equal((project.match(/ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;/g) || []).length, 2);
  assert.doesNotMatch(project, /DEVELOPMENT_TEAM/);
});
