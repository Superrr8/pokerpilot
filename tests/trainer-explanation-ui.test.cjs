'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const UI = require('../src/ui/trainer-explanation.js');

const root = path.resolve(__dirname, '..');

test('view model поддерживает progressive disclosure и скрывает пустую математику', () => {
  const model = UI.createViewModel({
    summary: 'Короткое объяснение.',
    reasons: ['Первая причина.', 'Вторая причина.'],
    keyFactors: ['Позиция CO', 'Слабый kicker'],
    alternatives: ['С BTN решение было бы ближе.'],
    takeaway: 'Запомни основной принцип.',
    math: {},
    confidenceExplanation: 'Высокая уверенность.',
    decisionQualityExplanation: 'Решение совпало с рекомендацией.'
  }, { actionClass: 'FOLD' });
  assert.equal(model.actionLabel, 'Fold');
  assert.equal(model.hasMath, false);
  assert.deepEqual(model.sections.map(section => section.title), ['Почему', 'Ключевые факторы', 'Что изменило бы решение', 'Запомнить']);
  assert.match(model.decisionQualityExplanation, /совпало/);
});

test('math section появляется только для реально доступных значений', () => {
  const model = UI.createViewModel({
    summary: 'Call имеет запас.', reasons: ['Цена колла подходит.'], keyFactors: ['Pot odds'], alternatives: [], takeaway: 'Сравнивай equity с ценой.',
    math: { equity: 0.34, requiredEquity: 0.25, outs: 9, nextCardProbability: 0.19, callEV: 4.2, spr: 2.5 },
    confidenceExplanation: 'Средняя уверенность.'
  }, { actionClass: 'CALL', amount: 20 });
  assert.equal(model.hasMath, true);
  assert.match(model.sections.at(-1).items.join(' '), /34%/);
  assert.match(model.sections.at(-1).items.join(' '), /\+\$4/);
});

test('UI использует безопасный textContent и не вставляет explanation через innerHTML', () => {
  const source = fs.readFileSync(path.join(root, 'src/ui/trainer-explanation.js'), 'utf8');
  assert.match(source, /textContent/);
  assert.doesNotMatch(source, /innerHTML/);
});

test('Coach 2.0 подключён к Hand Lab, Study и Ranges', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /src\/training\/trainer-explanation-engine\.js/);
  assert.match(html, /src\/ui\/trainer-explanation\.js/);
  assert.match(html, /id="anExplanation"/);
  assert.match(html, /id="studyExplanation"/);
  assert.match(html, /id="rangeExplanation"/);
  assert.match(html, /TrainerExplanationUI\.render/);
});

test('styles используют semantic tokens, mobile contract и touch-safe summaries', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles/trainer-explanation.css'), 'utf8');
  assert.match(css, /var\(--surface-/);
  assert.match(css, /var\(--text-/);
  assert.match(css, /var\(--border-/);
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /@media\s*\(max-width:\s*430px\)/);
  assert.match(css, /max-width:\s*100%/);
});

test('existing themes inherit Coach UI without hardcoded palette selectors', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles/trainer-explanation.css'), 'utf8');
  assert.doesNotMatch(css, /data-theme\s*=|#[0-9a-f]{3,8}/i);
});
