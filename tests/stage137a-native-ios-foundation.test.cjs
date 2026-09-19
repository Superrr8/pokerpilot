'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const projectPath = 'ios/PokerElevate.xcodeproj/project.pbxproj';
const appPath = 'ios/PokerElevate/PokerElevateApp.swift';
const webViewPath = 'ios/PokerElevate/PokerElevateWebView.swift';
const infoPath = 'ios/PokerElevate/Info.plist';
const privacyPath = 'ios/PokerElevate/PrivacyInfo.xcprivacy';

test('native project packages the accepted web application from local bundle resources', () => {
  const project = read(projectPath);
  const host = read(webViewPath);

  for (const resource of ['../index.html', '../manifest.webmanifest', '../src', '../legal']) {
    assert.match(project, new RegExp(resource.replace(/[./]/g, '\\$&')));
  }
  assert.match(host, /Bundle\.main\.url\(forResource:\s*"index",\s*withExtension:\s*"html"\)/);
  assert.match(host, /loadFileURL\([\s\S]*allowingReadAccessTo:/);
  assert.match(host, /WKWebsiteDataStore\.default\(\)/);
  assert.doesNotMatch(host, /load\(URLRequest\(url:\s*URL\(string:\s*"https:\/\//);
  assert.equal(fs.existsSync(path.join(root, 'ios/Web')), false, 'accepted web sources must not be duplicated');
});

test('native host preserves the accepted edge-to-edge iPhone geometry and portrait scope', () => {
  const app = read(appPath);
  const host = read(webViewPath);
  const info = read(infoPath);

  assert.match(app, /ignoresSafeArea\(\.container,\s*edges:\s*\.all\)/);
  assert.match(host, /contentInsetAdjustmentBehavior\s*=\s*\.never/);
  assert.match(host, /keyboardDismissMode\s*=\s*\.interactive/);
  assert.match(info, /UIInterfaceOrientationPortrait/);
  assert.doesNotMatch(info, /UIInterfaceOrientationLandscape/);
});

test('native host preserves local-first persistence and provides deterministic relaunch diagnostics', () => {
  const host = read(webViewPath);

  assert.match(host, /WKWebsiteDataStore\.default\(\)/);
  assert.match(host, /POKERELEVATE_NATIVE_VALIDATION/);
  assert.match(host, /pokerelevate\.native\.validation\.v1/);
  assert.match(host, /localStorage\.getItem/);
  assert.match(host, /localStorage\.setItem/);
  assert.match(host, /storagePrevious/);
  assert.match(host, /storageCurrent/);
});

test('native audio and haptics adapt existing feedback without changing web vocabulary', () => {
  const app = read(appPath);
  const host = read(webViewPath);

  assert.match(app, /AVAudioSession\.sharedInstance\(\)/);
  assert.match(app, /setCategory\(\.ambient/);
  assert.match(app, /\.mixWithOthers/);
  assert.match(host, /pokerElevateHaptics/);
  assert.match(host, /navigator/);
  assert.match(host, /vibrate/);
  assert.match(host, /UIImpactFeedbackGenerator/);
  assert.doesNotMatch(`${app}\n${host}`, /requestRecordPermission|AVAudioRecorder|microphone/i);
});

test('native navigation is local by default and only canonical legal HTTPS links may leave the app', () => {
  const host = read(webViewPath);

  assert.match(host, /superrr8\.github\.io/);
  assert.match(host, /\/pokerpilot\/legal\//);
  assert.match(host, /UIApplication\.shared\.open/);
  assert.match(host, /decisionHandler\(\.cancel\)/);
  assert.doesNotMatch(host, /allowsArbitraryLoads|NSAllowsArbitraryLoads/);
});

test('native metadata requests no sensitive permissions and declares no tracking or collection', () => {
  const info = read(infoPath);
  const privacy = read(privacyPath);
  const combined = `${info}\n${privacy}`;

  for (const forbidden of [
    'NSCameraUsageDescription', 'NSMicrophoneUsageDescription',
    'NSContactsUsageDescription', 'NSLocationWhenInUseUsageDescription',
    'NSPhotoLibraryUsageDescription', 'NSUserTrackingUsageDescription'
  ]) assert.doesNotMatch(combined, new RegExp(forbidden));
  assert.match(privacy, /NSPrivacyTracking[\s\S]*?<false\/>/);
  assert.match(privacy, /NSPrivacyCollectedDataTypes[\s\S]*?<array\/>/);
  assert.match(privacy, /NSPrivacyAccessedAPITypes[\s\S]*?<array\/>/);
});

test('native package retains canonical Stage 13.6C legal versions and identities', () => {
  const Compliance = require('../src/compliance/release-compliance.js');
  const project = read(projectPath);

  assert.equal(Compliance.TERMS_VERSION, '1.0');
  assert.equal(Compliance.PRIVACY_VERSION, '1.0');
  assert.equal(Compliance.documentIdentity('terms', 'en'), 'pokerelevate:terms:1.0:en');
  assert.equal(Compliance.documentIdentity('privacy', 'ru'), 'pokerelevate:privacy:1.0:ru');
  assert.match(project, /path = \.\.\/legal;/);
});

test('native package retains the Stage 13.7A dependency and entitlement boundaries', () => {
  const iosFiles = fs.readdirSync(path.join(root, 'ios'), { recursive: true }).map(String);
  const project = read(projectPath);
  const info = read(infoPath);

  assert.equal(iosFiles.some(file => /\.entitlements$/i.test(file)), false);
  assert.equal(iosFiles.some(file => /loading|rising.?chip/i.test(file)), false);
  assert.doesNotMatch(project, /XCRemoteSwiftPackageReference|CocoaPods|carthage/i);
  assert.doesNotMatch(info, /UIBackgroundModes|aps-environment|CFBundleURLTypes/);
});
