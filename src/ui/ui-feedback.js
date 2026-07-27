'use strict';

(function attachFeedback(root) {
  function showToast(message, tone = 'info', duration = 2200) {
    const toast = root.document?.querySelector('#appToast');
    if (!toast) return false;
    toast.textContent = String(message ?? '');
    toast.dataset.tone = tone;
    toast.classList.add('is-visible');
    root.clearTimeout(showToast.timer);
    showToast.timer = root.setTimeout(() => toast.classList.remove('is-visible'), duration);
    return true;
  }

  function openDialog({ title, message } = {}) {
    const dialog = root.document?.querySelector('#appDialog');
    if (!dialog) return false;
    const titleNode = dialog.querySelector('[data-dialog-title]');
    const messageNode = dialog.querySelector('[data-dialog-message]');
    if (titleNode) titleNode.textContent = String(title || 'PokerPilot');
    if (messageNode) messageNode.textContent = String(message || '');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return true;
  }

  function closeDialog() {
    const dialog = root.document?.querySelector('#appDialog');
    if (!dialog) return false;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    return true;
  }

  function setLoading(button, loading) {
    if (!button) return false;
    button.classList.toggle('is-loading', Boolean(loading));
    button.toggleAttribute('disabled', Boolean(loading));
    button.setAttribute('aria-busy', String(Boolean(loading)));
    return Boolean(loading);
  }

  function animateChipTransfer(element, direction = 'to-pot') {
    if (!element || root.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    const className = direction === 'to-winner' ? 'is-pot-to-winner' : 'is-chip-to-pot';
    element.classList.remove('is-chip-to-pot', 'is-pot-to-winner');
    root.requestAnimationFrame?.(() => element.classList.add(className));
    root.setTimeout(() => element.classList.remove(className), 520);
    return true;
  }

  const api = { showToast, openDialog, closeDialog, setLoading, animateChipTransfer };
  root.UIFeedback = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

