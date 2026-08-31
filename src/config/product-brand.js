'use strict';

(function attachProductBrand(root) {
  const identity = {
    productName: 'PokerElevate',
    shortName: 'PokerElevate',
    wordmark: 'PokerElevate',
    monogram: 'PE',
    tagline: 'Тренировка и разбор решений',
    documentTitle: 'PokerElevate'
  };

  function apply(documentRef = root.document) {
    if (!documentRef) return false;
    documentRef.title = identity.documentTitle;
    documentRef.querySelectorAll?.('[data-brand]').forEach(node => {
      const key = node.getAttribute('data-brand');
      if (Object.prototype.hasOwnProperty.call(identity, key)) {
        node.textContent = identity[key];
      }
    });
    const applicationName = documentRef.querySelector?.('meta[name="application-name"]');
    const appleTitle = documentRef.querySelector?.('meta[name="apple-mobile-web-app-title"]');
    if (applicationName) applicationName.content = identity.productName;
    if (appleTitle) appleTitle.content = identity.productName;
    return true;
  }

  const api = Object.freeze({ ...identity, apply });
  root.ProductBrand = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
