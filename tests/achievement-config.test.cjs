'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

let Config = null;
let loadError = null;
try {
  Config = require('../src/progress/achievement-config.js');
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(Config);
  return Config;
}

const REQUIRED_IDS = [
  'FIRST_STEP',
  'QUICK_LEARNER',
  'DECISION_MAKER',
  'SHARP_MIND',
  'POKER_STUDENT',
  'ON_A_ROLL',
  'DEDICATED',
  'EXAM_READY',
  'HIGH_ACHIEVER',
  'CENTURY_CLUB'
];

test('каталог содержит стабильные уникальные achievement IDs', () => {
  const config = api();
  assert.deepEqual(config.ACHIEVEMENT_IDS, REQUIRED_IDS);
  assert.equal(new Set(config.ACHIEVEMENT_IDS).size, REQUIRED_IDS.length);
  assert.equal(config.ACHIEVEMENTS.length, REQUIRED_IDS.length);
});

test('каждое достижение содержит локализованную метаинформацию и condition contract', () => {
  const config = api();
  for (const item of config.ACHIEVEMENTS) {
    assert.match(item.id, /^[A-Z][A-Z0-9_]+$/);
    assert.ok(item.title.trim(), item.id);
    assert.ok(item.description.trim(), item.id);
    assert.ok(item.iconKey.trim(), item.id);
    assert.ok(config.CATEGORIES.includes(item.category), item.id);
    assert.ok(config.RARITIES.includes(item.rarity), item.id);
    assert.equal(typeof item.hidden, 'boolean', item.id);
    assert.ok(item.condition && typeof item.condition.metric === 'string', item.id);
  }
});

test('условия каталога совпадают с контрактом Stage 9.5', () => {
  const byId = Object.fromEntries(api().ACHIEVEMENTS.map(item => [item.id, item]));
  assert.deepEqual(byId.FIRST_STEP.condition, { metric: 'trainingScenarios', comparator: 'gte', target: 1 });
  assert.equal(byId.QUICK_LEARNER.condition.target, 10);
  assert.equal(byId.DECISION_MAKER.condition.target, 25);
  assert.equal(byId.SHARP_MIND.condition.target, 60);
  assert.equal(byId.POKER_STUDENT.condition.target, 5);
  assert.equal(byId.ON_A_ROLL.condition.target, 3);
  assert.equal(byId.DEDICATED.condition.target, 7);
  assert.equal(byId.EXAM_READY.condition.target, 1);
  assert.deepEqual(byId.HIGH_ACHIEVER.condition, {
    metric: 'rank',
    comparator: 'rankAbove',
    target: 'INTERMEDIATE'
  });
  assert.equal(byId.CENTURY_CLUB.condition.target, 100);
});

test('Stage 9.6 использует только COMMON, RARE, EPIC и LEGENDARY без изменения условий', () => {
  const config = api();
  assert.deepEqual(config.RARITIES, ['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
  assert.deepEqual(Object.fromEntries(config.ACHIEVEMENTS.map(item => [item.id, item.rarity])), {
    FIRST_STEP: 'COMMON',
    QUICK_LEARNER: 'COMMON',
    DECISION_MAKER: 'RARE',
    SHARP_MIND: 'EPIC',
    POKER_STUDENT: 'RARE',
    ON_A_ROLL: 'RARE',
    DEDICATED: 'EPIC',
    EXAM_READY: 'RARE',
    HIGH_ACHIEVER: 'EPIC',
    CENTURY_CLUB: 'LEGENDARY'
  });
  assert.deepEqual(config.BY_ID.FIRST_STEP.condition, {
    metric: 'trainingScenarios', comparator: 'gte', target: 1
  });
  assert.deepEqual(config.BY_ID.HIGH_ACHIEVER.condition, {
    metric: 'rank', comparator: 'rankAbove', target: 'INTERMEDIATE'
  });
});

test('getAchievementCatalog возвращает независимую read-only проекцию каталога', () => {
  const config = api();
  assert.equal(typeof config.getAchievementCatalog, 'function');
  const catalog = config.getAchievementCatalog();
  catalog[0].title = 'Изменено снаружи';
  catalog[0].condition.target = 999;
  assert.equal(config.BY_ID.FIRST_STEP.title, 'Первый шаг');
  assert.equal(config.BY_ID.FIRST_STEP.condition.target, 1);
});
