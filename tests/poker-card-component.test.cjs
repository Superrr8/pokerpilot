'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src', 'ui', 'poker-card.js');

function loadCard() {
  const sandbox = { window: {}, module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  new vm.Script(fs.readFileSync(file, 'utf8'), { filename: 'src/ui/poker-card.js' })
    .runInContext(sandbox);
  return sandbox.window.PokerCardUI || sandbox.module.exports;
}

test('компонент карты существует и подключён до приложения', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(fs.existsSync(file), 'Нет src/ui/poker-card.js');
  assert.match(html, /<script src="src\/ui\/poker-card\.js"><\/script>/);
});

test('face-up карта сохраняет 10 и различает красные и чёрные масти', () => {
  const ui = loadCard();
  const tenHearts = ui.render({ r: 10, s: 'h' });
  const aceSpades = ui.render({ r: 14, s: 's' });
  assert.match(tenHearts, />10</);
  assert.match(tenHearts, /suit-red/);
  assert.match(aceSpades, /suit-black/);
});

test('face-down карта не раскрывает ранг и масть', () => {
  const markup = loadCard().render({ r: 14, s: 's' }, { faceUp: false });
  assert.match(markup, /face-down/);
  assert.match(markup, /Закрытая карта/);
  assert.doesNotMatch(markup, />A</);
  assert.doesNotMatch(markup, /♠/);
});

test('карта поддерживает selected, winning, disabled и deal index', () => {
  const markup = loadCard().render(
    { r: 12, s: 'd' },
    { selected: true, winning: true, disabled: true, dealIndex: 3 }
  );
  assert.match(markup, /is-selected/);
  assert.match(markup, /is-winning/);
  assert.match(markup, /is-disabled/);
  assert.match(markup, /--deal-index:3/);
  assert.match(markup, /aria-disabled="true"/);
});

test('cardsHTML реального приложения делегирует визуал PokerCardUI', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /PokerCardUI\.render/);
});

