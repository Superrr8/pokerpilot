'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadFlow() {
  return require('../src/live/live-flow-controller.js');
}

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(fn, delay) {
      const id = nextId++;
      tasks.set(id, { fn, at: now + delay });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
    tick(ms) {
      const target = now + ms;
      while (true) {
        const due = [...tasks.entries()]
          .filter(([, task]) => task.at <= target)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (!due) break;
        now = due[1].at;
        tasks.delete(due[0]);
        due[1].fn();
      }
      now = target;
    },
    pending: () => tasks.size
  };
}

function createHarness(options = {}) {
  const api = loadFlow();
  const clock = fakeClock();
  const events = [];
  const flow = api.create({
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    nowFn: clock.now,
    onAutoNext: token => events.push(['auto-next', token]),
    ...options
  });
  return { api, clock, events, flow };
}

test('Hero folds при двух соперниках — контроллер переходит в observer state', () => {
  const { flow } = createHarness();
  flow.startHand();

  const result = flow.foldHero(2);

  assert.equal(result.continues, true);
  assert.equal(flow.getState().phase, 'observing');
  assert.equal(flow.getState().heroState, 'folded');
});

test('после Fold Hero контроллер запрещает игровые действия Hero', () => {
  const { flow } = createHarness();
  flow.startHand();
  flow.foldHero(3);

  assert.equal(flow.canHeroAct(), false);
});

test('после Fold Hero оставшиеся улицы следуют preflop → flop → turn → river → showdown', () => {
  const { nextStreet } = loadFlow();

  assert.deepEqual(
    ['preflop', 'flop', 'turn', 'river'].map(nextStreet),
    ['flop', 'turn', 'river', 'showdown']
  );
  assert.equal(nextStreet('showdown'), null);
});

test('контролируемая AI-задержка показывает активного игрока и выполняется один раз', () => {
  const { flow, clock } = createHarness();
  let calls = 0;
  flow.startHand();

  flow.scheduleAi(4, () => { calls += 1; }, 320);

  assert.equal(flow.getState().activePlayerId, 4);
  clock.tick(319);
  assert.equal(calls, 0);
  clock.tick(1);
  assert.equal(calls, 1);
  assert.equal(flow.getState().activePlayerId, null);
});

test('новая рука отменяет таймеры предыдущей и меняет hand token', () => {
  const { flow, clock } = createHarness();
  let staleCalls = 0;
  const firstToken = flow.startHand();
  flow.scheduleAi(2, () => { staleCalls += 1; }, 300);

  const secondToken = flow.startHand();
  clock.tick(1000);

  assert.notEqual(firstToken, secondToken);
  assert.equal(staleCalls, 0);
  assert.equal(clock.pending(), 0);
});

test('completed hand хранится как immutable snapshot с полной историей после Fold Hero', () => {
  const { flow } = createHarness();
  flow.startHand();
  flow.foldHero(2);
  const input = {
    id: 'hand-1',
    actions: [
      { sequence: 1, street: 'preflop', type: 'FOLD', playerId: 0 },
      { sequence: 2, street: 'flop', type: 'BET', playerId: 2 },
      { sequence: 3, street: 'turn', type: 'CALL', playerId: 3 },
      { sequence: 4, street: 'river', type: 'CHECK', playerId: 2 },
      { sequence: 5, street: 'showdown', type: 'SHOWDOWN', playerId: 3 }
    ]
  };

  flow.completeHand(input, { autoDelay: 1200 });
  input.actions.push({ sequence: 6, type: 'RESULT' });
  const saved = flow.getLastCompletedHand();

  assert.equal(saved.actions.length, 5);
  assert.equal(Object.isFrozen(saved), true);
  assert.equal(Object.isFrozen(saved.actions), true);
  assert.throws(() => { saved.actions.push({}); }, TypeError);
});

test('автоматическая следующая рука запускается ровно один раз', () => {
  const { flow, clock, events } = createHarness();
  flow.startHand();

  assert.equal(flow.completeHand({ id: 'hand-1' }, { autoDelay: 900 }), true);
  assert.equal(flow.completeHand({ id: 'hand-1-duplicate' }, { autoDelay: 900 }), false);
  clock.tick(899);
  assert.equal(events.length, 0);
  clock.tick(1);
  clock.tick(5000);

  assert.deepEqual(events, [['auto-next', 1]]);
});

test('пауза останавливает автопереход, resume безопасно продолжает его', () => {
  const { flow, clock, events } = createHarness();
  flow.startHand();
  flow.completeHand({ id: 'hand-1' }, { autoDelay: 1000 });
  clock.tick(400);

  flow.pause();
  clock.tick(5000);
  assert.equal(events.length, 0);
  assert.equal(flow.getState().phase, 'paused');

  flow.resume();
  clock.tick(599);
  assert.equal(events.length, 0);
  clock.tick(1);
  assert.equal(events.length, 1);
});

test('выход очищает AI и auto-next таймеры без поздних действий', () => {
  const { flow, clock, events } = createHarness();
  let aiCalls = 0;
  flow.startHand();
  flow.scheduleAi(1, () => { aiCalls += 1; }, 300);
  flow.completeHand({ id: 'hand-1' }, { autoDelay: 1000 });

  flow.exit();
  clock.tick(5000);

  assert.equal(aiCalls, 0);
  assert.equal(events.length, 0);
  assert.equal(clock.pending(), 0);
  assert.equal(flow.getState().phase, 'exited');
});

test('последнюю completed hand можно получить после начала следующей руки', () => {
  const { flow } = createHarness();
  flow.startHand();
  flow.completeHand({ id: 'hand-1', result: { heroNet: -3 } });

  flow.startHand();

  assert.equal(flow.getLastCompletedHand().id, 'hand-1');
  assert.equal(flow.getState().phase, 'playing');
});

test('новая completed hand атомарно заменяет предыдущую', () => {
  const { flow } = createHarness();
  flow.startHand();
  flow.completeHand({ id: 'hand-1' });
  flow.startHand();
  flow.completeHand({ id: 'hand-2' });

  assert.equal(flow.getLastCompletedHand().id, 'hand-2');
});

test('showdown раскрывает карты только не сфолдившихся участников showdown', () => {
  const { canRevealHoleCards } = loadFlow();

  assert.equal(canRevealHoleCards({ folded: false, reachedShowdown: true }), true);
  assert.equal(canRevealHoleCards({ folded: true, reachedShowdown: true }), false);
  assert.equal(canRevealHoleCards({ folded: false, reachedShowdown: false }), false);
});

test('победитель без showdown по умолчанию не раскрывает hole cards', () => {
  const { canRevealHoleCards } = loadFlow();

  assert.equal(canRevealHoleCards({
    folded: false,
    reachedShowdown: false,
    wonWithoutShowdown: true
  }), false);
});
