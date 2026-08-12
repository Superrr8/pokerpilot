'use strict';

(function attachTrainerExplanationEngine(root) {
  const ACTION_LABELS = Object.freeze({
    FOLD: 'Fold', CHECK: 'Check', CALL: 'Call', BET: 'Bet', RAISE: 'Raise', ALL_IN: 'All-in'
  });
  const RANKS = Object.freeze({ '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, T: 10, J: 11, Q: 12, K: 13, A: 14 });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeAction(value) {
    const raw = typeof value === 'string' ? value : object(value).actionClass;
    const normalized = String(raw || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    return normalized === 'ALLIN' ? 'ALL_IN' : normalized;
  }

  function unique(values, limit = Infinity) {
    const result = [];
    values.forEach(value => {
      const text = String(value || '').trim();
      if (text && !result.includes(text) && result.length < limit) result.push(text);
    });
    return result;
  }

  function percent(value) {
    return `${Math.round(Number(value) * 100)}%`;
  }

  function money(value) {
    const number = Number(value);
    const rounded = Math.abs(number) >= 10 ? Math.round(Math.abs(number)) : Math.round(Math.abs(number) * 10) / 10;
    return `${number >= 0 ? '+' : '-'}$${rounded}`;
  }

  function handClassInfo(value) {
    const normalized = String(value || '').trim().toUpperCase();
    const match = normalized.match(/^([2-9TJQKA])([2-9TJQKA])([SO])?$/);
    if (!match) return { code: normalized, label: normalized || 'рука', suited: false, offsuit: false, category: 'unknown' };
    const first = match[1], second = match[2], suffix = match[3] || '';
    const code = `${first}${second}${suffix.toLowerCase()}`;
    const high = Math.max(RANKS[first], RANKS[second]);
    const low = Math.min(RANKS[first], RANKS[second]);
    const pair = first === second;
    const suited = suffix === 'S';
    const offsuit = suffix === 'O';
    let category = 'unclassified';
    let label = code;
    if (pair && high >= 12) { category = 'premium_pair'; label = 'премиальная пара'; }
    else if (pair && high >= 8) { category = 'medium_pair'; label = 'средняя карманная пара'; }
    else if (pair) { category = 'small_pair'; label = 'малая карманная пара'; }
    else if (high >= 10 && low >= 10) { category = suited ? 'suited_broadway' : 'offsuit_broadway'; label = suited ? 'одномастный broadway' : 'разномастный broadway'; }
    else if (suited && high === 14) { category = 'suited_ace'; label = 'одномастный туз'; }
    else if (suited && high === 13 && low < 10) { category = 'suited_king'; label = 'одномастный king'; }
    else if (offsuit && high === 13 && low < 10) { category = 'weak_offsuit_king'; label = 'слабый разномастный king'; }
    else if (offsuit && high === 14 && low < 10) { category = 'weak_offsuit_ace'; label = 'слабый разномастный туз'; }
    else if (suited && high - low === 1) { category = 'suited_connector'; label = 'одномастный коннектор'; }
    else if (suited && high - low === 2) { category = 'suited_gapper'; label = 'одномастный gapper'; }
    else if (offsuit && high <= 10) { category = 'trash_offsuit'; label = 'слабая разномастная рука'; }
    return { code, label, category, suited, offsuit, high, low };
  }

  function positionInfo(position) {
    const value = String(position || '').toUpperCase();
    if (['UTG', 'UTG+1', 'MP'].includes(value)) return { group: 'early', label: `ранняя позиция ${value}` };
    if (['LJ', 'HJ'].includes(value)) return { group: 'middle', label: `средняя позиция ${value}` };
    if (['CO', 'BTN'].includes(value)) return { group: 'late', label: `поздняя позиция ${value}` };
    if (['SB', 'BB'].includes(value)) return { group: 'blind', label: `блайнд ${value}` };
    return { group: 'unknown', label: value || '' };
  }

  function actionContextReason(context, opponents, limpers) {
    if (context === 'firstin') return 'Банк не открыт: решение относится к базовому диапазону первого входа.';
    if (context === 'limpers') return `${limpers || opponents || 1} лимпер(а) уже вошли в банк, поэтому изоляция должна учитывать риск multiway-игры.`;
    if (['vs_raise_early', 'vs_raise_late', 'blind_defense', 'open'].includes(context)) return 'Перед Hero уже был рейз, поэтому нужен более сильный диапазон продолжения, чем в неоткрытом банке.';
    if (['vs_3bet', 'threebet'].includes(context)) return 'Hero столкнулся с 3-bet: продолжение требует заметно более сильной руки и учёта effective stack.';
    if (['facing_bet', 'facing_raise', 'after_check'].includes(context)) return 'Hero принимает решение против уже сделанной ставки.';
    if (context === 'checked_to') return 'Перед Hero нет ставки, поэтому выбор идёт между Check и Bet.';
    return '';
  }

  function handReason(info, action) {
    const aggressive = ['BET', 'RAISE', 'ALL_IN'].includes(action);
    const reasons = {
      premium_pair: `${info.code} — премиальная пара: она далеко впереди большинства рук продолжения и подходит для ${aggressive ? 'агрессивного розыгрыша' : 'продолжения'}.`,
      medium_pair: `${info.code} — средняя карманная пара с готовым showdown value, но её уязвимость зависит от позиции и предыдущего действия.`,
      small_pair: `${info.code} — малая карманная пара: без подходящего контекста ей трудно выдерживать давление старших карт.`,
      suited_ace: `${info.code} — одномастный туз: suited-потенциал даёт больше сильных draw и улучшает playability.`,
      suited_king: `${info.code} — одномастный king: suited-версия чаще получает flush draw и лучше реализует потенциал, чем offsuit.`,
      weak_offsuit_king: `${info.code} — слабый offsuit king: kicker слабый, а лучшие Kx часто создают риск доминации.`,
      weak_offsuit_ace: `${info.code} — слабый offsuit ace: туз выглядит привлекательно, но слабый kicker часто оказывается доминирован.`,
      suited_connector: `${info.code} — одномастный коннектор: последовательные карты могут собирать сильные straight и flush draw.`,
      suited_gapper: `${info.code} — одномастный gapper: suited-потенциал помогает, но разрыв снижает частоту сильных straight draw.`,
      suited_broadway: `${info.code} — одномастный broadway с хорошей связностью и suited-потенциалом.`,
      offsuit_broadway: `${info.code} — разномастный broadway: высокие карты сильны, но отсутствие suited-потенциала снижает playability.`,
      trash_offsuit: `${info.code} — слабая offsuit-комбинация без достаточной связности и suited-потенциала.`
    };
    return reasons[info.category] || (info.code ? `Класс руки ${info.code} сопоставлен с существующей рекомендацией Trainer.` : 'Сила руки учитывается существующей рекомендацией Trainer.');
  }

  function positionReason(info, position) {
    if (info.group === 'early') return `${info.label}: после Hero остаётся много игроков, поэтому диапазон должен быть уже.`;
    if (info.group === 'middle') return `${info.label}: игроков позади меньше, чем из UTG, но слабые руки всё ещё часто получают сопротивление.`;
    if (info.group === 'late' && position === 'BTN') return 'BTN — самая поздняя позиция: меньше игроков позади и больше постфлоп-решений принимаются в позиции.';
    if (info.group === 'late') return `${info.label}: диапазон шире ранних позиций, но после Hero ещё остаются игроки.`;
    if (info.group === 'blind') return `${info.label}: префлоп-цена может быть лучше, но постфлоп Hero часто играет без позиции.`;
    return '';
  }

  function mathFrom(input, trainerResult) {
    const source = object(input.math && Object.keys(object(input.math)).length ? input.math : trainerResult.math);
    const equitySource = object(source.equity);
    const outsSource = object(source.outs);
    const math = {};
    const equity = finite(equitySource.equity ?? source.equity);
    const required = finite(source.requiredEquity ?? source.required);
    const outs = finite(outsSource.strongOuts ?? source.outs);
    const conditionalOuts = finite(outsSource.conditionalOuts);
    const nextCardProbability = finite(outsSource.strongNextCard ?? source.nextCardProbability);
    const byRiverProbability = finite(outsSource.strongByRiver ?? source.byRiverProbability);
    const callEV = finite(source.callEV ?? trainerResult.callEV);
    const spr = finite(source.spr);
    if (equity !== null) math.equity = equity;
    if (required !== null) math.requiredEquity = required;
    if (outs !== null && outs > 0) math.outs = outs;
    if (conditionalOuts !== null && conditionalOuts > 0) math.conditionalOuts = conditionalOuts;
    if (nextCardProbability !== null && outs > 0) math.nextCardProbability = nextCardProbability;
    if (byRiverProbability !== null && outs > 0) math.byRiverProbability = byRiverProbability;
    if (callEV !== null) math.callEV = callEV;
    if (spr !== null) math.spr = spr;
    return math;
  }

  function madeHandDescription(input, trainerResult) {
    const math = object(trainerResult.math);
    const name = String(object(input.math).handName || math.handName || '').trim();
    if (!name) return '';
    if (/одна пара|one pair|^пара$/i.test(name)) {
      const hero = Array.isArray(input.hero) ? input.hero : [];
      const board = Array.isArray(input.board) ? input.board : [];
      const heroRanks = hero.map(card => finite(object(card).r)).filter(rank => rank !== null);
      const boardRanks = board.map(card => finite(object(card).r)).filter(rank => rank !== null);
      if (heroRanks.length === 2 && boardRanks.length) {
        const maxBoard = Math.max(...boardRanks);
        if (heroRanks[0] === heroRanks[1] && heroRanks[0] > maxBoard) return 'оверпара';
        const pairedRank = heroRanks.find(rank => boardRanks.includes(rank));
        if (pairedRank === maxBoard) {
          const kicker = heroRanks.find(rank => rank !== pairedRank);
          return kicker !== undefined && kicker >= 12 ? 'top pair с сильным kicker' : 'top pair со слабым kicker';
        }
        if (pairedRank !== undefined) return 'нестаршая пара';
      }
    }
    return name.toLowerCase();
  }

  function drawDescription(trainerResult) {
    const outs = object(object(trainerResult.math).outs);
    const groups = Array.isArray(outs.groups) ? outs.groups : [];
    const labels = groups.map(group => String(object(group).label || '').toLowerCase());
    const flush = labels.some(label => /флеш|flush/.test(label));
    const straight = labels.some(label => /стрит|straight/.test(label));
    if (flush && straight) return 'комбо-дро';
    if (flush) return 'флеш-дро';
    if (straight) return 'стрит-дро';
    return '';
  }

  function normalizeBoardTexture(texture, board, street) {
    const value = { ...object(texture) };
    const cards = Array.isArray(board) ? board : [];
    const ranks = cards.map(card => finite(object(card).r)).filter(rank => rank !== null);
    const suits = cards.map(card => String(object(card).s || '')).filter(Boolean);
    const suitCounts = suits.reduce((counts, suit) => ({ ...counts, [suit]: (counts[suit] || 0) + 1 }), {});
    const maxSuitCount = Math.max(0, ...Object.values(suitCounts));
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    const adjacentLinks = uniqueRanks.slice(1).filter((rank, index) => rank - uniqueRanks[index] <= 2).length;
    if (ranks.length) value.paired = value.paired || uniqueRanks.length < ranks.length;
    if (suits.length >= 3) value.monotone = value.monotone || maxSuitCount >= 3;
    if (suits.length >= 3 && street !== 'river') value.twoTone = value.twoTone || maxSuitCount === 2;
    if (ranks.length >= 3) value.connected = value.connected || adjacentLinks >= 2;
    value.wet = Boolean(value.wet || value.monotone || value.twoTone || value.connected);
    return value;
  }

  function boardReason(texture, street) {
    const value = object(texture);
    if (!Object.keys(value).length) return '';
    if (value.paired) return 'Доска спаренная: сила обычных one-pair рук и чистота draw требуют большей осторожности.';
    if (value.flushy || value.monotone) return 'Монотонная доска уже поддерживает готовые flush и делает продолжение диапазонов более полярным.';
    if (street === 'river' && value.connected) return 'Финальная доска связанная: готовые straight и две пары возможны, но будущих draw уже нет.';
    if (value.twoTone && value.connected) return 'Доска two-tone и связанная: здесь одновременно возможны flush draw и многочисленные straight draw.';
    if (value.twoTone) return 'Доска two-tone: две карты одной масти создают реальные flush draw, поэтому flop не считается полностью сухим.';
    if (value.wet || value.connected) return 'Доска связанная и динамичная: возможны многочисленные straight/flush draw и сильные продолжения.';
    return 'Доска сухая и спокойная: готовые руки реже нуждаются в большой защите.';
  }

  function confidenceExplanation(trainerResult) {
    const confidence = String(trainerResult.confidence || 'medium').toLowerCase();
    if (trainerResult.isMarginal || confidence === 'low') return 'Это пограничный spot: небольшое изменение диапазона, размера ставки или контекста может поменять рекомендацию.';
    if (confidence === 'high') return 'Здесь уверенность высокая: решение находится далеко от границы текущей модели.';
    return 'Уверенность средняя: линия предпочтительна, но ситуация не полностью однозначная.';
  }

  function decisionQualityExplanation(value) {
    const result = object(value);
    if (result.isRated !== true || finite(result.score) === null) return '';
    const reasons = Array.isArray(result.reasons) ? unique(result.reasons, 2) : [];
    return reasons.length
      ? `Decision Quality ${Math.round(Number(result.score))}${result.grade ? ` (${result.grade})` : ''}. ${reasons.join(' ')}`
      : `Decision Quality ${Math.round(Number(result.score))}${result.grade ? ` (${result.grade})` : ''} отражает совпадение действия и размера с готовой рекомендацией Trainer.`;
  }

  function preflopExplanation(input, trainerResult, action, math) {
    const hand = handClassInfo(input.handClass);
    const position = positionInfo(input.position);
    const context = String(input.actionContext || input.situation || '').toLowerCase();
    const reasons = [handReason(hand, action), actionContextReason(context, input.opponents, input.limpers), positionReason(position, String(input.position || '').toUpperCase())];
    if (action === 'ALL_IN') reasons.unshift('Короткий effective stack превращает продолжение в ALL-IN вместо промежуточного рейза или Call.');
    if (Number(input.opponents) > 1 && context !== 'limpers') reasons.push(`В банке несколько соперников: marginal-руки хуже реализуют свой потенциал multiway.`);
    const selectedReasons = unique(reasons, 4);
    while (selectedReasons.length < 2) selectedReasons.push('Рекомендация следует текущему проверенному диапазону Trainer для этого контекста.');

    let summary;
    if (hand.category === 'premium_pair') summary = `${hand.code} — премиальная пара. ${ACTION_LABELS[action] || action} сохраняет value и соответствует текущей модели Trainer.`;
    else if (hand.category === 'weak_offsuit_king' && action === 'FOLD') summary = `${hand.code} — слабый разномастный king: слабый kicker и риск доминации делают Fold спокойным базовым решением.`;
    else summary = `${ACTION_LABELS[action] || action} — базовая линия Trainer для ${hand.code} (${hand.label}) из позиции ${input.position || 'по заданному контексту'}.`;

    const alternatives = [];
    if (hand.offsuit) alternatives.push(`Suited-версия ${hand.code.slice(0, 2)}s получает больше flush draw и обычно играет шире.`);
    if (position.group !== 'late' || input.position !== 'BTN') alternatives.push('С BTN диапазон шире, потому что игроков позади меньше.');
    if (context === 'limpers') alternatives.push('Против одного лимпера решение может быть агрессивнее, чем против нескольких.');
    if (['vs_raise_early', 'vs_raise_late', 'blind_defense', 'open'].includes(context)) alternatives.push('Меньший размер открытия или более поздняя позиция рейзера могут сделать продолжение ближе.');
    if (action === 'ALL_IN') alternatives.push('При более глубоком effective stack Trainer может оставить место для Call или обычного рейза.');

    const takeawayByCategory = {
      weak_offsuit_king: 'Слабые offsuit Kx часто выигрывают маленькие банки, но проигрывают крупные лучшим Kx; suited-версии можно играть шире.',
      suited_ace: 'Suited ace ценен не только тузом: nut-flush потенциал улучшает playability.',
      suited_connector: 'Suited connectors сильнее в позиции и при подходящей цене; сами по себе они не оправдывают любой Call.',
      premium_pair: 'С премиальной парой обычно важнее строить банк, чем маскировать силу ценой упущенного value.'
    };
    return {
      summary,
      reasons: selectedReasons,
      keyFactors: unique([hand.label, position.label, context ? actionContextReason(context, input.opponents, input.limpers).split(':')[0] : '', action === 'ALL_IN' ? 'короткий effective stack' : ''], 5),
      alternatives: unique(alternatives, 2),
      takeaway: takeawayByCategory[hand.category] || 'Сначала определяй позицию и действие перед Hero, затем сопоставляй руку с диапазоном продолжения.',
      math
    };
  }

  function postflopExplanation(input, trainerResult, action, math) {
    const hand = madeHandDescription(input, trainerResult);
    const draw = drawDescription(trainerResult);
    const street = String(input.street || '').toLowerCase();
    const normalizedTexture = normalizeBoardTexture(input.boardTexture, input.board, street);
    const texture = boardReason(normalizedTexture, street);
    const opponents = Math.max(1, Number(input.opponents) || 1);
    const positionState = String(input.positionState || '').toLowerCase();
    const facing = ['facing_bet', 'facing_raise', 'after_check'].includes(String(input.actionContext || input.situation || '').toLowerCase()) || finite(input.bet) > 0;
    const reasons = [];

    if (facing && math.requiredEquity !== undefined && math.equity !== undefined) {
      const enough = math.equity >= math.requiredEquity;
      reasons.push(`Для Call нужно около ${percent(math.requiredEquity)}, а готовая модель даёт около ${percent(math.equity)} — математический запас ${enough ? 'есть' : 'отсутствует'}.`);
    }
    if (hand) reasons.push(`Текущая готовая рука — ${hand}; её качество определяет, можно ли играть на value или нужен контроль банка.`);
    if (draw && math.outs) reasons.push(`У Hero ${draw}: существующий outs engine отмечает ${Math.round(math.outs)} сильных outs${math.nextCardProbability !== undefined ? ` (около ${percent(math.nextCardProbability)} на следующей карте)` : ''}.`);
    if (texture) reasons.push(texture);
    if (opponents > 1) reasons.push(`Банк multiway против ${opponents} соперников: руки с одной парой и marginal-линии требуют большей осторожности.`);
    if (positionState === 'ip') reasons.push('Hero в позиции (IP): больше информации помогает контролировать размер банка.');
    if (positionState === 'oop') reasons.push('Hero без позиции (OOP): сложнее реализовать потенциал руки и контролировать pot.');
    if (math.callEV !== undefined && ['CALL', 'FOLD'].includes(action)) reasons.unshift(`Готовая EV-оценка Call — ${money(math.callEV)} относительно Fold в этой модели.`);

    const selectedReasons = unique(reasons, 4);
    while (selectedReasons.length < 2) selectedReasons.push('Линия следует готовой рекомендации Trainer и фактическому контексту раздачи.');
    const main = draw || hand || 'текущая рука';
    let summary = `${ACTION_LABELS[action] || action} — предпочтительная линия Trainer: ${main} сопоставляется с текущей доской и действием соперника.`;
    if (hand && ['BET', 'RAISE', 'ALL_IN'].includes(action)) summary = `${ACTION_LABELS[action] || action} строит банк с рукой «${hand}» в рамках готовой рекомендации Trainer.`;
    if (facing && math.requiredEquity !== undefined && math.equity !== undefined) summary = math.equity >= math.requiredEquity
      ? `${ACTION_LABELS[action] || action}: доступная equity превышает цену продолжения в текущей модели.`
      : `${ACTION_LABELS[action] || action}: доступной equity не хватает для заданной цены продолжения.`;

    const alternatives = [];
    if (opponents > 1) alternatives.push('Heads-up такая же made hand или draw обычно сохраняет больше относительной силы.');
    if (positionState === 'oop') alternatives.push('В позиции marginal-линия реализует потенциал руки проще.');
    if (facing && finite(input.bet) !== null) alternatives.push('Другой размер ставки меняет pot odds и может приблизить решение к границе.');
    if (input.customRange || object(trainerResult.math).range) alternatives.push('Другая подтверждённая модель диапазона соперника может изменить доступную equity.');
    if (texture) alternatives.push('Другая текстура доски меняет число сильных продолжений и ценность защиты.');

    return {
      summary,
      reasons: selectedReasons,
      keyFactors: unique([hand, draw, texture ? (normalizedTexture.wet ? 'динамичная доска' : 'сухая доска') : '', opponents > 1 ? `multiway: ${opponents} соперника` : 'heads-up', positionState === 'ip' ? 'позиция IP' : positionState === 'oop' ? 'без позиции OOP' : '', math.spr !== undefined ? `SPR ${Math.round(math.spr * 10) / 10}` : ''], 5),
      alternatives: unique(alternatives, 2),
      takeaway: draw
        ? 'С draw сравнивай готовую equity и pot odds; число outs само по себе ещё не гарантирует прибыльное продолжение.'
        : opponents > 1
          ? 'В multiway pot относительная сила одной пары ниже, поэтому value и bluff-catch требуют большего запаса.'
          : 'Связывай силу готовой руки с текстурой доски, позицией и ценой продолжения.',
      math
    };
  }

  function generateExplanation(input = {}) {
    const source = object(input);
    const trainerResult = object(source.trainerResult);
    const action = normalizeAction(trainerResult);
    const math = mathFrom(source, trainerResult);
    const street = String(source.street || 'preflop').toLowerCase();
    const explanation = street === 'preflop'
      ? preflopExplanation(source, trainerResult, action, math)
      : postflopExplanation(source, trainerResult, action, math);
    return Object.freeze({
      summary: explanation.summary,
      reasons: Object.freeze(explanation.reasons.slice()),
      keyFactors: Object.freeze(explanation.keyFactors.slice()),
      alternatives: Object.freeze(explanation.alternatives.slice()),
      takeaway: explanation.takeaway,
      math: Object.freeze({ ...explanation.math }),
      confidenceExplanation: confidenceExplanation(trainerResult),
      decisionQualityExplanation: decisionQualityExplanation(source.decisionQuality)
    });
  }

  const api = Object.freeze({ generateExplanation });
  root.TrainerExplanationEngine = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
