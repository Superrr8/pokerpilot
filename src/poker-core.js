'use strict';

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PokerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SUITS = ['s', 'h', 'd', 'c'];
  const SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const RANK_TEXT = { 14: 'A', 13: 'K', 12: 'Q', 11: 'J', 10: 'T', 9: '9', 8: '8', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2' };
  const TEXT_RANK = { A: 14, K: 13, Q: 12, J: 11, T: 10, '10': 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };
  const HAND_NAMES = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш'];

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const cardId = c => `${c.r}${c.s}`;

  function fullDeck() {
    const deck = [];
    for (const s of SUITS) for (let r = 2; r <= 14; r += 1) deck.push({ r, s });
    return deck;
  }

  function shuffle(deck, rng = Math.random) {
    const d = deck.slice();
    for (let i = d.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function parseCard(text) {
    const t = String(text).trim();
    const suit = t.slice(-1).toLowerCase();
    const rankText = t.slice(0, -1).toUpperCase();
    const r = TEXT_RANK[rankText];
    if (!r || !SUITS.includes(suit)) throw new Error(`Invalid card: ${text}`);
    return { r, s: suit };
  }

  function cardText(c, tenAs10 = true) {
    const rank = c.r === 10 && tenAs10 ? '10' : RANK_TEXT[c.r];
    return `${rank}${SUIT_SYMBOL[c.s]}`;
  }

  function assertValidCard(card, context) {
    if (!card || !Number.isInteger(card.r) || card.r < 2 || card.r > 14 || !SUITS.includes(card.s)) {
      throw new Error(`Invalid card in ${context}`);
    }
  }

  function assertUniqueCards(cards, context) {
    const seen = new Set();
    for (const card of cards) {
      assertValidCard(card, context);
      const id = cardId(card);
      if (seen.has(id)) throw new Error(`Duplicate card in ${context}: ${cardText(card)}`);
      seen.add(id);
    }
  }

  function removeKnown(deck, cards) {
    assertUniqueCards(deck, 'deck');
    assertUniqueCards(cards, 'known cards');
    const ids = new Set(cards.map(cardId));
    return deck.filter(c => !ids.has(cardId(c)));
  }

  function combinations(arr, k) {
    const out = [];
    function rec(start, cur) {
      if (cur.length === k) {
        out.push(cur.slice());
        return;
      }
      for (let i = start; i <= arr.length - (k - cur.length); i += 1) {
        cur.push(arr[i]);
        rec(i + 1, cur);
        cur.pop();
      }
    }
    rec(0, []);
    return out;
  }

  function compareEval(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      const d = (a[i] || 0) - (b[i] || 0);
      if (d) return Math.sign(d);
    }
    return 0;
  }

  function eval5(cards) {
    if (!Array.isArray(cards) || cards.length !== 5) throw new Error('eval5 requires exactly 5 cards');
    assertUniqueCards(cards, 'eval5');
    const ranks = cards.map(c => c.r).sort((a, b) => b - a);
    const counts = {};
    for (const r of ranks) counts[r] = (counts[r] || 0) + 1;
    const groups = Object.entries(counts)
      .map(([r, c]) => ({ r: Number(r), c }))
      .sort((a, b) => b.c - a.c || b.r - a.r);
    const flush = cards.every(c => c.s === cards[0].s);
    const uniqDesc = [...new Set(ranks)];
    if (uniqDesc.includes(14)) uniqDesc.push(1);
    let straightHigh = 0;
    for (let i = 0; i <= uniqDesc.length - 5; i += 1) {
      if (uniqDesc[i] - uniqDesc[i + 4] === 4) {
        straightHigh = uniqDesc[i];
        break;
      }
    }
    if (flush && straightHigh) return [8, straightHigh];
    if (groups[0].c === 4) return [7, groups[0].r, ...groups.filter(g => g.c === 1).map(g => g.r).slice(0, 1)];
    if (groups[0].c === 3 && groups[1]?.c >= 2) return [6, groups[0].r, groups[1].r];
    if (flush) return [5, ...ranks];
    if (straightHigh) return [4, straightHigh];
    if (groups[0].c === 3) return [3, groups[0].r, ...groups.filter(g => g.c === 1).map(g => g.r).slice(0, 2)];
    const pairs = groups.filter(g => g.c === 2).map(g => g.r);
    if (pairs.length >= 2) {
      const kick = groups.filter(g => g.c === 1).map(g => g.r)[0];
      return [2, pairs[0], pairs[1], kick];
    }
    if (pairs.length === 1) return [1, pairs[0], ...groups.filter(g => g.c === 1).map(g => g.r).slice(0, 3)];
    return [0, ...ranks];
  }

  function best7(cards) {
    if (!Array.isArray(cards) || cards.length < 5 || cards.length > 7) throw new Error('best7 requires 5 to 7 cards');
    assertUniqueCards(cards, 'best7');
    let best = null;
    for (const five of combinations(cards, 5)) {
      const e = eval5(five);
      if (!best || compareEval(e, best) > 0) best = e;
    }
    return best;
  }

  function handName(evalResult) {
    return HAND_NAMES[evalResult[0]];
  }

  function handClass(cards) {
    assertUniqueCards(cards, 'handClass');
    let [a, b] = cards.slice().sort((x, y) => y.r - x.r);
    if (a.r === b.r) return `${RANK_TEXT[a.r]}${RANK_TEXT[b.r]}`;
    return `${RANK_TEXT[a.r]}${RANK_TEXT[b.r]}${a.s === b.s ? 's' : 'o'}`;
  }

  function canonicalCombo(cards) {
    assertUniqueCards(cards, 'canonicalCombo');
    return cards.slice().sort((a, b) => b.r - a.r || SUITS.indexOf(a.s) - SUITS.indexOf(b.s));
  }

  const ALL_COMBOS = (() => {
    const deck = fullDeck();
    const out = [];
    for (let i = 0; i < deck.length; i += 1) {
      for (let j = i + 1; j < deck.length; j += 1) out.push(canonicalCombo([deck[i], deck[j]]));
    }
    return out;
  })();

  function expandRangeToken(token) {
    let t = token.trim();
    if (!t) return [];
    const plus = t.endsWith('+');
    if (plus) t = t.slice(0, -1);
    const pairRange = t.match(/^([AKQJT98765432])([AKQJT98765432])-([AKQJT98765432])([AKQJT98765432])$/);
    if (pairRange && pairRange[1] === pairRange[2] && pairRange[3] === pairRange[4]) {
      const hi = TEXT_RANK[pairRange[1]];
      const lo = TEXT_RANK[pairRange[3]];
      const top = Math.max(hi, lo);
      const bottom = Math.min(hi, lo);
      return RANKS.filter(r => r <= top && r >= bottom).map(r => `${RANK_TEXT[r]}${RANK_TEXT[r]}`);
    }
    const pairMatch = t.match(/^([AKQJT98765432])\1$/);
    if (pairMatch) {
      const start = TEXT_RANK[pairMatch[1]];
      const ranks = plus ? RANKS.filter(r => r >= start) : [start];
      return ranks.map(r => `${RANK_TEXT[r]}${RANK_TEXT[r]}`);
    }
    const m = t.match(/^([AKQJT98765432])([AKQJT98765432])(s|o)$/);
    if (!m) throw new Error(`Unsupported range token: ${token}`);
    const high = TEXT_RANK[m[1]];
    const low = TEXT_RANK[m[2]];
    const suffix = m[3];
    if (high <= low) throw new Error(`Range token must be high-card first: ${token}`);
    if (!plus) return [`${RANK_TEXT[high]}${RANK_TEXT[low]}${suffix}`];
    const out = [];
    for (let kicker = low; kicker < high; kicker += 1) out.push(`${RANK_TEXT[high]}${RANK_TEXT[kicker]}${suffix}`);
    return out;
  }

  function expandRange(rangeText) {
    const classes = new Set();
    String(rangeText || '')
      .split(',')
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(token => expandRangeToken(token).forEach(x => classes.add(x)));
    return classes;
  }

  function rangeCombos(rangeText, knownCards = []) {
    assertUniqueCards(knownCards, 'rangeCombos known cards');
    const classes = expandRange(rangeText);
    const known = new Set(knownCards.map(cardId));
    return ALL_COMBOS.filter(combo => classes.has(handClass(combo)) && combo.every(c => !known.has(cardId(c))));
  }

  function potMath({ potBefore = 0, bet = 0, call = bet } = {}) {
    const values = { potBefore: Number(potBefore), bet: Number(bet), call: Number(call) };
    for (const [name, value] of Object.entries(values)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a finite non-negative number`);
    }
    const p = values.potBefore;
    const b = values.bet;
    const c = values.call;
    const potNow = p + b;
    const finalPot = potNow + c;
    const requiredEquity = finalPot > 0 ? c / finalPot : 0;
    return { potBefore: p, bet: b, call: c, potNow, finalPot, requiredEquity };
  }

  function callEV({ equity, potBefore = 0, bet = 0, call = bet } = {}) {
    const q = clamp(Number(equity) || 0, 0, 1);
    const m = potMath({ potBefore, bet, call });
    // Relative to folding: when we win, we gain the pot already out there; when we lose, we lose the call.
    const ev = q * m.potNow - (1 - q) * m.call;
    return { ...m, equity: q, ev };
  }

  function exactHitProbability(outs, unseen, cardsToCome = 1) {
    const n = clamp(Math.round(outs), 0, unseen);
    const u = Math.max(0, Math.round(unseen));
    const k = clamp(Math.round(cardsToCome), 0, u);
    if (!u || !k || !n) return 0;
    let miss = 1;
    for (let i = 0; i < k; i += 1) miss *= (u - n - i) / (u - i);
    return clamp(1 - miss, 0, 1);
  }

  function straightWindows() {
    return [
      [14, 5, 4, 3, 2],
      [6, 5, 4, 3, 2],
      [7, 6, 5, 4, 3],
      [8, 7, 6, 5, 4],
      [9, 8, 7, 6, 5],
      [10, 9, 8, 7, 6],
      [11, 10, 9, 8, 7],
      [12, 11, 10, 9, 8],
      [13, 12, 11, 10, 9],
      [14, 13, 12, 11, 10]
    ];
  }

  function analyzeOuts(hero, board) {
    assertUniqueCards([...hero, ...board], 'analyzeOuts');
    if (board.length < 3 || board.length >= 5) {
      return { rawOuts: 0, strongOuts: 0, conditionalOuts: 0, dirtyOuts: 0, unseen: 52 - hero.length - board.length, nextCard: 0, byRiver: 0, strongNextCard: 0, strongByRiver: 0, dirtyNextCard: 0, dirtyByRiver: 0, groups: [], warning: '' };
    }
    const known = [...hero, ...board];
    const unseenCards = removeKnown(fullDeck(), known);
    const unseenIds = new Set(unseenCards.map(cardId));
    const strong = new Set();
    const conditional = new Set();
    const dirty = new Set();
    const groups = [];
    const current = best7(known);
    const currentCategory = current[0];
    const boardRankCounts = {};
    for (const c of board) boardRankCounts[c.r] = (boardRankCounts[c.r] || 0) + 1;
    const pairedBoard = Object.values(boardRankCounts).some(count => count >= 2);

    const suitCount = {};
    for (const c of known) suitCount[c.s] = (suitCount[c.s] || 0) + 1;
    for (const s of SUITS) {
      const suitedHero = hero.filter(c => c.s === s);
      if (suitedHero.length && suitCount[s] === 4) {
        const ids = unseenCards.filter(c => c.s === s).map(cardId);
        const nutDraw = Math.max(...suitedHero.map(c => c.r)) === 14;
        const quality = pairedBoard ? 'dirty' : nutDraw ? 'strong' : 'conditional';
        const target = quality === 'dirty' ? dirty : quality === 'strong' ? strong : conditional;
        ids.forEach(id => target.add(id));
        groups.push({ key: 'flush', label: pairedBoard ? 'Флеш на парной доске' : nutDraw ? 'Натсовый флеш' : 'Флеш (может быть доминирован)', outs: ids.length, quality });
      }
    }

    const knownRanks = new Set(known.map(c => c.r));
    const heroRanks = new Set(hero.map(c => c.r));
    const missingRanks = new Set();
    for (const window of straightWindows()) {
      const present = window.filter(r => knownRanks.has(r));
      const heroContributes = window.some(r => heroRanks.has(r));
      if (heroContributes && present.length === 4) {
        const missing = window.find(r => !knownRanks.has(r));
        if (missing) missingRanks.add(missing);
      }
    }
    if (missingRanks.size) {
      let count = 0;
      const straightQuality = pairedBoard ? 'dirty' : currentCategory >= 3 ? 'conditional' : 'strong';
      const straightTarget = straightQuality === 'dirty' ? dirty : straightQuality === 'conditional' ? conditional : strong;
      for (const r of missingRanks) {
        for (const c of unseenCards.filter(x => x.r === r)) {
          straightTarget.add(cardId(c));
          count += 1;
        }
      }
      groups.push({ key: 'straight', label: missingRanks.size >= 2 ? 'Двусторонний стрит-дро' : 'Гатшот / стрит', outs: count, quality: straightQuality });
    }
    const boardMax = Math.max(...board.map(c => c.r));
    if (currentCategory === 0) {
      const overRanks = [...new Set(hero.filter(c => c.r > boardMax).map(c => c.r))];
      if (overRanks.length) {
        let count = 0;
        const overcardTarget = pairedBoard ? dirty : conditional;
        for (const r of overRanks) {
          for (const c of unseenCards.filter(x => x.r === r)) {
            overcardTarget.add(cardId(c));
            count += 1;
          }
        }
        groups.push({ key: 'overcards', label: overRanks.length === 2 ? 'Две оверкарты' : 'Оверкарта', outs: count, quality: pairedBoard ? 'dirty' : 'conditional' });
      }
    }

    if (currentCategory === 1) {
      const ranks = hero.map(c => c.r);
      const boardRanks = board.map(c => c.r);
      if (ranks[0] === ranks[1]) {
        const ids = unseenCards.filter(c => c.r === ranks[0]).map(cardId);
        ids.forEach(id => strong.add(id));
        if (ids.length) groups.push({ key: 'set', label: 'Сет', outs: ids.length, quality: 'strong' });
      } else {
        const pairedHole = ranks.find(r => boardRanks.includes(r));
        const otherHole = ranks.find(r => r !== pairedHole);
        if (pairedHole) {
          const trips = unseenCards.filter(c => c.r === pairedHole).map(cardId);
          trips.forEach(id => strong.add(id));
          if (trips.length) groups.push({ key: 'trips', label: 'Трипс', outs: trips.length, quality: 'strong' });
          if (otherHole && !boardRanks.includes(otherHole)) {
            const twoPair = unseenCards.filter(c => c.r === otherHole).map(cardId);
            twoPair.forEach(id => conditional.add(id));
            if (twoPair.length) groups.push({ key: 'twoPair', label: 'Две пары', outs: twoPair.length, quality: 'conditional' });
          }
        }
      }
    }

    if (currentCategory >= 2 && currentCategory <= 3) {
      const upgrade = [];
      for (const c of unseenCards) {
        const next = best7([...known, c]);
        if (compareEval(next, current) > 0 && next[0] >= 6) upgrade.push(cardId(c));
      }
      const unique = [...new Set(upgrade)];
      unique.forEach(id => strong.add(id));
      if (unique.length) groups.push({ key: 'boat', label: 'Фулл-хаус / каре', outs: unique.length, quality: 'strong' });
    }

    // Avoid double counting cards that appear in more than one draw.
    for (const id of dirty) {
      strong.delete(id);
      conditional.delete(id);
    }
    for (const id of strong) conditional.delete(id);
    const raw = new Set([...strong, ...conditional, ...dirty]);
    const unseen = unseenCards.length;
    const cardsToCome = board.length === 3 ? 2 : 1;
    const rawOuts = raw.size;
    const strongOuts = strong.size;
    const conditionalOuts = conditional.size;
    const dirtyOuts = dirty.size;
    return {
      rawOuts,
      strongOuts,
      conditionalOuts,
      dirtyOuts,
      unseen,
      nextCard: exactHitProbability(rawOuts, unseen, 1),
      byRiver: exactHitProbability(rawOuts, unseen, cardsToCome),
      strongNextCard: exactHitProbability(strongOuts, unseen, 1),
      strongByRiver: exactHitProbability(strongOuts, unseen, cardsToCome),
      dirtyNextCard: exactHitProbability(dirtyOuts, unseen, 1),
      dirtyByRiver: exactHitProbability(dirtyOuts, unseen, cardsToCome),
      groups,
      warning: dirtyOuts ? 'Часть аутов грязная: рука усилится, но может остаться позади готовой более сильной комбинации.' : conditionalOuts ? 'Часть аутов условная: усиление не гарантирует выигрыш против диапазона соперника.' : ''
    };
  }

  function sampleIndex(length, rng) {
    return Math.floor(rng() * length);
  }

  function equityVsRange({ hero, board = [], range, trials = 5000, rng = Math.random, exactLimit = 140000 } = {}) {
    const known = [...hero, ...board];
    assertUniqueCards(known, 'equityVsRange known cards');
    const knownIds = new Set(known.map(cardId));
    const combos = Array.isArray(range)
      ? range.filter(combo => {
        assertUniqueCards(combo, 'equityVsRange combo');
        return combo.every(c => !knownIds.has(cardId(c)));
      })
      : rangeCombos(range, known);
    if (!combos.length) {
      return { equity: 0, win: 0, tie: 0, lose: 0, samples: 0, stderr: 0, ci95: 0, exact: true, method: 'exact', combos: 0 };
    }
    const missing = 5 - board.length;
    let wins = 0;
    let ties = 0;
    let losses = 0;
    let samples = 0;
    let exactUsed = false;

    const runOne = (villain, runout) => {
      const he = best7([...hero, ...board, ...runout]);
      const ve = best7([...villain, ...board, ...runout]);
      const cmp = compareEval(he, ve);
      if (cmp > 0) wins += 1;
      else if (cmp === 0) ties += 1;
      else losses += 1;
      samples += 1;
    };

    if (missing === 0) {
      for (const villain of combos) runOne(villain, []);
      exactUsed = true;
    } else if (missing === 1) {
      let total = 0;
      for (const villain of combos) total += 52 - known.length - villain.length;
      if (total <= exactLimit) {
        for (const villain of combos) {
          const deck = removeKnown(fullDeck(), [...known, ...villain]);
          for (const river of deck) runOne(villain, [river]);
        }
        exactUsed = true;
      }
    } else if (missing === 2) {
      let total = 0;
      for (const villain of combos) {
        const remaining = 52 - known.length - villain.length;
        total += remaining * (remaining - 1) / 2;
        if (total > exactLimit) break;
      }
      if (total <= exactLimit) {
        for (const villain of combos) {
          const deck = removeKnown(fullDeck(), [...known, ...villain]);
          for (let i = 0; i < deck.length - 1; i += 1) {
            for (let j = i + 1; j < deck.length; j += 1) runOne(villain, [deck[i], deck[j]]);
          }
        }
        exactUsed = true;
      }
    }

    if (!exactUsed) {
      const n = Math.max(500, Math.round(trials));
      for (let i = 0; i < n; i += 1) {
        const villain = combos[sampleIndex(combos.length, rng)];
        const deck = shuffle(removeKnown(fullDeck(), [...known, ...villain]), rng);
        runOne(villain, deck.slice(0, missing));
      }
    }

    const equity = samples ? (wins + ties * 0.5) / samples : 0;
    // For Monte Carlo this is a conservative Bernoulli approximation; exact enumerations have no sampling error.
    const stderr = exactUsed || !samples ? 0 : Math.sqrt(Math.max(0, equity * (1 - equity) / samples));
    return {
      equity,
      win: samples ? wins / samples : 0,
      tie: samples ? ties / samples : 0,
      lose: samples ? losses / samples : 0,
      samples,
      stderr,
      ci95: 1.96 * stderr,
      exact: exactUsed,
      method: exactUsed ? 'exact' : 'montecarlo',
      combos: combos.length
    };
  }

  return {
    SUITS,
    SUIT_SYMBOL,
    RANKS,
    RANK_TEXT,
    HAND_NAMES,
    clamp,
    cardId,
    fullDeck,
    shuffle,
    parseCard,
    cardText,
    removeKnown,
    combinations,
    compareEval,
    eval5,
    best7,
    handName,
    handClass,
    expandRangeToken,
    expandRange,
    rangeCombos,
    potMath,
    callEV,
    exactHitProbability,
    analyzeOuts,
    equityVsRange
  };
});
