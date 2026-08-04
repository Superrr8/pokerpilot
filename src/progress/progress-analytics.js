'use strict';

(function attachProgressAnalytics(root) {
  const DateUtils = root.PokerPilotProgressDateUtils
    || (typeof require === 'function' ? require('./progress-date-utils.js') : null);
  const LiveMode = root.PokerPilotLiveMode
    || (typeof require === 'function' ? require('../live/live-mode.js') : null);

  const PERIODS = Object.freeze({
    '7d': Object.freeze({ id: '7d', label: '7 дней', days: 7 }),
    '30d': Object.freeze({ id: '30d', label: '30 дней', days: 30 }),
    all: Object.freeze({ id: 'all', label: 'Всё время', days: null })
  });
  const EVENT_CATEGORIES = Object.freeze({
    TRAINING_SCENARIO_COMPLETED: 'trainingScenarios',
    TRAINING_DECISION_RECORDED: 'trainerDecisions',
    EXAM_COMPLETED: 'exams',
    DAILY_CHALLENGE_COMPLETED: 'dailyChallenges'
  });
  const CATEGORY_LABELS = Object.freeze({
    trainingScenarios: 'Тренировочные сценарии',
    trainerDecisions: 'Решения Trainer',
    exams: 'Экзамены',
    dailyChallenges: 'Раздача дня',
    other: 'Другая учебная активность'
  });
  const EVENT_LABELS = Object.freeze({
    LESSON_COMPLETED: 'Урок завершён',
    EXAM_COMPLETED: 'Экзамен завершён',
    TRAINING_DECISION_RECORDED: 'Решение Trainer оценено',
    TRAINING_SCENARIO_COMPLETED: 'Сценарий тренировки завершён',
    TRAINING_SESSION_COMPLETED: 'Тренировочная сессия завершена',
    HAND_REVIEW_COMPLETED: 'Разбор раздачи завершён',
    DAILY_HAND_COMPLETED: 'Раздача дня завершена',
    DAILY_CHALLENGE_COMPLETED: 'Раздача дня завершена',
    LIVE_SESSION_REVIEWED: 'Live Poker: разбор завершён',
    SKILL_CHECK_COMPLETED: 'Проверка навыка завершена'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function finite(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function nonNegative(value) {
    const numeric = finite(value, 0);
    return Math.max(0, numeric);
  }

  function integer(value) {
    return Math.floor(nonNegative(value));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizePeriod(value) {
    return Object.hasOwn(PERIODS, value) ? value : '7d';
  }

  function historyDay(raw) {
    const explicit = DateUtils.normalizeDayKey(text(raw.localDate));
    if (explicit) return explicit;
    return DateUtils.dayKeyFromTimestamp(raw.timestamp, finite(raw.timezoneOffsetMinutes, 0));
  }

  function normalizeHistory(value) {
    const rows = Array.isArray(value) ? value : [];
    const seen = new Set();
    return rows.map((value, index) => {
      const raw = object(value);
      const eventId = text(raw.eventId || raw.id);
      const type = text(raw.type).toUpperCase();
      const timestampValue = typeof raw.timestamp === 'string' && Number.isFinite(Date.parse(raw.timestamp))
        ? new Date(Date.parse(raw.timestamp)).toISOString()
        : null;
      return {
        index,
        eventId,
        type,
        timestamp: timestampValue,
        day: historyDay(raw),
        source: text(LiveMode.normalizeProgressSource(raw.source), 'unknown'),
        xp: integer(raw.xp ?? raw.xpGained),
        summary: text(LiveMode.normalizeDisplayText(raw.summary)),
        lifetimeXpAfter: finite(raw.lifetimeXpAfter),
        levelAfter: finite(raw.levelAfter),
        rankAfter: text(raw.rankAfter) || null,
        pokerIqAfter: finite(raw.pokerIqAfter),
        streakAfter: finite(raw.streakAfter),
        metadata: LiveMode.normalizeProgressMetadata(object(raw.metadata))
      };
    }).filter(row => row.eventId && row.type && row.day).sort((left, right) => {
      const timeDelta = Date.parse(right.timestamp || '') - Date.parse(left.timestamp || '');
      if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
      return left.index - right.index;
    }).filter(row => {
      if (seen.has(row.eventId)) return false;
      seen.add(row.eventId);
      return true;
    });
  }

  function currentModel(snapshot) {
    const current = object(snapshot);
    const level = object(current.level);
    const rank = object(current.rank);
    const pokerIq = object(current.pokerIq);
    const streak = object(current.streak);
    return {
      lifetimeXp: integer(current.lifetimeXp),
      level: Math.max(1, integer(level.level) || 1),
      rank: text(rank.label, 'Без ранга'),
      rankId: text(rank.id, 'UNRANKED'),
      pokerIq: pokerIq.isRated === false ? null : finite(pokerIq.score),
      currentStreak: integer(streak.current),
      longestStreak: integer(streak.best)
    };
  }

  function coverageModel(snapshot, history) {
    const raw = object(object(snapshot).analyticsCoverage);
    const missingDetailedHistory = history.some(row =>
      row.type === 'TRAINING_DECISION_RECORDED' && row.pokerIqAfter === null
    );
    const isPartial = raw.isPartial === true || missingDetailedHistory;
    return {
      startsAt: typeof raw.startsAt === 'string' && Number.isFinite(Date.parse(raw.startsAt))
        ? new Date(Date.parse(raw.startsAt)).toISOString()
        : null,
      isPartial,
      reason: text(raw.reason) || (missingDetailedHistory ? 'POKER_IQ_HISTORY_PARTIAL' : null)
    };
  }

  function selectedRows(history, period, nowDay) {
    const bounded = history.filter(row => row.day <= nowDay);
    if (period.days === null) return bounded;
    const start = DateUtils.addCalendarDays(nowDay, 1 - period.days);
    return bounded.filter(row => row.day >= start);
  }

  function dailySeries(rows, period, nowDay, selector) {
    const values = new Map();
    rows.forEach(row => values.set(row.day, (values.get(row.day) || 0) + selector(row)));
    const days = period.days === null
      ? [...values.keys()].sort()
      : DateUtils.calendarRange(nowDay, period.days);
    return days.map(day => ({ day, value: Math.max(0, finite(values.get(day), 0)) }));
  }

  function categoryId(type) {
    return EVENT_CATEGORIES[type] || 'other';
  }

  function eventBreakdown(rows) {
    const counts = new Map();
    rows.forEach(row => {
      const id = categoryId(row.type);
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    const total = rows.length;
    return ['trainingScenarios', 'trainerDecisions', 'exams', 'dailyChallenges', 'other']
      .filter(id => counts.has(id))
      .map(id => ({
        id,
        label: CATEGORY_LABELS[id],
        count: counts.get(id),
        percent: total ? Math.round(counts.get(id) / total * 100) : 0
      }));
  }

  function pokerIqSeries(rows) {
    return [...rows].reverse().filter(row => row.pokerIqAfter !== null).map(row => ({
      day: row.day,
      timestamp: row.timestamp,
      value: row.pokerIqAfter
    }));
  }

  function recentActivity(rows, limit) {
    return rows.slice(0, Math.max(0, Math.min(20, integer(limit) || 8))).map(row => ({
      type: row.type,
      label: row.type === 'DAILY_CHALLENGE_COMPLETED'
        ? `Раздача дня — ${row.metadata.outcome === 'correct' ? 'правильный ответ' : 'ошибка'}`
        : EVENT_LABELS[row.type] || 'Учебная активность',
      timestamp: row.timestamp,
      day: row.day,
      xp: row.xp,
      source: row.source,
      resultingLevel: row.levelAfter,
      resultingRank: row.rankAfter
    }));
  }

  function createAnalyticsSnapshot({
    snapshot,
    history,
    period: requestedPeriod = '7d',
    now = () => new Date().toISOString(),
    timezoneOffsetMinutes = 0,
    recentLimit = 8
  } = {}) {
    const periodId = normalizePeriod(requestedPeriod);
    const period = PERIODS[periodId];
    const nowDay = DateUtils.resolveNowDay({ now, timezoneOffsetMinutes }) || '1970-01-01';
    const normalizedHistory = normalizeHistory(history);
    const rows = selectedRows(normalizedHistory, period, nowDay);
    const activity = dailySeries(rows, period, nowDay, () => 1);
    const dailyXp = dailySeries(rows, period, nowDay, row => row.xp);
    const activeDays = new Set(rows.map(row => row.day)).size;
    const xpGained = rows.reduce((sum, row) => sum + row.xp, 0);
    const breakdown = eventBreakdown(rows);
    const iqSeries = pokerIqSeries(rows);
    const coverage = coverageModel(snapshot, normalizedHistory);
    const trainerRows = rows.filter(row => row.type === 'TRAINING_DECISION_RECORDED');
    const pokerIqPartial = coverage.isPartial || trainerRows.some(row => row.pokerIqAfter === null);
    const result = {
      generatedAt: typeof now === 'function' ? now() : now,
      period: { ...period, startDay: period.days ? DateUtils.addCalendarDays(nowDay, 1 - period.days) : null, endDay: nowDay },
      coverage,
      current: currentModel(snapshot),
      periodSummary: {
        xpGained,
        activeDays,
        acceptedEvents: rows.length,
        trainingScenarios: breakdown.find(item => item.id === 'trainingScenarios')?.count || 0,
        trainerDecisions: breakdown.find(item => item.id === 'trainerDecisions')?.count || 0,
        exams: breakdown.find(item => item.id === 'exams')?.count || 0,
        dailyChallenges: breakdown.find(item => item.id === 'dailyChallenges')?.count || 0,
        averageXpPerActiveDay: activeDays ? Math.round(xpGained / activeDays * 10) / 10 : 0
      },
      series: {
        dailyActivity: activity,
        dailyXp,
        pokerIq: iqSeries
      },
      pokerIqHistory: {
        available: iqSeries.length > 0,
        isPartial: pokerIqPartial,
        startsAt: iqSeries[0]?.timestamp || null
      },
      eventBreakdown: breakdown,
      recentActivity: recentActivity(rows, recentLimit)
    };
    return clone(result);
  }

  const api = Object.freeze({
    PERIODS,
    EVENT_CATEGORIES,
    CATEGORY_LABELS,
    EVENT_LABELS,
    normalizePeriod,
    normalizeHistory,
    createAnalyticsSnapshot
  });

  root.PokerPilotProgressAnalytics = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
