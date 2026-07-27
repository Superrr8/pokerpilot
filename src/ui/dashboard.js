'use strict';

(function attachDashboard(root) {
  function safeProgress(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function createModel({ progress, course, courseProgress }) {
    const raw = safeProgress(progress);
    const learning = courseProgress.normalizeState(raw.learning);
    const modules = Array.isArray(course?.modules) ? course.modules : [];
    const implementedLessons = modules.flatMap(module => module.lessons || []);
    const completedLessonIds = new Set(
      modules.flatMap(module => courseProgress.getModuleState(learning, module.id).completedLessons)
    );
    const completedModules = modules.filter(module =>
      courseProgress.moduleComplete(learning, module.id)
    );
    const completedWithActivity = modules.filter(module => {
      const saved = courseProgress.getModuleState(learning, module.id);
      return saved.examAttempts.length > 0;
    });
    const bestExamScore = completedWithActivity.length
      ? Math.max(...completedWithActivity.map(module =>
        courseProgress.getModuleState(learning, module.id).bestExamScore
      ))
      : null;
    const lastCompleted = completedModules.at(-1) || null;
    const currentModule = modules.find(module => module.id === learning.current?.moduleId);
    const firstAvailableIncomplete = modules.find(module =>
      courseProgress.canOpenModule(learning, module.id)
      && !courseProgress.moduleComplete(learning, module.id)
    );
    const resumeModule = (
      currentModule && courseProgress.canOpenModule(learning, currentModule.id)
        ? currentModule
        : firstAvailableIncomplete
    ) || modules.at(-1) || null;
    const decisions = Number.isFinite(Number(raw.decisions)) ? Number(raw.decisions) : 0;
    const maxPoints = Number.isFinite(Number(raw.maxPoints)) ? Number(raw.maxPoints) : 0;
    const scorePoints = Number.isFinite(Number(raw.scorePoints)) ? Number(raw.scorePoints) : 0;
    const activityCount = completedLessonIds.size
      + modules.reduce((sum, module) => {
        const saved = courseProgress.getModuleState(learning, module.id);
        return sum + saved.taskAttempts.length + saved.examAttempts.length;
      }, 0);

    return {
      isEmpty: decisions === 0 && activityCount === 0,
      coursePercent: implementedLessons.length
        ? Math.round(completedLessonIds.size / implementedLessons.length * 100)
        : 0,
      completedLessons: completedLessonIds.size,
      totalLessons: implementedLessons.length,
      completedModules: completedModules.length,
      totalModules: modules.length,
      lastCompletedTitle: lastCompleted?.title || 'Пока нет завершённых модулей',
      bestExamScore,
      decisionAccuracy: maxPoints > 0 ? Math.round(scorePoints / maxPoints * 100) : null,
      decisions,
      resume: {
        moduleId: resumeModule?.id || null,
        label: resumeModule
          ? `Продолжить: ${resumeModule.title}`
          : 'Открыть обучение',
        detail: learning.current?.lessonId && resumeModule?.id === learning.current.moduleId
          ? 'Вернуться к последнему открытому уроку'
          : 'Продолжить с ближайшего доступного модуля'
      }
    };
  }

  function setText(scope, selector, value) {
    const element = scope.querySelector(selector);
    if (element) element.textContent = value;
  }

  function render(scope, model) {
    if (!scope || !model) return model;
    setText(scope, '#dashboardProgress', `${model.coursePercent}%`);
    setText(scope, '#dashboardProgressLabel', `${model.completedLessons}/${model.totalLessons} уроков`);
    setText(scope, '#dashboardLastModule', model.lastCompletedTitle);
    setText(scope, '#dashboardBestExam', model.bestExamScore === null ? '—' : `${model.bestExamScore}%`);
    setText(scope, '#dashboardResumeTitle', model.resume.label);
    setText(scope, '#dashboardResumeDetail', model.resume.detail);
    const bar = scope.querySelector('#dashboardCourseBar');
    if (bar) {
      bar.style.setProperty('--progress-value', `${model.coursePercent}%`);
      bar.setAttribute('aria-valuenow', String(model.coursePercent));
    }
    const empty = scope.querySelector('#dashboardEmpty');
    const populated = scope.querySelector('#dashboardPopulated');
    if (empty) empty.classList.toggle('hidden', !model.isEmpty);
    if (populated) populated.classList.toggle('hidden', model.isEmpty);
    const continueButton = scope.querySelector('#dashboardContinue');
    if (continueButton && model.resume.moduleId) {
      continueButton.dataset.moduleId = model.resume.moduleId;
      continueButton.dataset.resume = 'true';
    }
    return model;
  }

  const api = { createModel, render };
  root.PokerPilotDashboard = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

