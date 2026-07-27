'use strict';

(function attachLearningMode(root) {
  const COURSE = root.POKERPILOT_COURSE;
  const Progress = root.CourseProgress;
  const statusLabels = {
    available: 'Доступен',
    'in-progress': 'В процессе',
    completed: 'Завершён',
    locked: 'Заблокирован',
    'coming-soon': 'Скоро'
  };

  function escapeHTML(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderQuestionMarkup(question, selectedChoiceId = null, kind = 'task') {
    const answered = selectedChoiceId !== null && selectedChoiceId !== undefined;
    const choices = question.choices.map(item => {
      let className = 'learning-choice';
      if (answered && item.id === question.correctChoiceId) className += ' selected-correct';
      else if (answered && item.id === selectedChoiceId) className += ' selected-wrong';
      return `<button class="${className}" data-learning-action="answer-${kind}" data-choice-id="${escapeHTML(item.id)}"${answered ? ' disabled' : ''}>${escapeHTML(item.label)}</button>`;
    }).join('');
    const feedback = answered
      ? `<div class="feedback ${selectedChoiceId === question.correctChoiceId ? 'good' : 'bad'}"><strong>${selectedChoiceId === question.correctChoiceId ? 'Верно.' : 'Нужно повторить.'}</strong> ${escapeHTML(question.explanation)}</div>`
      : '';
    return `<div class="learning-question"><p class="spot-question">${escapeHTML(question.prompt)}</p><div class="learning-choices">${choices}</div>${feedback}</div>`;
  }

  function renderPositionTableMarkup(table, selectedPositionId = null) {
    const selected = table.positions.find(position => position.id === selectedPositionId) || null;
    const seats = table.positions.map(position => `<button class="learning-position-seat${selected?.id === position.id ? ' is-selected' : ''}" data-learning-action="select-position" data-position-id="${escapeHTML(position.id)}" aria-pressed="${selected?.id === position.id}">${escapeHTML(position.id)}</button>`).join('');
    const info = selected
      ? `<div class="learning-position-info"><span class="tag">${escapeHTML(selected.groupLabel)}</span><h4>${escapeHTML(selected.id)}</h4><p>${escapeHTML(selected.description)}</p><small>${escapeHTML(selected.postflop)}</small><div class="learning-hand-tags">${selected.exampleHands.map(hand => `<span>${escapeHTML(hand)}</span>`).join('')}</div></div>`
      : `<div class="learning-position-info"><h4>${escapeHTML(table.title)}</h4><p class="muted">${escapeHTML(table.instruction)}</p><small>Ответы и диапазоны не раскрываются: схема объясняет только выбранное место.</small></div>`;
    return `<div class="learning-poker-table-wrap"><div class="learning-poker-table" aria-label="${escapeHTML(table.title)}"><span class="learning-table-center">POKER TABLE</span>${seats}</div>${info}</div>`;
  }

  function create(options) {
    const container = options.container;
    const getProgress = options.getProgress;
    const commitProgress = options.commitProgress;
    const sound = options.sound || {
      handleUserGesture: () => Promise.resolve(false),
      play: () => false,
      toggle: () => false,
      getSettings: () => ({ enabled: false, volume: 0.35 })
    };
    let view = { type: 'catalog' };
    let selectedTaskChoice = null;
    let selectedPositionId = null;
    let examAnswers = {};
    let examIndex = 0;
    let selectedExamChoice = null;
    let lastExamResult = null;

    function learningState() {
      return Progress.normalizeState(getProgress().learning);
    }

    function saveLearning(state) {
      commitProgress(state);
    }

    function moduleById(moduleId) {
      return COURSE.modules.find(module => module.id === moduleId);
    }

    function moduleProgress(module, state) {
      const saved = Progress.getModuleState(state, module.id);
      return {
        saved,
        lessonsDone: module.lessons.filter(lesson => saved.completedLessons.includes(lesson.id)).length,
        bestScore: saved.bestExamScore
      };
    }

    function soundToggleMarkup() {
      const enabled = sound.getSettings().enabled;
      return `<button class="learning-sound-toggle" data-learning-action="toggle-sound" aria-pressed="${enabled}" aria-label="${enabled ? 'Выключить звук' : 'Включить звук'}">${enabled ? '🔊 Звук' : '🔇 Без звука'}</button>`;
    }

    function renderCatalog() {
      const state = learningState();
      const cards = COURSE.modules.map(module => {
        const status = Progress.moduleStatus(state, module.id);
        const details = moduleProgress(module, state);
        return `<button class="learning-module-card ${status}" style="--learning-order:${module.order}" data-learning-action="open-module" data-module-id="${module.id}" aria-disabled="${status === 'locked'}"${status === 'locked' ? ' disabled' : ''}>
          <span class="learning-module-number">${module.order}</span>
          <span class="learning-module-copy"><strong>${escapeHTML(module.title)}</strong><small>${escapeHTML(module.description)}</small>
          <span class="learning-meter"><i style="width:${Math.round(details.lessonsDone / module.lessons.length * 100)}%"></i></span>
          <small>${details.lessonsDone}/${module.lessons.length} уроков • лучший экзамен ${details.bestScore || 0}%</small></span>
          <span class="learning-status">${statusLabels[status]}</span>
        </button>`;
      }).join('');
      const future = (COURSE.upcomingModules || []).map(module => {
        const status = Progress.upcomingModuleStatus(state, module.id);
        return `<div class="learning-module-card ${status}" style="--learning-order:${module.order}" aria-disabled="true">
          <span class="learning-module-number">${module.order}</span>
          <span class="learning-module-copy"><strong>${escapeHTML(module.title)}</strong><small>${escapeHTML(module.description)}</small></span>
          <span class="learning-status">${statusLabels[status]}</span>
        </div>`;
      }).join('');
      container.innerHTML = `<div class="learning-header"><div class="learning-header-row"><div><span class="tag">Последовательный курс</span><h3>Обучение</h3></div>${soundToggleMarkup()}</div>
        <p class="muted">Короткие уроки, практика и экзамен. Ответ появляется только после твоего выбора.</p></div>
        <div class="learning-module-grid">${cards}${future}</div>`;
    }

    function renderOverview(moduleId) {
      const module = moduleById(moduleId);
      const state = learningState();
      const details = moduleProgress(module, state);
      const lessons = module.lessons.map((lesson, index) => {
        const done = details.saved.completedLessons.includes(lesson.id);
        return `<button class="learning-row" data-learning-action="open-lesson" data-module-id="${module.id}" data-lesson-id="${lesson.id}">
          <span>${done ? '✓' : index + 1}</span><span><strong>${escapeHTML(lesson.title)}</strong><small>${done ? 'Завершён' : 'Открыть урок'}</small></span><b>›</b>
        </button>`;
      }).join('');
      const examples = module.examples.map(example => `<article class="learning-example"><strong>${escapeHTML(example.title)}</strong><p>${escapeHTML(example.situation)}</p><small>${escapeHTML(example.explanation)}</small></article>`).join('');
      const tasks = module.tasks.map((task, index) => `<button class="learning-row" data-learning-action="open-task" data-module-id="${module.id}" data-task-id="${task.id}">
        <span>?</span><span><strong>Мини-задание ${index + 1}</strong><small>${escapeHTML(task.topic)}</small></span><b>›</b></button>`).join('');
      const table = module.table
        ? `<div class="section-title">Интерактивная схема</div>${renderPositionTableMarkup(module.table, selectedPositionId)}`
        : '';
      container.innerHTML = `<button class="back" data-learning-action="catalog">‹ Все модули</button>
        <div class="panel"><span class="tag">Модуль ${module.order}</span><h3>${escapeHTML(module.title)}</h3>
        <p class="muted">${escapeHTML(module.description)}</p><div class="stats-grid">
        <div class="stat"><small>Уроки</small><strong>${details.lessonsDone}/${module.lessons.length}</strong></div>
        <div class="stat"><small>Экзамен</small><strong>${details.bestScore || 0}%</strong></div>
        <div class="stat"><small>Порог</small><strong>${module.exam.passingScore}%</strong></div></div></div>
        ${table}
        <div class="section-title">Уроки</div><div class="learning-list">${lessons}</div>
        <div class="section-title">Примеры раздач</div><div class="learning-example-grid">${examples}</div>
        <div class="section-title">Мини-задания</div><div class="learning-list">${tasks}</div>
        <button class="primary wide learning-exam-button" data-learning-action="start-exam" data-module-id="${module.id}">${details.saved.examAttempts.length ? 'Повторить экзамен' : 'Начать экзамен'} • ${module.exam.questions.length} вопросов</button>`;
    }

    function renderLesson(moduleId, lessonId) {
      const module = moduleById(moduleId);
      const lesson = module.lessons.find(item => item.id === lessonId);
      const done = Progress.getModuleState(learningState(), moduleId).completedLessons.includes(lessonId);
      container.innerHTML = `<button class="back" data-learning-action="overview" data-module-id="${moduleId}">‹ К модулю</button>
        <article class="panel learning-lesson"><span class="tag">${escapeHTML(lesson.topic)}</span><h3>${escapeHTML(lesson.title)}</h3>
        ${lesson.sections.map(section => `<p>${escapeHTML(section)}</p>`).join('')}
        <div class="coach-box"><div class="coach-title">Подсказка тренера</div>${escapeHTML(lesson.coachTip)}</div>
        <button class="primary wide" data-learning-action="complete-lesson" data-module-id="${moduleId}" data-lesson-id="${lessonId}">${done ? 'Урок завершён — вернуться' : 'Я изучил урок'}</button></article>`;
    }

    function renderTask(moduleId, taskId) {
      const task = moduleById(moduleId).tasks.find(item => item.id === taskId);
      container.innerHTML = `<button class="back" data-learning-action="overview" data-module-id="${moduleId}">‹ К модулю</button>
        <div class="panel"><span class="tag">Мини-задание</span><h3>${escapeHTML(task.topic)}</h3>
        ${renderQuestionMarkup(task, selectedTaskChoice, 'task')}
        ${selectedTaskChoice !== null ? `<button class="primary wide" data-learning-action="overview" data-module-id="${moduleId}">Продолжить</button>` : ''}</div>`;
    }

    function renderExam(moduleId) {
      const module = moduleById(moduleId);
      const question = module.exam.questions[examIndex];
      const progressPercent = Math.round((examIndex + 1) / module.exam.questions.length * 100);
      container.innerHTML = `<button class="back" data-learning-action="overview" data-module-id="${moduleId}">‹ Выйти из экзамена</button>
        <div class="panel"><div class="panel-head"><div><span class="tag">Экзамен</span><h3>${escapeHTML(module.title)}</h3></div><span class="chip">${examIndex + 1}/${module.exam.questions.length}</span></div>
        <div class="learning-exam-progress" aria-label="Прогресс экзамена ${progressPercent}%"><i style="width:${progressPercent}%"></i></div>
        ${renderQuestionMarkup(question, selectedExamChoice, 'exam')}
        ${selectedExamChoice !== null ? `<button class="primary wide" data-learning-action="${examIndex + 1 === module.exam.questions.length ? 'finish-exam' : 'next-exam'}" data-module-id="${moduleId}">${examIndex + 1 === module.exam.questions.length ? 'Завершить экзамен' : 'Следующий вопрос'}</button>` : ''}</div>`;
    }

    function renderExamResult(moduleId) {
      const module = moduleById(moduleId);
      const errors = lastExamResult.errors.length
        ? `<div class="learning-errors">${lastExamResult.errors.map(error => {
          const question = module.exam.questions.find(item => item.id === error.questionId);
          return `<div class="history-item"><strong>${escapeHTML(error.topic)}</strong><small>${escapeHTML(question.prompt)}</small><p>${escapeHTML(error.explanation)}</p></div>`;
        }).join('')}</div>`
        : '<p class="feedback good">Ошибок нет — отличная работа.</p>';
      container.innerHTML = `<div class="panel learning-result"><span class="tag">${lastExamResult.passed ? 'Модуль пройден' : 'Нужно повторить'}</span>
        <h3>Результат: ${lastExamResult.score}%</h3><p class="muted">Проходной результат — ${module.exam.passingScore}%.</p>
        <div class="section-title">Ошибки по темам</div>${errors}
        <div class="learning-result-actions"><button class="primary" data-learning-action="start-exam" data-module-id="${moduleId}">Повторить экзамен</button>
        <button class="ghost" data-learning-action="overview" data-module-id="${moduleId}">К модулю</button></div></div>`;
    }

    function render() {
      if (view.type === 'catalog') renderCatalog();
      else if (view.type === 'overview') renderOverview(view.moduleId);
      else if (view.type === 'lesson') renderLesson(view.moduleId, view.lessonId);
      else if (view.type === 'task') renderTask(view.moduleId, view.taskId);
      else if (view.type === 'exam') renderExam(view.moduleId);
      else if (view.type === 'exam-result') renderExamResult(view.moduleId);
    }

    function handleClick(event) {
      const button = event.target.closest('[data-learning-action]');
      if (!button) return;
      const action = button.dataset.learningAction;
      const moduleId = button.dataset.moduleId || view.moduleId;
      sound.handleUserGesture();
      if (!['answer-task', 'answer-exam', 'finish-exam'].includes(action)) sound.play('uiClick');
      if (action === 'toggle-sound') {
        sound.toggle();
        render();
        return;
      }
      if (action === 'catalog') view = { type: 'catalog' };
      if (action === 'open-module') {
        try {
          saveLearning(Progress.openModule(learningState(), moduleId));
          selectedPositionId = null;
          view = { type: 'overview', moduleId };
        } catch (error) {
          container.querySelector('.learning-header p').textContent = error.message;
          return;
        }
      }
      if (action === 'overview') view = { type: 'overview', moduleId };
      if (action === 'select-position') {
        selectedPositionId = button.dataset.positionId;
        sound.play('cardDeal');
      }
      if (action === 'open-lesson') {
        saveLearning(Progress.openLesson(learningState(), moduleId, button.dataset.lessonId));
        view = { type: 'lesson', moduleId, lessonId: button.dataset.lessonId };
        sound.play('cardDeal');
      }
      if (action === 'complete-lesson') {
        const next = Progress.completeLesson(learningState(), moduleId, button.dataset.lessonId);
        saveLearning(next);
        if (Progress.moduleComplete(next, moduleId)) sound.play('unlock');
        view = { type: 'overview', moduleId };
      }
      if (action === 'open-task') {
        selectedTaskChoice = null;
        view = { type: 'task', moduleId, taskId: button.dataset.taskId };
      }
      if (action === 'answer-task' && selectedTaskChoice === null) {
        selectedTaskChoice = button.dataset.choiceId;
        const result = Progress.answerTask(learningState(), moduleId, view.taskId, selectedTaskChoice);
        saveLearning(result.state);
        sound.play(result.correct ? 'correct' : 'incorrect');
      }
      if (action === 'start-exam') {
        examAnswers = {};
        examIndex = 0;
        selectedExamChoice = null;
        lastExamResult = null;
        view = { type: 'exam', moduleId };
      }
      if (action === 'answer-exam' && selectedExamChoice === null) {
        selectedExamChoice = button.dataset.choiceId;
        const question = moduleById(moduleId).exam.questions[examIndex];
        examAnswers[question.id] = selectedExamChoice;
        sound.play(selectedExamChoice === question.correctChoiceId ? 'correct' : 'incorrect');
      }
      if (action === 'next-exam') {
        examIndex += 1;
        selectedExamChoice = null;
      }
      if (action === 'finish-exam') {
        lastExamResult = Progress.submitExam(learningState(), moduleId, examAnswers);
        saveLearning(lastExamResult.state);
        sound.play(
          Progress.moduleComplete(lastExamResult.state, moduleId)
            ? 'achievement'
            : (lastExamResult.passed ? 'correct' : 'incorrect')
        );
        view = { type: 'exam-result', moduleId };
      }
      render();
    }

    container.addEventListener('click', handleClick);
    render();
    return {
      render,
      showCatalog() {
        view = { type: 'catalog' };
        render();
      },
      resumeFromProgress() {
        const state = learningState();
        const current = state.current;
        const module = current?.moduleId ? moduleById(current.moduleId) : null;
        if (!module || !Progress.canOpenModule(state, module.id)) {
          view = { type: 'catalog' };
          render();
          return false;
        }
        const lessonExists = current.view === 'lesson'
          && module.lessons.some(lesson => lesson.id === current.lessonId);
        view = lessonExists
          ? { type: 'lesson', moduleId: module.id, lessonId: current.lessonId }
          : { type: 'overview', moduleId: module.id };
        render();
        return true;
      },
      openModule(moduleId) {
        saveLearning(Progress.openModule(learningState(), moduleId));
        selectedPositionId = null;
        view = { type: 'overview', moduleId };
        render();
      },
      destroy() {
        container.removeEventListener('click', handleClick);
      }
    };
  }

  const api = {
    create,
    renderQuestionMarkup,
    renderPositionTableMarkup,
    escapeHTML
  };
  root.LearningMode = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
