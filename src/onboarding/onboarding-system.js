'use strict';

(function attachOnboardingSystem(root) {
  const PokerCore = root.PokerCore
    || (typeof require === 'function' ? require('../poker-core.js') : null);
  const RangeData = root.OPEN_RANGES
    ? root
    : (typeof require === 'function' ? require('../data/preflop-ranges.js') : {});
  const StudySpots = root.STUDY_SPOTS
    || (typeof require === 'function' ? require('../data/postflop-scenarios.js') : []);
  const DecisionQuality = root.DecisionQualityEngine
    || (typeof require === 'function' ? require('../decision-quality/decision-quality-engine.js') : null);

  const ASSESSMENT_VERSION = '1.0';
  const TERMS_VERSION = '1.0';
  const ASSESSMENT_COUNT = 10;
  const ACTIONS = new Set(['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE', 'ALL_IN']);
  const REQUIRED_I18N_KEYS = Object.freeze([
    'onboarding.welcome.eyebrow',
    'onboarding.welcome.title',
    'onboarding.welcome.body',
    'onboarding.welcome.detail',
    'onboarding.welcome.start',
    'onboarding.consent.eyebrow',
    'onboarding.consent.title',
    'onboarding.consent.body',
    'onboarding.consent.agree',
    'onboarding.consent.terms',
    'onboarding.consent.privacy',
    'onboarding.consent.continue',
    'onboarding.consent.back',
    'onboarding.legal.termsPending',
    'onboarding.legal.privacyPending',
    'onboarding.assessment.eyebrow',
    'onboarding.assessment.progress',
    'onboarding.assessment.prompt',
    'onboarding.assessment.position',
    'onboarding.assessment.pot',
    'onboarding.assessment.toCall',
    'onboarding.assessment.stack',
    'onboarding.result.eyebrow',
    'onboarding.result.title',
    'onboarding.result.pokerIq',
    'onboarding.result.strengths',
    'onboarding.result.focus',
    'onboarding.result.start',
    'onboarding.band.starter',
    'onboarding.band.intermediate',
    'onboarding.band.advanced',
    'onboarding.band.expert',
    'onboarding.skill.preflop',
    'onboarding.skill.value',
    'onboarding.skill.bluffing',
    'onboarding.skill.discipline',
    'onboarding.skill.pokerMath',
    'onboarding.question.firstIn',
    'onboarding.question.earlyOpen',
    'onboarding.question.lateOpen',
    'onboarding.question.facingThreeBet',
    'onboarding.action.fold',
    'onboarding.action.check',
    'onboarding.action.call',
    'onboarding.action.bet',
    'onboarding.action.raise',
    'onboarding.action.allIn'
  ]);

  const BLUEPRINTS = Object.freeze([
    Object.freeze({
      id: 'open-utg-ajo', source: Object.freeze({ type: 'preflop-range', id: 'OPEN_RANGES.UTG' }),
      street: 'preflop', skillId: 'preflop', position: 'UTG', hero: Object.freeze(['Ah', 'Jd']),
      actions: Object.freeze(['FOLD', 'RAISE']), contextKey: 'onboarding.question.firstIn',
      ranges: Object.freeze({ RAISE: RangeData.OPEN_RANGES.UTG })
    }),
    Object.freeze({
      id: 'open-btn-a5s', source: Object.freeze({ type: 'preflop-range', id: 'OPEN_RANGES.BTN' }),
      street: 'preflop', skillId: 'preflop', position: 'BTN', hero: Object.freeze(['As', '5s']),
      actions: Object.freeze(['FOLD', 'RAISE']), contextKey: 'onboarding.question.firstIn',
      ranges: Object.freeze({ RAISE: RangeData.OPEN_RANGES.BTN })
    }),
    Object.freeze({
      id: 'defend-qq-early', source: Object.freeze({ type: 'preflop-range', id: 'DEFEND_VS_EARLY' }),
      street: 'preflop', skillId: 'preflop', position: 'BB', hero: Object.freeze(['Qh', 'Qd']),
      actions: Object.freeze(['FOLD', 'CALL', 'RAISE']), contextKey: 'onboarding.question.earlyOpen',
      ranges: Object.freeze({ RAISE: RangeData.DEFEND_VS_EARLY.raise, CALL: RangeData.DEFEND_VS_EARLY.call })
    }),
    Object.freeze({
      id: 'defend-a9s-late', source: Object.freeze({ type: 'preflop-range', id: 'DEFEND_VS_LATE' }),
      street: 'preflop', skillId: 'preflop', position: 'BB', hero: Object.freeze(['As', '9s']),
      actions: Object.freeze(['FOLD', 'CALL', 'RAISE']), contextKey: 'onboarding.question.lateOpen',
      ranges: Object.freeze({ RAISE: RangeData.DEFEND_VS_LATE.raise, CALL: RangeData.DEFEND_VS_LATE.call })
    }),
    Object.freeze({
      id: 'respond-qq-threebet', source: Object.freeze({ type: 'preflop-range', id: 'VS_3BET' }),
      street: 'preflop', skillId: 'preflop', position: 'CO', hero: Object.freeze(['Qs', 'Qc']),
      actions: Object.freeze(['FOLD', 'CALL', 'RAISE']), contextKey: 'onboarding.question.facingThreeBet',
      ranges: Object.freeze({ RAISE: RangeData.VS_3BET.raise, CALL: RangeData.VS_3BET.call })
    }),
    Object.freeze({ id: 'pot-odds-oesd', source: Object.freeze({ type: 'study-scenario', id: 'flop-oesd' }), skillId: 'pokerMath' }),
    Object.freeze({ id: 'value-overpair', source: Object.freeze({ type: 'study-scenario', id: 'flop-kk-value' }), skillId: 'value' }),
    Object.freeze({ id: 'river-bluff', source: Object.freeze({ type: 'study-scenario', id: 'river-missed-draw' }), skillId: 'bluffing' }),
    Object.freeze({ id: 'river-discipline', source: Object.freeze({ type: 'study-scenario', id: 'river-overbet' }), skillId: 'discipline' }),
    Object.freeze({ id: 'live-thin-value', source: Object.freeze({ type: 'study-scenario', id: 'river-thin-value' }), skillId: 'value' })
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normalizeAction(value) {
    const action = text(value).toUpperCase().replace(/[\s-]+/g, '_');
    return action === 'ALLIN' ? 'ALL_IN' : ACTIONS.has(action) ? action : null;
  }

  function cards(values) {
    return (Array.isArray(values) ? values : []).map(PokerCore.parseCard);
  }

  function spotFor(blueprint) {
    return StudySpots.find(spot => spot.id === blueprint.source.id) || null;
  }

  function resolvedQuestion(blueprint) {
    if (blueprint.source.type === 'preflop-range') {
      return {
        ...blueprint,
        hero: cards(blueprint.hero),
        board: [],
        actions: Array.from(blueprint.actions),
        pot: null,
        toCall: null,
        stack: 300,
        context: null
      };
    }
    const spot = spotFor(blueprint);
    if (!spot) throw new Error(`Missing canonical assessment scenario: ${blueprint.source.id}`);
    return {
      ...blueprint,
      street: String(spot.category || '').toLowerCase()
        .replace('флоп', 'flop').replace('тёрн', 'turn').replace('ривер', 'river'),
      position: spot.position,
      hero: cards(spot.hero),
      board: cards(spot.board),
      actions: spot.actions.map(action => normalizeAction(action)),
      pot: Number(spot.potBefore) || 0,
      toCall: Number(spot.bet) || 0,
      stack: 300,
      context: spot.text,
      grades: Object.fromEntries(Object.entries(spot.grades).map(([action, grade]) => [normalizeAction(action), grade]))
    };
  }

  function correctActionFor(questionId) {
    const blueprint = BLUEPRINTS.find(item => item.id === questionId);
    if (!blueprint) return null;
    if (blueprint.source.type === 'study-scenario') {
      const question = resolvedQuestion(blueprint);
      return question.actions.find(action => question.grades[action] === 'best') || null;
    }
    const handClass = PokerCore.handClass(cards(blueprint.hero));
    for (const action of ['RAISE', 'CALL']) {
      const range = blueprint.ranges[action];
      if (range && PokerCore.expandRange(range).has(handClass)) return action;
    }
    return 'FOLD';
  }

  function gradeFor(questionId, selectedAction) {
    const blueprint = BLUEPRINTS.find(item => item.id === questionId);
    const action = normalizeAction(selectedAction);
    if (!blueprint || !action) return 'mistake';
    if (blueprint.source.type === 'study-scenario') {
      return resolvedQuestion(blueprint).grades[action] || 'mistake';
    }
    return action === correctActionFor(questionId) ? 'best' : 'mistake';
  }

  function publicQuestion(blueprint) {
    const question = resolvedQuestion(blueprint);
    return clone({
      id: question.id,
      source: question.source,
      street: question.street,
      skillId: question.skillId,
      position: question.position,
      hero: question.hero,
      board: question.board,
      actions: question.actions,
      pot: question.pot,
      toCall: question.toCall,
      stack: question.stack,
      contextKey: question.contextKey || null,
      context: question.context || null
    });
  }

  function getAssessmentQuestions() {
    return BLUEPRINTS.map(publicQuestion);
  }

  function bandForPokerIq(value) {
    const score = Number(value) || 0;
    if (score < 1480) return 'STARTER';
    if (score < 1550) return 'INTERMEDIATE';
    if (score < 1620) return 'ADVANCED';
    return 'EXPERT';
  }

  function create({
    profileStore,
    progressSystem,
    now = () => new Date().toISOString(),
    timezoneOffsetMinutes = () => new Date().getTimezoneOffset()
  } = {}) {
    if (!profileStore?.getOnboarding || !profileStore?.updateOnboarding) {
      throw new Error('ProfileStore onboarding API is required');
    }
    if (!progressSystem?.recordEvent || !progressSystem?.getSnapshot || !DecisionQuality?.evaluate) {
      throw new Error('ProgressSystem canonical API is required');
    }

    function profileState() {
      return profileStore.getOnboarding();
    }

    function hasCurrentTerms(state = profileState()) {
      return state.termsVersion === TERMS_VERSION && Boolean(state.termsAcceptedAt);
    }

    function shouldStart() {
      return profileState().onboardingCompleted !== true;
    }

    function stepFor(state) {
      if (state.onboardingCompleted) return 'complete';
      if (state.assessmentCompleted) return 'result';
      if (hasCurrentTerms(state)) return 'assessment';
      return state.currentStep === 'consent' ? 'consent' : 'welcome';
    }

    function normalizedAnswers(state = profileState()) {
      const questions = getAssessmentQuestions();
      const byId = new Map(questions.map(question => [question.id, question]));
      const seen = new Set();
      return (Array.isArray(state.answers) ? state.answers : []).filter(answer => {
        const question = byId.get(answer.questionId);
        const action = normalizeAction(answer.selectedAction);
        if (!question || !action || !question.actions.includes(action) || seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
      }).slice(0, ASSESSMENT_COUNT).map(answer => ({
        questionId: answer.questionId,
        selectedAction: normalizeAction(answer.selectedAction)
      }));
    }

    function progressRecord(question, answer, timestamp) {
      const preferred = correctActionFor(question.id);
      const alternatives = question.actions
        .filter(action => action !== preferred && ['good', 'acceptable'].includes(gradeFor(question.id, action)))
        .map(actionClass => ({ actionClass }));
      const decisionQuality = DecisionQuality.evaluate({
        userAction: { actionClass: answer.selectedAction },
        trainer: {
          actionClass: preferred,
          confidence: 'high',
          isMarginal: alternatives.length > 0,
          alternatives
        },
        context: {
          source: 'onboarding_assessment',
          questionId: question.id,
          street: question.street,
          pot: question.pot,
          toCall: question.toCall
        },
        evaluatedAt: timestamp
      });
      const decisionId = `onboarding:${ASSESSMENT_VERSION}:${question.id}`;
      return {
        eventId: decisionId,
        event: {
          id: decisionId,
          type: 'TRAINING_DECISION_RECORDED',
          timestamp,
          source: 'onboarding_assessment',
          payload: {
            skillId: question.skillId,
            localDate: timestamp.slice(0, 10),
            timezoneOffsetMinutes: Number(timezoneOffsetMinutes()) || 0,
            decisionRecord: {
              decisionId,
              date: timestamp,
              street: question.street,
              decisionMode: 'EXAM',
              trainerSnapshot: { confidence: 'high', isMarginal: alternatives.length > 0 },
              decisionQuality
            }
          }
        }
      };
    }

    function resultFromSnapshot(answers, snapshot) {
      const attemptedSkills = Object.entries(snapshot.skills || {})
        .filter(([, skill]) => Number(skill?.attempts) > 0 && Number.isFinite(Number(skill?.score)))
        .map(([id, skill]) => ({ id, score: Number(skill.score), attempts: Number(skill.attempts) }));
      const ranked = attemptedSkills.sort((left, right) =>
        right.score - left.score || right.attempts - left.attempts || left.id.localeCompare(right.id)
      );
      const weakest = [...attemptedSkills].sort((left, right) =>
        left.score - right.score || right.attempts - left.attempts || left.id.localeCompare(right.id)
      )[0] || null;
      const points = answers.reduce((sum, answer) => {
        const grade = gradeFor(answer.questionId, answer.selectedAction);
        return sum + (grade === 'best' ? 1 : grade === 'good' ? 0.75 : grade === 'acceptable' ? 0.5 : 0);
      }, 0);
      return {
        bandId: bandForPokerIq(snapshot.pokerIq?.score),
        pokerIq: snapshot.pokerIq?.score ?? null,
        scorePercent: Math.round(points / ASSESSMENT_COUNT * 100),
        correctAnswers: answers.filter(answer => gradeFor(answer.questionId, answer.selectedAction) === 'best').length,
        strengths: ranked.slice(0, 2).map(item => item.id),
        recommendedFocus: weakest?.id || 'preflop'
      };
    }

    function finalizeAssessment() {
      const state = profileState();
      const answers = normalizedAnswers(state);
      if (!hasCurrentTerms(state) || answers.length !== ASSESSMENT_COUNT) {
        return { completed: false, reason: 'ASSESSMENT_INCOMPLETE' };
      }
      const timestamp = now();
      const questions = getAssessmentQuestions();
      answers.forEach(answer => {
        const question = questions.find(item => item.id === answer.questionId);
        if (question) progressSystem.recordEvent(progressRecord(question, answer, timestamp).event);
      });
      const snapshot = progressSystem.getSnapshot();
      const result = resultFromSnapshot(answers, snapshot);
      profileStore.updateOnboarding({
        assessmentCompleted: true,
        assessmentVersion: ASSESSMENT_VERSION,
        currentStep: 'result',
        answers,
        result,
        progressInitializedAt: state.progressInitializedAt || timestamp
      });
      return { completed: true, result: clone(result), snapshot };
    }

    function getState() {
      const stored = profileState();
      const step = stepFor(stored);
      const answers = normalizedAnswers(stored);
      const index = Math.min(answers.length, ASSESSMENT_COUNT - 1);
      return {
        required: !stored.onboardingCompleted,
        step,
        questionNumber: step === 'assessment' ? answers.length + 1 : null,
        totalQuestions: ASSESSMENT_COUNT,
        question: step === 'assessment' ? getAssessmentQuestions()[index] : null,
        answers: clone(answers),
        result: stored.result ? clone(stored.result) : null,
        termsAccepted: hasCurrentTerms(stored)
      };
    }

    function advanceWelcome() {
      if (!shouldStart()) return { advanced: false, reason: 'ONBOARDING_COMPLETE' };
      profileStore.updateOnboarding({ currentStep: 'consent' });
      return { advanced: true, step: 'consent' };
    }

    function returnToWelcome() {
      if (!shouldStart() || hasCurrentTerms()) return false;
      profileStore.updateOnboarding({ currentStep: 'welcome' });
      return true;
    }

    function acceptTerms(accepted) {
      if (accepted !== true) return { accepted: false, reason: 'CONSENT_REQUIRED' };
      const state = profileState();
      const resetAssessment = state.assessmentVersion && state.assessmentVersion !== ASSESSMENT_VERSION;
      profileStore.updateOnboarding({
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: now(),
        assessmentVersion: ASSESSMENT_VERSION,
        currentStep: 'assessment',
        answers: resetAssessment ? [] : normalizedAnswers(state),
        assessmentCompleted: resetAssessment ? false : state.assessmentCompleted,
        result: resetAssessment ? null : state.result
      });
      return { accepted: true, step: 'assessment' };
    }

    function submitAnswer(value) {
      const state = profileState();
      const answers = normalizedAnswers(state);
      if (stepFor(state) !== 'assessment') return { accepted: false, reason: 'ASSESSMENT_NOT_ACTIVE' };
      const question = getAssessmentQuestions()[answers.length];
      const action = normalizeAction(value);
      if (!question || !action || !question.actions.includes(action)) {
        return { accepted: false, reason: 'INVALID_ACTION' };
      }
      const nextAnswers = [...answers, { questionId: question.id, selectedAction: action }];
      profileStore.updateOnboarding({ answers: nextAnswers, currentStep: 'assessment' });
      if (nextAnswers.length === ASSESSMENT_COUNT) return finalizeAssessment();
      return { accepted: true, completed: false, questionNumber: nextAnswers.length + 1 };
    }

    function completeOnboarding() {
      const state = profileState();
      if (!state.assessmentCompleted || !state.result) {
        return { completed: false, reason: 'ASSESSMENT_INCOMPLETE' };
      }
      profileStore.updateOnboarding({ onboardingCompleted: true, currentStep: 'complete' });
      return { completed: true, result: clone(state.result) };
    }

    const pending = profileState();
    if (
      !pending.onboardingCompleted
      && !pending.assessmentCompleted
      && hasCurrentTerms(pending)
      && normalizedAnswers(pending).length === ASSESSMENT_COUNT
    ) finalizeAssessment();

    return Object.freeze({
      shouldStart,
      getState,
      advanceWelcome,
      returnToWelcome,
      acceptTerms,
      submitAnswer,
      completeOnboarding
    });
  }

  const api = Object.freeze({
    ASSESSMENT_VERSION,
    TERMS_VERSION,
    ASSESSMENT_COUNT,
    REQUIRED_I18N_KEYS,
    getAssessmentQuestions,
    correctActionFor,
    gradeFor,
    bandForPokerIq,
    create
  });

  root.PokerElevateOnboarding = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
