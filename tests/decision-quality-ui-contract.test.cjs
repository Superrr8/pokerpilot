'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../src/ui/decision-quality.js');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles/decision-quality.css'), 'utf8');
const uiSource = fs.readFileSync(path.join(root, 'src/ui/decision-quality.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(root, 'src/storage/progress-storage.js'), 'utf8');

const rated = {
  schemaVersion: 1,
  score: 92,
  grade: 'A',
  classification: 'EXCELLENT',
  stars: 4,
  isRated: true,
  confidence: 'medium',
  components: { actionQuality: 98, sizingQuality: null, evQuality: 50, contextReliability: 75 },
  reasons: ['Вы выбрали основное действие тренера.'],
  modelVersion: 'dq-1.0.0',
  evaluatedAt: '2026-01-01T00:00:00.000Z'
};

test('Decision Quality classic scripts подключены до inline-приложения', () => {
  for (const script of [
    'src/decision-quality/decision-quality-engine.js',
    'src/decision-quality/decision-records.js',
    'src/decision-quality/decision-quality-stats.js',
    'src/ui/decision-quality.js'
  ]) assert.ok(html.includes(`<script src="${script}"></script>`), script);
  assert.ok(html.indexOf('src/ui/decision-quality.js') < html.indexOf('const C = window.PokerCore;'));
});

test('Decision Quality stylesheet подключён', () => {
  assert.match(html, /src\/styles\/decision-quality\.css/);
});

test('UI view model показывает score, grade, stars и label', () => {
  const model = UI.createResultViewModel(rated);
  assert.equal(model.score, '92');
  assert.equal(model.grade, 'A');
  assert.equal(model.stars, 4);
  assert.equal(model.label, 'Отличное решение');
});

test('UNRATED UI не показывает нулевой score', () => {
  const model = UI.createResultViewModel({ isRated: false, score: null, classification: 'UNRATED', reasons: [] });
  assert.equal(model.score, '—');
  assert.equal(model.label, 'Недостаточно данных');
});

test('Profile summary имеет честный empty state', () => {
  const model = UI.createProfileViewModel({ ratedCount: 0, average: null, sampleStatus: 'NONE' });
  assert.equal(model.value, 'Не рассчитана');
  assert.match(model.detail, /решени/i);
});

test('Profile summary различает provisional и established', () => {
  assert.match(UI.createProfileViewModel({ ratedCount: 2, average: 88, sampleStatus: 'PROVISIONAL' }).detail, /предвар/i);
  assert.match(UI.createProfileViewModel({ ratedCount: 20, average: 82, sampleStatus: 'ESTABLISHED' }).detail, /20/);
});

test('history view model показывает action, grade и главный reason', () => {
  const model = UI.createHistoryItemViewModel({
    choice: 'call',
    decisionQuality: rated
  });
  assert.equal(model.action, 'CALL');
  assert.equal(model.grade, 'A');
  assert.equal(model.reason, rated.reasons[0]);
});

test('старый history record отображается как UNRATED, а не 0', () => {
  const model = UI.createHistoryItemViewModel({ choice: 'fold', grade: 'mistake' });
  assert.equal(model.score, '—');
  assert.equal(model.classification, 'UNRATED');
});

test('пользовательские строки Decision Quality выводятся через textContent', () => {
  assert.match(uiSource, /\.textContent\s*=/);
  assert.doesNotMatch(uiSource, /innerHTML\s*=[^;]*(?:reason|title|choice|explanation)/);
});

test('feedback containers существуют для Study, Ranges и Live', () => {
  assert.match(html, /id="studyDecisionQuality"/);
  assert.match(html, /id="rangeDecisionQuality"/);
  assert.match(html, /id="liveDecisionQuality"/);
});

test('Profile содержит расширенный Decision Quality summary', () => {
  assert.match(html, /id="profileDecisionQualityDetail"/);
  assert.match(html, /id="profileDecisionQualityTrend"/);
  assert.match(html, /id="profileDecisionQualityStreets"/);
});

test('Coach получает дополнительный DQ сигнал без удаления weak-area модели', () => {
  assert.match(html, /DecisionQualityStats\.getSummary/);
  assert.match(html, /progress\.mistakes/);
});

test('progress storage нормализует decision history и сохраняет старый ключ', () => {
  assert.match(storageSource, /DecisionQualityRecords/);
  assert.match(storageSource, /pokerpilot_v1_6_progress/);
  assert.doesNotMatch(storageSource, /removeItem\(/);
});

test('Decision Quality CSS mobile-first и без horizontal overflow', () => {
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /min-height:\s*44px/);
});

test('Decision Quality CSS поддерживает focus-visible и reduced motion', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('Decision Quality UI обновляет локальные контейнеры', () => {
  assert.doesNotMatch(uiSource, /document\.body\.innerHTML|app-shell[^;]*innerHTML/);
  assert.match(uiSource, /renderResult/);
  assert.match(uiSource, /renderProfile/);
});

test('session summary отделён от финансового результата', () => {
  assert.match(html, /getSessionSummary/);
  assert.match(html, /Качество решений/);
});
