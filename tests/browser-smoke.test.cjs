'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('index.html подключает внешний PokerCore до прикладного скрипта', () => {
  const coreScript = '<script src="src/poker-core.js"></script>';
  const scenariosScript = '<script src="src/data/postflop-scenarios.js"></script>';
  const rangesScript = '<script src="src/data/preflop-ranges.js"></script>';
  const courseScript = '<script src="src/data/learning-course.js"></script>';
  const courseProgressScript = '<script src="src/learning/course-progress.js"></script>';
  const storageScript = '<script src="src/storage/progress-storage.js"></script>';
  const learningUiScript = '<script src="src/ui/learning-mode.js"></script>';
  const appStart = 'const C = window.PokerCore;';
  assert.ok(html.includes(coreScript));
  assert.ok(html.includes(scenariosScript));
  assert.ok(html.includes(rangesScript));
  assert.ok(html.includes(courseScript));
  assert.ok(html.includes(courseProgressScript));
  assert.ok(html.includes(storageScript));
  assert.ok(html.includes(learningUiScript));
  assert.ok(html.indexOf(coreScript) < html.indexOf(scenariosScript));
  assert.ok(html.indexOf(scenariosScript) < html.indexOf(rangesScript));
  assert.ok(html.indexOf(rangesScript) < html.indexOf(courseScript));
  assert.ok(html.indexOf(courseScript) < html.indexOf(courseProgressScript));
  assert.ok(html.indexOf(courseProgressScript) < html.indexOf(storageScript));
  assert.ok(html.indexOf(storageScript) < html.indexOf(learningUiScript));
  assert.ok(html.indexOf(learningUiScript) < html.indexOf(appStart));
});

test('index.html не содержит дублированную реализацию PokerCore', () => {
  assert.doesNotMatch(html, /\(function \(root, factory\)/);
  assert.doesNotMatch(html, /function eval5\(/);
  assert.doesNotMatch(html, /function equityVsRange\(/);
});

test('index.html не содержит дублированное определение STUDY_SPOTS', () => {
  assert.doesNotMatch(html, /(?:const|let|var)\s+STUDY_SPOTS\s*=/);
  assert.doesNotMatch(html, /id:\s*'river-aj-bluffcatch'/);
});

test('index.html не содержит дублированные определения префлоп-диапазонов', () => {
  for (const name of [
    'OPEN_RANGES',
    'ISO_RANGES',
    'DEFEND_VS_EARLY',
    'DEFEND_VS_LATE',
    'VS_3BET'
  ]) {
    assert.doesNotMatch(html, new RegExp(`(?:const|let|var)\\s+${name}\\s*=`));
  }
});

test('index.html не содержит дублированную реализацию progress storage', () => {
  assert.doesNotMatch(html, /localStorage\.(?:getItem|setItem|removeItem|clear)/);
  assert.doesNotMatch(html, /function defaultProgress\(/);
  assert.doesNotMatch(html, /function loadProgress\(/);
  assert.doesNotMatch(html, /function saveProgress\(/);
  for (const name of [
    'STORAGE_KEY',
    'PREVIOUS_STORAGE_KEY',
    'OLD_STORAGE_KEY',
    'LEGACY_STORAGE_KEY'
  ]) {
    assert.doesNotMatch(html, new RegExp(`(?:const|let|var)\\s+${name}\\s*=`));
  }
});

test('режим Обучение имеет отдельный вход и экран без дублирования данных курса', () => {
  assert.match(html, /data-route="learning"/);
  assert.match(html, /id="screen-learning"/);
  assert.doesNotMatch(html, /(?:const|let|var)\s+POKERPILOT_COURSE\s*=/);
  assert.doesNotMatch(html, /id:\s*'holdem-foundations'/);
});
