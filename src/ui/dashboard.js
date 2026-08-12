'use strict';

(function attachDashboard(root) {
  const translate = (key, fallback) => root.PokerPilotI18n?.t?.(key, fallback) || fallback;
  const LiveMode = root.PokerPilotLiveMode
    || (typeof require === 'function' ? require('../live/live-mode.js') : null);
  const WeaknessModel = root.PokerPilotWeaknessModel
    || (typeof require === 'function' ? require('../progress/weakness-model.js') : null);
  const WEAK_TOPICS = Object.freeze({
    too_tight: 'Слишком тайтовые фолды',
    too_loose: 'Слишком широкие входы',
    passive: 'Пассивные линии',
    overplay: 'Переигрывание руки',
    pot_odds: 'Пот-оддсы',
    outs: 'Подсчёт аутов',
    sizing: 'Размеры ставок',
    position: 'Игра в позиции',
    range_reading: 'Чтение диапазона'
  });

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function number(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
  }

  function text(value, fallback = '') {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized || fallback;
  }

  function normalizeLearning(input) {
    const raw = object(object(input).progress);
    const api = object(object(input).courseProgress);
    if (typeof api.normalizeState === 'function') {
      try {
        return object(api.normalizeState(raw.learning));
      } catch (_) {}
    }
    return object(raw.learning);
  }

  function courseSnapshot(input) {
    const state = object(input);
    const api = object(state.courseProgress);
    const modules = list(object(state.course).modules);
    const learning = normalizeLearning(state);
    const moduleState = moduleId => {
      if (typeof api.getModuleState === 'function') {
        try {
          return object(api.getModuleState(learning, moduleId));
        } catch (_) {}
      }
      return object(object(learning.modules)[moduleId]);
    };
    const canOpen = moduleId => {
      if (typeof api.canOpenModule !== 'function') return true;
      try {
        return Boolean(api.canOpenModule(learning, moduleId));
      } catch (_) {
        return false;
      }
    };
    const complete = moduleId => {
      if (typeof api.moduleComplete === 'function') {
        try {
          return Boolean(api.moduleComplete(learning, moduleId));
        } catch (_) {}
      }
      const module = modules.find(item => item?.id === moduleId);
      const saved = moduleState(moduleId);
      return Boolean(
        module
        && list(module.lessons).length
        && list(saved.completedLessons).length >= list(module.lessons).length
        && number(saved.bestExamScore) >= 70
      );
    };
    const lessonIds = new Set();
    let activityCount = 0;
    modules.forEach(module => {
      const saved = moduleState(module?.id);
      list(saved.completedLessons).forEach(id => lessonIds.add(String(id)));
      activityCount += list(saved.taskAttempts).length + list(saved.examAttempts).length;
    });
    const completedModules = modules.filter(module => complete(module?.id));
    const availableModules = modules.filter(module => canOpen(module?.id)).length;
    const implementedLessons = modules.flatMap(module => list(module?.lessons));
    const current = object(learning.current);
    const currentModule = modules.find(module => module?.id === current.moduleId) || null;
    const hasLearningResume = Boolean(
      currentModule
      && current.view
      && canOpen(currentModule.id)
    );
    const firstAvailableIncomplete = modules.find(module =>
      canOpen(module?.id) && !complete(module?.id)
    ) || null;
    const resumeModule = hasLearningResume
      ? currentModule
      : firstAvailableIncomplete;
    const activeLesson = currentModule
      ? list(currentModule.lessons).find(lesson => lesson?.id === current.lessonId) || null
      : null;
    const bestExamScores = modules.flatMap(module => {
      const saved = moduleState(module?.id);
      const values = [
        optionalNumber(saved.bestExamScore),
        ...list(saved.examAttempts).map(attempt =>
          optionalNumber(attempt?.score ?? attempt?.percentage)
        )
      ];
      return values.filter(value => value !== null && value > 0);
    });
    return {
      learning,
      modules,
      current,
      currentModule,
      activeLesson,
      hasLearningResume,
      resumeModule,
      completedLessons: lessonIds.size,
      totalLessons: implementedLessons.length,
      completedModules: completedModules.length,
      totalModules: modules.length,
      availableModules,
      coursePercent: implementedLessons.length
        ? Math.round(lessonIds.size / implementedLessons.length * 100)
        : 0,
      lastCompletedTitle: completedModules.at(-1)?.title || 'Пока нет завершённых модулей',
      bestExamScore: bestExamScores.length ? Math.max(...bestExamScores) : null,
      activityCount: activityCount + lessonIds.size
    };
  }

  function topWeakness(input) {
    const mistakes = object(object(object(input).progress).mistakes);
    return Object.entries(mistakes)
      .map(([id, value]) => ({ id, count: number(value), label: WEAK_TOPICS[id] || id }))
      .filter(item => item.count > 0)
      .sort((left, right) => right.count - left.count || left.id.localeCompare(right.id))[0] || null;
  }

  function getHomeNextAction(input) {
    const state = object(input);
    const progress = object(state.progress);
    const course = courseSnapshot(state);
    if (course.hasLearningResume) {
      const moduleTitle = course.currentModule?.title || 'Учебный модуль';
      const subject = course.activeLesson?.title
        ? `${moduleTitle}: ${course.activeLesson.title}`
        : moduleTitle;
      return {
        type: 'resume-learning',
        eyebrow: 'ТВОЙ СЛЕДУЮЩИЙ ШАГ',
        title: `Продолжить: ${subject}`,
        description: 'Вернитесь к последнему открытому материалу без потери прогресса.',
        meta: 'около 5 минут',
        actionLabel: translate('action.continue', 'Продолжить'),
        target: 'learning',
        reason: 'Есть незавершённый учебный материал.',
        resume: true,
        moduleId: course.currentModule?.id || null
      };
    }
    const weakness = topWeakness(state);
    if (weakness) {
      return {
        type: 'weak-topic-training',
        eyebrow: 'ТВОЙ СЛЕДУЮЩИЙ ШАГ',
        title: `${weakness.label}: точная практика`,
        description: 'Короткая тренировка по теме, в которой уже были ошибки.',
        meta: '5 решений · около 5 минут',
        actionLabel: 'Тренировать',
        target: 'study',
        reason: `Зафиксировано ошибок по теме: ${weakness.count}.`,
        resume: false,
        moduleId: null
      };
    }
    // Stage 9.3A intentionally has no synthetic daily challenge.
    if (list(progress.savedHands).length) {
      return {
        type: 'review-hand',
        eyebrow: 'ТВОЙ СЛЕДУЮЩИЙ ШАГ',
        title: 'Вернуться к сохранённой раздаче',
        description: 'Разберите недавнюю раздачу в Hand Lab, пока линия ещё свежа.',
        meta: 'около 3 минут',
        actionLabel: 'Открыть разбор',
        target: 'analyzer',
        reason: 'Есть сохранённая раздача для анализа.',
        resume: false,
        moduleId: null
      };
    }
    const recentSession = list(progress.history).find(record => record?.mode === 'session');
    if (recentSession) {
      return {
        type: 'review-session',
        eyebrow: 'ТВОЙ СЛЕДУЮЩИЙ ШАГ',
        title: 'Разобрать последнюю сессию',
        description: 'Посмотрите решения последней сессии отдельно от денежного результата.',
        meta: 'около 4 минут',
        actionLabel: 'Перейти к разбору',
        target: 'analyzer',
        reason: 'В истории есть завершённая сессия.',
        resume: false,
        moduleId: null
      };
    }
    return {
      type: 'quick-training',
      eyebrow: 'ТВОЙ СЛЕДУЮЩИЙ ШАГ',
      title: 'Быстрая тренировка',
      description: 'Короткая серия решений для поддержания формы.',
      meta: '5 раздач · около 4 минут',
      actionLabel: translate('action.startTraining', 'Начать тренировку'),
      target: 'study',
      reason: 'Безопасное действие по умолчанию.',
      resume: false,
      moduleId: null
    };
  }

  function getHomeProgressSnapshot(input) {
    const state = object(input);
    const rawProgress = object(state.progress);
    const progressSnapshot = object(state.progressSnapshot);
    const profile = object(state.profile);
    const snapshotLevel = object(progressSnapshot.level);
    const progression = Object.keys(snapshotLevel).length
      ? snapshotLevel
      : object(profile.progression);
    const pokerIQ = Object.keys(object(progressSnapshot.pokerIq)).length
      ? object(progressSnapshot.pokerIq)
      : object(state.pokerIQ);
    const rank = object(pokerIQ.rank);
    const statistics = object(state.statistics);
    const iqScore = optionalNumber(pokerIQ.score);
    const hasIq = pokerIQ.isRated === true && iqScore !== null;
    const level = Math.max(1, Math.floor(number(progression.level, 1)));
    const xpIntoLevel = Math.floor(number(
      progression.xpIntoLevel,
      progression.totalXp ?? progression.xp
    ));
    const xpToNextLevel = Math.max(1, Math.floor(number(progression.xpToNextLevel, 500)));
    const snapshotStreak = object(progressSnapshot.streak);
    const dayStreak = optionalNumber(
      Object.keys(snapshotStreak).length ? snapshotStreak.current : statistics.currentStreakDays
    );
    const decisionStreak = Math.floor(number(
      statistics.currentDecisionStreak,
      rawProgress.streak
    ));
    const hasSnapshotStreak = Object.keys(snapshotStreak).length > 0;
    const streakIsDays = hasSnapshotStreak || (dayStreak !== null && dayStreak > 0);
    const streakValue = streakIsDays ? Math.floor(dayStreak || 0) : decisionStreak;
    return {
      pokerIQ: {
        label: 'Poker IQ',
        value: hasIq ? String(Math.round(iqScore)) : '—',
        detail: hasIq ? text(rank.label, 'Без ранга') : 'Не рассчитан'
      },
      level: {
        label: 'Уровень',
        value: String(level),
        detail: `${xpIntoLevel} / ${xpToNextLevel} XP`,
        percent: Math.max(0, Math.min(100, Math.round(xpIntoLevel / xpToNextLevel * 100)))
      },
      streak: {
        label: 'Серия',
        value: String(streakValue),
        detail: streakValue > 0
          ? streakIsDays ? 'дней подряд' : 'решений подряд'
          : 'пока нет серии'
      }
    };
  }

  function greetingFor(value, name) {
    const date = value instanceof Date ? value : new Date(value || NaN);
    const hour = Number.isFinite(date.getTime()) ? date.getHours() : null;
    if (hour !== null && hour >= 5 && hour < 12) return `Доброе утро, ${name}`;
    if (hour !== null && hour >= 12 && hour < 18) return `Добрый день, ${name}`;
    if (hour !== null && hour >= 18) return `Добрый вечер, ${name}`;
    return `С возвращением, ${name}`;
  }

  function focusSnapshot(input) {
    const summary = typeof WeaknessModel?.derive === 'function'
      ? WeaknessModel.derive(object(input).progressSnapshot)
      : {
          primary: null,
          hasReliableData: false,
          emptyMessage: 'Персональный фокус появится после нескольких тренировок.'
        };
    const weakness = summary.primary;
    if (!weakness) {
      return {
        eyebrow: 'ФОКУС НЕДЕЛИ',
        title: summary.hasReliableData ? 'Поддерживайте сильную форму' : 'Фокус формируется',
        description: summary.emptyMessage,
        actionLabel: 'Начать тренировку',
        target: 'study',
        skillId: null,
        fallback: true
      };
    }
    const trend = weakness.trendLabel ? ` ${weakness.trendLabel}.` : '';
    return {
      eyebrow: 'ФОКУС НЕДЕЛИ',
      title: weakness.label,
      description: `Средняя оценка ${weakness.scoreLabel} по ${weakness.relevantDecisions} решениям.${trend}`,
      actionLabel: 'Тренировать тему',
      target: weakness.trainingTarget.route,
      skillId: weakness.id,
      fallback: weakness.trainingTarget.fallback
    };
  }

  function secondaryActivitySnapshot(input, course) {
    const progress = object(object(input).progress);
    const savedHands = list(progress.savedHands);
    if (savedHands.length) {
      return {
        type: 'saved-hand',
        eyebrow: 'НЕДАВНЯЯ АКТИВНОСТЬ',
        title: 'Сохранённая раздача ждёт разбора',
        description: `${savedHands.length} ${savedHands.length === 1 ? 'раздача сохранена' : 'раздач сохранено'} в Hand Lab.`,
        actionLabel: 'Открыть Hand Lab',
        target: 'analyzer'
      };
    }
    const recentSession = list(progress.history).find(record => record?.mode === 'session');
    if (recentSession) {
      return {
        type: 'recent-session',
        eyebrow: 'НЕДАВНЯЯ АКТИВНОСТЬ',
        title: LiveMode.normalizeDisplayText(text(recentSession.title, 'Последняя Live Cash сессия')),
        description: 'История решений доступна в разделе разбора.',
        actionLabel: 'Посмотреть разбор',
        target: 'analyzer'
      };
    }
    if (course.completedLessons > 0) {
      return {
        type: 'course-progress',
        eyebrow: 'УЧЕБНЫЙ МАРШРУТ',
        title: `${course.completedLessons} из ${course.totalLessons} уроков завершено`,
        description: course.lastCompletedTitle === 'Пока нет завершённых модулей'
          ? 'Курс уже начат — продолжайте в удобном темпе.'
          : `Последний завершённый модуль: ${course.lastCompletedTitle}.`,
        actionLabel: 'Открыть обучение',
        target: 'learning'
      };
    }
    return null;
  }

  function buildHomeViewModel(input) {
    const state = object(input);
    const progress = object(state.progress);
    const profile = object(state.profile);
    const course = courseSnapshot(state);
    const nextAction = getHomeNextAction(state);
    const homeProgress = getHomeProgressSnapshot(state);
    const displayName = text(profile.displayName, 'Player').slice(0, 24);
    const decisions = Math.floor(number(progress.decisions));
    const maxPoints = number(progress.maxPoints);
    const scorePoints = number(progress.scorePoints);
    const secondaryActivity = secondaryActivitySnapshot(state, course);
    const status = homeProgress.pokerIQ.value === '—'
      ? 'Poker IQ формируется'
      : `Poker IQ ${homeProgress.pokerIQ.value} · ${homeProgress.pokerIQ.detail}`;
    return {
      user: {
        displayName,
        greeting: greetingFor(state.now, displayName)
      },
      status,
      nextAction,
      progress: homeProgress,
      quickActions: [
        { id: 'training', label: 'Тренировка', icon: '◎', target: 'study' },
        { id: 'hand', label: 'Ввести раздачу', icon: '＋', target: 'analyzer' },
        { id: 'equity', label: 'Equity', icon: '%', target: 'analyzer', focus: 'equity' }
      ],
      focus: focusSnapshot(state),
      secondaryActivity,
      isEmpty: decisions === 0 && course.activityCount === 0,
      coursePercent: course.coursePercent,
      completedLessons: course.completedLessons,
      totalLessons: course.totalLessons,
      completedModules: course.completedModules,
      totalModules: course.totalModules,
      availableModules: course.availableModules,
      lastCompletedTitle: course.lastCompletedTitle,
      bestExamScore: course.bestExamScore,
      decisionAccuracy: maxPoints > 0 ? Math.round(scorePoints / maxPoints * 100) : null,
      decisions,
      primaryAction: {
        label: nextAction.actionLabel,
        route: nextAction.target,
        resume: nextAction.resume
      },
      resume: {
        moduleId: nextAction.moduleId || course.resumeModule?.id || null,
        label: nextAction.title,
        detail: nextAction.description
      }
    };
  }

  function setText(scope, selector, value) {
    const element = scope?.querySelector?.(selector);
    if (element) element.textContent = String(value ?? '');
  }

  function setRoute(element, target) {
    if (!element) return;
    if (target) element.dataset.route = target;
    else delete element.dataset.route;
  }

  function render(scope, model) {
    if (!scope || !model) return model;
    setText(scope, '#homeGreeting', model.user.greeting);
    setText(scope, '#homeStatus', model.status);
    setText(scope, '#dashboardNextEyebrow', model.nextAction.eyebrow);
    setText(scope, '#dashboardNextTitle', model.nextAction.title);
    setText(scope, '#dashboardNextDescription', model.nextAction.description);
    setText(scope, '#dashboardNextMeta', model.nextAction.meta);
    const continueButton = scope.querySelector('#dashboardContinue');
    if (continueButton) {
      continueButton.textContent = model.nextAction.actionLabel;
      setRoute(continueButton, model.nextAction.target);
      continueButton.dataset.resume = String(Boolean(model.nextAction.resume));
      if (model.nextAction.moduleId) continueButton.dataset.moduleId = model.nextAction.moduleId;
      else delete continueButton.dataset.moduleId;
    }

    setText(scope, '#homePokerIqLabel', model.progress.pokerIQ.label);
    setText(scope, '#homePokerIqValue', model.progress.pokerIQ.value);
    setText(scope, '#homePokerIqRank', model.progress.pokerIQ.detail);
    setText(scope, '#homeLevelLabel', model.progress.level.label);
    setText(scope, '#homeLevelValue', model.progress.level.value);
    setText(scope, '#homeXpDetail', model.progress.level.detail);
    setText(scope, '#homeStreakLabel', model.progress.streak.label);
    setText(scope, '#homeStreakValue', model.progress.streak.value);
    setText(scope, '#homeStreakDetail', model.progress.streak.detail);
    const levelProgress = scope.querySelector('#homeLevelProgress');
    if (levelProgress) {
      levelProgress.style.setProperty('--home-progress', `${model.progress.level.percent}%`);
      levelProgress.setAttribute('aria-valuenow', String(model.progress.level.percent));
      levelProgress.setAttribute(
        'aria-label',
        `Прогресс уровня ${model.progress.level.value}: ${model.progress.level.detail}`
      );
    }

    scope.querySelectorAll('[data-home-quick-index]').forEach((button, index) => {
      const action = model.quickActions[index];
      if (!action) return;
      setRoute(button, action.target);
      if (action.focus) button.dataset.focus = action.focus;
      else delete button.dataset.focus;
      setText(button, '[data-home-quick-label]', action.label);
      setText(button, '[data-home-quick-icon]', action.icon);
    });

    setText(scope, '#homeFocusEyebrow', model.focus.eyebrow);
    setText(scope, '#homeFocusTitle', model.focus.title);
    setText(scope, '#homeFocusDescription', model.focus.description);
    const focusAction = scope.querySelector('#homeFocusAction');
    if (focusAction) {
      focusAction.classList.toggle('hidden', !model.focus.target);
      setRoute(focusAction, model.focus.target);
      focusAction.textContent = model.focus.actionLabel || '';
      focusAction.dataset.focusSkill = model.focus.skillId || '';
      focusAction.dataset.focusFallback = String(Boolean(model.focus.fallback));
    }

    const secondary = scope.querySelector('#dashboardResume');
    if (secondary) secondary.classList.toggle('hidden', !model.secondaryActivity);
    if (model.secondaryActivity) {
      setText(scope, '#homeSecondaryEyebrow', model.secondaryActivity.eyebrow);
      setText(scope, '#homeSecondaryTitle', model.secondaryActivity.title);
      setText(scope, '#homeSecondaryDescription', model.secondaryActivity.description);
      const secondaryAction = scope.querySelector('#homeSecondaryAction');
      setRoute(secondaryAction, model.secondaryActivity.target);
      setText(scope, '#homeSecondaryAction', model.secondaryActivity.actionLabel);
    }

    setText(scope, '#dashboardProgress', `${model.coursePercent}%`);
    setText(scope, '#dashboardProgressLabel', `${model.completedLessons}/${model.totalLessons} уроков`);
    setText(scope, '#dashboardAvailableModules', model.availableModules);
    setText(scope, '#dashboardLastModule', model.lastCompletedTitle);
    setText(scope, '#dashboardBestExam', model.bestExamScore === null ? '—' : `${model.bestExamScore}%`);
    setText(scope, '#statDecisions', model.decisions);
    const courseBar = scope.querySelector('#dashboardCourseBar');
    if (courseBar) {
      courseBar.style.setProperty('--progress-value', `${model.coursePercent}%`);
      courseBar.setAttribute('aria-valuenow', String(model.coursePercent));
    }
    return model;
  }

  const api = Object.freeze({
    WEAK_TOPICS,
    getHomeNextAction,
    getHomeProgressSnapshot,
    buildHomeViewModel,
    createModel: buildHomeViewModel,
    render
  });
  root.PokerPilotDashboard = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
