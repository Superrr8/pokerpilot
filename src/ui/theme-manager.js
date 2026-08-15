'use strict';

(function attachThemeManager(root) {
  const THEME_STORAGE_KEY = 'pokerpilot.appearance.v1';
  const THEME_IDS = Object.freeze([
    'emerald',
    'amber',
    'indigo',
    'minimal',
    'cyber',
    'glass',
    'warm-wood',
    'soft-pastel'
  ]);
  const THEME_OPTIONS = Object.freeze([
    { id: 'auto', name: 'System / Auto', description: 'Следовать оформлению устройства' },
    { id: 'emerald', name: 'Emerald', description: 'Глубокий зелёный' },
    { id: 'amber', name: 'Amber', description: 'Тёплый янтарный' },
    { id: 'indigo', name: 'Indigo', description: 'Прохладный индиго' },
    { id: 'minimal', name: 'Minimal Light', description: 'Светлый минимализм' },
    { id: 'cyber', name: 'Neon Cyber', description: 'Неон и энергия' },
    { id: 'glass', name: 'Glass', description: 'Стекло и глубина' },
    { id: 'warm-wood', name: 'Warm Wood', description: 'Тёплый клубный' },
    { id: 'soft-pastel', name: 'Soft Pastel', description: 'Мягкий светлый' }
  ]);
  const VALID_PREFERENCES = new Set(['auto', ...THEME_IDS]);
  const LIGHT_THEMES = new Set(['amber', 'minimal', 'soft-pastel']);

  function safeStorage(candidate) {
    if (candidate !== undefined) return candidate;
    try {
      return root.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function normalizePreference(value) {
    return VALID_PREFERENCES.has(value) ? value : 'emerald';
  }

  function createThemeManager({
    storage,
    rootElement = root.document?.documentElement || null,
    matchMedia = query => root.matchMedia?.(query) || { matches: false }
  } = {}) {
    const activeStorage = safeStorage(storage);
    const listeners = new Set();
    let systemQuery = null;
    let preference = 'emerald';
    let resolvedTheme = 'emerald';

    try {
      preference = normalizePreference(activeStorage?.getItem?.(THEME_STORAGE_KEY));
    } catch (_) {
      preference = 'emerald';
    }

    function prefersLight() {
      try {
        systemQuery ||= matchMedia('(prefers-color-scheme: light)');
        return Boolean(systemQuery?.matches);
      } catch (_) {
        return false;
      }
    }

    function resolve(value) {
      return value === 'auto' ? (prefersLight() ? 'minimal' : 'emerald') : normalizePreference(value);
    }

    function apply(value = preference, notify = false) {
      preference = normalizePreference(value);
      resolvedTheme = resolve(preference);
      if (rootElement) {
        rootElement.dataset.theme = resolvedTheme;
        rootElement.dataset.themePreference = preference;
        rootElement.style.colorScheme = LIGHT_THEMES.has(resolvedTheme) ? 'light' : 'dark';
        rootElement.setAttribute?.('data-theme', resolvedTheme);
      }
      const meta = root.document?.querySelector?.('meta[name="theme-color"]');
      if (meta) {
        const colors = {
          emerald: '#07100d', amber: '#f3ede1', indigo: '#080b17', minimal: '#f5f3ee',
          cyber: '#090711', glass: '#050b14', 'warm-wood': '#110b08', 'soft-pastel': '#faf4f1'
        };
        meta.setAttribute('content', colors[resolvedTheme]);
      }
      if (notify) {
        const snapshot = { preference, resolvedTheme };
        listeners.forEach(listener => listener(snapshot));
      }
      return resolvedTheme;
    }

    function persist() {
      try {
        activeStorage?.setItem?.(THEME_STORAGE_KEY, preference);
        return true;
      } catch (_) {
        return false;
      }
    }

    function setTheme(value) {
      preference = normalizePreference(value);
      persist();
      apply(preference, true);
      return { preference, resolvedTheme };
    }

    function handleSystemChange() {
      if (preference === 'auto') apply(preference, true);
    }

    apply(preference);
    try {
      systemQuery ||= matchMedia('(prefers-color-scheme: light)');
      systemQuery?.addEventListener?.('change', handleSystemChange);
    } catch (_) {}

    return Object.freeze({
      setTheme,
      applyTheme: () => apply(preference),
      getPreference: () => preference,
      getResolvedTheme: () => resolvedTheme,
      subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      destroy() {
        listeners.clear();
        systemQuery?.removeEventListener?.('change', handleSystemChange);
      }
    });
  }

  const manager = createThemeManager();

  function mountThemePicker(documentRef = root.document) {
    const picker = documentRef?.querySelector?.('#profileAppearance');
    if (!picker || picker.dataset.themePickerMounted === 'true') return picker || null;
    picker.dataset.themePickerMounted = 'true';
    const buttons = [...picker.querySelectorAll('[data-theme-choice]')];
    const update = () => {
      const preference = manager.getPreference();
      const resolved = manager.getResolvedTheme();
      buttons.forEach(button => {
        const selected = button.dataset.themeChoice === preference;
        button.classList.toggle('is-selected', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      const status = picker.querySelector('[data-theme-current]');
      if (status) {
        const option = THEME_OPTIONS.find(item => item.id === preference);
        status.textContent = preference === 'auto'
          ? `${option.name} · сейчас ${THEME_OPTIONS.find(item => item.id === resolved)?.name || resolved}`
          : option?.name || resolved;
      }
    };
    picker.addEventListener('click', event => {
      const button = event.target.closest?.('[data-theme-choice]');
      if (!button || !picker.contains(button)) return;
      manager.setTheme(button.dataset.themeChoice);
    });
    manager.subscribe(update);
    update();
    return picker;
  }

  const api = Object.freeze({
    THEME_STORAGE_KEY,
    THEME_IDS,
    THEME_OPTIONS,
    normalizePreference,
    createThemeManager,
    mountThemePicker,
    setTheme: manager.setTheme,
    getPreference: manager.getPreference,
    getResolvedTheme: manager.getResolvedTheme,
    subscribe: manager.subscribe
  });

  root.PokerPilotTheme = api;
  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', () => mountThemePicker(root.document), { once: true });
    } else {
      mountThemePicker(root.document);
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
