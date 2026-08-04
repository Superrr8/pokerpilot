'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createProgressStorageHarness
} = require('./progress-storage-loader.cjs');

const KEYS = {
  STORAGE_KEY: 'pokerpilot_v1_6_progress',
  PREVIOUS_STORAGE_KEY: 'pokerpilot_v1_5_1_progress',
  OLD_STORAGE_KEY: 'pokerpilot_v1_5_progress',
  LEGACY_STORAGE_KEY: 'pokerpilot_v1_4_progress'
};
const json = value => JSON.stringify(value);
const plain = value => JSON.parse(JSON.stringify(value));

test('пустой localStorage загружает неизменённый прогресс по умолчанию', () => {
  const harness = createProgressStorageHarness();
  assert.deepEqual(plain(harness.keys), KEYS);
  assert.deepEqual(plain(harness.getProgress()), {
    decisions: 0,
    scorePoints: 0,
    maxPoints: 0,
    sessions: 0,
    streak: 0,
    bestStreak: 0,
    assistMode: 'training',
    mistakes: {
      too_tight: 0,
      too_loose: 0,
      passive: 0,
      overplay: 0,
      pot_odds: 0,
      outs: 0,
      sizing: 0,
      position: 0,
      range_reading: 0
    },
    history: [],
    savedHands: [],
    learning: {
      schemaVersion: 1,
      modules: {},
      weakTopics: {},
      history: [],
      current: null,
      preferences: {
        sound: {
          enabled: true,
          volume: 0.35
        }
      }
    }
  });
});

test('сохранение и повторная загрузка сохраняют статистику, историю и слабые темы', () => {
  const first = createProgressStorageHarness();
  const progress = plain(first.getProgress());
  Object.assign(progress, {
    decisions: 12,
    scorePoints: 25,
    maxPoints: 36,
    sessions: 3,
    streak: 2,
    bestStreak: 7,
    assistMode: 'review'
  });
  progress.mistakes.pot_odds = 4;
  progress.mistakes.range_reading = 2;
  progress.history = [{
    date: '2026-07-26T12:00:00.000Z',
    mode: 'study',
    title: 'Контрольная ситуация',
    choice: 'call',
    preferred: 'call',
    grade: 'best'
  }];
  first.setProgress(progress);
  first.saveProgress();

  const stored = first.snapshot();
  const reloaded = createProgressStorageHarness({ initial: stored });
  assert.deepEqual(plain(reloaded.getProgress()), progress);
  assert.equal(first.getRenderCount(), 1);
});

test('текущий и предыдущий форматы сохраняют неизвестные допустимые поля', () => {
  for (const key of [KEYS.STORAGE_KEY, KEYS.PREVIOUS_STORAGE_KEY]) {
    const value = {
      decisions: 5,
      mistakes: { future_topic: 3 },
      futureModule: { unlocked: true }
    };
    const harness = createProgressStorageHarness({
      initial: { [key]: json(value) }
    });
    assert.deepEqual(
      plain(harness.getProgress().futureModule),
      { unlocked: true },
      key
    );
    assert.equal(harness.getProgress().mistakes.future_topic, 3, key);
    harness.saveProgress();
    assert.deepEqual(
      JSON.parse(harness.snapshot()[KEYS.STORAGE_KEY]).futureModule,
      { unlocked: true },
      key
    );
  }
});

test('старые v1.5 и v1.4 данные мигрируют по прежним правилам', () => {
  for (const key of [KEYS.OLD_STORAGE_KEY, KEYS.LEGACY_STORAGE_KEY]) {
    const old = {
      decisions: 8,
      correct: 5,
      sessions: 2,
      mistakes: { too_tight: 3 },
      history: [{ date: 'old', mode: 'ranges' }],
      ignoredLegacyField: 'not migrated'
    };
    const harness = createProgressStorageHarness({
      initial: { [key]: json(old) }
    });
    const migrated = plain(harness.getProgress());
    assert.equal(migrated.decisions, 8, key);
    assert.equal(migrated.scorePoints, 15, key);
    assert.equal(migrated.maxPoints, 24, key);
    assert.equal(migrated.sessions, 2, key);
    assert.equal(migrated.mistakes.too_tight, 3, key);
    assert.deepEqual(migrated.history, old.history, key);
    assert.equal(migrated.assistMode, 'training', key);
    assert.equal(migrated.learning.schemaVersion, 1, key);
    assert.ok(!Object.hasOwn(migrated, 'ignoredLegacyField'), key);
  }
});

test('повреждённый JSON не приводит к падению приложения', () => {
  const harness = createProgressStorageHarness({
    initial: {
      [KEYS.STORAGE_KEY]: '{broken',
      [KEYS.OLD_STORAGE_KEY]: json({ decisions: 99, correct: 99 })
    }
  });
  assert.doesNotThrow(() => harness.loadProgress());
  assert.equal(harness.getProgress().decisions, 0);
  assert.equal(harness.getProgress().scorePoints, 0);
});

test('сохранение пишет только текущий ключ и не удаляет старые ключи', () => {
  const initial = {
    [KEYS.PREVIOUS_STORAGE_KEY]: json({ decisions: 2 }),
    [KEYS.OLD_STORAGE_KEY]: json({ decisions: 1, correct: 1 }),
    [KEYS.LEGACY_STORAGE_KEY]: json({ decisions: 1, correct: 0 })
  };
  const harness = createProgressStorageHarness({ initial });
  harness.saveProgress();

  assert.ok(harness.snapshot()[KEYS.STORAGE_KEY]);
  for (const [key, value] of Object.entries(initial)) {
    assert.equal(harness.snapshot()[key], value);
  }
  assert.deepEqual(
    harness.operations.filter(([operation]) =>
      operation === 'removeItem' || operation === 'clear'
    ),
    []
  );
});

test('сброс выполняется только после существующего подтверждения', () => {
  const stored = {
    decisions: 7,
    scorePoints: 12,
    maxPoints: 21,
    mistakes: { outs: 4 },
    history: [{ date: 'saved' }]
  };
  const denied = createProgressStorageHarness({
    initial: { [KEYS.STORAGE_KEY]: json(stored) },
    confirmResult: false
  });
  denied.triggerReset();
  assert.equal(denied.getProgress().decisions, 7);
  assert.equal(
    denied.operations.filter(([operation]) => operation === 'setItem').length,
    0
  );

  const accepted = createProgressStorageHarness({
    initial: { [KEYS.STORAGE_KEY]: json(stored) },
    confirmResult: true
  });
  accepted.triggerReset();
  assert.deepEqual(
    plain(accepted.getProgress()),
    plain(accepted.defaultProgress())
  );
  assert.deepEqual(
    JSON.parse(accepted.snapshot()[KEYS.STORAGE_KEY]),
    plain(accepted.defaultProgress())
  );
});

test('обновление страницы повторно загружает сохранённые данные без потери', () => {
  const page = createProgressStorageHarness();
  const progress = plain(page.getProgress());
  progress.decisions = 17;
  progress.sessions = 4;
  progress.mistakes.position = 6;
  progress.history = [{ date: 'reload', grade: 'good' }];
  page.setProgress(progress);
  page.saveProgress();

  const refreshedPage = createProgressStorageHarness({
    initial: page.snapshot()
  });
  assert.deepEqual(plain(refreshedPage.getProgress()), progress);
});

test('storage создаёт и безопасно нормализует коллекцию savedHands', () => {
  const empty = createProgressStorageHarness();
  assert.deepEqual(plain(empty.getProgress().savedHands), []);

  for (const damaged of [null, 'broken', {}, 42]) {
    const harness = createProgressStorageHarness({
      initial: {
        [KEYS.STORAGE_KEY]: json({
          decisions: 3,
          savedHands: damaged
        })
      }
    });
    assert.deepEqual(plain(harness.getProgress().savedHands), []);
    assert.equal(harness.getProgress().decisions, 3);
  }

  const savedHands = [{ id: 'live-one', mode: 'live_cash_1_3', source: 'Live Cash $1/$3' }];
  const valid = createProgressStorageHarness({
    initial: {
      [KEYS.STORAGE_KEY]: json({ savedHands, futureField: true })
    }
  });
  assert.deepEqual(plain(valid.getProgress().savedHands), savedHands);
  assert.equal(valid.getProgress().futureField, true);
});
