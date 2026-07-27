'use strict';

const preflopHands = [
  {
    id: 'early-open-aqs',
    title: 'Open raise AQs из UTG',
    input: { street: 'preflop', position: 'UTG', situation: 'firstin', hero: 'As Qs', pot: 4, bet: 0, stack: 300, opponents: 1, villain: 'reg', customRange: '', notes: '' },
    context: {},
    expected: { action: 'raise', alternatives: ['fold'], sizeRange: [10, 14], confidence: ['высокая'], math: null },
    assumptions: ['Базовый exploit-диапазон live $1/$3', 'Все игроки до UTG выбросили'],
    boundary: false
  },
  {
    id: 'button-open-a5s',
    title: 'Open raise A5s с BTN',
    input: { street: 'preflop', position: 'BTN', situation: 'firstin', hero: 'As 5s', pot: 4, bet: 0, stack: 300, opponents: 1, villain: 'reg', customRange: '', notes: '' },
    context: {},
    expected: { action: 'raise', alternatives: ['fold'], sizeRange: [10, 14], confidence: ['высокая'], math: null },
    assumptions: ['До BTN все выбросили', 'Блайнды соответствуют базовой live-модели'],
    boundary: false
  },
  {
    id: 'isolate-one-limper-kqs',
    title: 'Изоляция одного лимпера с KQs',
    input: { street: 'preflop', position: 'HJ', situation: 'limpers', hero: 'Ks Qs', pot: 7, bet: 0, stack: 300, opponents: 1, villain: 'passive', customRange: '', notes: '' },
    context: { limpers: 1 },
    expected: { action: 'raise', alternatives: ['call'], sizeRange: [14, 17], confidence: ['высокая'], math: null },
    assumptions: ['Один пассивный лимпер', 'Игроки за спиной не заданы отдельно'],
    boundary: false
  },
  {
    id: 'isolate-three-limpers-ajs',
    title: 'Изоляция нескольких лимперов с AJs',
    input: { street: 'preflop', position: 'CO', situation: 'limpers', hero: 'Ah Jh', pot: 13, bet: 0, stack: 300, opponents: 3, villain: 'passive', customRange: '', notes: '' },
    context: { limpers: 3 },
    expected: { action: 'raise', alternatives: ['call'], sizeRange: [19, 23], confidence: ['высокая'], math: null },
    assumptions: ['Три лимпера', 'Live-изолейт увеличивается на $3 за дополнительного лимпера'],
    boundary: false
  },
  {
    id: 'bb-defense-kqo',
    title: 'Защита BB с KQo против BTN',
    input: { street: 'preflop', position: 'BB', situation: 'blind_defense', hero: 'Kh Qd', pot: 19, bet: 12, stack: 300, opponents: 1, villain: 'reg', customRange: '', notes: '' },
    context: { opener: 'late' },
    expected: { action: 'call', alternatives: ['raise', 'fold'], sizeRange: null, confidence: ['средняя'], math: null },
    assumptions: ['Открытие BTN трактуется как позднее', 'Нет информации о squeeze за спиной'],
    boundary: false
  },
  {
    id: 'threebet-qq-vs-early',
    title: '3-bet QQ против раннего открытия',
    input: { street: 'preflop', position: 'BTN', situation: 'vs_raise_early', hero: 'Qs Qh', pot: 19, bet: 12, stack: 300, opponents: 1, villain: 'nit', customRange: '', notes: '' },
    context: { opener: 'early' },
    expected: { action: 'raise', alternatives: ['call'], sizeRange: [34, 38], confidence: ['высокая'], math: null },
    assumptions: ['Раннее открытие $12', 'BTN считается в позиции'],
    boundary: false
  },
  {
    id: 'fold-kjo-vs-early',
    title: 'Fold KJo против сильного раннего открытия',
    input: { street: 'preflop', position: 'BTN', situation: 'vs_raise_early', hero: 'Kh Jd', pot: 19, bet: 12, stack: 300, opponents: 1, villain: 'nit', customRange: '', notes: '' },
    context: { opener: 'early' },
    expected: { action: 'fold', alternatives: ['call', 'raise'], sizeRange: null, confidence: ['высокая'], math: null },
    assumptions: ['Открытие из ранней позиции соответствует жёсткой таблице защиты'],
    boundary: false
  },
  {
    id: 'short-stack-aks-vs-threebet',
    title: 'AKs против 3-бета с коротким effective stack',
    input: { street: 'preflop', position: 'CO', situation: 'vs_3bet', hero: 'As Ks', pot: 45, bet: 30, stack: 25, opponents: 1, villain: 'reg', customRange: '', notes: '' },
    context: {},
    expected: { action: 'allin', alternatives: ['call'], sizeRange: [24, 26], confidence: ['высокая'], math: null },
    assumptions: ['Стек передан как доступный effective stack', 'Текущий тренер только ограничивает 4-bet размер стеком'],
    boundary: false
  },
  {
    id: 'impossible-utg-vs-early',
    title: 'Невозможная позиция UTG против более раннего открытия',
    input: { street: 'preflop', position: 'UTG', situation: 'vs_raise_early', hero: 'As Qs', pot: 19, bet: 12, stack: 300, opponents: 1, villain: 'reg', customRange: '', notes: '' },
    context: { opener: 'early' },
    expected: { error: /Impossible position/i, math: null },
    assumptions: ['Проверяется реальный валидатор Hand Lab до вызова рекомендации'],
    boundary: false
  },
  {
    id: 'borderline-aqs-vs-early',
    title: 'Пограничный call AQs против раннего открытия',
    input: { street: 'preflop', position: 'CO', situation: 'vs_raise_early', hero: 'Ah Qh', pot: 19, bet: 12, stack: 300, opponents: 1, villain: 'nit', customRange: '', notes: '' },
    context: { opener: 'early' },
    expected: { action: 'call', alternatives: ['fold', 'raise'], sizeRange: null, confidence: ['средняя'], math: null },
    assumptions: ['Рейк, игроки за спиной и точная частота раннего открытия не моделируются'],
    boundary: true
  }
];

const postflopHands = [
  {
    id: 'dry-overpair-value',
    title: 'Overpair на сухой доске',
    input: { street: 'flop', position: 'BTN', situation: 'checked_to', hero: 'Ah Ad', board: 'Ks 7d 2c', pot: 60, bet: 0, stack: 300, opponents: 1, villain: 'reg', customRange: 'KQs,KQo,QQ-JJ,77,22', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [30, 36], confidence: ['высокая'], math: { equity: [0.70, 0.72], required: [0, 0], edgeSign: 'positive', spr: [4.9, 5.1], method: 'exact' } },
    assumptions: ['Соперник чекает весь заданный диапазон', 'Размер является эвристическим'],
    boundary: false
  },
  {
    id: 'top-pair-good-kicker',
    title: 'Top pair с хорошим кикером',
    input: { street: 'flop', position: 'BTN', situation: 'checked_to', hero: 'Ah Qh', board: 'Qd 7c 2s', pot: 60, bet: 0, stack: 300, opponents: 1, villain: 'reg', customRange: 'KQs,QJs,QTs,JJ-99,77,22', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [30, 36], confidence: ['средняя', 'высокая'], math: { equity: [0.71, 0.73], required: [0, 0], edgeSign: 'positive', spr: [4.9, 5.1], method: 'exact' } },
    assumptions: ['Заданный диапазон содержит худшие Qx и карманные пары'],
    boundary: false
  },
  {
    id: 'top-pair-facing-large-bet',
    title: 'Top pair против крупной ставки',
    input: { street: 'turn', position: 'BTN', situation: 'facing_bet', hero: 'Ah Qh', board: 'Qd 9s 6s 2c', pot: 60, bet: 90, stack: 300, opponents: 1, villain: 'reg', customRange: 'QQ,99,66,AQs,KQs,QJs,JTs,T9s,87s', notes: '' },
    expected: { action: 'call', alternatives: ['fold', 'raise'], sizeRange: null, confidence: ['средняя', 'высокая'], math: { equity: [0.54, 0.56], required: [0.374, 0.376], edgeSign: 'positive', spr: [1.99, 2.01], method: 'exact' } },
    assumptions: ['Будущие ставки и implied odds не моделируются'],
    boundary: false
  },
  {
    id: 'two-pair-value',
    title: 'Две пары для value bet',
    input: { street: 'flop', position: 'CO', situation: 'checked_to', hero: 'As Qd', board: 'Ah Qs 7c', pot: 80, bet: 0, stack: 260, opponents: 1, villain: 'reg', customRange: 'AQs,AJo,KQs,QJs,QQ,77,AKo', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [52, 60], confidence: ['высокая'], math: { equity: [0.74, 0.77], required: [0, 0], edgeSign: 'positive', spr: [3.24, 3.26], method: 'exact' } },
    assumptions: ['Соперник продолжает с указанным диапазоном'],
    boundary: false
  },
  {
    id: 'set-value',
    title: 'Сет для value bet',
    input: { street: 'flop', position: 'HJ', situation: 'checked_to', hero: '9s 9h', board: '9d 7c 2s', pot: 60, bet: 0, stack: 240, opponents: 1, villain: 'reg', customRange: 'A9s,K9s,T9s,88-22', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [39, 45], confidence: ['высокая'], math: { equity: [0.96, 0.99], required: [0, 0], edgeSign: 'positive', spr: [3.99, 4.01], method: 'exact' } },
    assumptions: ['Slowplay допускается только как альтернатива'],
    boundary: false
  },
  {
    id: 'nut-flush-draw',
    title: 'Натсовый флеш-дро против ставки',
    input: { street: 'flop', position: 'BTN', situation: 'facing_bet', hero: 'As Ks', board: 'Qs 7s 2d', pot: 61, bet: 35, stack: 210, opponents: 1, villain: 'reg', customRange: 'QQ,77,22,AQs,KQs,QJs,JJ-TT', notes: '' },
    expected: { action: 'raise', alternatives: ['call'], sizeRange: [103, 110], confidence: ['средняя'], math: { equity: [0.42, 0.45], required: [0.266, 0.268], edgeSign: 'positive', spr: [2.18, 2.2], strongOuts: [9, 15], method: 'exact' } },
    assumptions: ['Fold equity не рассчитывается отдельно', 'Сильные ауты и equity считаются против диапазона'],
    boundary: false
  },
  {
    id: 'non-nut-flush-draw',
    title: 'Ненатсовый флеш-дро с риском доминации',
    input: { street: 'flop', position: 'BTN', situation: 'facing_bet', hero: '9s 8s', board: 'Qs 7s 2d', pot: 61, bet: 35, stack: 210, opponents: 1, villain: 'reg', customRange: 'QQ,77,22,AQs,KQs,QJs,JJ-TT', notes: '' },
    expected: { action: 'call', alternatives: ['fold', 'raise'], sizeRange: null, confidence: ['средняя', 'высокая'], math: { equity: [0.33, 0.36], required: [0.266, 0.268], edgeSign: 'positive', spr: [2.18, 2.2], conditionalOuts: [1, 15], method: 'exact' } },
    assumptions: ['Пиковые ауты могут быть доминированы более старшим флешом'],
    boundary: false
  },
  {
    id: 'open-ended-straight-draw',
    title: 'Открытый стрит-дро',
    input: { street: 'flop', position: 'CO', situation: 'facing_bet', hero: '9h 8h', board: '7c 6d Ks', pot: 60, bet: 20, stack: 240, opponents: 1, villain: 'reg', customRange: 'AKs,KQs,KJs,KK,77,66,QQ-JJ', notes: '' },
    expected: { action: 'call', alternatives: ['fold', 'raise'], sizeRange: null, confidence: ['средняя', 'высокая'], math: { equity: [0.30, 0.33], required: [0.199, 0.201], edgeSign: 'positive', spr: [2.99, 3.01], strongOuts: [8, 8], method: 'exact' } },
    assumptions: ['Учитывается только текущая цена колла без будущих ставок'],
    boundary: false
  },
  {
    id: 'combo-draw-semi-bluff',
    title: 'Combo draw как полублеф',
    input: { street: 'flop', position: 'BTN', situation: 'facing_bet', hero: 'Js Ts', board: '9s 8s 2d', pot: 60, bet: 30, stack: 240, opponents: 1, villain: 'aggro', customRange: '99,88,22,A9s,K9s,Q9s,QQ-TT', notes: '' },
    expected: { action: 'raise', alternatives: ['call'], sizeRange: [94, 98], confidence: ['средняя'], math: { equity: [0.53, 0.55], required: [0.249, 0.251], edgeSign: 'positive', spr: [2.66, 2.68], strongOuts: [8, 20], method: 'exact' } },
    assumptions: ['Fold equity заявляется эвристически, но не выводится числом'],
    boundary: false
  },
  {
    id: 'missed-draw-river',
    title: 'Промазавшее дро на ривере',
    input: { street: 'river', position: 'BTN', situation: 'facing_bet', hero: 'As Ks', board: 'Qs 7s 2d 9h 3c', pot: 100, bet: 40, stack: 200, opponents: 1, villain: 'reg', customRange: 'AQo,KQo,QJo,99,77,22', notes: '' },
    expected: { action: 'fold', alternatives: ['call'], sizeRange: null, confidence: ['высокая'], math: { equity: [0, 0], required: [0.222, 0.223], edgeSign: 'negative', spr: [1.42, 1.44], method: 'exact' } },
    assumptions: ['В заданном диапазоне нет промазавших блефов'],
    boundary: false
  },
  {
    id: 'river-bluff-catch',
    title: 'Bluff-catch на ривере',
    input: { street: 'river', position: 'CO', situation: 'after_check', hero: 'As Js', board: 'Jd 8c 4s 9h 2d', pot: 217, bet: 110, stack: 300, opponents: 1, villain: 'aggro', customRange: '99,88,44,22,J9s,AJs,AJo,KJs,QJs,JTs,T8s,76s,65s', notes: '' },
    expected: { action: 'call', alternatives: ['fold'], sizeRange: null, confidence: ['средняя', 'высокая'], math: { equity: [0.54, 0.57], required: [0.251, 0.253], edgeSign: 'positive', spr: [0.91, 0.93], method: 'exact' } },
    assumptions: ['Промазавшие draws остаются в диапазоне ставки'],
    boundary: false
  },
  {
    id: 'river-value-bet',
    title: 'Value bet с overpair на ривере',
    input: { street: 'river', position: 'BTN', situation: 'checked_to', hero: 'Kh Kd', board: 'Ts 7d 3c 4h 2s', pot: 100, bet: 0, stack: 220, opponents: 1, villain: 'passive', customRange: '22-99,ATs,KTs,QTs,JTs,ATo,KTo,QTo,JTo', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [66, 74], confidence: ['высокая'], math: { equity: [0.84, 0.86], required: [0, 0], edgeSign: 'positive', spr: [2.19, 2.21], method: 'exact' } },
    assumptions: ['Худшие Tx и пары могут платить', 'Размер определяется эвристикой текстуры'],
    boundary: false
  },
  {
    id: 'river-thin-value',
    title: 'Thin value с top pair',
    input: { street: 'river', position: 'BTN', situation: 'checked_to', hero: 'Ah Jd', board: 'Js 8c 4s 9h 2d', pot: 120, bet: 0, stack: 240, opponents: 1, villain: 'station', customRange: 'KJs,QJs,JTs,TT-77,A8s,A9s,JJ,99,88,44,22,J9s', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [80, 88], confidence: ['средняя'], math: { equity: [0.61, 0.63], required: [0, 0], edgeSign: 'positive', spr: [1.99, 2.01], method: 'exact' } },
    assumptions: ['Calling station продолжает с худшими парами чаще обычного'],
    boundary: true
  },
  {
    id: 'paired-board-danger',
    title: 'Опасная парная доска с флеш-дро',
    input: { street: 'flop', position: 'BTN', situation: 'facing_bet', hero: 'As Ks', board: 'Qs 7s 7d', pot: 100, bet: 60, stack: 240, opponents: 1, villain: 'nit', customRange: '77,QQ,AQs,KQs,QJs,76s,87s', notes: '' },
    expected: { action: 'fold', alternatives: ['call'], sizeRange: null, confidence: ['низкая'], math: { equity: [0.30, 0.32], required: [0.272, 0.274], edgeSign: 'positive', spr: [1.49, 1.51], dirtyOuts: [1, 15], method: 'exact' } },
    assumptions: ['Флеш-ауты на парной доске могут проигрывать фулл-хаусу', 'Против tight диапазона нужен запас выше базовых pot odds'],
    boundary: true
  },
  {
    id: 'monotone-board',
    title: 'Monotone board',
    input: { street: 'flop', position: 'CO', situation: 'checked_to', hero: 'Ah Qd', board: 'Jh 8h 4h', pot: 70, bet: 0, stack: 260, opponents: 1, villain: 'reg', customRange: 'AKs,KQs,QTs,JJ,88,44,AJo,KJo,QJo', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [45, 53], confidence: ['средняя', 'высокая'], math: { equity: [0.45, 0.48], required: [0, 0], edgeSign: 'positive', spr: [3.7, 3.73], method: 'exact' } },
    assumptions: ['Тренер считает monotone board динамичной по flushy-флагу'],
    boundary: true
  },
  {
    id: 'multiway-overpair',
    title: 'Overpair в multiway pot',
    input: { street: 'flop', position: 'BTN', situation: 'checked_to', hero: 'Ah Ad', board: 'Ks 7d 2c', pot: 90, bet: 0, stack: 270, opponents: 2, villain: 'reg', customRange: 'KQs,QQ-JJ', notes: '' },
    expected: { action: 'bet', alternatives: ['check'], sizeRange: [47, 52], confidence: ['средняя'], math: { equity: [0.79, 0.86], required: [0, 0], edgeSign: 'positive', spr: [2.99, 3.01], method: 'montecarlo' } },
    assumptions: ['Оба соперника получают одинаковую модель диапазона', 'Monte Carlo использует фиксированный seed в тесте'],
    boundary: false
  },
  {
    id: 'positive-ev-call',
    title: 'Математически положительный call',
    input: { street: 'flop', position: 'BTN', situation: 'facing_bet', hero: 'Ah Qh', board: 'Qd 7c 2s', pot: 100, bet: 20, stack: 300, opponents: 1, villain: 'reg', customRange: 'KQs,QJs,QTs,JJ-TT', notes: '' },
    expected: { action: 'call', alternatives: ['raise'], sizeRange: null, confidence: ['высокая'], math: { equity: [0.87, 0.90], required: [0.142, 0.144], edgeSign: 'positive', spr: [2.49, 2.51], callEVSign: 'positive', method: 'exact' } },
    assumptions: ['EV оценивается относительно fold и без будущих ставок'],
    boundary: false
  },
  {
    id: 'negative-ev-call',
    title: 'Математически отрицательный call',
    input: { street: 'flop', position: 'CO', situation: 'facing_bet', hero: '8c 8d', board: 'As Kh Qh', pot: 100, bet: 100, stack: 300, opponents: 1, villain: 'nit', customRange: 'AKs,AQs,KQs,JJ-TT', notes: '' },
    expected: { action: 'fold', alternatives: ['call'], sizeRange: null, confidence: ['высокая'], math: { equity: [0.08, 0.10], required: [0.332, 0.334], edgeSign: 'negative', spr: [1.49, 1.51], callEVSign: 'negative', method: 'exact' } },
    assumptions: ['Диапазон соперника не содержит блефов'],
    boundary: false
  },
  {
    id: 'range-sensitive-tight',
    title: 'Пограничный bluff-catch против узкого диапазона',
    input: { street: 'river', position: 'CO', situation: 'after_check', hero: 'Ah Jh', board: 'Jd 8c 4s 9h 2d', pot: 160, bet: 80, stack: 240, opponents: 1, villain: 'nit', customRange: 'JJ,99,88,44,22,J9s,KJs,QJs', notes: '' },
    expected: { action: 'fold', alternatives: ['call'], sizeRange: null, confidence: ['средняя'], math: { equity: [0.20, 0.22], required: [0.249, 0.251], edgeSign: 'negative', spr: [0.99, 1.01], method: 'exact' } },
    assumptions: ['Узкий диапазон содержит value и немного худших Jx'],
    boundary: true
  },
  {
    id: 'range-sensitive-wide',
    title: 'Тот же bluff-catch против широкого диапазона',
    input: { street: 'river', position: 'CO', situation: 'after_check', hero: 'Ah Jh', board: 'Jd 8c 4s 9h 2d', pot: 160, bet: 80, stack: 240, opponents: 1, villain: 'aggro', customRange: 'JJ,99,88,44,22,J9s,KJs,QJs,JTs', notes: '' },
    expected: { action: 'call', alternatives: ['fold'], sizeRange: null, confidence: ['средняя'], math: { equity: [0.28, 0.29], required: [0.249, 0.251], edgeSign: 'positive', spr: [0.99, 1.01], method: 'exact' } },
    assumptions: ['Добавление JTs пересекает математический порог колла'],
    boundary: true
  }
];

for (const hand of preflopHands) {
  hand.decisionClass = hand.expected.error ? 'validation' : 'strategic';
}
for (const hand of postflopHands) {
  hand.decisionClass = ['positive-ev-call', 'negative-ev-call'].includes(hand.id)
    ? 'mathematical'
    : 'strategic';
}

module.exports = { preflopHands, postflopHands };
