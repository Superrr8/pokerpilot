'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadController() {
  return require('../src/live/live-ux-controller.js');
}

test('HistoryPanel по умолчанию collapsed', () => {
  const history = loadController().createHistoryPanel();
  assert.deepEqual(history.getState(), {
    expanded: false,
    manuallyExpanded: false
  });
});

test('пользовательский toggle раскрывает HistoryPanel', () => {
  const history = loadController().createHistoryPanel();
  history.toggle();
  assert.deepEqual(history.getState(), {
    expanded: true,
    manuallyExpanded: true
  });
});

test('повторный toggle сворачивает HistoryPanel и снимает manual flag', () => {
  const history = loadController().createHistoryPanel();
  history.toggle();
  history.toggle();
  assert.deepEqual(history.getState(), {
    expanded: false,
    manuallyExpanded: false
  });
});

test('ход Hero автоматически закрывает немануально открытую историю', () => {
  const history = loadController().createHistoryPanel();
  history.setExpanded(true, { manual: false });
  history.onHeroTurn();
  assert.equal(history.getState().expanded, false);
});

test('ход Hero сохраняет вручную раскрытую историю', () => {
  const history = loadController().createHistoryPanel();
  history.toggle();
  history.onHeroTurn();
  assert.deepEqual(history.getState(), {
    expanded: true,
    manuallyExpanded: true
  });
});

test('новая раздача сбрасывает expanded и manuallyExpanded', () => {
  const history = loadController().createHistoryPanel();
  history.toggle();
  history.startHand();
  assert.deepEqual(history.getState(), {
    expanded: false,
    manuallyExpanded: false
  });
});

test('одно действие создаёт только одну enter-анимацию badge', () => {
  const feed = loadController().createActionFeed();
  assert.equal(feed.consume('hand-1:action-4'), true);
  assert.equal(feed.consume('hand-1:action-4'), false);
});

test('обычный rerender не запускает тот же badge повторно', () => {
  const feed = loadController().createActionFeed();
  const results = Array.from({ length: 5 }, () => feed.consume('hand-2:action-7'));
  assert.deepEqual(results, [true, false, false, false, false]);
});

test('новая раздача очищает action feed deduplication', () => {
  const feed = loadController().createActionFeed();
  feed.consume('action-1');
  feed.startHand();
  assert.equal(feed.consume('action-1'), true);
});

test('cardSignature стабилен для тех же карт и меняется для новой карты', () => {
  const { cardSignature } = loadController();
  const cards = [{ r: 14, s: 'h' }, { r: 10, s: 's' }];
  assert.equal(cardSignature(cards), cardSignature(cards.map(card => ({ ...card }))));
  assert.notEqual(cardSignature(cards), cardSignature([{ r: 14, s: 'h' }, { r: 9, s: 's' }]));
});

test('syncCardCollection повторно использует DOM-карты при обычном rerender', () => {
  const classNames = () => {
    const values = new Set();
    return {
      add: value => values.add(value),
      toggle: (value, force) => force ? values.add(value) : values.delete(value)
    };
  };
  const container = {
    children: [],
    dataset: {},
    appendChild(node) { this.children.push(node); },
    replaceChildren() { this.children.length = 0; },
    ownerDocument: {
      createElement() {
        const template = { content: { firstElementChild: null } };
        Object.defineProperty(template, 'innerHTML', {
          set() {
            template.content.firstElementChild = {
              dataset: {},
              classList: classNames()
            };
          }
        });
        return template;
      }
    }
  };
  global.PokerCardUI = { render: () => '<div class="playing-card"></div>' };
  const { syncCardCollection } = loadController();
  const cards = [{ r: 14, s: 'h' }, { r: 10, s: 's' }];

  const first = syncCardCollection(container, cards, { collectionKey: 'hand-1' });
  const originalNodes = [...container.children];
  const second = syncCardCollection(container, cards.map(card => ({ ...card })), {
    collectionKey: 'hand-1'
  });

  assert.equal(first.created, 2);
  assert.equal(second.created, 0);
  assert.equal(second.reused, 2);
  assert.equal(container.children[0], originalNodes[0]);
  assert.equal(container.children[1], originalNodes[1]);

  const third = syncCardCollection(container, cards.map(card => ({ ...card })), {
    collectionKey: 'hand-2'
  });
  assert.equal(third.created, 2);
  assert.notEqual(container.children[0], originalNodes[0]);
});
