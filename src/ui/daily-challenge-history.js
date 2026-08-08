'use strict';

(function attachDailyChallengeHistoryUI(root) {
  function setText(documentRef, selector, value) {
    const node = documentRef.querySelector(selector);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function setHidden(documentRef, selector, hidden) {
    const node = documentRef.querySelector(selector);
    if (node) node.hidden = Boolean(hidden);
  }

  function cardObject(code) {
    const rank = { T: 10, J: 11, Q: 12, K: 13, A: 14 }[code?.[0]] || Number(code?.[0]);
    return { r: rank, s: code?.[1] };
  }

  function appendCard(documentRef, container, cardRenderer, code, index, small) {
    if (!container) return;
    const markup = cardRenderer?.render?.(cardObject(code), { small, dealIndex: index });
    if (markup && typeof documentRef.createRange === 'function') {
      const fragment = documentRef.createRange().createContextualFragment(markup);
      container.append(fragment);
      return;
    }
    const card = documentRef.createElement('div');
    card.className = `playing-card${small ? ' small-card' : ''}`;
    card.setAttribute('role', 'img');
    card.setAttribute('aria-label', code || 'Карта');
    card.textContent = code || '';
    container.append(card);
  }

  function renderCards(documentRef, selector, values, cardRenderer, small = false) {
    const container = documentRef.querySelector(selector);
    if (!container) return;
    container.replaceChildren();
    values.forEach((code, index) => appendCard(documentRef, container, cardRenderer, code, index, small));
  }

  function create({ documentRef = root.document, history, cardRenderer = root.PokerCardUI, onNavigate } = {}) {
    if (!documentRef || !history) throw new Error('Daily Challenge History UI requires document and history.');
    let selectedDateKey = null;

    function navigate(route) {
      if (typeof onNavigate === 'function') onNavigate(route);
    }

    function dayLabel(value) {
      const count = Math.max(0, Math.floor(Number(value) || 0));
      const lastTwo = count % 100;
      const last = count % 10;
      if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
      if (last === 1) return 'день';
      if (last >= 2 && last <= 4) return 'дня';
      return 'дней';
    }

    function renderSummary(snapshot, stats) {
      const summary = documentRef.querySelector('#dailyHistorySummary');
      if (summary) summary.hidden = false;
      setText(documentRef, '#dailyHistoryCurrentStreak', `${snapshot.currentStreak} ${dayLabel(snapshot.currentStreak)}`);
      setText(documentRef, '#dailyHistoryBestStreak', `${snapshot.bestStreak} ${dayLabel(snapshot.bestStreak)}`);
      setText(documentRef, '#dailyHistoryTotal', snapshot.completedCount);
      setText(documentRef, '#dailyHistoryCorrect', snapshot.correctCount);
      setText(documentRef, '#dailyHistoryIncorrect', stats.incorrect);
      setText(documentRef, '#dailyHistoryAccuracy', `${snapshot.accuracy}%`);
      setText(documentRef, '#dailyHistoryXp', `${stats.earnedXp} XP`);
      setText(documentRef, '#dailyHistoryRecent', stats.recent
        ? `${stats.recent.outcomeLabel} · ${stats.recent.dateLabel}`
        : '—');
    }

    function reviewDate(dateKey) {
      selectedDateKey = dateKey;
      navigate('daily-review');
    }

    function renderWeek(snapshot) {
      const container = documentRef.querySelector('#dailyHistoryWeek');
      if (!container) return;
      container.replaceChildren();
      snapshot.recentDays.forEach(day => {
        const cell = documentRef.createElement(day.openable ? 'button' : 'div');
        if (day.openable) cell.type = 'button';
        cell.className = `daily-history-day is-${day.status}`;
        cell.dataset.dateKey = day.dateKey;
        cell.setAttribute('aria-label', day.ariaLabel);
        if (day.isToday) cell.setAttribute('aria-current', 'date');
        const weekday = documentRef.createElement('small');
        weekday.textContent = day.weekdayLabel;
        const number = documentRef.createElement('strong');
        number.textContent = String(day.dayNumber);
        const status = documentRef.createElement('span');
        status.textContent = day.statusLabel;
        cell.append(weekday, number, status);
        if (day.openable) cell.addEventListener('click', () => reviewDate(day.dateKey));
        container.append(cell);
      });
    }

    function createHistoryRow(entry) {
      const row = documentRef.createElement('article');
      row.className = 'daily-history-row';
      row.dataset.dateKey = entry.dateKey;
      row.setAttribute('aria-label', `${entry.dateLabel}, ${entry.title}, ${entry.outcomeLabel}`);

      const copy = documentRef.createElement('div');
      copy.className = 'daily-history-row-copy';
      const meta = documentRef.createElement('small');
      meta.textContent = `${entry.dateLabel} · ${entry.streetLabel} · ${entry.difficulty}`;
      const title = documentRef.createElement('h3');
      title.textContent = entry.title;
      const detail = documentRef.createElement('p');
      detail.textContent = `Ваше действие: ${entry.selectedActionLabel}`;
      copy.append(meta, title, detail);

      const result = documentRef.createElement('div');
      result.className = 'daily-history-row-result';
      const outcome = documentRef.createElement('strong');
      outcome.className = `daily-history-outcome is-${entry.isCorrect ? 'correct' : 'incorrect'}`;
      outcome.textContent = entry.outcomeLabel;
      const xp = documentRef.createElement('span');
      xp.textContent = Number.isFinite(entry.xpAwarded) ? `+${entry.xpAwarded} XP` : (
        entry.creditStatus === 'pending' ? 'XP ожидает начисления' : 'XP не начислялся'
      );
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'ui-button-ghost small daily-history-review-button';
      button.setAttribute('aria-label', `Посмотреть разбор: ${entry.dateLabel}, ${entry.title}`);
      button.textContent = 'Посмотреть разбор';
      button.addEventListener('click', () => reviewDate(entry.dateKey));
      result.append(outcome, xp, button);
      row.append(copy, result);
      return row;
    }

    function openHistory() {
      const entries = history.getCompletionHistory();
      const stats = history.getDailyChallengeStats();
      const snapshot = history.getProgressSnapshot();
      renderSummary(snapshot, stats);
      renderWeek(snapshot);
      setHidden(documentRef, '#dailyHistoryEmpty', entries.length > 0);
      setHidden(documentRef, '#dailyHistoryContent', entries.length === 0);
      const list = documentRef.querySelector('#dailyHistoryList');
      if (list) {
        list.replaceChildren();
        entries.forEach(entry => list.append(createHistoryRow(entry)));
      }
      return { entries, stats, snapshot };
    }

    function openReview(dateKey = selectedDateKey) {
      const review = history.getHistoricalReview(dateKey);
      const content = documentRef.querySelector('#dailyReviewContent');
      const empty = documentRef.querySelector('#dailyReviewUnavailable');
      if (!review) {
        if (content) content.hidden = true;
        if (empty) empty.hidden = false;
        return null;
      }
      selectedDateKey = review.dateKey;
      if (content) content.hidden = false;
      if (empty) empty.hidden = true;
      setText(documentRef, '#dailyReviewDate', review.dateLabel);
      setText(documentRef, '#dailyReviewTitle', review.title);
      setText(documentRef, '#dailyReviewStreet', review.streetLabel);
      setText(documentRef, '#dailyReviewDifficulty', review.difficulty);
      setText(documentRef, '#dailyReviewOutcome', review.outcomeLabel);
      setText(documentRef, '#dailyReviewSelected', review.selectedActionLabel);
      setText(documentRef, '#dailyReviewCorrect', review.correctActionLabel);
      setText(documentRef, '#dailyReviewXp', Number.isFinite(review.xpAwarded) ? `+${review.xpAwarded} XP` : 'XP не начислялся');
      setText(documentRef, '#dailyReviewContext', review.context);
      setText(documentRef, '#dailyReviewExplanation', review.explanation);
      setText(documentRef, '#dailyReviewFallback', review.challengeAvailable ? '' : review.unavailableMessage);
      setHidden(documentRef, '#dailyReviewFallback', review.challengeAvailable);
      renderCards(documentRef, '#dailyReviewHeroCards', review.heroCards, cardRenderer);
      renderCards(documentRef, '#dailyReviewBoard', review.board, cardRenderer, true);
      setHidden(documentRef, '#dailyReviewCards', !review.challengeAvailable);
      return review;
    }

    return Object.freeze({ openHistory, openReview, reviewDate });
  }

  const api = Object.freeze({ create });
  root.PokerPilotDailyChallengeHistoryUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
