'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadPostflopScenarios } = require('./postflop-scenarios-loader.cjs');

const EXPECTED_IDS = [
  'river-aj-bluffcatch',
  'flop-kk-value',
  'turn-aq-nit',
  'flop-nfd',
  'flop-oesd',
  'river-thin-value',
  'turn-top-pair-control',
  'flop-set-wet',
  'river-flush-value',
  'flop-underpair',
  'turn-two-pair-raise',
  'river-missed-draw',
  'turn-combo-draw',
  'river-overbet',
  'turn-nfd-price',
  'flop-gutshot-overs',
  'turn-set-connected',
  'river-qq-aggro'
];
const EXPECTED_CONTENT_SHA256 =
  'd298392cf1ffdc9524f346990c5b26e7bd8cf0dc6a3dc946c59e48726f661189';
const REQUIRED_FIELDS = [
  'id', 'title', 'category', 'position', 'hero', 'board', 'potBefore', 'bet',
  'villain', 'range', 'text', 'actions', 'grades', 'summary', 'key', 'missed',
  'rangeNote', 'why', 'alternative'
];

const scenarios = loadPostflopScenarios();

test('контракт содержит ровно 18 постфлоп-сценариев в прежнем порядке', () => {
  assert.equal(scenarios.length, 18);
  assert.deepEqual(
    Array.from(scenarios, scenario => scenario.id),
    EXPECTED_IDS
  );
});

test('каждый постфлоп-сценарий сохраняет обязательные поля', () => {
  for (const scenario of scenarios) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(
        Object.hasOwn(scenario, field),
        `${scenario.id}: missing field ${field}`
      );
    }
    assert.equal(scenario.hero.length, 2, `${scenario.id}: hero cards`);
    assert.ok(
      scenario.board.length >= 3 && scenario.board.length <= 5,
      `${scenario.id}: board cards`
    );
    assert.equal(typeof scenario.potBefore, 'number', `${scenario.id}: potBefore`);
    assert.equal(typeof scenario.bet, 'number', `${scenario.id}: bet`);
    assert.ok(Array.isArray(scenario.actions), `${scenario.id}: actions`);
    assert.equal(typeof scenario.grades, 'object', `${scenario.id}: grades`);
    for (const action of scenario.actions) {
      assert.ok(
        Object.hasOwn(scenario.grades, action),
        `${scenario.id}: missing grade for ${action}`
      );
    }
  }
});

test('полный снимок карт, размеров, действий, объяснений и остальных полей неизменен', () => {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify(scenarios))
    .digest('hex');
  assert.equal(digest, EXPECTED_CONTENT_SHA256);
});
