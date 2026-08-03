'use strict';

(function attachProgressOverview(root) {
  const SKILL_IDS = Object.freeze([
    'preflop',
    'value',
    'bluffing',
    'discipline',
    'pokerMath',
    'postflop'
  ]);
  const SKILL_LABELS = Object.freeze({
    preflop: 'Префлоп',
    value: 'Вэлью',
    bluffing: 'Блефы',
    discipline: 'Дисциплина',
    pokerMath: 'Покерная математика',
    postflop: 'Постфлоп'
  });
  const CONFIDENCE_LABELS = Object.freeze({
    insufficient: 'Мало данных',
    low: 'Низкая уверенность',
    medium: 'Средняя уверенность',
    high: 'Высокая уверенность'
  });
  const TREND_LABELS = Object.freeze({
    UP: 'Растёт',
    DOWN: 'Снижается',
    STABLE: 'Стабильно'
  });
  const DECISION_BANDS = Object.freeze({
    EXCELLENT: 'Отличное решение',
    GOOD: 'Хорошее решение',
    ACCEPTABLE: 'Приемлемое решение',
    POOR: 'Слабое решение',
    BLUNDER: 'Грубая ошибка'
  });
  const EVENT_LABELS = Object.freeze({
    LESSON_COMPLETED: 'Урок завершён',
    EXAM_COMPLETED: 'Экзамен завершён',
    TRAINING_DECISION_RECORDED: 'Решение оценено',
    TRAINING_SCENARIO_COMPLETED: 'Сценарий тренировки завершён',
    TRAINING_SESSION_COMPLETED: 'Тренировка завершена',
    HAND_REVIEW_COMPLETED: 'Раздача разобрана',
    DAILY_HAND_COMPLETED: 'Раздача дня завершена',
    LIVE_SESSION_REVIEWED: 'Live Session разобрана',
    SKILL_CHECK_COMPLETED: 'Проверка навыка завершена'
  });
  const ACHIEVEMENT_ICONS = Object.freeze({
    spark: '✦', bolt: '↯', decision: '◎', mind: '◇', book: '▤',
    flame: '♨', calendar: '▦', exam: '✓', rank: '◆', chips: '●'
  });
  const RARITY_LABELS = Object.freeze({
    COMMON: 'Обычное',
    RARE: 'Редкое',
    EPIC: 'Эпическое',
    LEGENDARY: 'Легендарное'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function finite(value, fallback = null) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function nonNegativeInteger(value, fallback = 0) {
    const numeric = finite(value);
    return numeric === null ? fallback : Math.max(0, Math.floor(numeric));
  }

  function boundedScore(value) {
    const numeric = finite(value);
    return numeric === null || numeric < 0 || numeric > 100 ? null : numeric;
  }

  function displayName(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || 'Player';
  }

  function attemptWord(value) {
    const lastTwo = value % 100;
    const last = value % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'попыток';
    if (last === 1) return 'попытка';
    if (last >= 2 && last <= 4) return 'попытки';
    return 'попыток';
  }

  function sampleLabel(count, status) {
    if (!count) return 'Недостаточно решений';
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'PROVISIONAL' || count < 5) return `${count} решений · предварительно`;
    if (normalized === 'FORMING' || count < 20) return `${count} решений · выборка формируется`;
    return `${count} решений · устойчивая выборка`;
  }

  function dateLabel(value) {
    const timestamp = typeof value === 'string' ? Date.parse(value) : NaN;
    if (!Number.isFinite(timestamp)) return '';
    const date = new Date(timestamp);
    return [
      String(date.getUTCDate()).padStart(2, '0'),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      date.getUTCFullYear()
    ].join('.');
  }

  function levelModel(value) {
    const level = object(value);
    const xpToNextLevel = Math.max(1, nonNegativeInteger(level.xpToNextLevel, 1));
    const xpIntoLevel = Math.min(xpToNextLevel, nonNegativeInteger(level.xpIntoLevel));
    return {
      number: Math.max(1, nonNegativeInteger(level.level, 1)),
      totalXp: nonNegativeInteger(level.totalXp),
      xpIntoLevel,
      xpToNextLevel,
      label: `${xpIntoLevel} / ${xpToNextLevel} XP`
    };
  }

  function pokerIqModel(snapshot) {
    const pokerIq = object(snapshot.pokerIq);
    const rank = object(snapshot.rank);
    const nestedRank = object(pokerIq.rank);
    const score = finite(pokerIq.score);
    const ratedDecisions = nonNegativeInteger(pokerIq.ratedDecisions);
    const isRated = pokerIq.isRated === true && score !== null;
    const trend = object(pokerIq.trend);
    const direction = String(trend.direction || '').toUpperCase();
    const delta = finite(trend.delta);
    const change = isRated && delta !== null && ['UP', 'DOWN'].includes(direction)
      ? `${delta > 0 ? '+' : ''}${Math.round(delta)}`
      : null;
    return {
      available: isRated,
      value: isRated ? String(Math.round(score)) : 'Не рассчитан',
      rank: isRated
        ? String(rank.label || nestedRank.label || 'Без ранга')
        : 'Без ранга',
      change,
      changeDirection: change ? direction.toLowerCase() : null,
      sampleLabel: sampleLabel(ratedDecisions, pokerIq.sampleStatus)
    };
  }

  function decisionQualityModel(value) {
    const dq = object(value);
    const score = boundedScore(dq.score);
    const available = dq.isRated === true && score !== null;
    const count = nonNegativeInteger(dq.ratedDecisions);
    return {
      available,
      value: available ? String(Math.round(score)) : 'Не рассчитана',
      band: available
        ? DECISION_BANDS[String(dq.classification || '').toUpperCase()] || 'Оценено'
        : null,
      sampleLabel: sampleLabel(count),
      recentAverage: available ? boundedScore(dq.recentAverage) : null,
      emptyMessage: available ? null : 'Недостаточно решений для оценки Decision Quality.'
    };
  }

  function skillModel(id, value) {
    const raw = object(value);
    const attempts = nonNegativeInteger(raw.attempts);
    const score = boundedScore(raw.score);
    const available = attempts > 0 && score !== null;
    const confidence = ['insufficient', 'low', 'medium', 'high'].includes(raw.confidence)
      ? raw.confidence
      : 'insufficient';
    const trend = String(raw.recentTrend || '').toUpperCase();
    return {
      id,
      label: SKILL_LABELS[id],
      available,
      score: available ? score : null,
      scoreLabel: available ? `${Math.round(score)} / 100` : 'Нет данных',
      attempts,
      attemptsLabel: available ? `${attempts} ${attemptWord(attempts)}` : null,
      confidence,
      confidenceLabel: available ? CONFIDENCE_LABELS[confidence] : null,
      trendLabel: available ? TREND_LABELS[trend] || null : null
    };
  }

  function weeklyFocusModel(skills) {
    const reliable = skills
      .filter(item =>
        item.available
        && item.attempts >= 10
        && ['medium', 'high'].includes(item.confidence)
        && item.score < 80
      )
      .sort((left, right) =>
        left.score - right.score || SKILL_IDS.indexOf(left.id) - SKILL_IDS.indexOf(right.id)
      );
    const target = reliable[0] || null;
    return {
      target,
      route: target ? 'study' : null,
      title: target ? target.label : 'Фокус недели пока не определён',
      description: target
        ? `Самый надёжно измеренный резерв роста: ${target.scoreLabel}.`
        : null,
      emptyMessage: target
        ? null
        : 'Недостаточно надёжных данных по навыкам. Продолжайте тренироваться.'
    };
  }

  function recentEventsModel(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(item => EVENT_LABELS[object(item).type])
      .slice(0, 3)
      .map(item => {
        const event = object(item);
        const xp = nonNegativeInteger(event.xp);
        return {
          id: String(event.eventId || ''),
          type: event.type,
          label: EVENT_LABELS[event.type],
          dateLabel: dateLabel(event.timestamp),
          xpLabel: xp ? `+${xp} XP` : null
        };
      });
  }

  function achievementsModel(value) {
    const raw = object(value);
    const source = Array.isArray(raw.items) ? raw.items : [];
    const items = source.map(value => {
      const item = object(value);
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!id || !title) return null;
      const unlocked = item.unlocked === true;
      const hidden = item.hidden === true && !unlocked;
      const progress = object(item.progress);
      const progressTarget = Math.max(0, nonNegativeInteger(progress.target));
      const progressCurrent = Math.min(progressTarget, nonNegativeInteger(progress.current));
      const progressLabel = typeof progress.label === 'string' && progress.label.trim()
        ? progress.label.trim()
        : null;
      const rarityValue = String(item.rarity || '').toUpperCase();
      const rarity = RARITY_LABELS[rarityValue] ? rarityValue : 'COMMON';
      return {
        id,
        title: hidden ? 'Скрытое достижение' : title,
        description: hidden
          ? 'Условие пока скрыто.'
          : String(item.description || ''),
        icon: hidden ? '?' : ACHIEVEMENT_ICONS[item.iconKey] || '✦',
        rarity,
        rarityLabel: RARITY_LABELS[rarity],
        unlocked,
        hidden,
        dateLabel: unlocked ? dateLabel(item.unlockedAt) : null,
        progressCurrent,
        progressTarget,
        progressLabel: hidden || unlocked ? null : progressLabel
      };
    }).filter(Boolean);
    const totalCount = Math.max(items.length, nonNegativeInteger(raw.totalCount));
    const unlockedCount = Math.min(
      totalCount,
      items.filter(item => item.unlocked).length
    );
    return {
      unlockedCount,
      totalCount,
      countLabel: `${unlockedCount} / ${totalCount}`,
      items,
      emptyMessage: 'Пока нет данных о достижениях.'
    };
  }

  function createViewModel({ snapshot, displayName: name, today } = {}) {
    const current = object(snapshot);
    const skillsSource = object(current.skills);
    const skills = SKILL_IDS.map(id => skillModel(id, skillsSource[id]));
    const streak = object(current.streak);
    const currentStreak = nonNegativeInteger(streak.current);
    const bestStreak = Math.max(currentStreak, nonNegativeInteger(streak.best));
    const validToday = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today);
    const todayQualified = validToday && streak.lastQualifiedDate === today;
    return {
      playerName: displayName(name),
      pokerIq: pokerIqModel(current),
      level: levelModel(current.level),
      decisionQuality: decisionQualityModel(current.decisionQuality),
      skills,
      weeklyFocus: weeklyFocusModel(skills),
      streak: {
        current: currentStreak,
        best: bestStreak,
        todayQualified,
        todayLabel: todayQualified
          ? 'Сегодня уже засчитано'
          : 'Сегодня активность ещё не засчитана'
      },
      achievements: achievementsModel(current.achievements),
      recentEvents: recentEventsModel(current.recentChanges),
      recentEmptyMessage: 'Пока нет значимых событий прогресса.'
    };
  }

  function find(documentRef, selector) {
    return documentRef && typeof documentRef.querySelector === 'function'
      ? documentRef.querySelector(selector)
      : null;
  }

  function setText(documentRef, selector, value) {
    const node = find(documentRef, selector);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function setHidden(documentRef, selector, hidden) {
    const node = find(documentRef, selector);
    if (node) node.hidden = Boolean(hidden);
  }

  function setProgress(node, value, maximum, label) {
    if (!node) return;
    node.max = maximum;
    node.value = value;
    node.setAttribute('aria-label', label);
  }

  function createSkillRow(documentRef, skill) {
    const row = documentRef.createElement('article');
    row.className = 'progress-skill-row';
    row.dataset.skillId = skill.id;

    const header = documentRef.createElement('div');
    header.className = 'progress-skill-heading';
    const title = documentRef.createElement('strong');
    title.textContent = skill.label;
    const score = documentRef.createElement('span');
    score.textContent = skill.scoreLabel;
    header.append(title, score);

    const progress = documentRef.createElement('progress');
    progress.className = 'progress-meter progress-skill-meter';
    setProgress(
      progress,
      skill.score || 0,
      100,
      `${skill.label}: ${skill.scoreLabel}`
    );

    const meta = documentRef.createElement('small');
    meta.className = 'progress-skill-meta';
    meta.textContent = skill.available
      ? [skill.attemptsLabel, skill.confidenceLabel, skill.trendLabel].filter(Boolean).join(' · ')
      : 'Недостаточно попыток для оценки';

    row.append(header, progress, meta);
    return row;
  }

  function createEventRow(documentRef, event) {
    const row = documentRef.createElement('li');
    row.className = 'progress-event-row';
    const copy = documentRef.createElement('span');
    const title = documentRef.createElement('strong');
    title.textContent = event.label;
    const date = documentRef.createElement('small');
    date.textContent = event.dateLabel;
    copy.append(title, date);
    row.append(copy);
    if (event.xpLabel) {
      const xp = documentRef.createElement('b');
      xp.textContent = event.xpLabel;
      row.append(xp);
    }
    return row;
  }

  function createAchievementCard(documentRef, achievement) {
    const card = documentRef.createElement('article');
    card.className = `progress-achievement-card${achievement.unlocked ? ' is-unlocked' : ' is-locked'}`;
    card.dataset.achievementId = achievement.id;
    card.dataset.rarity = achievement.rarity;

    const icon = documentRef.createElement('span');
    icon.className = 'progress-achievement-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = achievement.icon;

    const copy = documentRef.createElement('span');
    copy.className = 'progress-achievement-copy';
    const heading = documentRef.createElement('span');
    heading.className = 'progress-achievement-heading';
    const title = documentRef.createElement('strong');
    title.textContent = achievement.title;
    const rarity = documentRef.createElement('small');
    rarity.textContent = achievement.rarityLabel;
    heading.append(title, rarity);
    const description = documentRef.createElement('span');
    description.className = 'progress-achievement-description';
    description.textContent = achievement.description;
    copy.append(heading, description);

    if (achievement.unlocked && achievement.dateLabel) {
      const date = documentRef.createElement('small');
      date.className = 'progress-achievement-status';
      date.textContent = `Открыто ${achievement.dateLabel}`;
      copy.append(date);
    } else if (achievement.progressLabel) {
      const progress = documentRef.createElement('progress');
      progress.className = 'progress-meter progress-achievement-meter';
      setProgress(
        progress,
        achievement.progressCurrent,
        Math.max(1, achievement.progressTarget),
        `${achievement.title}: ${achievement.progressLabel}`
      );
      const label = documentRef.createElement('small');
      label.className = 'progress-achievement-status';
      label.textContent = achievement.progressLabel;
      copy.append(progress, label);
    }

    card.append(icon, copy);
    return card;
  }

  function render(documentRef, model) {
    if (!documentRef || !model) return false;
    const rootNode = find(documentRef, '#progressOverview');
    if (!rootNode) return false;

    setText(documentRef, '#progressPlayerName', model.playerName);
    setText(documentRef, '#progressPokerIq', model.pokerIq.value);
    setText(documentRef, '#progressRank', model.pokerIq.rank);
    setText(documentRef, '#progressIqSample', model.pokerIq.sampleLabel);
    setText(documentRef, '#progressIqChange', model.pokerIq.change);
    const iqChange = find(documentRef, '#progressIqChange');
    if (iqChange) {
      iqChange.hidden = !model.pokerIq.change;
      iqChange.dataset.direction = model.pokerIq.changeDirection || 'none';
    }

    setText(documentRef, '#progressLevel', `Level ${model.level.number}`);
    setText(documentRef, '#progressXpLabel', model.level.label);
    setProgress(
      find(documentRef, '#progressXpBar'),
      model.level.xpIntoLevel,
      model.level.xpToNextLevel,
      `Level ${model.level.number}: ${model.level.label}`
    );

    setText(documentRef, '#progressDqScore', model.decisionQuality.value);
    setText(documentRef, '#progressDqBand', model.decisionQuality.band || '');
    setText(documentRef, '#progressDqSample', model.decisionQuality.sampleLabel);
    setText(documentRef, '#progressDqEmpty', model.decisionQuality.emptyMessage || '');
    setHidden(documentRef, '#progressDqPresent', !model.decisionQuality.available);
    setHidden(documentRef, '#progressDqEmpty', model.decisionQuality.available);

    const skillList = find(documentRef, '#progressSkillsList');
    if (skillList) skillList.replaceChildren(...model.skills.map(skill =>
      createSkillRow(documentRef, skill)
    ));

    setText(documentRef, '#progressFocusTitle', model.weeklyFocus.title);
    setText(
      documentRef,
      '#progressFocusDescription',
      model.weeklyFocus.description || model.weeklyFocus.emptyMessage
    );
    const focusCta = find(documentRef, '#progressFocusCta');
    if (focusCta) {
      focusCta.hidden = !model.weeklyFocus.target;
      focusCta.disabled = !model.weeklyFocus.target;
      focusCta.dataset.skill = model.weeklyFocus.target?.id || '';
    }

    setText(documentRef, '#progressCurrentStreak', String(model.streak.current));
    setText(documentRef, '#progressBestStreak', String(model.streak.best));
    setText(documentRef, '#progressTodayStatus', model.streak.todayLabel);

    setText(documentRef, '#progressAchievementsCount', model.achievements.countLabel);
    const achievementList = find(documentRef, '#progressAchievementsList');
    if (achievementList) achievementList.replaceChildren(...model.achievements.items.map(item =>
      createAchievementCard(documentRef, item)
    ));
    setText(documentRef, '#progressAchievementsEmpty', model.achievements.emptyMessage);
    setHidden(documentRef, '#progressAchievementsEmpty', model.achievements.items.length > 0);
    setHidden(documentRef, '#progressAchievementsList', model.achievements.items.length === 0);

    const recentList = find(documentRef, '#progressRecentList');
    if (recentList) recentList.replaceChildren(...model.recentEvents.map(event =>
      createEventRow(documentRef, event)
    ));
    setText(documentRef, '#progressRecentEmpty', model.recentEmptyMessage);
    setHidden(documentRef, '#progressRecentEmpty', model.recentEvents.length > 0);
    setHidden(documentRef, '#progressRecentList', model.recentEvents.length === 0);

    rootNode.dataset.ready = 'true';
    return true;
  }

  const api = Object.freeze({
    SKILL_IDS,
    createViewModel,
    render
  });

  root.PokerPilotProgressOverview = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
