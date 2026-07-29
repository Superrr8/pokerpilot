'use strict';

const baseContext = Object.freeze({
  scenarioId: 'fixture',
  mode: 'TRAINING',
  street: 'flop',
  pot: 100,
  toCall: 20,
  effectiveStack: 300
});

function scenario(id, userAction, trainer, expected) {
  return {
    id,
    input: {
      userAction,
      trainer,
      context: { ...baseContext, scenarioId: id },
      evaluatedAt: '2026-01-01T00:00:00.000Z'
    },
    expected
  };
}

module.exports = [
  scenario('exact-fold-high', 'FOLD', { actionClass: 'FOLD', confidence: 'high' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('exact-check-medium', 'CHECK', { actionClass: 'CHECK', confidence: 'medium' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('exact-call-low', 'CALL', { actionClass: 'CALL', confidence: 'low' }, { min: 90, max: 100, classification: 'EXCELLENT' }),
  scenario('exact-bet-size', { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL' }, { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL', confidence: 'high' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('exact-raise-rounding', { actionClass: 'RAISE', amount: 101, amountUnit: 'TO_TOTAL' }, { actionClass: 'RAISE', amount: 100, amountUnit: 'TO_TOTAL', confidence: 'high' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('alternative-call', 'CALL', { actionClass: 'RAISE', confidence: 'medium', alternatives: [{ actionClass: 'CALL', reason: 'Допустим контроль банка.' }] }, { min: 75, max: 92, classification: 'GOOD' }),
  scenario('alternative-check', 'CHECK', { actionClass: 'BET', confidence: 'low', isMarginal: true, alternatives: [{ actionClass: 'CHECK', reason: 'Допустим контроль банка.' }] }, { min: 75, max: 92, classification: 'GOOD' }),
  scenario('wrong-fold-high', 'FOLD', { actionClass: 'CALL', confidence: 'high' }, { min: 0, max: 49, classification: 'BLUNDER' }),
  scenario('wrong-call-high', 'CALL', { actionClass: 'FOLD', confidence: 'high' }, { min: 0, max: 49, classification: 'BLUNDER' }),
  scenario('wrong-low-confidence', 'FOLD', { actionClass: 'CALL', confidence: 'low' }, { min: 50, max: 79, classification: 'MISTAKE' }),
  scenario('wrong-marginal', 'CALL', { actionClass: 'FOLD', confidence: 'medium', isMarginal: true }, { min: 50, max: 79, classification: 'MISTAKE' }),
  scenario('bet-size-20pct', { actionClass: 'BET', amount: 60, amountUnit: 'TO_TOTAL' }, { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL', confidence: 'high' }, { min: 85, max: 96, classification: 'EXCELLENT' }),
  scenario('bet-size-40pct', { actionClass: 'BET', amount: 70, amountUnit: 'TO_TOTAL' }, { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL', confidence: 'high' }, { min: 80, max: 94, classification: 'GOOD' }),
  scenario('bet-size-large', { actionClass: 'BET', amount: 100, amountUnit: 'TO_TOTAL' }, { actionClass: 'BET', amount: 50, amountUnit: 'TO_TOTAL', confidence: 'high' }, { min: 70, max: 89, classification: 'ACCEPTABLE' }),
  scenario('call-positive-ev', 'CALL', { actionClass: 'CALL', confidence: 'high', callEV: 12, callEVMethod: 'exact' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('fold-negative-call-ev', 'FOLD', { actionClass: 'FOLD', confidence: 'high', callEV: -8, callEVMethod: 'exact' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('call-negative-ev', 'CALL', { actionClass: 'CALL', confidence: 'high', callEV: -8, callEVMethod: 'exact' }, { min: 79, max: 79, classification: 'ACCEPTABLE' }),
  scenario('fold-positive-call-ev', 'FOLD', { actionClass: 'FOLD', confidence: 'high', callEV: 8, callEVMethod: 'exact' }, { min: 79, max: 79, classification: 'ACCEPTABLE' }),
  scenario('all-in-exact', { actionClass: 'ALL_IN', amount: 120, amountUnit: 'ADDITIONAL' }, { actionClass: 'ALL_IN', amount: 120, amountUnit: 'ADDITIONAL', confidence: 'high' }, { min: 95, max: 100, classification: 'EXCELLENT' }),
  scenario('raise-alternative-sized', { actionClass: 'RAISE', amount: 90, amountUnit: 'TO_TOTAL' }, { actionClass: 'CALL', confidence: 'medium', alternatives: [{ actionClass: 'RAISE', amount: 100, reason: 'Допустимый полублеф.' }] }, { min: 75, max: 92, classification: 'GOOD' }),
  scenario('marginal-exact', 'CALL', { actionClass: 'CALL', confidence: 'medium', isMarginal: true }, { min: 90, max: 100, classification: 'EXCELLENT' }),
  scenario('low-confidence-opposite', 'BET', { actionClass: 'CHECK', confidence: 'low' }, { min: 50, max: 79, classification: 'MISTAKE' }),
  scenario('medium-confidence-opposite', 'RAISE', { actionClass: 'FOLD', confidence: 'medium' }, { min: 35, max: 69, classification: 'BLUNDER' }),
  scenario('exact-no-optional-components', 'CHECK', { actionClass: 'CHECK', confidence: 'high', callEV: null }, { min: 95, max: 100, classification: 'EXCELLENT' })
];
