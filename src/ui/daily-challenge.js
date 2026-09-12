'use strict';

(function attachDailyChallengeUI(root) {
  const translate = (key, values = {}, fallback = '') => root.PokerElevateI18n?.t?.(key, values, fallback) || fallback;
  const localizeCopy = value => root.PokerElevateI18n?.translateCopy?.(value) || value;
  const ACTION_LABELS = Object.freeze({
    FOLD: 'Fold', CHECK: 'Check', CALL: 'Call', BET: 'Bet', RAISE: 'Raise', ALL_IN: 'All-in'
  });
  const STREET_LABELS = Object.freeze({ preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер' });
  const OPPONENT_LABELS = Object.freeze({
    nit: 'тайтовый игрок', reg: 'регуляр', passive: 'пассивный игрок',
    aggro: 'агрессивный игрок', station: 'calling station', new: 'новичок', wild: 'непредсказуемый игрок'
  });

  function cardObject(code) {
    const rank = { T: 10, J: 11, Q: 12, K: 13, A: 14 }[code?.[0]] || Number(code?.[0]);
    return { r: rank, s: code?.[1] };
  }

  function money(value) {
    const amount = Number(value) || 0;
    return `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  }

  function dayLabel(value) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return translate('daily.dayMany', {}, 'дней');
    if (last === 1) return translate('daily.dayOne', {}, 'день');
    if (last >= 2 && last <= 4) return translate('daily.dayFew', {}, 'дня');
    return translate('daily.dayMany', {}, 'дней');
  }

  function dailyStreakLabel(value) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    return translate('daily.streak', { count, unit: dayLabel(count) }, `Серия раздачи дня: ${count} ${dayLabel(count)}`);
  }

  function actionLabel(action) {
    const base = ACTION_LABELS[action.actionClass] || action.actionClass;
    if (!Number.isFinite(action.amount) || action.amount <= 0) return base;
    return action.actionClass === 'RAISE' ? `${base} to ${money(action.amount)}` : `${base} ${money(action.amount)}`;
  }

  function dashboardResultLabel(review) {
    const outcome = review?.isCorrect
      ? translate('daily.correctDecision', {}, 'Правильное решение')
      : translate('daily.incorrect', {}, 'Ошибка');
    return Number.isFinite(review?.xpAwarded)
      ? translate('daily.resultWithXp', { outcome, xp: review.xpAwarded }, `${outcome} · +${review.xpAwarded} XP`)
      : outcome;
  }

  function selectionStatusLabel(action, completed = false) {
    const label = actionLabel(action);
    return completed
      ? translate('daily.answerSaved', { action: label }, `Ответ сохранён: ${label}`)
      : translate('daily.actionSelected', { action: label }, `Выбрано: ${label}`);
  }

  function localizeExplanation(value) {
    return String(value || '')
      .split(/(?<=[.!?])\s+/u)
      .map(localizeCopy)
      .join(' ');
  }

  function resultPresentation(status) {
    if (status?.status !== 'completed' || !status.review) return null;
    const actionFor = actionClass => status.challenge?.actions?.find(action => action.actionClass === actionClass)
      || { actionClass, amount: null };
    return {
      title: status.review.isCorrect
        ? translate('daily.correct', {}, 'Правильно')
        : translate('daily.incorrect', {}, 'Ошибка'),
      stateLabel: translate('daily.handComplete', {}, 'Раздача завершена'),
      selectedActionLabel: actionLabel(actionFor(status.review.selectedAction)),
      correctActionLabel: actionLabel(actionFor(status.review.correctAction)),
      explanation: localizeExplanation(status.review.explanation),
      tone: status.review.isCorrect ? 'good' : 'bad'
    };
  }

  function setText(documentRef, selector, value) {
    const element = documentRef.querySelector(selector);
    if (element) element.textContent = String(value ?? '');
  }

  function create({ documentRef = root.document, system, progress = null, cardRenderer = root.PokerCardUI, onReview = null } = {}) {
    if (!documentRef || !system) throw new Error('Daily Challenge UI requires document and system.');
    const card = documentRef.querySelector('#dailyChallengeCard');
    const actionContainer = documentRef.querySelector('#dailyActions');
    const confirmButton = documentRef.querySelector('#dailyConfirm');
    const reviewButton = documentRef.querySelector('#dailyResultReviewCta');
    let selectedAction = null;
    let actionButtons = [];

    function renderCards(selector, cards, small = false) {
      const container = documentRef.querySelector(selector);
      if (!container) return;
      container.replaceChildren();
      cards.forEach((code, index) => {
        const holder = documentRef.createElement('div');
        holder.innerHTML = cardRenderer.render(cardObject(code), { small, dealIndex: index });
        if (holder.firstElementChild) container.append(holder.firstElementChild);
      });
    }

    function renderDashboard() {
      const status = system.getTodayStatus();
      const progressSnapshot = typeof progress?.getProgressSnapshot === 'function'
        ? progress.getProgressSnapshot()
        : null;
      if (!card) return status;
      const available = status.status === 'new' || status.status === 'completed';
      card.hidden = !available;
      card.dataset.state = status.status;
      if (!available) return status;
      const completed = status.status === 'completed';
      setText(documentRef, '#dailyChallengeStatus', completed ? 'Завершено' : 'Новая');
      setText(documentRef, '#dailyChallengeSummary', `${STREET_LABELS[status.challenge.street]} · ${status.challenge.difficulty}`);
      setText(documentRef, '#dailyChallengeHandLabel', status.challenge.title);
      renderCards('#dailyChallengePreviewCards', status.challenge.heroCards, true);
      setText(documentRef, '#dailyChallengeResult', completed
        ? dashboardResultLabel(status.review)
        : 'Одно решение на сегодня');
      setText(documentRef, '#dailyChallengeTodayState', progressSnapshot?.completedToday
        ? 'Сегодня выполнено'
        : 'Сегодня доступно');
      setText(documentRef, '#dailyChallengeStreak', dailyStreakLabel(progressSnapshot?.currentStreak));
      setText(documentRef, '#dailyChallengeAccuracy', `Решено: ${progressSnapshot?.completedCount || 0} · Точность: ${progressSnapshot?.accuracy || 0}%`);
      const cta = documentRef.querySelector('#dailyChallengeCta');
      if (cta) cta.textContent = completed ? 'Посмотреть разбор' : 'Решить';
      return status;
    }

    function selectAction(actionClass) {
      const status = system.getTodayStatus();
      if (status.status !== 'new') return false;
      selectedAction = actionClass;
      actionButtons.forEach(button => {
        const selected = button.dataset.action === actionClass;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      const selected = status.challenge.actions.find(action => action.actionClass === actionClass);
      setText(documentRef, '#dailySelectionStatus', selectionStatusLabel(selected || { actionClass }));
      documentRef.querySelector('#dailySelectionStatus')?.classList.add('has-selection');
      if (confirmButton) confirmButton.disabled = false;
      return true;
    }

    function renderActions(status) {
      if (!actionContainer) return;
      actionContainer.replaceChildren();
      actionButtons = [];
      status.challenge.actions.forEach(action => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'daily-action';
        button.dataset.action = action.actionClass;
        button.setAttribute('aria-pressed', String(status.review?.selectedAction === action.actionClass));
        button.textContent = actionLabel(action);
        button.disabled = status.status === 'completed';
        if (status.review?.selectedAction === action.actionClass) button.classList.add('is-selected');
        if (status.status === 'completed' && status.review?.correctAction === action.actionClass) button.classList.add('is-recommended');
        if (status.status === 'completed' && !status.review?.isCorrect && status.review?.selectedAction === action.actionClass) {
          button.classList.add('is-incorrect-selection');
        }
        button.addEventListener('click', () => selectAction(action.actionClass));
        actionContainer.append(button);
        actionButtons.push(button);
      });
    }

    function renderFeedback(status) {
      const feedback = documentRef.querySelector('#dailyFeedback');
      const correct = documentRef.querySelector('#dailyCorrectAction');
      const selected = documentRef.querySelector('#dailySelectedAction');
      const explanation = documentRef.querySelector('#dailyExplanation');
      const completed = status.status === 'completed';
      feedback?.classList.toggle('hidden', !completed);
      if (!completed) {
        if (correct) correct.textContent = '';
        if (selected) selected.textContent = '';
        if (explanation) explanation.textContent = '';
        setText(documentRef, '#dailyReward', '');
        setText(documentRef, '#dailyStreak', '');
        setText(documentRef, '#dailyProgressPending', '');
        return;
      }
      const presentation = resultPresentation(status);
      feedback.classList.toggle('good', presentation.tone === 'good');
      feedback.classList.toggle('bad', presentation.tone === 'bad');
      setText(documentRef, '#dailyResultTitle', presentation.title);
      const recorded = status.review.progressStatus === 'recorded' && Number.isFinite(status.review.xpAwarded);
      const pending = status.review.progressStatus === 'pending' || status.review.progressStatus === null;
      const dailySnapshot = typeof progress?.getProgressSnapshot === 'function'
        ? progress.getProgressSnapshot()
        : null;
      setText(documentRef, '#dailyReward', recorded ? `+${status.review.xpAwarded} XP` : '');
      setText(documentRef, '#dailyStreak', Number.isFinite(dailySnapshot?.currentStreak)
        ? dailyStreakLabel(dailySnapshot.currentStreak)
        : '');
      setText(documentRef, '#dailyProgressPending', pending
        ? 'Награда будет зачислена при следующем открытии'
        : '');
      documentRef.querySelector('#dailyProgressPending')?.classList.toggle('hidden', !pending);
      if (selected) selected.textContent = presentation.selectedActionLabel;
      if (correct) correct.textContent = presentation.correctActionLabel;
      if (explanation) explanation.textContent = presentation.explanation;
    }

    function renderScreen() {
      const status = system.getTodayStatus();
      if (status.status !== 'new' && status.status !== 'completed') return status;
      selectedAction = status.review?.selectedAction || null;
      const challenge = status.challenge;
      setText(documentRef, '#dailyTitle', challenge.title);
      setText(documentRef, '#dailyDifficulty', challenge.difficulty);
      setText(documentRef, '#dailyStreet', STREET_LABELS[challenge.street]);
      setText(documentRef, '#dailyPosition', challenge.position);
      setText(documentRef, '#dailyOpponent', `${OPPONENT_LABELS[challenge.opponentType] || challenge.opponentType} · ${challenge.villainPosition}`);
      setText(documentRef, '#dailyPot', money(challenge.pot));
      setText(documentRef, '#dailyCall', challenge.amountToCall > 0 ? money(challenge.amountToCall) : 'Нет ставки');
      setText(documentRef, '#dailyStack', money(challenge.effectiveStack));
      setText(documentRef, '#dailyContext', challenge.context);
      const completed = status.status === 'completed';
      const completionState = documentRef.querySelector('#dailyCompletionState');
      completionState?.classList.toggle('hidden', !completed);
      if (completionState) completionState.textContent = completed ? 'Завершено' : '';
      renderCards('#dailyHeroCards', challenge.heroCards);
      renderCards('#dailyBoard', challenge.board, true);
      documentRef.querySelector('#dailyBoardWrap')?.classList.toggle('hidden', challenge.board.length === 0);
      renderActions(status);
      const selectedDefinition = challenge.actions.find(action => action.actionClass === selectedAction);
      setText(documentRef, '#dailySelectionStatus', completed
        ? selectionStatusLabel(selectedDefinition || { actionClass: selectedAction }, true)
        : selectedAction
          ? selectionStatusLabel(selectedDefinition || { actionClass: selectedAction })
          : 'Выберите действие');
      documentRef.querySelector('#dailySelectionStatus')?.classList.toggle('has-selection', Boolean(selectedAction));
      if (confirmButton) {
        confirmButton.disabled = completed || !selectedAction;
        confirmButton.classList.toggle('hidden', completed);
      }
      renderFeedback(status);
      return status;
    }

    function submit() {
      if (!selectedAction) return { accepted: false, reason: 'NO_SELECTION' };
      if (confirmButton) confirmButton.disabled = true;
      const result = system.submitAnswer(selectedAction);
      renderScreen();
      renderDashboard();
      return result;
    }

    confirmButton?.addEventListener('click', submit);
    reviewButton?.addEventListener('click', () => {
      if (system.getTodayStatus().status === 'completed' && typeof onReview === 'function') onReview();
    });

    return Object.freeze({ renderDashboard, renderScreen, open: renderScreen, selectAction, submit });
  }

  const api = Object.freeze({ create, ACTION_LABELS, STREET_LABELS, dashboardResultLabel, resultPresentation, selectionStatusLabel, dailyStreakLabel });
  root.PokerPilotDailyChallengeUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
