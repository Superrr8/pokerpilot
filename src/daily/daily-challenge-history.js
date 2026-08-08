'use strict';

(function attachDailyChallengeHistory(root) {
  const DateUtils = root.PokerPilotDailyDate
    || (typeof require === 'function' ? require('./daily-date.js') : null);
  const Catalog = root.PokerPilotDailyChallengeCatalog
    || (typeof require === 'function' ? require('./daily-challenge-catalog.js') : null);
  const Storage = root.PokerPilotDailyChallengeStorage
    || (typeof require === 'function' ? require('./daily-challenge-storage.js') : null);

  const ACTION_LABELS = Object.freeze({
    FOLD: 'Fold', CHECK: 'Check', CALL: 'Call', BET: 'Bet', RAISE: 'Raise', ALL_IN: 'All-in'
  });
  const STREET_LABELS = Object.freeze({
    preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер'
  });
  const STATUS_LABELS = Object.freeze({
    correct: 'Правильно',
    incorrect: 'Неверно',
    pending: 'Награда ожидает начисления',
    legacy: 'Завершено без начисления',
    not_completed: 'Не завершено',
    today_available: 'Доступно сегодня'
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function dateLabel(dateKey) {
    if (!DateUtils.validDateKey(dateKey)) return '';
    const [year, month, day] = dateKey.split('-');
    return `${day}.${month}.${year}`;
  }

  function weekdayLabel(dateKey) {
    if (!DateUtils.validDateKey(dateKey)) return '';
    const [year, month, day] = dateKey.split('-').map(Number);
    const labels = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    return labels[new Date(year, month - 1, day, 12).getDay()];
  }

  function creditStatus(completion, isToday) {
    const status = completion.progress?.status;
    if (status === 'recorded') return completion.isCorrect ? 'correct' : 'incorrect';
    if (status === 'pending') return 'pending';
    if (status === 'legacy_uncredited') return 'legacy';
    return isToday ? 'pending' : 'legacy';
  }

  function create({ storage = Storage.create(), catalog = Catalog, now = () => new Date() } = {}) {
    function todayKey() {
      const value = typeof now === 'function' ? now() : now;
      const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
      return DateUtils.localDateKey(date);
    }

    function historySource() {
      return typeof storage?.getHistoryCompletions === 'function'
        ? storage.getHistoryCompletions()
        : [];
    }

    function entryFor(completion) {
      const challenge = catalog?.getById?.(completion.challengeId) || null;
      const isToday = completion.dateKey === todayKey();
      const status = creditStatus(completion, isToday);
      const xpAwarded = completion.progress?.status === 'recorded'
        && Number.isFinite(Number(completion.progress.xpAwarded))
        ? Math.max(0, Math.floor(Number(completion.progress.xpAwarded)))
        : null;
      return {
        dateKey: completion.dateKey,
        dateLabel: dateLabel(completion.dateKey),
        challengeId: completion.challengeId,
        challengeAvailable: Boolean(challenge),
        title: challenge?.title || 'Раздача дня',
        street: challenge?.street || null,
        streetLabel: STREET_LABELS[challenge?.street] || 'Улица недоступна',
        difficulty: challenge?.difficulty || 'Архивная раздача',
        selectedAction: completion.selectedAction,
        selectedActionLabel: ACTION_LABELS[completion.selectedAction] || completion.selectedAction,
        correctAction: completion.correctAction,
        correctActionLabel: ACTION_LABELS[completion.correctAction] || completion.correctAction,
        isCorrect: completion.isCorrect,
        outcomeLabel: completion.isCorrect ? 'Правильно' : 'Неверно',
        completedAt: completion.completedAt,
        creditStatus: status,
        xpAwarded,
        challenge: challenge ? clone(challenge) : null
      };
    }

    function getCompletionHistory() {
      return historySource()
        .map(entryFor)
        .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
        .map(clone);
    }

    function getCompletionByDate(dateKey) {
      if (!DateUtils.validDateKey(dateKey)) return null;
      return clone(getCompletionHistory().find(item => item.dateKey === dateKey) || null);
    }

    function getDailyChallengeStats() {
      const history = getCompletionHistory();
      const correct = history.filter(item => item.isCorrect).length;
      const incorrect = history.length - correct;
      const earnedXp = history.reduce((total, item) => total + (
        item.creditStatus === 'correct' || item.creditStatus === 'incorrect'
          ? Number(item.xpAwarded) || 0
          : 0
      ), 0);
      return {
        total: history.length,
        correct,
        incorrect,
        accuracy: history.length ? Math.round((correct / history.length) * 100) : 0,
        earnedXp,
        recent: history[0] ? clone(history[0]) : null
      };
    }

    function calendarDaysFor(history, current, count = 7) {
      const total = Math.max(1, Math.min(31, Math.floor(Number(count) || 7)));
      if (!current) return [];
      const completionMap = new Map(history.map(item => [item.dateKey, item]));
      return Array.from({ length: total }, (_, index) => {
        const dateKey = DateUtils.addCalendarDays(current, index - total + 1);
        const completion = completionMap.get(dateKey) || null;
        const isToday = dateKey === current;
        const status = completion?.creditStatus || (isToday ? 'today_available' : 'not_completed');
        return {
          date: dateKey,
          dateKey,
          dateLabel: dateLabel(dateKey),
          weekdayLabel: weekdayLabel(dateKey),
          dayNumber: Number(dateKey.slice(-2)),
          completed: Boolean(completion),
          correct: completion ? completion.isCorrect : null,
          status,
          statusLabel: STATUS_LABELS[status],
          isToday,
          openable: Boolean(completion),
          ariaLabel: `${dateLabel(dateKey)}: ${STATUS_LABELS[status]}`
        };
      });
    }

    function getRecentCalendarDays(count = 7) {
      return calendarDaysFor(getCompletionHistory(), todayKey(), count);
    }

    function streaksFor(history, currentDateKey) {
      const dates = [...new Set(history.map(item => item.dateKey))]
        .filter(DateUtils.validDateKey)
        .sort((left, right) => left.localeCompare(right));
      const completedDates = new Set(dates);
      const yesterday = DateUtils.addCalendarDays(currentDateKey, -1);
      const currentEnd = completedDates.has(currentDateKey)
        ? currentDateKey
        : (completedDates.has(yesterday) ? yesterday : null);
      let currentStreak = 0;
      let cursor = currentEnd;
      while (cursor && completedDates.has(cursor)) {
        currentStreak += 1;
        cursor = DateUtils.addCalendarDays(cursor, -1);
      }

      let bestStreak = 0;
      let running = 0;
      let previousIndex = null;
      dates.forEach(dateKey => {
        const index = DateUtils.calendarIndex(dateKey);
        running = previousIndex !== null && index === previousIndex + 1 ? running + 1 : 1;
        bestStreak = Math.max(bestStreak, running);
        previousIndex = index;
      });
      return { currentStreak, bestStreak };
    }

    function getProgressSnapshot() {
      const history = getCompletionHistory();
      const current = todayKey();
      const correctCount = history.filter(item => item.isCorrect).length;
      const streaks = current ? streaksFor(history, current) : { currentStreak: 0, bestStreak: 0 };
      return clone({
        currentStreak: streaks.currentStreak,
        bestStreak: streaks.bestStreak,
        completedCount: history.length,
        correctCount,
        accuracy: history.length ? Math.round((correctCount / history.length) * 100) : 0,
        completedToday: Boolean(current && history.some(item => item.dateKey === current)),
        recentDays: calendarDaysFor(history, current, 7)
      });
    }

    function getHistoricalReview(dateKey) {
      const entry = getCompletionByDate(dateKey);
      if (!entry) return null;
      const challenge = entry.challenge;
      return {
        readOnly: true,
        dateKey: entry.dateKey,
        dateLabel: entry.dateLabel,
        title: entry.title,
        street: entry.street,
        streetLabel: entry.streetLabel,
        difficulty: entry.difficulty,
        challengeAvailable: entry.challengeAvailable,
        heroCards: challenge?.heroCards ? [...challenge.heroCards] : [],
        board: challenge?.board ? [...challenge.board] : [],
        context: challenge?.context || 'Подробности этой архивной раздачи недоступны.',
        selectedAction: entry.selectedAction,
        selectedActionLabel: entry.selectedActionLabel,
        correctAction: entry.correctAction,
        correctActionLabel: entry.correctActionLabel,
        isCorrect: entry.isCorrect,
        outcomeLabel: entry.outcomeLabel,
        xpAwarded: entry.xpAwarded,
        explanation: challenge?.explanation || 'Разбор недоступен: исходная раздача больше не входит в каталог.',
        unavailableMessage: entry.challengeAvailable
          ? null
          : 'Карты и полный контекст этой архивной раздачи недоступны.'
      };
    }

    return Object.freeze({
      getCompletionHistory,
      getCompletionByDate,
      getDailyChallengeStats,
      getRecentCalendarDays,
      getProgressSnapshot,
      getHistoricalReview
    });
  }

  const api = Object.freeze({ create, dateLabel });
  root.PokerPilotDailyChallengeHistory = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
