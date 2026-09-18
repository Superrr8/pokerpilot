'use strict';

(function attachReleaseComplianceUi(root) {
  function create({
    documentRef = root.document,
    compliance = root.PokerElevateCompliance,
    i18n = root.PokerElevateI18n,
    feedback = root.UIFeedback,
    storage = root.localStorage,
    confirmRef = message => root.confirm?.(message) === true,
    locationRef = root.location
  } = {}) {
    if (!documentRef || !compliance) throw new Error('Release compliance UI dependencies are required');
    let bound = false;
    const t = (key, values = {}, fallback = '') => i18n?.t?.(key, values, fallback) || fallback || key;
    const locale = () => i18n?.getLocale?.() || 'en';

    function setCopy(element) {
      const key = element?.dataset?.complianceCopy;
      if (key) element.textContent = t(`compliance.${key}`);
    }

    function render() {
      documentRef.querySelectorAll?.('[data-compliance-copy]')?.forEach(setCopy);
      const section = documentRef.querySelector?.('#profileCompliance');
      section?.setAttribute?.('aria-label', t('compliance.title'));
    }

    function documentMessage(document) {
      const metadata = [
        t('compliance.version', { version: document.version }),
        t('compliance.effectiveDate', { date: document.effectiveDate })
      ].join(' · ');
      return [
        metadata,
        document.summary,
        ...document.sections.flatMap(section => [section.title, section.body])
      ].join('\n\n');
    }

    function openDocument(type) {
      const activeLocale = locale();
      const document = compliance.getDocument(type, activeLocale);
      const destination = compliance.getDestination(type, activeLocale);
      return feedback?.openDialog?.({
        title: document.title,
        message: documentMessage(document),
        destination: destination.url
          ? { url: destination.url, label: t('compliance.openDestination') }
          : null
      }) || false;
    }

    function deleteData() {
      if (!confirmRef(t('compliance.deleteConfirm'))) return { deleted: false, reason: 'CANCELLED' };
      const result = compliance.deleteAllLocalData(storage);
      if (result.errors.length) {
        feedback?.showToast?.(t('compliance.deleteFailed'), 'danger');
        return { deleted: false, reason: 'STORAGE_ERROR', ...result };
      }
      locationRef?.reload?.();
      return { deleted: true, ...result };
    }

    function bind() {
      if (bound) return;
      bound = true;
      documentRef.querySelectorAll?.('[data-legal-document]')?.forEach(button => {
        button.addEventListener('click', () => openDocument(button.dataset.legalDocument));
      });
      documentRef.querySelectorAll?.('[data-delete-local-data]')?.forEach(button => {
        button.addEventListener('click', deleteData);
      });
    }

    bind();
    render();
    const unsubscribe = i18n?.subscribe?.(render);
    return Object.freeze({
      render,
      openDocument,
      deleteData,
      destroy() {
        unsubscribe?.();
      }
    });
  }

  const api = Object.freeze({ create });
  root.PokerElevateComplianceUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
