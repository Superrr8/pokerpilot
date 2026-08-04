'use strict';

(function attachProgressSystem(root) {
  const Config = root.PokerPilotProgressConfig
    || (typeof require === 'function' ? require('./progress-config.js') : null);
  const DecisionQuality = root.DecisionQualityEngine
    || (typeof require === 'function' ? require('../decision-quality/decision-quality-engine.js') : null);
  const PokerIQ = root.PokerIQ
    || (typeof require === 'function' ? require('../poker-iq/poker-iq-engine.js') : null);
  const AchievementSystem = root.PokerPilotAchievementSystem
    || (typeof require === 'function' ? require('./achievement-system.js') : null);
  const DateUtils = root.PokerPilotProgressDateUtils
    || (typeof require === 'function' ? require('./progress-date-utils.js') : null);
  const Analytics = root.PokerPilotProgressAnalytics
    || (typeof require === 'function' ? require('./progress-analytics.js') : null);
  const LiveMode = root.PokerPilotLiveMode
    || (typeof require === 'function' ? require('../live/live-mode.js') : null);
  const EVENT_TYPES = new Set(Config.EVENT_TYPES);
  const SKILL_IDS = new Set(Config.SKILL_IDS);

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function boundedText(value, maximum, fallback = '') {
    return [...text(value, fallback)].slice(0, maximum).join('');
  }

  function finite(value, fallback = null) {
    if (value === null || value === undefined || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function nonNegativeInteger(value, fallback = 0) {
    const numeric = finite(value);
    return numeric === null ? fallback : Math.max(0, Math.floor(numeric));
  }

  function safeIso(value, fallback) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
  }

  function createPlayerId() {
    return `progress-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function skillConfidence(attempts) {
    if (attempts < 3) return 'insufficient';
    if (attempts < 10) return 'low';
    if (attempts < 30) return 'medium';
    return 'high';
  }

  function defaultSkill() {
    return {
      score: null,
      attempts: 0,
      confidence: 'insufficient',
      recentTrend: 'INSUFFICIENT_DATA',
      updatedAt: null
    };
  }

  function defaultSkills() {
    return Object.fromEntries(Config.SKILL_IDS.map(id => [id, defaultSkill()]));
  }

  function createDefaultProgressState({ now, playerId } = {}) {
    const timestamp = safeIso(
      typeof now === 'function' ? now() : now,
      '1970-01-01T00:00:00.000Z'
    );
    return {
      schemaVersion: Config.SCHEMA_VERSION,
      playerId: boundedText(playerId, 160, createPlayerId()),
      lifetimeXp: 0,
      decisionRecords: [],
      counters: {
        trainingScenarios: 0,
        trainerDecisions: 0,
        exams: 0
      },
      achievements: AchievementSystem.createDefaultAchievementState(),
      streak: {
        current: 0,
        best: 0,
        lastQualifiedDate: null
      },
      skills: defaultSkills(),
      history: [],
      analyticsCoverage: {
        startsAt: timestamp,
        isPartial: false,
        reason: null
      },
      processedEventIds: [],
      metadata: {
        createdAt: timestamp,
        updatedAt: timestamp,
        migratedFrom: [],
        eventCount: 0
      }
    };
  }

  function normalizeDecisionQuality(value) {
    const raw = object(value);
    const score = finite(raw.score);
    const isRated = raw.isRated === true && score !== null && score >= 0 && score <= 100;
    return {
      schemaVersion: nonNegativeInteger(raw.schemaVersion, 1) || 1,
      score: isRated ? score : null,
      classification: boundedText(raw.classification, 32, isRated ? 'ACCEPTABLE' : 'UNRATED'),
      confidence: ['low', 'medium', 'high'].includes(String(raw.confidence).toLowerCase())
        ? String(raw.confidence).toLowerCase()
        : 'medium',
      isRated,
      isMarginal: Boolean(raw.isMarginal),
      modelVersion: boundedText(raw.modelVersion, 80),
      evaluatedAt: safeIso(raw.evaluatedAt, '1970-01-01T00:00:00.000Z')
    };
  }

  function normalizeDecisionRecord(value, index = 0) {
    const raw = object(value);
    const dq = normalizeDecisionQuality(raw.decisionQuality);
    const trainer = object(raw.trainerSnapshot);
    const decisionId = text(raw.decisionId);
    if (!decisionId && !dq.isRated) return null;
    const date = safeIso(
      raw.date || raw.timestamp || dq.evaluatedAt,
      '1970-01-01T00:00:00.000Z'
    );
    const confidence = ['low', 'medium', 'high'].includes(String(trainer.confidence).toLowerCase())
      ? String(trainer.confidence).toLowerCase()
      : dq.confidence;
    return {
      decisionId: boundedText(decisionId || `legacy-${date}-${index}`, 160),
      date,
      street: boundedText(raw.street, 24, 'unknown').toLowerCase(),
      decisionMode: boundedText(raw.decisionMode || raw.mode, 24, 'UNKNOWN').toUpperCase(),
      sessionId: boundedText(raw.sessionId, 160) || null,
      trainerSnapshot: {
        confidence,
        isMarginal: Boolean(trainer.isMarginal || dq.isMarginal)
      },
      decisionQuality: {
        ...dq,
        confidence,
        isMarginal: Boolean(trainer.isMarginal || dq.isMarginal)
      }
    };
  }

  function normalizeDecisionRecords(value) {
    const records = Array.isArray(value) ? value : [];
    const seen = new Set();
    return records
      .map(normalizeDecisionRecord)
      .filter(record => {
        if (!record || seen.has(record.decisionId)) return false;
        seen.add(record.decisionId);
        return true;
      })
      .sort((left, right) =>
        Date.parse(right.date) - Date.parse(left.date)
        || left.decisionId.localeCompare(right.decisionId)
      )
      .slice(0, Config.DECISION_RETENTION);
  }

  function normalizeSkill(value) {
    const raw = object(value);
    const attempts = nonNegativeInteger(raw.attempts);
    const score = finite(raw.score);
    return {
      score: score === null ? null : Math.max(0, Math.min(100, Math.round(score * 10) / 10)),
      attempts,
      confidence: skillConfidence(attempts),
      recentTrend: ['UP', 'DOWN', 'STABLE', 'INSUFFICIENT_DATA'].includes(raw.recentTrend)
        ? raw.recentTrend
        : 'INSUFFICIENT_DATA',
      updatedAt: safeIso(raw.updatedAt, null)
    };
  }

  function normalizeStreak(value, legacy = {}) {
    const raw = object(value);
    const current = nonNegativeInteger(raw.current ?? legacy.currentStreak);
    const best = Math.max(current, nonNegativeInteger(raw.best ?? legacy.bestStreak));
    const candidate = text(raw.lastQualifiedDate);
    const lastQualifiedDate = /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
    return { current, best, lastQualifiedDate };
  }

  function normalizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.map((item, index) => {
      const raw = object(item);
      const timestamp = safeIso(raw.timestamp, null);
      const explicitDay = DateUtils.normalizeDayKey(text(raw.localDate));
      const timezoneOffsetMinutes = finite(raw.timezoneOffsetMinutes, 0);
      const rawMetadata = object(raw.metadata);
      const metadata = {};
      for (const key of [
        'lessonId', 'moduleId', 'scenarioId', 'sessionId', 'handId', 'challengeId',
        'skillId', 'decisionId', 'dateKey', 'outcome', 'selectedAction', 'correctAction',
        'street', 'difficulty'
      ]) {
        const value = boundedText(rawMetadata[key], 160);
        if (value) metadata[key] = value;
      }
      for (const key of ['mode', 'liveMode', 'tableMode']) {
        const value = boundedText(rawMetadata[key], 160);
        if (value) metadata[key] = LiveMode.normalizeIdentifier(value);
      }
      const score = finite(rawMetadata.score);
      if (score !== null) metadata.score = Math.max(0, Math.min(100, score));
      if (typeof rawMetadata.passed === 'boolean') metadata.passed = rawMetadata.passed;
      if (typeof rawMetadata.isCorrect === 'boolean') metadata.isCorrect = rawMetadata.isCorrect;
      for (const key of ['scheduleVersion', 'rewardVersion']) {
        const value = finite(rawMetadata[key]);
        if (value !== null && value >= 1) metadata[key] = Math.floor(value);
      }
      return {
        index,
        eventId: boundedText(raw.eventId, 160),
        type: boundedText(raw.type, 48),
        timestamp,
        localDate: explicitDay || DateUtils.dayKeyFromTimestamp(timestamp, timezoneOffsetMinutes),
        timezoneOffsetMinutes,
        source: boundedText(LiveMode.normalizeProgressSource(raw.source), 64, 'unknown'),
        xp: nonNegativeInteger(raw.xp),
        summary: boundedText(LiveMode.normalizeDisplayText(raw.summary), 240),
        lifetimeXpAfter: finite(raw.lifetimeXpAfter),
        levelAfter: finite(raw.levelAfter),
        rankAfter: boundedText(raw.rankAfter, 48) || null,
        pokerIqAfter: finite(raw.pokerIqAfter),
        streakAfter: finite(raw.streakAfter),
        metadata
      };
    }).filter(item => item.eventId && item.type).sort((left, right) => {
      const leftTime = left.timestamp ? Date.parse(left.timestamp) : -Infinity;
      const rightTime = right.timestamp ? Date.parse(right.timestamp) : -Infinity;
      return rightTime - leftTime || left.index - right.index;
    }).filter(item => {
      if (seen.has(item.eventId)) return false;
      seen.add(item.eventId);
      return true;
    }).slice(0, Config.HISTORY_LIMIT).map(({ index, ...item }) => item);
  }

  function hasLegacyProgress(raw, history, decisionRecords) {
    const counters = object(raw.counters);
    return nonNegativeInteger(raw.lifetimeXp ?? raw.xp) > 0
      || history.length > 0
      || decisionRecords.length > 0
      || nonNegativeInteger(counters.trainingScenarios) > 0
      || nonNegativeInteger(counters.trainerDecisions) > 0
      || nonNegativeInteger(counters.exams) > 0
      || Object.keys(object(object(raw.achievements).unlocked)).length > 0;
  }

  function normalizeAnalyticsCoverage(raw, base, history, decisionRecords) {
    const source = object(raw.analyticsCoverage);
    if (nonNegativeInteger(raw.schemaVersion) >= 3) {
      return {
        startsAt: safeIso(source.startsAt, base.analyticsCoverage.startsAt),
        isPartial: source.isPartial === true,
        reason: boundedText(source.reason, 80) || null
      };
    }
    const partial = hasLegacyProgress(raw, history, decisionRecords);
    return {
      startsAt: base.analyticsCoverage.startsAt,
      isPartial: partial,
      reason: partial
        ? history.length ? 'LEGACY_HISTORY_PARTIAL' : 'LEGACY_TOTALS_WITHOUT_DETAILED_HISTORY'
        : null
    };
  }

  function inferredCounters(raw, decisionRecords, history) {
    const counters = object(raw.counters);
    const scenarioEvents = history.filter(item => item.type === 'TRAINING_SCENARIO_COMPLETED').length;
    const examEvents = history.filter(item => item.type === 'EXAM_COMPLETED').length;
    return {
      trainingScenarios: Math.max(nonNegativeInteger(counters.trainingScenarios), scenarioEvents),
      trainerDecisions: Math.max(nonNegativeInteger(counters.trainerDecisions), decisionRecords.length),
      exams: Math.max(nonNegativeInteger(counters.exams), examEvents)
    };
  }

  function migrateProgressState(value, options = {}) {
    const base = createDefaultProgressState(options);
    const raw = object(value);
    const rawSkills = object(raw.skills);
    const skills = Object.fromEntries(Config.SKILL_IDS.map(id => [
      id,
      normalizeSkill(rawSkills[id])
    ]));
    const processedEventIds = Array.isArray(raw.processedEventIds)
      ? [...new Set(raw.processedEventIds.map(id => boundedText(id, 160)).filter(Boolean))]
        .slice(-Config.PROCESSED_EVENT_LIMIT)
      : [];
    const metadata = object(raw.metadata);
    const createdAt = safeIso(metadata.createdAt, base.metadata.createdAt);
    const decisionRecords = normalizeDecisionRecords(raw.decisionRecords);
    const history = normalizeHistory(raw.history);
    return {
      schemaVersion: Config.SCHEMA_VERSION,
      playerId: boundedText(raw.playerId, 160, base.playerId),
      lifetimeXp: nonNegativeInteger(raw.lifetimeXp ?? raw.xp),
      decisionRecords,
      counters: inferredCounters(raw, decisionRecords, history),
      achievements: AchievementSystem.normalizeAchievementState(raw.achievements),
      streak: normalizeStreak(raw.streak, raw),
      skills,
      history,
      analyticsCoverage: normalizeAnalyticsCoverage(raw, base, history, decisionRecords),
      processedEventIds,
      metadata: {
        createdAt,
        updatedAt: safeIso(metadata.updatedAt, createdAt),
        migratedFrom: Array.isArray(metadata.migratedFrom)
          ? metadata.migratedFrom.map(item => boundedText(item, 80)).filter(Boolean).slice(0, 20)
          : [],
        eventCount: nonNegativeInteger(metadata.eventCount)
      }
    };
  }

  function parseProgressState(value, options = {}) {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value;
      return migrateProgressState(parsed, options);
    } catch (_) {
      return createDefaultProgressState(options);
    }
  }

  function validateProgressState(value) {
    const errors = [];
    const raw = object(value);
    if (raw.schemaVersion !== Config.SCHEMA_VERSION) errors.push('schemaVersion');
    if (!text(raw.playerId)) errors.push('playerId');
    if (!Number.isFinite(raw.lifetimeXp) || raw.lifetimeXp < 0) errors.push('lifetimeXp');
    if (!Array.isArray(raw.decisionRecords)) errors.push('decisionRecords');
    if (!raw.counters || typeof raw.counters !== 'object') errors.push('counters');
    if (!raw.achievements || typeof raw.achievements !== 'object') errors.push('achievements');
    if (!Array.isArray(raw.history)) errors.push('history');
    if (!raw.analyticsCoverage || typeof raw.analyticsCoverage !== 'object') errors.push('analyticsCoverage');
    if (!Array.isArray(raw.processedEventIds)) errors.push('processedEventIds');
    if (Config.SKILL_IDS.some(id => !Object.hasOwn(object(raw.skills), id))) errors.push('skills');
    return { valid: errors.length === 0, errors };
  }

  function deriveLevel(value) {
    return Config.deriveLevel(value);
  }

  function deriveRank(value) {
    return PokerIQ.getRank(value);
  }

  function evaluateDecisionQuality(input) {
    return DecisionQuality.evaluate(input);
  }

  function updatePokerIq(records, decisionRecord) {
    const previousRecords = normalizeDecisionRecords(records);
    const currentRecords = normalizeDecisionRecords(
      decisionRecord ? [decisionRecord, ...previousRecords] : previousRecords
    );
    const previous = PokerIQ.evaluate(previousRecords);
    const current = PokerIQ.evaluate(currentRecords);
    return {
      previous,
      current,
      delta: previous.score === null || current.score === null ? null : current.score - previous.score,
      reason: currentRecords.length === previousRecords.length ? 'DUPLICATE_OR_UNRATED' : 'DECISION_ADDED',
      confidence: current.sampleStatus
    };
  }

  function decisionQualitySnapshot(records) {
    const rated = normalizeDecisionRecords(records).filter(record => record.decisionQuality.isRated);
    const latest = rated[0]?.decisionQuality || null;
    const recent = rated.slice(0, 20).map(record => record.decisionQuality.score);
    return {
      score: latest?.score ?? null,
      classification: latest?.classification || 'UNRATED',
      isRated: Boolean(latest),
      recentAverage: recent.length
        ? Math.round(recent.reduce((sum, score) => sum + score, 0) / recent.length * 10) / 10
        : null,
      ratedDecisions: rated.length
    };
  }

  function achievementMetrics(state, pokerIqValue = null) {
    const pokerIq = pokerIqValue || PokerIQ.evaluate(state.decisionRecords);
    return {
      trainingScenarios: state.counters.trainingScenarios,
      trainerDecisions: state.counters.trainerDecisions,
      exams: state.counters.exams,
      lifetimeXp: state.lifetimeXp,
      level: deriveLevel(state.lifetimeXp).level,
      streak: state.streak.current,
      pokerIq: pokerIq.isRated ? pokerIq.score : 0,
      rank: pokerIq.rank
    };
  }

  function createSnapshot(value) {
    const state = migrateProgressState(value);
    const pokerIq = PokerIQ.evaluate(state.decisionRecords);
    return {
      schemaVersion: state.schemaVersion,
      playerId: state.playerId,
      lifetimeXp: state.lifetimeXp,
      level: deriveLevel(state.lifetimeXp),
      decisionQuality: decisionQualitySnapshot(state.decisionRecords),
      pokerIq,
      rank: clone(pokerIq.rank),
      counters: clone(state.counters),
      achievements: AchievementSystem.createAchievementSnapshot({
        state: state.achievements,
        metrics: achievementMetrics(state, pokerIq)
      }),
      streak: clone(state.streak),
      skills: clone(state.skills),
      recentChanges: clone(state.history.slice(0, 10)),
      analyticsCoverage: clone(state.analyticsCoverage),
      metadata: clone(state.metadata)
    };
  }

  function validPayload(type, payload) {
    const raw = object(payload);
    if (type === 'LESSON_COMPLETED') return Boolean(text(raw.lessonId));
    if (type === 'EXAM_COMPLETED') {
      const score = finite(raw.score);
      return Boolean(text(raw.moduleId)) && score !== null && score >= 0 && score <= 100;
    }
    if (type === 'TRAINING_DECISION_RECORDED') {
      return Boolean(normalizeDecisionRecord(raw.decisionRecord));
    }
    if (type === 'TRAINING_SCENARIO_COMPLETED') {
      return Boolean(text(raw.scenarioId)) && Boolean(text(raw.decisionId));
    }
    if (type === 'TRAINING_SESSION_COMPLETED') return Boolean(text(raw.sessionId));
    if (type === 'HAND_REVIEW_COMPLETED') return Boolean(text(raw.handId));
    if (type === 'DAILY_HAND_COMPLETED') return Boolean(text(raw.handId || raw.challengeId));
    if (type === 'DAILY_CHALLENGE_COMPLETED') {
      const scheduleVersion = finite(raw.scheduleVersion);
      const rewardVersion = finite(raw.rewardVersion);
      const actions = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
      const selectedAction = text(raw.selectedAction).toUpperCase();
      const correctAction = text(raw.correctAction).toUpperCase();
      return Boolean(text(raw.challengeId))
        && /^\d{4}-\d{2}-\d{2}$/.test(text(raw.dateKey || raw.localDate))
        && scheduleVersion !== null && Number.isInteger(scheduleVersion) && scheduleVersion >= 1
        && rewardVersion !== null && Number.isInteger(rewardVersion) && rewardVersion >= 1
        && Config.xpRewardForEvent(type, raw) !== null
        && typeof raw.isCorrect === 'boolean'
        && ['correct', 'incorrect'].includes(text(raw.outcome).toLowerCase())
        && actions.has(selectedAction)
        && actions.has(correctAction)
        && raw.isCorrect === (selectedAction === correctAction);
    }
    if (type === 'LIVE_SESSION_REVIEWED') return Boolean(text(raw.sessionId));
    if (type === 'SKILL_CHECK_COMPLETED') {
      const score = finite(raw.score);
      return SKILL_IDS.has(text(raw.skillId)) && score !== null && score >= 0 && score <= 100;
    }
    return false;
  }

  function normalizeEvent(value) {
    const raw = object(value);
    const id = boundedText(raw.id, 160);
    const type = text(raw.type).toUpperCase();
    const payload = object(raw.payload);
    if (!id || !EVENT_TYPES.has(type) || !validPayload(type, payload)) return null;
    return {
      id,
      type,
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
      source: boundedText(LiveMode.normalizeProgressSource(raw.source), 64, 'unknown'),
      payload
    };
  }

  function eventLocalDate(event) {
    if (
      event.type === 'TRAINING_DECISION_RECORDED'
      && normalizeDecisionRecord(event.payload.decisionRecord)?.decisionQuality.isRated !== true
    ) return null;
    const explicit = text(event.payload.localDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
    const timestamp = Date.parse(event.timestamp);
    if (!Number.isFinite(timestamp)) return null;
    const offset = finite(event.payload.timezoneOffsetMinutes, 0);
    return new Date(timestamp - offset * 60_000).toISOString().slice(0, 10);
  }

  function updateStreak(streak, date) {
    if (!date) return clone(streak);
    if (!streak.lastQualifiedDate) {
      return { current: 1, best: Math.max(1, streak.best), lastQualifiedDate: date };
    }
    if (date === streak.lastQualifiedDate) return clone(streak);
    const currentDay = Date.parse(`${date}T00:00:00.000Z`);
    const previousDay = Date.parse(`${streak.lastQualifiedDate}T00:00:00.000Z`);
    if (!Number.isFinite(currentDay) || !Number.isFinite(previousDay) || currentDay < previousDay) {
      return clone(streak);
    }
    const difference = Math.round((currentDay - previousDay) / 86_400_000);
    const current = difference === 1 ? streak.current + 1 : 1;
    return {
      current,
      best: Math.max(streak.best, current),
      lastQualifiedDate: date
    };
  }

  function skillForPayload(payload) {
    const direct = text(payload.skillId);
    if (SKILL_IDS.has(direct)) return direct;
    const topic = text(payload.topic).toLowerCase();
    return Object.hasOwn(Config.TOPIC_TO_SKILL, topic)
      ? Config.TOPIC_TO_SKILL[topic]
      : null;
  }

  function updateSkill(skill, score, timestamp) {
    const attempts = skill.attempts + 1;
    const previousScore = finite(skill.score);
    const nextScore = previousScore === null
      ? score
      : Math.round(((previousScore * skill.attempts + score) / attempts) * 10) / 10;
    const delta = previousScore === null ? 0 : nextScore - previousScore;
    return {
      score: nextScore,
      attempts,
      confidence: skillConfidence(attempts),
      recentTrend: attempts < 5 ? 'INSUFFICIENT_DATA' : delta > 0.5 ? 'UP' : delta < -0.5 ? 'DOWN' : 'STABLE',
      updatedAt: safeIso(timestamp, skill.updatedAt)
    };
  }

  function historySummary(event, xp) {
    const payload = event.payload;
    const identifier = payload.lessonId || payload.moduleId || payload.scenarioId || payload.sessionId
      || payload.handId || payload.challengeId || payload.skillId || payload.decisionRecord?.decisionId;
    return boundedText(LiveMode.normalizeDisplayText(
      `${event.type}${identifier ? ` · ${String(identifier)}` : ''}${xp ? ` · +${xp} XP` : ''}`,
    ), 240);
  }

  function historyMetadata(event) {
    const payload = object(event.payload);
    const metadata = {};
    for (const key of [
      'lessonId', 'moduleId', 'scenarioId', 'sessionId', 'handId', 'challengeId',
      'skillId', 'decisionId', 'dateKey', 'outcome', 'selectedAction', 'correctAction',
      'street', 'difficulty'
    ]) {
      const value = boundedText(payload[key], 160);
      if (value) metadata[key] = value;
    }
    for (const key of ['mode', 'liveMode', 'tableMode']) {
      const value = boundedText(payload[key], 160);
      if (value) metadata[key] = LiveMode.normalizeIdentifier(value);
    }
    const decisionId = boundedText(payload.decisionRecord?.decisionId, 160);
    if (decisionId) metadata.decisionId = decisionId;
    const score = finite(payload.score);
    if (score !== null) metadata.score = Math.max(0, Math.min(100, score));
    if (typeof payload.passed === 'boolean') metadata.passed = payload.passed;
    if (typeof payload.isCorrect === 'boolean') metadata.isCorrect = payload.isCorrect;
    for (const key of ['scheduleVersion', 'rewardVersion']) {
      const value = finite(payload[key]);
      if (value !== null && value >= 1) metadata[key] = Math.floor(value);
    }
    return metadata;
  }

  function rankOrder(value) {
    const id = text(object(value).id);
    if (id === 'UNRANKED') return -1;
    return Config.RANKS.findIndex(rank => rank.id === id);
  }

  function transition(beforeState, afterState, xp, newlyUnlocked = []) {
    const before = createSnapshot(beforeState);
    const after = createSnapshot(afterState);
    return {
      xp: {
        gained: nonNegativeInteger(xp),
        previous: before.lifetimeXp,
        current: after.lifetimeXp
      },
      level: {
        previous: before.level.level,
        current: after.level.level,
        leveledUp: after.level.level > before.level.level
      },
      rank: {
        previous: clone(before.rank),
        current: clone(after.rank),
        rankedUp: rankOrder(after.rank) > rankOrder(before.rank)
      },
      achievements: {
        newlyUnlocked: clone(newlyUnlocked)
      }
    };
  }

  function unapplied(state, reason, event = null) {
    return {
      applied: false,
      state,
      rewards: { xp: 0 },
      changes: [],
      reason,
      ignored: true,
      duplicate: reason === 'DUPLICATE_EVENT' || reason === 'DUPLICATE_DECISION',
      event: event ? { id: event.id, type: event.type, source: event.source } : null,
      transition: transition(state, state, 0, [])
    };
  }

  function applyProgressEvent(value, inputEvent) {
    const state = migrateProgressState(value);
    const event = normalizeEvent(inputEvent);
    if (!event) return unapplied(state, 'INVALID_EVENT');
    if (state.processedEventIds.includes(event.id)) return unapplied(state, 'DUPLICATE_EVENT', event);
    if (
      event.type === 'TRAINING_DECISION_RECORDED'
      && state.decisionRecords.some(record =>
        record.decisionId === text(event.payload.decisionRecord?.decisionId)
      )
    ) return unapplied(state, 'DUPLICATE_DECISION', event);

    const next = clone(state);
    const xp = nonNegativeInteger(Config.xpRewardForEvent(event.type, event.payload));
    next.lifetimeXp += xp;
    const changes = xp ? [{ type: 'XP', amount: xp }] : [];

    if (event.type === 'TRAINING_SCENARIO_COMPLETED') next.counters.trainingScenarios += 1;
    if (event.type === 'TRAINING_DECISION_RECORDED') next.counters.trainerDecisions += 1;
    if (event.type === 'EXAM_COMPLETED') next.counters.exams += 1;

    if (event.type === 'TRAINING_DECISION_RECORDED') {
      const record = normalizeDecisionRecord(event.payload.decisionRecord);
      const iqUpdate = updatePokerIq(next.decisionRecords, record);
      next.decisionRecords = normalizeDecisionRecords([record, ...next.decisionRecords]);
      changes.push({
        type: 'DECISION_QUALITY',
        score: record.decisionQuality.score,
        classification: record.decisionQuality.classification
      });
      if (iqUpdate.delta !== null) changes.push({ type: 'POKER_IQ', delta: iqUpdate.delta });
    }

    const skillId = skillForPayload(event.payload);
    let skillScore = null;
    if (event.type === 'SKILL_CHECK_COMPLETED') skillScore = finite(event.payload.score);
    if (event.type === 'TRAINING_DECISION_RECORDED') {
      skillScore = finite(event.payload.decisionRecord?.decisionQuality?.score);
    }
    if (skillId && skillScore !== null) {
      next.skills[skillId] = updateSkill(next.skills[skillId], skillScore, event.timestamp);
      changes.push({ type: 'SKILL', skillId, score: next.skills[skillId].score });
    }

    next.streak = updateStreak(next.streak, eventLocalDate(event));
    const achievementEvaluation = AchievementSystem.evaluateAchievements({
      state: next.achievements,
      metrics: achievementMetrics(next),
      eventId: event.id,
      timestamp: event.timestamp
    });
    next.achievements = achievementEvaluation.state;
    achievementEvaluation.newlyUnlocked.forEach(item => changes.push({
      type: 'ACHIEVEMENT_UNLOCKED',
      achievementId: item.id
    }));
    next.processedEventIds = [...next.processedEventIds, event.id].slice(-Config.PROCESSED_EVENT_LIMIT);
    const postPokerIq = PokerIQ.evaluate(next.decisionRecords);
    const localDate = eventLocalDate(event);
    const eventTimestamp = safeIso(event.timestamp, null);
    next.history = [{
      eventId: event.id,
      type: event.type,
      timestamp: eventTimestamp,
      localDate,
      timezoneOffsetMinutes: finite(event.payload.timezoneOffsetMinutes, 0),
      source: event.source,
      xp,
      summary: historySummary(event, xp),
      lifetimeXpAfter: next.lifetimeXp,
      levelAfter: deriveLevel(next.lifetimeXp).level,
      rankAfter: postPokerIq.rank?.id || 'UNRANKED',
      pokerIqAfter: event.type === 'DAILY_CHALLENGE_COMPLETED'
        ? null
        : postPokerIq.isRated ? postPokerIq.score : null,
      streakAfter: next.streak.current,
      metadata: historyMetadata(event)
    }, ...next.history].slice(0, Config.HISTORY_LIMIT);
    next.metadata.updatedAt = safeIso(event.timestamp, next.metadata.updatedAt);
    next.metadata.eventCount += 1;
    const normalizedNext = migrateProgressState(next);
    return {
      applied: true,
      state: normalizedNext,
      rewards: { xp },
      changes,
      reason: 'APPLIED',
      ignored: false,
      duplicate: false,
      event: { id: event.id, type: event.type, source: event.source },
      transition: transition(state, normalizedNext, xp, achievementEvaluation.newlyUnlocked)
    };
  }

  function legacyState({ legacyProfile, legacyProgress, now, playerId }) {
    const profile = object(legacyProfile);
    const progress = object(legacyProgress);
    const state = createDefaultProgressState({
      now,
      playerId: text(profile.id, playerId)
    });
    state.lifetimeXp = nonNegativeInteger(profile.progression?.totalXp);
    state.decisionRecords = normalizeDecisionRecords(progress.history);
    if (state.lifetimeXp > 0 || state.decisionRecords.length > 0) {
      state.analyticsCoverage = {
        startsAt: safeIso(typeof now === 'function' ? now() : now, state.metadata.createdAt),
        isPartial: true,
        reason: 'LEGACY_TOTALS_WITHOUT_DETAILED_HISTORY'
      };
    }
    state.metadata.migratedFrom = [
      ...(Object.keys(profile).length ? ['pokerpilot_profile'] : []),
      ...(Object.keys(progress).length ? ['pokerpilot_v1_6_progress'] : [])
    ];
    return state;
  }

  function create({
    storage,
    now = () => new Date().toISOString(),
    createPlayerId: makePlayerId = createPlayerId,
    legacyProfile,
    legacyProgress,
    autoLoad = true
  } = {}) {
    let activeStorage = storage;
    if (activeStorage === undefined) {
      try {
        activeStorage = root.localStorage || null;
      } catch (_) {
        activeStorage = null;
      }
    }
    const listeners = new Set();
    let status = { persisted: Boolean(activeStorage), error: null };
    let state = createDefaultProgressState({ now: now(), playerId: makePlayerId() });
    let initialized = false;

    function persist() {
      if (!activeStorage || typeof activeStorage.setItem !== 'function') {
        status = { persisted: false, error: null };
        return false;
      }
      try {
        activeStorage.setItem(Config.STORAGE_KEY, JSON.stringify(state));
        status = { persisted: true, error: null };
        return true;
      } catch (error) {
        status = { persisted: false, error: text(error?.message, 'Storage error') };
        return false;
      }
    }

    function load(options = {}) {
      let stored = null;
      try {
        stored = activeStorage && typeof activeStorage.getItem === 'function'
          ? activeStorage.getItem(Config.STORAGE_KEY)
          : null;
      } catch (error) {
        status = { persisted: false, error: text(error?.message, 'Storage error') };
      }
      if (stored !== null && stored !== undefined && stored !== '') {
        state = parseProgressState(stored, { now: now(), playerId: makePlayerId() });
      } else {
        state = legacyState({
          legacyProfile: options.legacyProfile ?? legacyProfile,
          legacyProgress: options.legacyProgress ?? legacyProgress,
          now: now(),
          playerId: makePlayerId()
        });
      }
      initialized = true;
      persist();
      return createSnapshot(state);
    }

    function ensureLoaded() {
      if (!initialized) load();
    }

    function notify() {
      const snapshot = createSnapshot(state);
      listeners.forEach(listener => listener(clone(snapshot)));
    }

    function recordEvent(event) {
      ensureLoaded();
      const result = applyProgressEvent(state, event);
      if (result.applied) {
        state = result.state;
        persist();
        notify();
      }
      return { ...result, state: clone(result.state), snapshot: createSnapshot(result.state) };
    }

    function getAnalyticsSnapshot(options = {}) {
      ensureLoaded();
      return Analytics.createAnalyticsSnapshot({
        snapshot: createSnapshot(state),
        history: clone(state.history),
        period: options.period,
        now: options.now ?? now,
        timezoneOffsetMinutes: options.timezoneOffsetMinutes ?? 0,
        recentLimit: options.recentLimit
      });
    }

    function importState(value) {
      ensureLoaded();
      try {
        const candidate = typeof value === 'string' ? JSON.parse(value) : value;
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
          return { imported: false, reason: 'INVALID_IMPORT', state: clone(state) };
        }
        const migrated = migrateProgressState(candidate, { now: now(), playerId: state.playerId });
        if (!validateProgressState(migrated).valid) {
          return { imported: false, reason: 'INVALID_IMPORT', state: clone(state) };
        }
        state = migrated;
        persist();
        notify();
        return { imported: true, state: clone(state), snapshot: createSnapshot(state) };
      } catch (_) {
        return { imported: false, reason: 'INVALID_IMPORT', state: clone(state) };
      }
    }

    const store = Object.freeze({
      load,
      getSnapshot() {
        ensureLoaded();
        return createSnapshot(state);
      },
      getAnalyticsSnapshot,
      recordEvent,
      resetForTesting() {
        state = createDefaultProgressState({ now: now(), playerId: makePlayerId() });
        initialized = true;
        persist();
        notify();
        return createSnapshot(state);
      },
      export() {
        ensureLoaded();
        return clone(state);
      },
      import: importState,
      subscribe(listener) {
        if (typeof listener !== 'function') throw new Error('Listener must be a function');
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getStatus() {
        return { ...status };
      }
    });

    if (autoLoad) load();
    return store;
  }

  const singleton = create({ autoLoad: false });
  const api = Object.freeze({
    createDefaultProgressState,
    parseProgressState,
    migrateProgressState,
    validateProgressState,
    deriveLevel,
    deriveRank,
    evaluateDecisionQuality,
    updatePokerIq,
    applyProgressEvent,
    createSnapshot,
    create,
    load: singleton.load,
    getSnapshot: singleton.getSnapshot,
    getAnalyticsSnapshot: singleton.getAnalyticsSnapshot,
    recordEvent: singleton.recordEvent,
    resetForTesting: singleton.resetForTesting,
    export: singleton.export,
    import: singleton.import,
    subscribe: singleton.subscribe,
    getStatus: singleton.getStatus
  });

  root.ProgressSystem = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
