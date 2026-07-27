'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgressStorageHarness } = require('./progress-storage-loader.cjs');

const STORAGE_KEY = 'pokerpilot_v1_6_progress';
const plain = value => JSON.parse(JSON.stringify(value));

test('пустое хранилище создаёт версионированный учебный прогресс в старом ключе', () => {
  const harness = createProgressStorageHarness();
  assert.equal(harness.keys.STORAGE_KEY, STORAGE_KEY);
  assert.equal(harness.getProgress().learning.schemaVersion, 1);
  harness.saveProgress();
  assert.equal(JSON.parse(harness.snapshot()[STORAGE_KEY]).learning.schemaVersion, 1);
});

test('учебный прогресс сохраняется и загружается без потери истории тренера', () => {
  const first = createProgressStorageHarness();
  const progress = plain(first.getProgress());
  progress.decisions = 9;
  progress.history = [{ mode: 'study', grade: 'best' }];
  progress.learning.modules['holdem-foundations'] = {
    completedLessons: ['foundations-goal-cards'],
    completedTasks: [],
    taskAttempts: [],
    examAttempts: [{ score: 70 }],
    bestExamScore: 70
  };
  progress.learning.history.push({ type: 'module-exam', score: 70 });
  first.setProgress(progress);
  first.saveProgress();

  const reloaded = createProgressStorageHarness({ initial: first.snapshot() });
  assert.equal(reloaded.getProgress().decisions, 9);
  assert.deepEqual(plain(reloaded.getProgress().history), progress.history);
  assert.deepEqual(plain(reloaded.getProgress().learning), progress.learning);
});

test('частично повреждённое обучение нормализуется, неизвестные поля сохраняются', () => {
  const stored = {
    decisions: 3,
    futureTrainerField: { keep: true },
    learning: {
      schemaVersion: -1,
      futureLearningField: { keep: true },
      modules: 'broken',
      weakTopics: { cards: -2, positions: 2 },
      history: 'broken'
    }
  };
  const harness = createProgressStorageHarness({
    initial: { [STORAGE_KEY]: JSON.stringify(stored) }
  });
  const loaded = plain(harness.getProgress());
  assert.deepEqual(loaded.futureTrainerField, { keep: true });
  assert.deepEqual(loaded.learning.futureLearningField, { keep: true });
  assert.equal(loaded.learning.schemaVersion, 1);
  assert.deepEqual(loaded.learning.modules, {});
  assert.deepEqual(loaded.learning.history, []);
  assert.deepEqual(loaded.learning.weakTopics, { positions: 2 });
});
