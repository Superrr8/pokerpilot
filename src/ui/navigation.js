'use strict';

(function attachNavigation(root) {
  const i18n = root.PokerPilotI18n;
  const definition = [
    { id: 'home', route: 'home', labelKey: 'nav.home', icon: '⌂' },
    { id: 'learning', route: 'learning', labelKey: 'nav.learning', icon: '◇' },
    { id: 'training', route: 'training', labelKey: 'nav.training', icon: '◎' },
    { id: 'analysis', route: 'analyzer', labelKey: 'nav.analysis', icon: '⌕' },
    { id: 'profile', route: 'profile', labelKey: 'nav.profile', icon: '○' }
  ];
  const sections = Object.freeze(definition.map(item => Object.freeze({
    ...item,
    label: i18n.t(item.labelKey)
  })));
  const routeSections = Object.freeze({
    home: 'home',
    daily: 'home',
    learning: 'learning',
    ranges: 'learning',
    training: 'training',
    study: 'training',
    live: 'training',
    analyzer: 'analysis',
    analysis: 'analysis',
    coach: 'profile',
    profile: 'profile'
  });
  const routeAliases = Object.freeze({
    analysis: 'analyzer',
    coach: 'profile'
  });

  function resolveRoute(route) {
    return routeAliases[route] || route;
  }

  function sectionForRoute(route) {
    return routeSections[route] || routeSections[resolveRoute(route)] || 'home';
  }

  function setActive(container, route) {
    if (!container) return sectionForRoute(route);
    const activeSection = sectionForRoute(route);
    container.querySelectorAll('button[data-section]').forEach(button => {
      const active = button.dataset.section === activeSection;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    return activeSection;
  }

  function render(container, activeRoute = 'home') {
    if (!container) return null;
    const document = container.ownerDocument;
    container.replaceChildren();
    sections.forEach(section => {
      const button = document.createElement('button');
      const icon = document.createElement('span');
      const label = document.createElement('span');
      button.type = 'button';
      button.dataset.route = section.route;
      button.dataset.section = section.id;
      button.setAttribute('aria-label', section.label);
      icon.className = 'primary-nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = section.icon;
      label.className = 'primary-nav-label';
      label.textContent = section.label;
      button.append(icon, label);
      container.append(button);
    });
    setActive(container, activeRoute);
    return container;
  }

  const api = Object.freeze({
    sections,
    routeSections,
    resolveRoute,
    sectionForRoute,
    setActive,
    render
  });
  root.PokerPilotNavigation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
