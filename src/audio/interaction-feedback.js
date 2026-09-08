'use strict';

(function attachInteractionFeedback(root) {
  const CONTROL_SELECTOR = [
    'button',
    'a[href]',
    'select',
    'summary',
    'input[type="checkbox"]',
    'input[type="radio"]',
    '[role="button"]',
    '[data-audio-control]'
  ].join(',');
  const ALLOWED_INPUT_TYPES = new Set(['checkbox', 'radio']);

  function findControl(target) {
    return target?.closest?.(CONTROL_SELECTOR) || null;
  }

  function isDisabled(control) {
    if (!control) return true;
    if (control.disabled || control.matches?.(':disabled')) return true;
    if (control.getAttribute?.('aria-disabled') === 'true') return true;
    if (control.closest?.('[inert]')) return true;
    const tag = String(control.tagName || '').toLowerCase();
    if (tag === 'input') {
      const type = String(control.getAttribute?.('type') || control.type || '').toLowerCase();
      return !ALLOWED_INPUT_TYPES.has(type);
    }
    return false;
  }

  function isSemanticOwner(control) {
    return control?.getAttribute?.('data-audio-owner') === 'semantic'
      || control?.hasAttribute?.('data-learning-action')
      || control?.id === 'soundToggle';
  }

  function interactionSound(control) {
    const requested = control?.getAttribute?.('data-audio-event');
    if (requested === 'primary' || requested === 'tap') return requested;
    return control?.classList?.contains('primary')
      || control?.classList?.contains('ui-button-primary')
      ? 'primary'
      : 'tap';
  }

  function create({ documentRef = root.document, sound = root.SoundManager?.getInstance?.() } = {}) {
    const activations = new WeakMap();
    let installed = false;

    function eligible(event) {
      if (!event || event.isTrusted !== true || event.defaultPrevented) return null;
      const control = findControl(event.target);
      return isDisabled(control) ? null : control;
    }

    function activationFor(event) {
      if (activations.has(event)) return activations.get(event);
      const activation = Promise.resolve(sound?.handleUserGesture?.()).catch(() => false);
      activations.set(event, activation);
      return activation;
    }

    function handleGesture(event) {
      const control = eligible(event);
      if (!control) return false;
      activationFor(event);
      return true;
    }

    async function handleClick(event) {
      const control = eligible(event);
      if (!control) return false;
      await activationFor(event);
      if (isSemanticOwner(control)) return false;
      return Boolean(sound?.play?.(interactionSound(control)));
    }

    function install() {
      if (installed || !documentRef?.addEventListener) return false;
      documentRef.addEventListener('click', handleGesture, true);
      documentRef.addEventListener('click', handleClick, false);
      installed = true;
      return true;
    }

    function destroy() {
      if (!installed || !documentRef?.removeEventListener) return false;
      documentRef.removeEventListener('click', handleGesture, true);
      documentRef.removeEventListener('click', handleClick, false);
      installed = false;
      return true;
    }

    return Object.freeze({ install, destroy, handleGesture, handleClick });
  }

  const api = Object.freeze({ CONTROL_SELECTOR, findControl, isDisabled, isSemanticOwner, interactionSound, create });
  root.InteractionFeedback = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
