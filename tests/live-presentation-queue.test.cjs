'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function loadQueue() {
  return require('../src/live/live-presentation-queue.js');
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

function harness(pacing = {}) {
  const api = loadQueue();
  const clock = fakeClock();
  const events = [];
  const queue = api.create({
    pacing: {
      ...api.ZERO_DURATION_PACING,
      dealCardMs: 160,
      dealGapMs: 55,
      aiThinkMinMs: 100,
      aiThinkMaxMs: 100,
      actionBadgeHoldMs: 200,
      actionBadgeExitMs: 90,
      afterCheckPauseMs: 300,
      afterFoldPauseMs: 350,
      chipMoveMs: 150,
      afterBetPauseMs: 250,
      streetTransitionPauseMs: 180,
      cardRevealGapMs: 120,
      showdownRevealGapMs: 220,
      winnerDisplayMs: 400,
      ...pacing
    },
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    nowFn: clock.now,
    onPhase: event => events.push(`${event.phase}:${event.playerId ?? event.street ?? ''}`)
  });
  queue.startHand(1);
  return { api, clock, events, queue };
}

test('deal presentation ждёт последовательную раздачу всех карт', () => {
  const { queue, clock, events } = harness();
  queue.playDeal({ token: 1, cardCount: 4 });

  assert.deepEqual(events, ['deal-cards:']);
  clock.tick(324);
  assert.equal(events.includes('deal-complete:'), false);
  clock.tick(1);
  assert.equal(events.includes('deal-complete:'), true);
});

test('AI actions воспроизводятся строго последовательно', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'CHECK' }) });
  queue.playAction({ token: 1, playerId: 2, perform: () => ({ type: 'FOLD' }) });

  clock.tick(2000);

  assert.ok(events.indexOf('action-complete:1') < events.indexOf('thinking:2'));
});

test('следующее action presentation не начинается до reading pause предыдущего', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'CHECK' }) });
  queue.playAction({ token: 1, playerId: 2, perform: () => ({ type: 'CHECK' }) });

  clock.tick(689);
  assert.equal(events.includes('thinking:2'), false);
  clock.tick(1);
  assert.equal(events.includes('thinking:2'), true);
});

test('CHECK badge остаётся видимым в течение actionBadgeHold + afterCheckPause', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 3, perform: () => ({ type: 'CHECK' }) });

  clock.tick(689);
  assert.equal(events.includes('action-complete:3'), false);
  clock.tick(1);
  assert.equal(events.includes('action-complete:3'), true);
});

test('badge получает exit phase до завершения visual action', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 3, perform: () => ({ type: 'CHECK' }) });

  clock.tick(2000);
  assert.ok(events.includes('action-exit:3'));
  assert.ok(events.indexOf('action-exit:3') < events.indexOf('action-complete:3'));
});

test('FOLD сначала показывает badge, затем применяет folded visual state', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 4, perform: () => ({ type: 'FOLD' }) });

  clock.tick(100);
  assert.deepEqual(events.slice(0, 2), ['thinking:4', 'action:4']);
  assert.equal(events.includes('fold-visual:4'), false);
  clock.tick(200);
  assert.equal(events.includes('fold-visual:4'), true);
});

test('BET и CALL показывают bet zone до завершения action presentation', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'BET', amount: 20 }) });
  queue.playAction({ token: 1, playerId: 2, perform: () => ({ type: 'CALL', amount: 20 }) });

  clock.tick(2000);
  assert.ok(events.indexOf('chip-move:1') < events.indexOf('action-complete:1'));
  assert.ok(events.indexOf('chip-move:2') < events.indexOf('action-complete:2'));
});

test('street transition собирает ставки перед открытием следующей карты', () => {
  const { queue, clock, events } = harness();
  queue.playStreetTransition({ token: 1, street: 'flop', cardCount: 3 });

  clock.tick(1000);
  assert.ok(events.indexOf('collect-bets:flop') < events.indexOf('reveal-card:flop'));
});

test('turn не раскрывается до завершения сбора ставок flop', () => {
  const { queue, clock, events } = harness();
  queue.playStreetTransition({ token: 1, street: 'turn', cardCount: 1 });

  clock.tick(179);
  assert.equal(events.includes('reveal-card:turn'), false);
  clock.tick(1);
  assert.equal(events.includes('reveal-card:turn'), true);
});

test('river не раскрывается до завершения turn transition', () => {
  const { queue, clock, events } = harness();
  queue.playStreetTransition({ token: 1, street: 'river', cardCount: 1 });

  clock.tick(179);
  assert.equal(events.includes('reveal-card:river'), false);
  clock.tick(1);
  assert.equal(events.includes('reveal-card:river'), true);
});

test('showdown раскрывает карты участников последовательно', () => {
  const { queue, clock, events } = harness();
  queue.playShowdown({ token: 1, playerIds: [2, 5, 7] });

  clock.tick(2000);
  const reveals = events.filter(event => event.startsWith('showdown-reveal:'));
  assert.deepEqual(reveals, ['showdown-reveal:2', 'showdown-reveal:5', 'showdown-reveal:7']);
});

test('showdown helper исключает folded players из раскрытия', () => {
  const { showdownPlayerIds } = loadQueue();
  assert.deepEqual(showdownPlayerIds([
    { id: 1, folded: false },
    { id: 2, folded: true },
    { id: 3, folded: false }
  ]), [1, 3]);
});

test('победа без showdown не создаёт reveal steps', () => {
  const { queue, clock, events } = harness();
  queue.playShowdown({ token: 1, playerIds: [], wonWithoutShowdown: true });

  clock.tick(1000);
  assert.equal(events.some(event => event.startsWith('showdown-reveal:')), false);
});

test('exit полностью очищает action queue', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'BET' }) });
  queue.exit();
  clock.tick(5000);

  assert.equal(queue.getState().phase, 'exited');
  assert.equal(clock.pending(), 0);
  assert.equal(events.includes('action:1'), false);
});

test('pause замораживает queue и resume продолжает оставшееся время', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'CHECK' }) });
  clock.tick(50);
  queue.pause();
  clock.tick(1000);
  assert.equal(events.includes('action:1'), false);
  queue.resume();
  clock.tick(49);
  assert.equal(events.includes('action:1'), false);
  clock.tick(1);
  assert.equal(events.includes('action:1'), true);
});

test('новая рука отменяет presentation events старой руки', () => {
  const { queue, clock, events } = harness();
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'BET' }) });
  queue.startHand(2);
  clock.tick(5000);

  assert.equal(events.includes('action:1'), false);
  assert.equal(queue.getState().handToken, 2);
});

test('устаревший hand token не может поставить событие в новую очередь', () => {
  const { queue, clock, events } = harness();
  queue.startHand(2);
  const accepted = queue.playAction({
    token: 1,
    playerId: 8,
    perform: () => ({ type: 'ALL_IN' })
  });
  clock.tick(5000);

  assert.equal(accepted, false);
  assert.equal(events.includes('action:8'), false);
});

test('action queue не нарушает single auto-next lifecycle controller', () => {
  const flowApi = require('../src/live/live-flow-controller.js');
  const clock = fakeClock();
  let nextHands = 0;
  const flow = flowApi.create({
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    nowFn: clock.now,
    onAutoNext: () => { nextHands += 1; }
  });
  flow.startHand();
  flow.completeHand({ id: 'completed-1' }, { autoDelay: 500 });
  flow.completeHand({ id: 'completed-duplicate' }, { autoDelay: 500 });
  clock.tick(1000);

  assert.equal(nextHands, 1);
});

test('zero-duration scheduler завершает flow без реального ожидания', () => {
  const api = loadQueue();
  const events = [];
  const queue = api.create({
    pacing: api.ZERO_DURATION_PACING,
    onPhase: event => events.push(event.phase)
  });
  queue.startHand(9);
  queue.playAction({ token: 9, playerId: 1, perform: () => ({ type: 'CALL' }) });

  assert.equal(queue.getState().pendingSteps, 0);
  assert.ok(events.includes('action-complete'));
  assert.equal(events.at(-1), 'idle');
});

test('reduced motion сокращает длительности, сохраняя порядок событий', () => {
  const api = loadQueue();
  assert.ok(api.REDUCED_MOTION_PACING.actionBadgeHoldMs > 0);
  const { queue, clock, events } = harness(api.REDUCED_MOTION_PACING);
  queue.playAction({ token: 1, playerId: 1, perform: () => ({ type: 'FOLD' }) });
  clock.tick(5000);

  assert.ok(events.indexOf('action:1') < events.indexOf('fold-visual:1'));
  assert.ok(events.indexOf('fold-visual:1') < events.indexOf('action-complete:1'));
});
