'use strict';

(function attachOnboardingUi(root) {
  function create({
    documentRef = root.document,
    onboarding,
    i18n = root.PokerElevateI18n,
    cardRenderer = root.PokerCardUI,
    feedback = root.UIFeedback,
    openLegalDocument = () => false,
    onComplete = () => {}
  } = {}) {
    if (!documentRef || !onboarding) throw new Error('Onboarding UI dependencies are required');
    const screen = documentRef.querySelector('#screen-onboarding');
    const welcome = documentRef.querySelector('#onboardingWelcome');
    const consentStep = documentRef.querySelector('#onboardingConsent');
    const assessment = documentRef.querySelector('#onboardingAssessment');
    const resultStep = documentRef.querySelector('#onboardingResult');
    const consent = documentRef.querySelector('#onboardingConsentCheck');
    const continueButton = documentRef.querySelector('#onboardingConsentContinue');
    let bound = false;

    const t = (key, values = {}, fallback = '') => i18n?.t?.(key, values, fallback) || fallback || key;
    const copy = value => i18n?.translateCopy?.(value) || value;

    function setText(selector, value) {
      const element = documentRef.querySelector(selector);
      if (element) element.textContent = String(value ?? '');
    }

    function showStep(active) {
      [welcome, consentStep, assessment, resultStep].forEach(step => {
        if (step) step.hidden = step !== active;
      });
    }

    function renderWelcome() {
      showStep(welcome);
      setText('#onboardingWelcomeEyebrow', t('onboarding.welcome.eyebrow'));
      setText('#onboardingWelcomeTitle', t('onboarding.welcome.title'));
      setText('#onboardingWelcomeBody', t('onboarding.welcome.body'));
      setText('#onboardingWelcomeDetail', t('onboarding.welcome.detail'));
      setText('#onboardingWelcomeStart', t('onboarding.welcome.start'));
    }

    function renderConsent(state) {
      showStep(consentStep);
      const prefix = state.reconsent ? 'onboarding.reconsent' : 'onboarding.consent';
      setText('#onboardingConsentEyebrow', t(`${prefix}.eyebrow`));
      setText('#onboardingConsentTitle', t(`${prefix}.title`));
      setText('#onboardingConsentBody', t(`${prefix}.body`));
      setText('#onboardingConsentLabel', t('onboarding.consent.agree'));
      setText('[data-onboarding-legal="terms"]', t('onboarding.consent.terms'));
      setText('[data-onboarding-legal="privacy"]', t('onboarding.consent.privacy'));
      setText('#onboardingConsentContinue', t(`${prefix}.continue`));
      setText('#onboardingConsentBack', t('onboarding.consent.back'));
      const back = documentRef.querySelector('#onboardingConsentBack');
      if (back) back.hidden = state.reconsent;
      continueButton.disabled = !consent.checked;
    }

    function renderCardGroup(selector, values, small = false) {
      const container = documentRef.querySelector(selector);
      if (!container) return;
      if (!values?.length) {
        container.replaceChildren();
        container.hidden = true;
        return;
      }
      container.hidden = false;
      container.innerHTML = values.map((card, index) =>
        cardRenderer.render(card, { small, dealIndex: index })
      ).join('');
    }

    function actionLabel(action) {
      const suffix = action === 'ALL_IN'
        ? 'allIn'
        : action.toLowerCase();
      return t(`onboarding.action.${suffix}`, {}, action);
    }

    function renderAssessment(state) {
      showStep(assessment);
      const question = state.question;
      const current = state.questionNumber;
      setText('#onboardingAssessmentEyebrow', t('onboarding.assessment.eyebrow'));
      setText('#onboardingAssessmentProgress', t('onboarding.assessment.progress', {
        current,
        total: state.totalQuestions
      }));
      setText('#onboardingAssessmentPrompt', t('onboarding.assessment.prompt'));
      const track = documentRef.querySelector('#onboardingAssessmentTrack');
      if (track) {
        const percent = Math.round(current / state.totalQuestions * 100);
        track.style.setProperty('--onboarding-progress', `${percent}%`);
        track.setAttribute('aria-valuenow', String(current));
        track.setAttribute('aria-valuemax', String(state.totalQuestions));
        track.setAttribute('aria-label', t('onboarding.assessment.progress', { current, total: state.totalQuestions }));
      }

      const metadata = [
        ['#onboardingPositionMeta', '#onboardingPositionLabel', '#onboardingPositionValue', t('onboarding.assessment.position'), question.position],
        ['#onboardingPotMeta', '#onboardingPotLabel', '#onboardingPotValue', t('onboarding.assessment.pot'), question.pot === null ? null : `$${question.pot}`],
        ['#onboardingCallMeta', '#onboardingCallLabel', '#onboardingCallValue', t('onboarding.assessment.toCall'), question.toCall === null ? null : `$${question.toCall}`],
        ['#onboardingStackMeta', '#onboardingStackLabel', '#onboardingStackValue', t('onboarding.assessment.stack'), `$${question.stack}`]
      ];
      metadata.forEach(([wrapSelector, labelSelector, valueSelector, label, value]) => {
        const wrap = documentRef.querySelector(wrapSelector);
        if (wrap) wrap.hidden = value === null;
        setText(labelSelector, label);
        setText(valueSelector, value);
      });

      renderCardGroup('#onboardingHeroCards', question.hero);
      renderCardGroup('#onboardingBoardCards', question.board, true);
      setText('#onboardingAssessmentContext', question.contextKey ? t(question.contextKey) : copy(question.context));

      const actions = documentRef.querySelector('#onboardingActions');
      actions.replaceChildren(...question.actions.map(action => {
        const button = documentRef.createElement('button');
        button.type = 'button';
        button.className = 'onboarding-action';
        button.dataset.onboardingAction = action;
        button.textContent = actionLabel(action);
        button.setAttribute('aria-label', actionLabel(action));
        return button;
      }));
    }

    function skillLabel(skillId) {
      return t(`onboarding.skill.${skillId}`, {}, skillId);
    }

    function renderResult(state) {
      showStep(resultStep);
      const result = state.result || {};
      const bandKey = String(result.bandId || 'STARTER').toLowerCase();
      setText('#onboardingResultEyebrow', t('onboarding.result.eyebrow'));
      setText('#onboardingResultTitle', t('onboarding.result.title'));
      setText('#onboardingResultBand', t(`onboarding.band.${bandKey}`));
      setText('#onboardingResultIqLabel', t('onboarding.result.pokerIq'));
      setText('#onboardingResultIq', result.pokerIq ?? '—');
      setText('#onboardingStrengthsLabel', t('onboarding.result.strengths'));
      setText('#onboardingStrengths', (result.strengths || []).map(skillLabel).join(' · '));
      setText('#onboardingFocusLabel', t('onboarding.result.focus'));
      setText('#onboardingFocus', skillLabel(result.recommendedFocus));
      setText('#onboardingResultStart', t('onboarding.result.start'));
    }

    function render() {
      const state = onboarding.getState();
      if (state.step === 'welcome') renderWelcome();
      else if (state.step === 'consent') renderConsent(state);
      else if (state.step === 'assessment') renderAssessment(state);
      else if (state.step === 'result') renderResult(state);
      return state;
    }

    function open() {
      const state = render();
      root.requestAnimationFrame?.(() => {
        const heading = screen?.querySelector?.('.onboarding-step:not([hidden]) h1');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus?.({ preventScroll: true });
      });
      return state;
    }

    function bind() {
      if (bound) return;
      bound = true;
      documentRef.querySelector('#onboardingWelcomeStart')?.addEventListener('click', () => {
        onboarding.advanceWelcome();
        render();
      });
      documentRef.querySelector('#onboardingConsentBack')?.addEventListener('click', () => {
        onboarding.returnToWelcome();
        render();
      });
      consent?.addEventListener('change', () => {
        continueButton.disabled = !consent.checked;
      });
      continueButton?.addEventListener('click', () => {
        const accepted = onboarding.acceptLegal(consent.checked);
        if (!accepted.accepted) return;
        if (accepted.step === 'complete') onComplete();
        else render();
      });
      documentRef.querySelector('#onboardingActions')?.addEventListener('click', event => {
        const button = event.target.closest('[data-onboarding-action]');
        if (!button) return;
        onboarding.submitAnswer(button.dataset.onboardingAction);
        render();
      });
      documentRef.querySelector('#onboardingResultStart')?.addEventListener('click', () => {
        const completed = onboarding.completeOnboarding();
        if (completed.completed) onComplete(completed.result);
      });
      documentRef.querySelectorAll('[data-onboarding-legal]').forEach(button => {
        button.addEventListener('click', () => {
          const documentName = button.dataset.onboardingLegal;
          openLegalDocument(documentName);
        });
      });
    }

    bind();
    const unsubscribeLocale = i18n?.subscribe?.(() => {
      if (screen?.classList?.contains('active')) render();
    });

    return Object.freeze({
      shouldStart: onboarding.shouldStart,
      getState: onboarding.getState,
      open,
      render,
      destroy() {
        unsubscribeLocale?.();
      }
    });
  }

  const api = Object.freeze({ create });
  root.PokerElevateOnboardingUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
