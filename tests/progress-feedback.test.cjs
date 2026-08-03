'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const modulePath = path.join(root, 'src', 'progress', 'progress-feedback.js');
let Feedback = null;
let loadError = null;
try {
  Feedback = require(modulePath);
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(Feedback);
  return Feedback;
}

function result(overrides = {}) {
  return {
    applied: true,
    duplicate: false,
    event: { id: 'event-1', type: 'TRAINING_SCENARIO_COMPLETED' },
    transition: {
      xp: { gained: 15, previous: 0, current: 15 },
      level: { previous: 1, current: 1, leveledUp: false },
      rank: {
        previous: { id: 'UNRANKED', label: 'Без ранга' },
        current: { id: 'UNRANKED', label: 'Без ранга' },
        rankedUp: false
      },
      achievements: { newlyUnlocked: [] }
    },
    ...overrides
  };
}

function scheduler() {
  const jobs = [];
  return {
    schedule(callback) {
      jobs.push(callback);
      return callback;
    },
    cancel(callback) {
      const index = jobs.indexOf(callback);
      if (index >= 0) jobs.splice(index, 1);
    },
    runNext() {
      const callback = jobs.shift();
      if (callback) callback();
    },
    get size() {
      return jobs.length;
    }
  };
}

test('structured result создаёт компактное XP notification ровно один раз', () => {
  const items = api().notificationsFromResult(result());
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'xp');
  assert.equal(items[0].title, '+15 XP');
  assert.equal(items[0].id, 'event-1:xp');
});

test('achievement, level-up и rank-up используют только transition data', () => {
  const items = api().notificationsFromResult(result({
    transition: {
      xp: { gained: 60, previous: 490, current: 550 },
      level: { previous: 1, current: 2, leveledUp: true },
      rank: {
        previous: { id: 'INTERMEDIATE', label: 'Средний уровень' },
        current: { id: 'ADVANCED', label: 'Продвинутый' },
        rankedUp: true
      },
      achievements: {
        newlyUnlocked: [{
          id: 'FIRST_STEP', title: 'Первый шаг', description: 'Первая тренировка.',
          iconKey: 'spark', rarity: 'common'
        }]
      }
    }
  }));
  assert.deepEqual(items.map(item => item.kind), ['xp', 'achievement', 'level', 'rank']);
  assert.match(items[1].eyebrow, /Достижение открыто/);
  assert.match(items[2].description, /Level 1.*Level 2/);
  assert.match(items[3].description, /Средний уровень.*Продвинутый/);
});

test('duplicate или unapplied event не создаёт feedback', () => {
  assert.deepEqual(api().notificationsFromResult(result({ applied: false, duplicate: true })), []);
  assert.deepEqual(api().notificationsFromResult(result({ applied: false, duplicate: false })), []);
});

test('queue показывает multiple unlocks последовательно без потерь', () => {
  const clock = scheduler();
  const shown = [];
  const hidden = [];
  const queue = api().createQueue({
    schedule: callback => clock.schedule(callback),
    cancel: callback => clock.cancel(callback),
    onShow: item => shown.push(item.id),
    onHide: item => hidden.push(item.id),
    onClear: () => {},
    holdMs: 100,
    exitMs: 20
  });
  queue.consume(result({
    transition: {
      xp: { gained: 0, previous: 0, current: 0 },
      level: { previous: 1, current: 1, leveledUp: false },
      rank: { previous: {}, current: {}, rankedUp: false },
      achievements: {
        newlyUnlocked: [
          { id: 'FIRST_STEP', title: 'Первый шаг', description: 'A', iconKey: 'spark', rarity: 'common' },
          { id: 'CENTURY_CLUB', title: 'Клуб 100', description: 'B', iconKey: 'chips', rarity: 'rare' }
        ]
      }
    }
  }));
  assert.deepEqual(shown, ['event-1:achievement:FIRST_STEP']);
  clock.runNext();
  assert.deepEqual(hidden, ['event-1:achievement:FIRST_STEP']);
  clock.runNext();
  assert.deepEqual(shown, [
    'event-1:achievement:FIRST_STEP',
    'event-1:achievement:CENTURY_CLUB'
  ]);
  clock.runNext();
  clock.runNext();
  assert.equal(queue.getState().active, null);
  assert.equal(queue.getState().pending, 0);
});

test('повторная доставка результата и subscription rerender не переигрывают уведомления', () => {
  const clock = scheduler();
  const shown = [];
  const queue = api().createQueue({
    schedule: callback => clock.schedule(callback),
    cancel: callback => clock.cancel(callback),
    onShow: item => shown.push(item.id),
    onHide: () => {},
    onClear: () => {},
    holdMs: 100,
    exitMs: 0
  });
  assert.equal(queue.consume(result()), 1);
  assert.equal(queue.consume(result()), 0);
  assert.deepEqual(shown, ['event-1:xp']);
});

test('rapid events сохраняются в очереди, destroy очищает timers и DOM lifecycle', () => {
  const clock = scheduler();
  const cleared = [];
  const queue = api().createQueue({
    schedule: callback => clock.schedule(callback),
    cancel: callback => clock.cancel(callback),
    onShow: () => {},
    onHide: () => {},
    onClear: item => cleared.push(item?.id || null),
    holdMs: 100,
    exitMs: 20
  });
  queue.consume(result());
  queue.consume(result({ event: { id: 'event-2', type: 'EXAM_COMPLETED' } }));
  assert.equal(queue.getState().pending, 1);
  queue.destroy();
  assert.equal(clock.size, 0);
  assert.deepEqual(queue.getState(), { active: null, pending: 0, destroyed: true });
  assert.ok(cleared.length >= 1);
});

test('reduced motion сохраняет последовательность с нулевой exit duration', () => {
  const clock = scheduler();
  const shown = [];
  const queue = api().createQueue({
    schedule: callback => clock.schedule(callback),
    cancel: callback => clock.cancel(callback),
    onShow: item => shown.push(item.id),
    onHide: () => {},
    onClear: () => {},
    reducedMotion: true,
    holdMs: 100,
    exitMs: 220
  });
  queue.consume(result());
  queue.consume(result({ event: { id: 'event-2', type: 'EXAM_COMPLETED' } }));
  clock.runNext();
  clock.runNext();
  assert.deepEqual(shown, ['event-1:xp', 'event-2:xp']);
});

test('browser contract подключает non-blocking aria-live feedback и reduced-motion CSS', () => {
  api();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const cssPath = path.join(root, 'src', 'styles', 'progress-feedback.css');
  const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  assert.match(html, /id="progressFeedback"[^>]+aria-live="polite"/);
  assert.match(html, /src\/progress\/progress-feedback\.js/);
  assert.match(html, /src\/styles\/progress-feedback\.css/);
  assert.match(html, /onResult:\s*result\s*=>\s*progressFeedback\.consume\(result\)/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
