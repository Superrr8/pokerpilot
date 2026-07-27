'use strict';

const HANDS = Object.freeze({
  AA: 'As Ah',
  QQ: 'Qs Qh',
  JJ: 'Js Jh',
  TT: 'Ts Th',
  '99': '9s 9h',
  AKs: 'As Ks',
  AKo: 'Ah Kd',
  AQs: 'Ah Qh',
  AQo: 'Ah Qd',
  AJs: 'Ah Jh',
  AJo: 'Ah Jd',
  ATs: 'Ah Th',
  A9s: 'Ah 9h',
  A5s: 'Ah 5h',
  KQo: 'Kh Qd',
  KJo: 'Kh Jd',
  KTs: 'Kh Th',
  QJs: 'Qh Jh',
  '76s': '7h 6h',
  '72o': '7h 2d',
  K9o: 'Kh 9d'
});

const preflopScenarios = [];
const addPreflop = (id, group, overrides, meta = {}) => {
  preflopScenarios.push({
    id: `pre-${id}`,
    group,
    input: {
      street: 'preflop',
      position: 'CO',
      opponentPosition: 'UTG',
      situation: 'vs_raise_early',
      hero: HANDS.AQs,
      board: '',
      pot: 19,
      bet: 12,
      stack: 300,
      opponents: 1,
      villain: 'reg',
      customRange: '',
      notes: '',
      ...overrides
    },
    context: { limpers: 1, opener: 'early', ...(meta.context || {}) },
    ...meta
  });
};

for (const position of ['UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB']) {
  for (const hand of ['AA', 'AJo', 'KQo', 'K9o', 'A5s', '72o']) {
    addPreflop(
      `open-${position}-${hand}`,
      'position-open',
      {
        position,
        opponentPosition: null,
        situation: 'firstin',
        hero: HANDS[hand],
        pot: 4,
        bet: 0
      },
      {
        hand,
        position,
        golden: hand === 'AA' ? 'RAISE' : hand === '72o' ? 'FOLD' : null
      }
    );
  }
}

for (const opponentPosition of ['UTG', 'MP', 'BTN']) {
  for (const hand of ['AA', 'AQs', 'AQo', 'KQo', 'KJo', 'A5s', '99', '72o']) {
    addPreflop(
      `bb-defense-${opponentPosition}-${hand}`,
      'bb-defense',
      {
        position: 'BB',
        opponentPosition,
        situation: 'blind_defense',
        hero: HANDS[hand]
      },
      {
        hand,
        opponentPosition,
        context: { opener: opponentPosition === 'BTN' ? 'late' : 'early' },
        golden: hand === 'AA'
          ? 'RAISE'
          : hand === '72o'
            ? 'FOLD'
            : hand === 'KQo'
              ? opponentPosition === 'BTN' ? 'CALL' : 'FOLD'
              : null
      }
    );
  }
}

for (const villain of ['nit', 'reg', 'wild', 'aggro']) {
  for (const hand of ['KQo', 'KJo', 'ATs', 'AQs', 'AA']) {
    addPreflop(
      `profile-${villain}-${hand}`,
      'villain-profile',
      { villain, hero: HANDS[hand] },
      {
        hand,
        villain,
        golden: hand === 'AA'
          ? 'RAISE'
          : hand === 'KQo'
            ? ['wild', 'aggro'].includes(villain) ? 'CALL' : 'FOLD'
            : null
      }
    );
  }
}

for (const opponents of [1, 3]) {
  for (const hand of ['AA', 'AJs', 'KTs', '76s', '72o']) {
    addPreflop(
      `opponents-${opponents}-${hand}`,
      'heads-up-multiway',
      {
        position: 'HJ',
        opponentPosition: null,
        situation: 'limpers',
        hero: HANDS[hand] || 'Ah Jh',
        pot: opponents === 1 ? 10 : 16,
        bet: 0,
        opponents,
        villain: 'passive'
      },
      {
        hand,
        opponents,
        context: { limpers: 1 },
        comparison: `iso-opponents-${hand}`,
        order: opponents
      }
    );
  }
}

for (const limpers of [1, 2, 3, 4]) {
  for (const hand of ['AJs', 'KQo', '72o']) {
    addPreflop(
      `limpers-${limpers}-${hand}`,
      'limper-count',
      {
        position: 'CO',
        opponentPosition: null,
        situation: 'limpers',
        hero: HANDS[hand] || 'Ah Jh',
        pot: 7 + limpers * 3,
        bet: 0,
        opponents: limpers,
        villain: 'passive'
      },
      {
        hand,
        limpers,
        context: { limpers },
        comparison: `limper-size-${hand}`,
        order: limpers
      }
    );
  }
}

const stackTemplates = [
  { name: 'aks-vs3bet', hero: HANDS.AKs, situation: 'vs_3bet', bet: 30 },
  { name: 'aqs-vs3bet', hero: HANDS.AQs, situation: 'vs_3bet', bet: 30 },
  { name: '99-vs3bet', hero: HANDS['99'], situation: 'vs_3bet', bet: 30 },
  { name: 'qq-vs-open', hero: HANDS.QQ, situation: 'vs_raise_early', bet: 12 },
  {
    name: 'kqo-bb',
    hero: HANDS.KQo,
    position: 'BB',
    opponentPosition: 'BTN',
    situation: 'blind_defense',
    bet: 12
  }
];
for (const stackBB of [15, 20, 30, 50, 100, 200]) {
  for (const template of stackTemplates) {
    addPreflop(
      `stack-${stackBB}bb-${template.name}`,
      'effective-stack',
      {
        position: template.position || 'CO',
        opponentPosition: Object.hasOwn(template, 'opponentPosition')
          ? template.opponentPosition
          : null,
        situation: template.situation,
        hero: template.hero,
        pot: template.situation === 'vs_3bet' ? 45 : 19,
        bet: template.bet,
        stack: stackBB * 3
      },
      {
        stackBB,
        template: template.name,
        context: { opener: template.opponentPosition === 'BTN' ? 'late' : 'early' },
        comparison: `stack-${template.name}`,
        order: stackBB
      }
    );
  }
}

for (const bet of [6, 12, 24]) {
  for (const hand of ['AA', 'AQs', '72o']) {
    addPreflop(
      `open-size-${bet}-${hand}`,
      'opening-size',
      { hero: HANDS[hand], bet, pot: 7 + bet },
      {
        hand,
        openingSize: bet,
        comparison: `opening-size-${hand}`,
        order: bet
      }
    );
  }
}

for (const bet of [18, 45]) {
  for (const hand of ['AKs', 'AQs', '99']) {
    addPreflop(
      `threebet-size-${bet}-${hand}`,
      'threebet-size',
      {
        opponentPosition: null,
        situation: 'vs_3bet',
        hero: HANDS[hand],
        pot: 15 + bet,
        bet,
        stack: 300
      },
      {
        hand,
        threebetSize: bet,
        comparison: `threebet-size-${hand}`,
        order: bet
      }
    );
  }
}

for (const [index, villain] of [null, '', 'mystery-player'].entries()) {
  addPreflop(
    `unknown-${index}`,
    'unknown-default',
    { villain, hero: HANDS.KQo },
    { neutralDefault: true }
  );
}
for (const [index, customRange] of ['AA,KK', '22+,AJs+', 'AQo+,KQs'].entries()) {
  addPreflop(
    `custom-range-${index}`,
    'custom-range',
    { customRange, hero: HANDS.AQs },
    { customRangeDisclosure: true }
  );
}
for (const [left, right] of [
  ['AQo', 'AJo'],
  ['AJo', 'ATs'],
  ['KQo', 'KJo']
]) {
  for (const hand of [left, right]) {
    addPreflop(
      `near-${left}-${right}-${hand}`,
      'near-hand',
      { hero: HANDS[hand], villain: 'reg' },
      { hand, comparison: `near-${left}-${right}`, order: hand === left ? 1 : 2 }
    );
  }
}

const POST_CONFIGS = Object.freeze({
  flopPair: {
    street: 'flop',
    hero: 'Ah Qh',
    board: 'Qd 7c 2s',
    customRange: 'KQs,QJs'
  },
  turnPair: {
    street: 'turn',
    hero: 'Ah Qh',
    board: 'Qd 7c 2s 9h',
    customRange: 'KQs,QJs'
  },
  riverPair: {
    street: 'river',
    hero: 'Ah Qh',
    board: 'Qd 7c 2s 9h 3c',
    customRange: 'KQs,QJs'
  },
  flopDraw: {
    street: 'flop',
    hero: 'As Ks',
    board: 'Qs 7s 2d',
    customRange: 'QQ,KQs'
  },
  turnDraw: {
    street: 'turn',
    hero: 'As Ks',
    board: 'Qs 7s 2d 9h',
    customRange: 'QQ,KQs'
  },
  riverMissedDraw: {
    street: 'river',
    hero: 'As Ks',
    board: 'Qs 7s 2d 9h 3c',
    customRange: 'QQ,KQs'
  },
  flopSet: {
    street: 'flop',
    hero: '9s 9h',
    board: '9d 7c 2s',
    customRange: 'A9s,K9s'
  },
  turnStraight: {
    street: 'turn',
    hero: '9h 8h',
    board: '7c 6d 5s 2h',
    customRange: 'AA,KK'
  },
  riverNuts: {
    street: 'river',
    hero: 'As Ks',
    board: 'Qs Js Ts 2d 3c',
    customRange: '99-77,AQo,KQo'
  },
  riverBluffCatch: {
    street: 'river',
    hero: 'Ah Jh',
    board: 'Jd 8c 4s 9h 2d',
    customRange: 'JJ,99,88,44,22,J9s,KJs,QJs,JTs'
  },
  riverThin: {
    street: 'river',
    hero: 'Ah Jd',
    board: 'Js 8c 4s 9h 2d',
    customRange: 'KJs,QJs,JTs,TT-77,A8s,A9s,JJ,99,88,44,22,J9s'
  },
  riverWeak: {
    street: 'river',
    hero: '8c 8d',
    board: 'As Kh Qh 2s 3c',
    customRange: 'AKs,AQs,KQs,JJ-TT'
  },
  riverOverpair: {
    street: 'river',
    hero: 'Kh Kd',
    board: 'Ts 7d 3c 4h 2s',
    customRange: '22-99,ATs,KTs,QTs,JTs,ATo,KTo,QTo,JTo'
  },
  riverTie: {
    street: 'river',
    hero: '2c 3d',
    board: 'As Ks Qs Js Ts',
    customRange: '22-99,AQo,KQo'
  }
});

const postflopScenarios = [];
const addPostflop = (id, group, config, overrides = {}, meta = {}) => {
  postflopScenarios.push({
    id: `post-${id}`,
    group,
    input: {
      position: 'CO',
      opponentPosition: 'BB',
      situation: 'checked_to',
      pot: 100,
      bet: 0,
      stack: 300,
      opponents: 1,
      villain: 'reg',
      notes: '',
      ...config,
      ...overrides
    },
    ...meta
  });
};

for (const [street, configs] of Object.entries({
  flop: ['flopPair', 'flopDraw', 'flopSet', 'riverWeak'],
  turn: ['turnPair', 'turnDraw', 'turnStraight', 'riverWeak'],
  river: ['riverPair', 'riverMissedDraw', 'riverNuts', 'riverWeak']
})) {
  for (const [index, name] of configs.entries()) {
    const source = POST_CONFIGS[name];
    const streetConfig = source.street === street
      ? source
      : street === 'flop'
        ? { ...source, street, board: 'As Kh Qh', customRange: 'AKs,AQs' }
        : { ...source, street, board: 'As Kh Qh 2s', customRange: 'AKs,AQs' };
    addPostflop(
      `street-${street}-${index}`,
      'street-coverage',
      streetConfig,
      {
        situation: index === 3 ? 'facing_raise' : index % 2 ? 'facing_bet' : 'checked_to',
        bet: index % 2 ? 30 : 0
      },
      { street }
    );
  }
}

for (const [caseName, config] of [
  ['draw', POST_CONFIGS.flopDraw],
  ['pair', POST_CONFIGS.flopPair],
  ['turn-draw', POST_CONFIGS.turnDraw],
  ['river-bluff', POST_CONFIGS.riverBluffCatch]
]) {
  for (const position of ['BTN', 'BB']) {
    addPostflop(
      `hero-position-${caseName}-${position}`,
      'hero-position',
      config,
      {
        position,
        opponentPosition: 'CO',
        situation: caseName === 'river-bluff' ? 'after_check' : 'checked_to',
        bet: caseName === 'river-bluff' ? 80 : 0
      },
      {
        comparison: `hero-position-${caseName}`,
        order: position === 'BTN' ? 1 : 2
      }
    );
  }
}

for (const [caseName, config] of [
  ['draw', POST_CONFIGS.flopDraw],
  ['pair', POST_CONFIGS.flopPair],
  ['turn-draw', POST_CONFIGS.turnDraw],
  ['river-bluff', POST_CONFIGS.riverBluffCatch]
]) {
  for (const opponentPosition of ['HJ', 'BTN']) {
    addPostflop(
      `opponent-position-${caseName}-${opponentPosition}`,
      'opponent-position',
      config,
      {
        position: 'CO',
        opponentPosition,
        situation: caseName === 'river-bluff' ? 'after_check' : 'checked_to',
        bet: caseName === 'river-bluff' ? 80 : 0
      },
      {
        comparison: `opponent-position-${caseName}`,
        order: opponentPosition === 'HJ' ? 1 : 2
      }
    );
  }
}

for (const villain of ['nit', 'reg', 'wild', 'passive', 'aggro', 'station']) {
  for (const [caseName, config, situation, bet] of [
    ['bluff-catch', POST_CONFIGS.riverBluffCatch, 'after_check', 80],
    ['thin-value', POST_CONFIGS.riverThin, 'checked_to', 0],
    ['weak-overbet', POST_CONFIGS.riverWeak, 'facing_bet', 160],
    ['nuts', POST_CONFIGS.riverNuts, 'checked_to', 0]
  ]) {
    addPostflop(
      `profile-${villain}-${caseName}`,
      'villain-profile',
      config,
      { villain, situation, bet, pot: 160 },
      {
        villain,
        caseName,
        comparison: `post-profile-${caseName}`,
        order: ['nit', 'passive', 'reg', 'station', 'aggro', 'wild'].indexOf(villain)
      }
    );
  }
}

for (const [caseName, config] of [
  ['overpair', POST_CONFIGS.riverOverpair],
  ['thin', POST_CONFIGS.riverThin],
  ['nuts', POST_CONFIGS.riverNuts],
  ['pair', POST_CONFIGS.riverPair],
  ['tie', POST_CONFIGS.riverTie]
]) {
  for (const [sprBand, stack] of [['low', 80], ['medium', 300], ['high', 800]]) {
    addPostflop(
      `spr-${caseName}-${sprBand}`,
      'spr',
      config,
      {
        situation: 'checked_to',
        pot: 100,
        bet: 0,
        stack,
        villain: caseName === 'thin' ? 'station' : 'reg'
      },
      {
        sprBand,
        comparison: `spr-${caseName}`,
        order: stack
      }
    );
  }
}

for (const [caseName, config] of [
  ['bluff-catch', POST_CONFIGS.riverBluffCatch],
  ['weak', POST_CONFIGS.riverWeak],
  ['pair', POST_CONFIGS.riverPair],
  ['tie', POST_CONFIGS.riverTie],
  ['nuts', POST_CONFIGS.riverNuts]
]) {
  for (const bet of [20, 60, 120, 240]) {
    addPostflop(
      `bet-size-${caseName}-${bet}`,
      'bet-size',
      config,
      {
        situation: 'facing_bet',
        pot: 120,
        bet,
        stack: 300,
        villain: 'reg'
      },
      {
        bet,
        comparison: `bet-size-${caseName}`,
        order: bet
      }
    );
  }
}

for (const [caseName, config, strength] of [
  ['top-pair', POST_CONFIGS.riverPair, 'one-pair'],
  ['overpair', POST_CONFIGS.riverOverpair, 'one-pair'],
  ['bluff-catch', POST_CONFIGS.riverBluffCatch, 'one-pair'],
  ['nuts', POST_CONFIGS.riverNuts, 'nuts'],
  ['weak', POST_CONFIGS.riverWeak, 'weak']
]) {
  for (const opponents of [1, 2, 3]) {
    addPostflop(
      `multiway-${caseName}-${opponents}`,
      'multiway',
      config,
      {
        customRange: caseName === 'top-pair'
          ? 'KQs,QJs,QTs,JJ-77,AQo,KQo'
          : config.customRange,
        situation: caseName === 'bluff-catch' || caseName === 'weak'
          ? 'facing_bet'
          : 'checked_to',
        bet: caseName === 'bluff-catch' || caseName === 'weak' ? 60 : 0,
        pot: 120,
        opponents
      },
      {
        opponents,
        strength,
        complexMultiway: opponents > 1 && strength !== 'nuts',
        comparison: `multiway-${caseName}`,
        order: opponents
      }
    );
  }
}

for (const [texture, config] of [
  ['dry', POST_CONFIGS.flopPair],
  ['connected', { street: 'flop', hero: 'Ah Qh', board: 'Qd Js Tc', customRange: 'KQs,QJs' }],
  ['paired', { street: 'flop', hero: 'As Ks', board: 'Qs 7s 7d', customRange: 'QQ,KQs' }],
  ['monotone', { street: 'flop', hero: 'Qs Qd', board: 'Jh 8h 4h', customRange: 'KJs,JTs' }]
]) {
  for (const villain of ['reg', 'nit']) {
    addPostflop(
      `texture-${texture}-${villain}`,
      'board-texture',
      config,
      { situation: 'checked_to', pot: 80, bet: 0, villain },
      { texture, villain, comparison: `texture-${villain}`, order: texture }
    );
  }
}

for (const [handName, config] of [
  ['two-pair', { street: 'river', hero: 'As Qd', board: 'Ah Qs 7c 4h 2d', customRange: 'AJo,KQs' }],
  ['set', { street: 'river', hero: '9s 9h', board: '9d 7c 2s 4h 3d', customRange: 'A9s,K9s' }],
  ['straight', { street: 'river', hero: '9h 8h', board: '7c 6d 5s 2h Kd', customRange: 'AA,KK' }],
  ['flush', { street: 'river', hero: 'As Ks', board: 'Qs 7s 2s 9h 3c', customRange: 'QQ,77' }],
  ['full-house', { street: 'river', hero: '9s 9h', board: '9d 7c 7s 4h 2d', customRange: 'A7s,K7s' }],
  ['quads', { street: 'river', hero: '7s 7h', board: '7d 7c 2s 4h 3d', customRange: 'AA,KK' }],
  ['nut-straight-flush', POST_CONFIGS.riverNuts]
]) {
  addPostflop(
    `made-${handName}`,
    'made-hands',
    config,
    { situation: 'checked_to', pot: 120, bet: 0, villain: 'station' },
    { handName, golden: 'BET' }
  );
}

for (const [drawName, config, villain] of [
  ['flush', POST_CONFIGS.flopDraw, 'reg'],
  ['straight', { street: 'flop', hero: '9h 8h', board: '7c 6d Ks', customRange: 'AKs,KK' }, 'reg'],
  ['combo', { street: 'flop', hero: 'Js Ts', board: '9s 8s 2d', customRange: '99,A9s' }, 'aggro'],
  ['dirty', { street: 'flop', hero: 'As Ks', board: 'Qs 7s 7d', customRange: '77,QQ' }, 'nit']
]) {
  addPostflop(
    `draw-${drawName}`,
    'draws',
    config,
    { situation: 'facing_bet', pot: 100, bet: 40, villain },
    { drawName }
  );
}

for (const [band, bet, villain] of [
  ['positive', 40, 'aggro'],
  ['near-zero', 80, 'reg'],
  ['negative', 160, 'passive']
]) {
  addPostflop(
    `river-ev-${band}`,
    'river-ev',
    POST_CONFIGS.riverBluffCatch,
    { situation: 'after_check', pot: 160, bet, villain },
    { evBand: band, comparison: 'river-ev', order: bet }
  );
}

for (const [order, texture, board] of [
  [1, 'dry', 'Jh 7c 2s'],
  [2, 'connected', 'Jh Tc 9s'],
  [3, 'paired', 'Jh 7c 7s'],
  [4, 'monotone', 'Jh 8h 4h']
]) {
  addPostflop(
    `one-pair-texture-${texture}`,
    'one-pair-texture-comparison',
    {
      street: 'flop',
      hero: 'Qs Qd',
      board,
      customRange: 'AKs,KJs'
    },
    { situation: 'checked_to', pot: 80, bet: 0, villain: 'reg' },
    { texture, comparison: 'one-pair-texture', order }
  );
}

addPostflop(
  'deterministic-monte-carlo',
  'determinism',
  {
    street: 'flop',
    hero: 'Ah Ad',
    board: 'Ks 7d 2c',
    customRange: 'KQs,QQ-JJ'
  },
  {
    position: 'BTN',
    opponentPosition: 'BB',
    situation: 'checked_to',
    pot: 90,
    bet: 0,
    stack: 270,
    opponents: 2,
    villain: 'reg'
  },
  { deterministicMonteCarlo: true, complexMultiway: true }
);

addPostflop(
  'positive-call-ev-contextual-fold',
  'explanation-consistency',
  {
    street: 'flop',
    hero: 'As Ks',
    board: 'Qs 7s 7d',
    customRange: '77,QQ,AQs,KQs,QJs,76s,87s'
  },
  {
    position: 'BTN',
    opponentPosition: 'BB',
    situation: 'facing_bet',
    pot: 100,
    bet: 60,
    stack: 240,
    opponents: 1,
    villain: 'nit'
  },
  { positiveEvFoldExplanation: true }
);

module.exports = {
  HANDS,
  POST_CONFIGS,
  preflopScenarios,
  postflopScenarios
};
