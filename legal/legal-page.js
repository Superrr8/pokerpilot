'use strict';

(function attachLegalPage(root) {
  const Compliance = root.PokerElevateCompliance
    || (typeof require === 'function' ? require('../src/compliance/release-compliance.js') : null);
  const TYPE_BY_SLUG = Object.freeze({
    terms: 'terms',
    privacy: 'privacy',
    support: 'support',
    'responsible-play': 'responsiblePlay'
  });

  function resolveRequest(search = '', navigatorLanguages = []) {
    const params = new URLSearchParams(String(search || ''));
    const type = TYPE_BY_SLUG[params.get('document')] || 'terms';
    const requestedLocale = params.get('lang');
    const detectedLocale = requestedLocale == null
      ? (navigatorLanguages.some(value => String(value).toLowerCase().startsWith('ru')) ? 'ru' : 'en')
      : requestedLocale;
    return {
      type,
      locale: detectedLocale === 'ru' ? 'ru' : 'en'
    };
  }

  function create({
    documentRef = root.document,
    locationRef = root.location,
    navigatorRef = root.navigator,
    compliance = Compliance
  } = {}) {
    if (!documentRef || !compliance) throw new Error('Legal page dependencies are required');
    const request = resolveRequest(locationRef?.search, navigatorRef?.languages || []);
    const legalDocument = compliance.getDocument(request.type, request.locale);
    const title = documentRef.querySelector('[data-legal-title]');
    const type = documentRef.querySelector('[data-legal-type]');
    const metadata = documentRef.querySelector('[data-legal-metadata]');
    const summary = documentRef.querySelector('[data-legal-summary]');
    const sections = documentRef.querySelector('[data-legal-sections]');

    documentRef.documentElement.lang = legalDocument.locale === 'ru' ? 'ru' : 'en';
    documentRef.title = `${legalDocument.title} — PokerElevate`;
    if (title) title.textContent = legalDocument.title;
    if (type) type.textContent = legalDocument.type === 'responsiblePlay'
      ? (legalDocument.locale === 'ru' ? 'ОБУЧЕНИЕ И ОТВЕТСТВЕННАЯ ИГРА' : 'EDUCATIONAL USE & RESPONSIBLE PLAY')
      : (legalDocument.locale === 'ru' ? 'ДОКУМЕНТ POKERELEVATE' : 'POKERELEVATE DOCUMENT');
    if (metadata) metadata.textContent = legalDocument.locale === 'ru'
      ? `Версия ${legalDocument.version} · Действует с ${legalDocument.effectiveDate}`
      : `Version ${legalDocument.version} · Effective ${legalDocument.effectiveDate}`;
    if (summary) summary.textContent = legalDocument.summary;
    if (sections) {
      const nodes = legalDocument.sections.map(section => {
        const wrapper = documentRef.createElement('section');
        const heading = documentRef.createElement('h2');
        const body = documentRef.createElement('p');
        heading.textContent = section.title;
        body.textContent = section.body;
        wrapper.append(heading, body);
        return wrapper;
      });
      sections.replaceChildren(...nodes);
    }

    documentRef.querySelectorAll('[data-legal-language]').forEach(link => {
      const locale = link.dataset.legalLanguage;
      link.href = compliance.getDestination(request.type, locale).url;
      link.setAttribute('aria-current', locale === legalDocument.locale ? 'page' : 'false');
    });

    return Object.freeze({ request, document: legalDocument });
  }

  const api = Object.freeze({ TYPE_BY_SLUG, resolveRequest, create });
  root.PokerElevateLegalPage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', () => create(), { once: true });
    } else {
      create();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
