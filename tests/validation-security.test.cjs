'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPokerCore } = require('./poker-core-loader.cjs');
const { loadAppFunction } = require('./app-function-loader.cjs');

const C = loadPokerCore();
const cards = text => text.split(/\s+/).map(C.parseCard);
const indexPath = path.resolve(__dirname, '..', 'index.html');

test('PokerCore отклоняет объект карты с недопустимым рангом или мастью', () => {
  assert.throws(
    () => C.eval5([{ r: 15, s: 's' }, ...cards('Ks Qs Js Ts')]),
    /invalid card/i
  );
  assert.throws(
    () => C.eval5([{ r: 14, s: 'x' }, ...cards('Ks Qs Js Ts')]),
    /invalid card/i
  );
});

test('PokerCore отклоняет повторяющиеся карты', () => {
  assert.throws(() => C.eval5(cards('As As Qs Js Ts')), /duplicate card/i);
});

test('PokerCore отклоняет неправильное количество карт', () => {
  assert.throws(() => C.eval5(cards('As Ks Qs Js')), /exactly 5 cards/i);
  assert.throws(() => C.best7(cards('As Ks Qs Js Ts 9s 8s 7s')), /5 to 7 cards/i);
});

test('potMath отклоняет отрицательный банк', () => {
  assert.throws(
    () => C.potMath({ potBefore: -1, bet: 10, call: 10 }),
    /potBefore.*non-negative/i
  );
});

test('potMath отклоняет отрицательную ставку', () => {
  assert.throws(
    () => C.potMath({ potBefore: 100, bet: -1, call: 10 }),
    /bet.*non-negative/i
  );
});

test('Hand Lab отклоняет отрицательный стек', () => {
  const validate = loadAppFunction('validateAnalyzerNumbers');
  assert.equal(typeof validate, 'function', 'validateAnalyzerNumbers must exist');
  assert.throws(
    () => validate({ pot: 100, bet: 20, stack: -1, call: 20, opponents: 1 }),
    /stack.*positive/i
  );
});

test('Hand Lab отклоняет сумму колла больше эффективного стека', () => {
  const validate = loadAppFunction('validateAnalyzerNumbers');
  assert.equal(typeof validate, 'function', 'validateAnalyzerNumbers must exist');
  assert.throws(
    () => validate({ pot: 100, bet: 200, stack: 150, call: 200, opponents: 1 }),
    /call.*stack/i
  );
});

test('Hand Lab отклоняет невозможные сочетания позиций', () => {
  const validate = loadAppFunction('validateAnalyzerPosition');
  assert.equal(typeof validate, 'function', 'validateAnalyzerPosition must exist');
  assert.throws(() => validate('UTG', 'early'), /position/i);
  assert.throws(() => validate('HJ', 'late'), /position/i);
  assert.doesNotThrow(() => validate('BTN', 'early'));
  assert.doesNotThrow(() => validate('BTN', 'late'));
});

test('пользовательский HTML и script-теги выводятся только как текст', () => {
  const escapeHTML = loadAppFunction('escapeHTML');
  assert.equal(typeof escapeHTML, 'function', 'escapeHTML must exist');
  const unsafe = '<script>alert("x")</script><b>note</b>';
  assert.equal(
    escapeHTML(unsafe),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&lt;b&gt;note&lt;/b&gt;'
  );
  const html = fs.readFileSync(indexPath, 'utf8');
  assert.match(html, /escapeHTML\(data\.notes\)/);
});
