'use strict';

(function attachCourseProgress(root) {
  const COURSE = root.POKERPILOT_COURSE;
  const SCHEMA_VERSION = 1;
  const PASSING_SCORE = 70;
  const DEFAULT_SOUND = { enabled: true, volume: 0.35 };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function defaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      modules: {},
      weakTopics: {},
      history: [],
      current: null,
      preferences: {
        sound: { ...DEFAULT_SOUND }
      }
    };
  }

  function cleanUniqueStrings(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter(item => typeof item === 'string' && item))];
  }

  function cleanAttempts(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter(item => item && typeof item === 'object' && !Array.isArray(item))
      .map(item => clone(item));
  }

  function normalizeModuleState(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const score = Number(raw.bestExamScore);
    return {
      ...clone(raw),
      completedLessons: cleanUniqueStrings(raw.completedLessons),
      completedTasks: cleanUniqueStrings(raw.completedTasks),
      taskAttempts: cleanAttempts(raw.taskAttempts),
      examAttempts: cleanAttempts(raw.examAttempts),
      bestExamScore: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0
    };
  }

  function normalizeState(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const modules = {};
    if (raw.modules && typeof raw.modules === 'object' && !Array.isArray(raw.modules)) {
      for (const [id, state] of Object.entries(raw.modules)) {
        modules[id] = normalizeModuleState(state);
      }
    }
    const weakTopics = {};
    if (raw.weakTopics && typeof raw.weakTopics === 'object' && !Array.isArray(raw.weakTopics)) {
      for (const [topic, count] of Object.entries(raw.weakTopics)) {
        if (typeof topic === 'string' && Number.isFinite(Number(count)) && Number(count) >= 0) {
          weakTopics[topic] = Number(count);
        }
      }
    }
    const current = raw.current
      && typeof raw.current === 'object'
      && typeof raw.current.moduleId === 'string'
      ? clone(raw.current)
      : null;
    const rawPreferences = raw.preferences
      && typeof raw.preferences === 'object'
      && !Array.isArray(raw.preferences)
      ? raw.preferences
      : {};
    const rawSound = rawPreferences.sound
      && typeof rawPreferences.sound === 'object'
      && !Array.isArray(rawPreferences.sound)
      ? rawPreferences.sound
      : {};
    const soundEnabled = typeof rawSound.enabled === 'boolean'
      ? rawSound.enabled
      : DEFAULT_SOUND.enabled;
    const soundVolume = typeof rawSound.volume === 'number'
      && Number.isFinite(rawSound.volume)
      && rawSound.volume >= 0
      && rawSound.volume <= 1
      ? rawSound.volume
      : DEFAULT_SOUND.volume;
    return {
      ...clone(raw),
      schemaVersion: SCHEMA_VERSION,
      modules,
      weakTopics,
      history: cleanAttempts(raw.history),
      current,
      preferences: {
        ...clone(rawPreferences),
        sound: {
          ...clone(rawSound),
          enabled: soundEnabled,
          volume: soundVolume
        }
      }
    };
  }

  function migrateProgress(progress) {
    const raw = progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
    return {
      ...clone(raw),
      learning: normalizeState(raw.learning)
    };
  }

  function getModule(moduleId) {
    const module = COURSE?.modules?.find(item => item.id === moduleId);
    if (!module) throw new Error(`Неизвестный учебный модуль: ${moduleId}`);
    return module;
  }

  function getUpcomingModule(moduleId) {
    return COURSE?.upcomingModules?.find(item => item.id === moduleId) || null;
  }

  function getModuleState(state, moduleId) {
    return normalizeModuleState(normalizeState(state).modules[moduleId]);
  }

  function withModuleState(state, moduleId, nextModuleState) {
    const next = normalizeState(state);
    next.modules[moduleId] = normalizeModuleState(nextModuleState);
    return next;
  }

  function moduleComplete(state, moduleId) {
    const module = getModule(moduleId);
    const saved = getModuleState(state, moduleId);
    return module.lessons.every(lesson => saved.completedLessons.includes(lesson.id))
      && saved.bestExamScore >= module.exam.passingScore;
  }

  function canOpenModule(state, moduleId) {
    const module = getModule(moduleId);
    if (module.order === 1) return true;
    const previous = COURSE.modules.find(item => item.order === module.order - 1);
    return Boolean(previous && moduleComplete(state, previous.id));
  }

  function openModule(state, moduleId) {
    const upcoming = getUpcomingModule(moduleId);
    if (upcoming) {
      throw new Error(`Модуль «${upcoming.title}» ещё не реализован`);
    }
    if (!canOpenModule(state, moduleId)) {
      throw new Error(`Модуль «${getModule(moduleId).title}» заблокирован`);
    }
    const next = normalizeState(state);
    next.current = { moduleId, view: 'overview' };
    return next;
  }

  function openLesson(state, moduleId, lessonId) {
    if (!canOpenModule(state, moduleId)) throw new Error('Учебный модуль заблокирован');
    const module = getModule(moduleId);
    if (!module.lessons.some(lesson => lesson.id === lessonId)) {
      throw new Error(`Неизвестный урок: ${lessonId}`);
    }
    const next = normalizeState(state);
    next.current = { moduleId, lessonId, view: 'lesson' };
    return next;
  }

  function completeLesson(state, moduleId, lessonId) {
    const next = openLesson(state, moduleId, lessonId);
    const saved = getModuleState(next, moduleId);
    saved.completedLessons = cleanUniqueStrings([...saved.completedLessons, lessonId]);
    return withModuleState(next, moduleId, saved);
  }

  function answerTask(state, moduleId, taskId, choiceId, now = new Date().toISOString()) {
    if (!canOpenModule(state, moduleId)) throw new Error('Учебный модуль заблокирован');
    const module = getModule(moduleId);
    const task = module.tasks.find(item => item.id === taskId);
    if (!task) throw new Error(`Неизвестное мини-задание: ${taskId}`);
    const next = normalizeState(state);
    const saved = getModuleState(next, moduleId);
    const correct = choiceId === task.correctChoiceId;
    saved.taskAttempts.push({ taskId, choiceId, correct, topic: task.topic, date: now });
    if (correct) saved.completedTasks = cleanUniqueStrings([...saved.completedTasks, taskId]);
    if (!correct) next.weakTopics[task.topic] = (next.weakTopics[task.topic] || 0) + 1;
    next.modules[moduleId] = normalizeModuleState(saved);
    return { state: next, correct, explanation: task.explanation };
  }

  function submitExam(state, moduleId, answers, now = new Date().toISOString()) {
    if (!canOpenModule(state, moduleId)) throw new Error('Учебный модуль заблокирован');
    const module = getModule(moduleId);
    const safeAnswers = answers && typeof answers === 'object' && !Array.isArray(answers) ? clone(answers) : {};
    const errors = [];
    let correctCount = 0;
    for (const question of module.exam.questions) {
      const choiceId = safeAnswers[question.id] ?? null;
      if (choiceId === question.correctChoiceId) correctCount += 1;
      else {
        errors.push({
          questionId: question.id,
          topic: question.topic,
          choiceId,
          correctChoiceId: question.correctChoiceId,
          explanation: question.explanation
        });
      }
    }
    const score = Math.round(correctCount / module.exam.questions.length * 100);
    const next = normalizeState(state);
    const saved = getModuleState(next, moduleId);
    const attempt = {
      date: now,
      answers: safeAnswers,
      score,
      passed: score >= module.exam.passingScore,
      errors
    };
    saved.examAttempts.push(attempt);
    saved.bestExamScore = Math.max(saved.bestExamScore, score);
    for (const error of errors) {
      next.weakTopics[error.topic] = (next.weakTopics[error.topic] || 0) + 1;
    }
    next.history.push({
      type: 'module-exam',
      moduleId,
      date: now,
      score,
      passed: attempt.passed,
      errors: clone(errors)
    });
    next.modules[moduleId] = normalizeModuleState(saved);
    next.current = { moduleId, view: 'exam-result' };
    return { state: next, score, passed: attempt.passed, errors };
  }

  function moduleStatus(state, moduleId) {
    if (!canOpenModule(state, moduleId)) return 'locked';
    if (moduleComplete(state, moduleId)) return 'completed';
    const saved = getModuleState(state, moduleId);
    const started = saved.completedLessons.length
      || saved.completedTasks.length
      || saved.taskAttempts.length
      || saved.examAttempts.length;
    return started ? 'in-progress' : 'available';
  }

  function upcomingModuleStatus(state, moduleId) {
    const upcoming = getUpcomingModule(moduleId);
    if (!upcoming) throw new Error(`Неизвестный будущий модуль: ${moduleId}`);
    return moduleComplete(state, upcoming.requires) ? 'coming-soon' : 'locked';
  }

  function setSoundPreferences(state, settings) {
    const next = normalizeState(state);
    next.preferences.sound = {
      ...next.preferences.sound,
      ...(settings && typeof settings === 'object' ? settings : {})
    };
    return normalizeState(next);
  }

  const api = {
    SCHEMA_VERSION,
    PASSING_SCORE,
    DEFAULT_SOUND,
    defaultState,
    normalizeState,
    normalizeModuleState,
    migrateProgress,
    getModule,
    getUpcomingModule,
    getModuleState,
    moduleComplete,
    canOpenModule,
    openModule,
    openLesson,
    completeLesson,
    answerTask,
    submitExam,
    moduleStatus,
    upcomingModuleStatus,
    setSoundPreferences
  };

  root.CourseProgress = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
