'use strict';

(function attachProfileUi(root) {
  const translate = (key, fallback) => root.PokerPilotI18n?.t?.(key, fallback) || fallback;
  const AVATAR_SYMBOLS = Object.freeze({
    'spade-green': 'A♠',
    'diamond-blue': 'K♦',
    'club-gold': 'Q♣',
    'heart-red': 'J♥'
  });

  function number(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function dayWord(value) {
    const count = Math.max(0, Math.floor(number(value)));
    const lastTwo = count % 100;
    const last = count % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
    if (last === 1) return 'день';
    if (last >= 2 && last <= 4) return 'дня';
    return 'дней';
  }

  function createPokerIqViewModel(value = {}) {
    const summary = value && typeof value === 'object' ? value : {};
    const score = optionalNumber(summary.score);
    const ratedDecisions = Math.max(0, Math.floor(number(summary.ratedDecisions)));
    const sampleStatus = ['NONE', 'PROVISIONAL', 'FORMING', 'ESTABLISHED'].includes(summary.sampleStatus)
      ? summary.sampleStatus
      : ratedDecisions ? 'PROVISIONAL' : 'NONE';
    const isRated = summary.isRated === true && score !== null;
    const rank = summary.rank && typeof summary.rank === 'object' ? summary.rank : {};
    const trend = summary.trend && typeof summary.trend === 'object' ? summary.trend : {};
    const details = {
      NONE: 'Нужно минимум 30 оцениваемых решений. Начните с первого решения.',
      PROVISIONAL: `Предварительный Poker IQ · ${ratedDecisions} из 30 решений`,
      FORMING: `Poker IQ формируется · ${ratedDecisions} из 30 решений`,
      ESTABLISHED: `Оценка сформирована по ${ratedDecisions} решениям`
    };
    const trendLabels = {
      UP: `↗ Растёт${Number.isFinite(Number(trend.delta)) ? ` · +${Math.abs(Math.round(Number(trend.delta)))}` : ''}`,
      DOWN: `↘ Снижается${Number.isFinite(Number(trend.delta)) ? ` · −${Math.abs(Math.round(Number(trend.delta)))}` : ''}`,
      STABLE: '→ Стабилен',
      INSUFFICIENT_DATA: '— Недостаточно данных'
    };
    const breakdown = summary.breakdown && typeof summary.breakdown === 'object' ? summary.breakdown : {};
    const streetValue = street => optionalNumber(breakdown[street]) !== null
      ? Math.round(optionalNumber(breakdown[street]))
      : null;
    return {
      isRated,
      score: isRated ? Math.round(score) : null,
      displayScore: isRated ? String(Math.round(score)) : 'Не рассчитан',
      sampleStatus,
      statusLabel: details[sampleStatus],
      ratedDecisions,
      rank: {
        label: isRated ? String(rank.label || 'Без ранга') : 'Без ранга',
        nextLabel: rank.nextRank?.label ? String(rank.nextRank.label) : null,
        iqToNext: optionalNumber(rank.iqToNext) !== null ? Math.max(0, Math.round(optionalNumber(rank.iqToNext))) : null,
        progressPercent: Math.max(0, Math.min(100, Math.round(number(rank.progressPercent))))
      },
      trend: {
        direction: String(trend.direction || 'INSUFFICIENT_DATA'),
        label: trendLabels[trend.direction] || trendLabels.INSUFFICIENT_DATA
      },
      consistency: optionalNumber(summary.components?.consistency) !== null
        ? Math.round(optionalNumber(summary.components.consistency))
        : null,
      streets: {
        preflop: streetValue('preflop'),
        flop: streetValue('flop'),
        turn: streetValue('turn'),
        river: streetValue('river'),
        postflop: streetValue('postflop')
      }
    };
  }

  function createViewModel({
    profile = {},
    statistics = {},
    pokerIQ = null,
    progressSnapshot = null
  } = {}) {
    const hasProgressSnapshot = Boolean(progressSnapshot && typeof progressSnapshot === 'object');
    const snapshot = object(progressSnapshot);
    const progression = hasProgressSnapshot ? object(snapshot.level) : object(profile.progression);
    const ratings = object(profile.ratings);
    const snapshotPokerIq = object(snapshot.pokerIq);
    const snapshotRank = object(snapshot.rank);
    const pokerIqInput = hasProgressSnapshot
      ? {
          ...snapshotPokerIq,
          rank: Object.keys(object(snapshotPokerIq.rank)).length
            ? object(snapshotPokerIq.rank)
            : snapshotRank
        }
      : object(pokerIQ);
    const pokerIqModel = createPokerIqViewModel(pokerIqInput);
    const xpToNextLevel = Math.max(
      1,
      number(progression.xpToNextLevel) || (hasProgressSnapshot ? 1 : 500)
    );
    const xpIntoLevel = Math.min(xpToNextLevel, number(progression.xpIntoLevel));
    const totalXp = hasProgressSnapshot
      ? number(progression.totalXp ?? snapshot.lifetimeXp)
      : number(progression.totalXp);
    const rank = ratings.rank && ratings.rank !== 'Unranked' ? String(ratings.rank) : 'Без ранга';
    const playerTitle = pokerIqModel.isRated
      ? String(snapshotRank.label || pokerIqModel.rank.label || 'Без ранга')
      : 'Без ранга';
    const streakSnapshot = object(snapshot.streak);
    const currentStreak = hasProgressSnapshot ? Math.floor(number(streakSnapshot.current)) : 0;
    const bestStreak = hasProgressSnapshot
      ? Math.max(currentStreak, Math.floor(number(streakSnapshot.best)))
      : 0;
    const decisionQualitySnapshot = object(snapshot.decisionQuality);
    const decisionQualityScore = optionalNumber(decisionQualitySnapshot.score);
    const decisionQualityRated = hasProgressSnapshot
      && decisionQualitySnapshot.isRated === true
      && decisionQualityScore !== null
      && decisionQualityScore >= 0
      && decisionQualityScore <= 100;
    const decisionQualityCount = Math.floor(number(decisionQualitySnapshot.ratedDecisions));
    const achievementSnapshot = object(snapshot.achievements);
    const achievementTotal = hasProgressSnapshot
      ? Math.floor(number(achievementSnapshot.totalCount))
      : 0;
    const achievementUnlocked = Math.min(
      achievementTotal,
      hasProgressSnapshot ? Math.floor(number(achievementSnapshot.unlockedCount)) : 0
    );
    const avatar = profile.avatar || { type: 'initials', value: 'PL' };
    return {
      displayName: String(profile.displayName || 'Player'),
      bio: String(profile.bio || ''),
      preferredGame: String(profile.preferredGame || '$1/$3 Cash'),
      avatar: {
        type: avatar.type === 'preset' && AVATAR_SYMBOLS[avatar.value] ? 'preset' : 'initials',
        value: avatar.type === 'preset' && AVATAR_SYMBOLS[avatar.value]
          ? AVATAR_SYMBOLS[avatar.value]
          : String(avatar.value || 'PL'),
        preset: avatar.type === 'preset' ? avatar.value : null
      },
      playerTitle,
      level: Math.max(1, Math.floor(number(progression.level) || 1)),
      totalXp,
      xpIntoLevel,
      xpToNextLevel,
      progressPercent: Math.max(0, Math.min(100, Math.round(xpIntoLevel / xpToNextLevel * 100))),
      progressLabel: `${xpIntoLevel} / ${xpToNextLevel} XP`,
      pokerIQ: pokerIqModel,
      streak: {
        current: currentStreak,
        best: bestStreak
      },
      decisionQuality: {
        isRated: decisionQualityRated,
        value: decisionQualityRated ? Math.round(decisionQualityScore) : null,
        displayValue: decisionQualityRated
          ? String(Math.round(decisionQualityScore))
          : translate('profile.notCalculatedFeminine', 'Не рассчитана'),
        ratedDecisions: decisionQualityCount
      },
      achievements: {
        unlockedCount: achievementUnlocked,
        totalCount: achievementTotal,
        countLabel: `${achievementUnlocked} / ${achievementTotal}`
      },
      ratings: {
        pokerIQ: pokerIqModel.isRated
          ? pokerIqModel.displayScore
          : ratings.pokerIQ === null || ratings.pokerIQ === undefined
            ? translate('profile.notCalculated', 'Не рассчитан')
            : String(ratings.pokerIQ),
        decisionQuality: hasProgressSnapshot
          ? decisionQualityRated
            ? String(Math.round(decisionQualityScore))
            : translate('profile.notCalculatedFeminine', 'Не рассчитана')
          : ratings.decisionQuality === null || ratings.decisionQuality === undefined
            ? translate('profile.notCalculatedFeminine', 'Не рассчитана')
            : String(ratings.decisionQuality),
        rating: ratings.elo === null || ratings.elo === undefined
          ? translate('profile.unrated', 'Без рейтинга')
          : String(ratings.elo),
        rank: pokerIqModel.isRated
          ? pokerIqModel.rank.label
          : rank === 'Без ранга' ? translate('profile.unranked', rank) : rank
      },
      statistics: {
        isEmpty: Boolean(statistics.isEmpty),
        handsPlayed: number(statistics.handsPlayed),
        savedHands: number(statistics.savedHands),
        sessionsPlayed: number(statistics.sessionsPlayed),
        decisionsMade: number(statistics.decisionsMade),
        correctDecisions: number(statistics.correctDecisions),
        decisionAccuracy: statistics.decisionAccuracy ?? null,
        bestResult: statistics.bestResult ?? null,
        currentDecisionStreak: number(statistics.currentDecisionStreak),
        bestDecisionStreak: number(statistics.bestDecisionStreak),
        currentStreakDays: statistics.currentStreakDays ?? null
      }
    };
  }

  function setText(document, selector, value) {
    const element = document?.querySelector(selector);
    if (element) element.textContent = String(value ?? '');
  }

  function setAvatar(document, selector, model) {
    const element = document?.querySelector(selector);
    if (!element) return;
    element.textContent = model.avatar.value;
    element.dataset.avatarType = model.avatar.type;
    element.dataset.avatarPreset = model.avatar.preset || '';
    element.setAttribute('aria-label', `Аватар ${model.displayName}`);
  }

  function renderHomeEntry(document, model) {
    setAvatar(document, '#homeProfileAvatar', model);
    setText(document, '#homeProfileName', model.displayName);
    setText(document, '#homeProfileLevel', `Level ${model.level} · ${model.totalXp} XP`);
    setText(
      document,
      '#homeProfileIq',
      model.pokerIQ.isRated
        ? `Poker IQ ${model.pokerIQ.displayScore} · ${model.pokerIQ.rank.label}`
        : 'Poker IQ формируется'
    );
    const bar = document?.querySelector('#homeProfileProgress');
    if (bar) {
      bar.style.setProperty('--profile-progress', `${model.progressPercent}%`);
      bar.setAttribute('aria-valuenow', String(model.progressPercent));
      bar.setAttribute('aria-label', `Прогресс Level ${model.level}: ${model.progressLabel}`);
    }
  }

  function renderProfile(document, model) {
    setAvatar(document, '#profileAvatar', model);
    setText(document, '#profileName', model.displayName);
    setText(document, '#profileGame', model.preferredGame);
    const bio = document?.querySelector('#profileBioText');
    if (bio) {
      bio.textContent = model.bio;
      bio.hidden = !model.bio;
    }
    setText(document, '#profilePlayerTitle', model.playerTitle);
    setText(document, '#profileLevel', `Level ${model.level}`);
    setText(document, '#profileXpLabel', model.progressLabel);
    setText(document, '#profileLifetimeXp', `${model.totalXp} XP всего`);
    setText(document, '#profileHeroPokerIq', model.pokerIQ.displayScore);
    setText(
      document,
      '#profileHeroPokerIqMeta',
      model.pokerIQ.ratedDecisions ? `${model.pokerIQ.ratedDecisions} решений` : 'Оценка формируется'
    );
    setText(document, '#profileHeroStreak', `${model.streak.current} ${dayWord(model.streak.current)}`);
    setText(document, '#profileHeroStreakMeta', `Лучшая: ${model.streak.best}`);
    setText(document, '#profileHeroDecisionQuality', model.decisionQuality.displayValue);
    setText(
      document,
      '#profileHeroDecisionQualityMeta',
      model.decisionQuality.ratedDecisions
        ? `${model.decisionQuality.ratedDecisions} решений`
        : 'Оценка формируется'
    );
    setText(document, '#profileHeroAchievements', model.achievements.countLabel);
    setText(document, '#profileHeroAchievementsMeta', 'Открыто');
    const progress = document?.querySelector('#profileXpProgress');
    if (progress) {
      progress.style.setProperty('--profile-progress', `${model.progressPercent}%`);
      progress.setAttribute('aria-valuenow', String(model.progressPercent));
      progress.setAttribute('aria-label', `Прогресс Level ${model.level}: ${model.progressLabel}`);
    }
    setText(document, '#profilePokerIq', model.ratings.pokerIQ);
    setText(document, '#profileDecisionQuality', model.ratings.decisionQuality);
    setText(document, '#profileRating', model.ratings.rating);
    setText(document, '#profileRank', model.ratings.rank);
    setText(document, '#profilePokerIqRank', model.pokerIQ.rank.label);
    setText(document, '#profilePokerIqStatus', model.pokerIQ.statusLabel);
    setText(document, '#profilePokerIqTrend', model.pokerIQ.trend.label);
    setText(document, '#profilePokerIqRated', model.pokerIQ.ratedDecisions);
    setText(
      document,
      '#profilePokerIqConsistency',
      model.pokerIQ.consistency === null ? 'Недостаточно данных' : `${model.pokerIQ.consistency} / 100`
    );
    setText(
      document,
      '#profilePokerIqNext',
      model.pokerIQ.rank.nextLabel && model.pokerIQ.rank.iqToNext !== null
        ? `${model.pokerIQ.rank.iqToNext} IQ до ранга «${model.pokerIQ.rank.nextLabel}»`
        : model.pokerIQ.isRated ? 'Максимальный ранг' : 'Недостаточно данных'
    );
    const pokerIqProgress = document?.querySelector('#profilePokerIqProgress');
    if (pokerIqProgress) {
      pokerIqProgress.style.setProperty('--poker-iq-progress', `${model.pokerIQ.rank.progressPercent}%`);
      pokerIqProgress.setAttribute('aria-valuenow', String(model.pokerIQ.rank.progressPercent));
      pokerIqProgress.setAttribute(
        'aria-label',
        model.pokerIQ.isRated
          ? `Прогресс ранга ${model.pokerIQ.rank.label}: ${model.pokerIQ.rank.progressPercent}%`
          : 'Прогресс Poker IQ: недостаточно данных'
      );
    }
    const pokerIqSummary = document?.querySelector('#profilePokerIqSummary');
    if (pokerIqSummary) {
      pokerIqSummary.setAttribute(
        'aria-label',
        model.pokerIQ.isRated
          ? `Poker IQ ${model.pokerIQ.displayScore}, ранг ${model.pokerIQ.rank.label}. ${model.pokerIQ.statusLabel}.`
          : `Poker IQ не рассчитан. ${model.pokerIQ.statusLabel}.`
      );
      pokerIqSummary.dataset.sampleStatus = model.pokerIQ.sampleStatus;
    }
    Object.entries(model.pokerIQ.streets).forEach(([street, value]) => {
      setText(
        document,
        `#profilePokerIqStreet-${street}`,
        value === null ? 'Недостаточно данных' : value
      );
    });
    setText(document, '#profileHandsPlayed', model.statistics.handsPlayed || 'Нет данных');
    setText(document, '#profileSessionsPlayed', model.statistics.sessionsPlayed);
    setText(document, '#profileDecisionsMade', model.statistics.decisionsMade);
    setText(document, '#profileCorrectDecisions', model.statistics.correctDecisions);
    setText(
      document,
      '#profileBestResult',
      model.statistics.bestResult === null ? 'Нет данных' : `${model.statistics.bestResult}%`
    );
    setText(
      document,
      '#profileDayStreak',
      model.statistics.currentStreakDays === null ? 'Нет данных' : model.statistics.currentStreakDays
    );
    const empty = document?.querySelector('#profileEmptyState');
    if (empty) empty.classList.toggle('hidden', !model.statistics.isEmpty);
    const achievementRules = {
      'first-hand': model.statistics.handsPlayed >= 1,
      'ten-correct': model.statistics.correctDecisions >= 10,
      'three-day-streak': number(model.statistics.currentStreakDays) >= 3,
      'hundred-hands': model.statistics.handsPlayed >= 100
    };
    document?.querySelectorAll('[data-profile-achievement]').forEach(element => {
      const complete = Boolean(achievementRules[element.dataset.profileAchievement]);
      element.classList.toggle('is-complete', complete);
      element.dataset.status = complete ? 'complete' : 'locked';
      const status = element.querySelector('[data-achievement-status]');
      if (status) status.textContent = complete ? 'Выполнено' : 'Заблокировано';
    });
  }

  function create({
    store,
    getStatistics = () => ({}),
    getPokerIQ = () => null,
    getProgressSnapshot = () => null,
    feedback = root.UIFeedback,
    document = root.document
  } = {}) {
    if (!store || typeof store.getProfile !== 'function') {
      throw new Error('ProfileStore недоступен');
    }
    let lastFocused = null;
    const dialog = document?.querySelector('#profileEditDialog');
    const form = document?.querySelector('#profileEditForm');
    const avatarButtons = [...(document?.querySelectorAll('[data-avatar-value]') || [])];

    function currentModel() {
      return createViewModel({
        profile: store.getProfile(),
        statistics: getStatistics(),
        pokerIQ: getPokerIQ(),
        progressSnapshot: getProgressSnapshot()
      });
    }

    function render() {
      const model = currentModel();
      renderHomeEntry(document, model);
      renderProfile(document, model);
      return model;
    }

    function selectAvatar(type, value) {
      avatarButtons.forEach(button => {
        const selected = button.dataset.avatarType === type
          && (type === 'initials' || button.dataset.avatarValue === value);
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
    }

    function populateForm() {
      const profile = store.getProfile();
      const name = document?.querySelector('#profileDisplayName');
      const bio = document?.querySelector('#profileBio');
      const game = document?.querySelector('#profilePreferredGame');
      if (name) name.value = profile.displayName;
      if (bio) bio.value = profile.bio;
      if (game) game.value = profile.preferredGame;
      const initialsButton = avatarButtons.find(button => button.dataset.avatarType === 'initials');
      if (initialsButton) {
        initialsButton.textContent = profile.avatar.type === 'initials'
          ? profile.avatar.value
          : store.getProfile().displayName.slice(0, 2).toLocaleUpperCase('ru-RU');
        initialsButton.dataset.avatarValue = initialsButton.textContent;
      }
      selectAvatar(profile.avatar.type, profile.avatar.value);
    }

    function closeDialog() {
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      const target = lastFocused;
      lastFocused = null;
      if (target && typeof target.focus === 'function') target.focus();
    }

    function openDialog(trigger, focusAvatar = false) {
      if (!dialog) return;
      lastFocused = trigger || document?.activeElement || null;
      populateForm();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (focusAvatar) {
        const avatarTarget = avatarButtons.find(button => button.getAttribute('aria-pressed') === 'true')
          || avatarButtons[0];
        avatarTarget?.focus();
      } else {
        document?.querySelector('#profileDisplayName')?.focus();
      }
    }

    function save(event) {
      event?.preventDefault?.();
      const selected = avatarButtons.find(button => button.getAttribute('aria-pressed') === 'true');
      try {
        store.updateProfile({
          displayName: document?.querySelector('#profileDisplayName')?.value,
          bio: document?.querySelector('#profileBio')?.value,
          preferredGame: document?.querySelector('#profilePreferredGame')?.value,
          avatar: selected
            ? { type: selected.dataset.avatarType, value: selected.dataset.avatarValue }
            : { type: 'initials', value: '' }
        });
        const status = store.getStatus();
        if (!status.persisted) {
          feedback?.showToast?.(
            translate('profile.saveError', 'Не удалось сохранить профиль на устройстве'),
            'danger'
          );
        } else {
          feedback?.showToast?.(translate('profile.saved', 'Профиль сохранён'), 'success');
        }
        closeDialog();
      } catch (error) {
        setText(document, '#profileEditError', error?.message || String(error));
        document?.querySelector('#profileEditError')?.classList.remove('hidden');
      }
    }

    function trapDialogFocus(event) {
      if (!dialog?.open) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
      )].filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document?.querySelector('#profileEdit')?.addEventListener('click', event => openDialog(event.currentTarget));
    document?.querySelector('#profileAvatarEdit')?.addEventListener('click', event => openDialog(event.currentTarget, true));
    document?.querySelector('#profileCancel')?.addEventListener('click', closeDialog);
    form?.addEventListener('submit', save);
    dialog?.addEventListener('keydown', trapDialogFocus);
    dialog?.addEventListener('cancel', event => {
      event.preventDefault();
      closeDialog();
    });
    avatarButtons.forEach(button => button.addEventListener('click', () => {
      selectAvatar(button.dataset.avatarType, button.dataset.avatarValue);
    }));
    const unsubscribe = store.subscribe(render);
    render();

    return Object.freeze({
      render,
      openDialog,
      closeDialog,
      destroy() {
        unsubscribe();
      }
    });
  }

  const api = Object.freeze({
    AVATAR_SYMBOLS,
    createPokerIqViewModel,
    createViewModel,
    renderHomeEntry,
    renderProfile,
    create
  });
  root.PokerPilotProfileUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
