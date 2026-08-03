'use strict';

(function attachProfileStore(root) {
  const ProgressConfig = root.PokerPilotProgressConfig
    || (typeof require === 'function' ? require('../progress/progress-config.js') : null);
  const PROFILE_SCHEMA_VERSION = 1;
  const PROFILE_STORAGE_KEY = 'pokerpilot_profile';
  const MAX_DISPLAY_NAME_LENGTH = 24;
  const MAX_BIO_LENGTH = 120;
  const MAX_PREFERRED_GAME_LENGTH = 32;
  const AVATAR_PRESETS = Object.freeze([
    'spade-green',
    'diamond-blue',
    'club-gold',
    'heart-red'
  ]);

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function initialsFor(name) {
    const words = cleanText(name).split(/\s+/).filter(Boolean);
    const initials = words.length > 1
      ? `${words[0][0] || ''}${words[1][0] || ''}`
      : (words[0] || 'Player').slice(0, 2);
    return initials.toLocaleUpperCase('ru-RU');
  }

  function validateDisplayName(value) {
    const name = cleanText(value);
    if (!name) throw new Error('Имя профиля не может быть пустым');
    if ([...name].length > MAX_DISPLAY_NAME_LENGTH) {
      throw new Error(`Имя профиля не может быть длиннее ${MAX_DISPLAY_NAME_LENGTH} символов`);
    }
    return name;
  }

  function validateBio(value) {
    const bio = cleanText(value);
    if ([...bio].length > MAX_BIO_LENGTH) {
      throw new Error(`Bio не может быть длиннее ${MAX_BIO_LENGTH} символов`);
    }
    return bio;
  }

  function validatePreferredGame(value) {
    const game = cleanText(value);
    if (!game) throw new Error('Выберите предпочитаемую игру');
    if ([...game].length > MAX_PREFERRED_GAME_LENGTH) {
      throw new Error(`Название игры не может быть длиннее ${MAX_PREFERRED_GAME_LENGTH} символов`);
    }
    return game;
  }

  function normalizeAvatar(value, displayName) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (raw.type === 'preset' && AVATAR_PRESETS.includes(raw.value)) {
      return { type: 'preset', value: raw.value };
    }
    return { type: 'initials', value: initialsFor(displayName) };
  }

  function xpRequiredForLevel(level) {
    return ProgressConfig.xpRequiredForLevel(level);
  }

  function calculateLevelFromXp(value) {
    return ProgressConfig.deriveLevel(value);
  }

  function safeIsoDate(value, fallback) {
    if (typeof value !== 'string') return fallback;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
  }

  function nullableNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function defaultProfile({ now, createId } = {}) {
    const timestamp = typeof now === 'function' ? now() : new Date().toISOString();
    const id = typeof createId === 'function'
      ? String(createId())
      : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return {
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id,
      displayName: 'Player',
      avatar: { type: 'initials', value: 'PL' },
      bio: '',
      preferredGame: '$1/$3 Cash',
      createdAt: timestamp,
      updatedAt: timestamp,
      progression: {
        ...calculateLevelFromXp(0),
        lastXpSource: null
      },
      ratings: {
        pokerIQ: null,
        decisionQuality: null,
        elo: null,
        rank: 'Unranked'
      },
      activity: {
        handsPlayed: 0,
        sessionsPlayed: 0,
        decisionsMade: 0,
        correctDecisions: 0,
        currentStreakDays: 0,
        bestStreakDays: 0,
        lastActiveDate: null
      },
      achievements: [],
      settings: {
        profileVisibility: 'private'
      }
    };
  }

  function migrateProfile(value, options = {}) {
    const base = defaultProfile(options);
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const legacy = Number(raw.schemaVersion) < PROFILE_SCHEMA_VERSION;
    const rawName = cleanText(
      legacy ? raw.displayName || raw.name : raw.displayName
    );
    const displayName = rawName && [...rawName].length <= MAX_DISPLAY_NAME_LENGTH
      ? rawName
      : base.displayName;
    const rawBio = cleanText(raw.bio);
    const bio = [...rawBio].length <= MAX_BIO_LENGTH ? rawBio : base.bio;
    const rawPreferredGame = cleanText(
      legacy ? raw.preferredGame || raw.game : raw.preferredGame
    );
    const preferredGame = rawPreferredGame && [...rawPreferredGame].length <= MAX_PREFERRED_GAME_LENGTH
      ? rawPreferredGame
      : base.preferredGame;
    const rawXp = legacy
      ? raw.progression?.totalXp ?? raw.xp ?? 0
      : raw.progression?.totalXp ?? 0;
    const totalXp = Number.isFinite(Number(rawXp)) ? Math.max(0, Math.floor(Number(rawXp))) : 0;
    const avatarInput = legacy && raw.avatarPreset
      ? { type: 'preset', value: raw.avatarPreset }
      : raw.avatar;
    const ratings = raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {};
    const activity = raw.activity && typeof raw.activity === 'object' ? raw.activity : {};
    const createdAt = safeIsoDate(raw.createdAt, base.createdAt);
    const updatedAt = safeIsoDate(raw.updatedAt, createdAt);
    return {
      ...base,
      schemaVersion: PROFILE_SCHEMA_VERSION,
      id: cleanText(raw.id) || base.id,
      displayName,
      avatar: normalizeAvatar(avatarInput, displayName),
      bio,
      preferredGame,
      createdAt,
      updatedAt,
      progression: {
        ...calculateLevelFromXp(totalXp),
        lastXpSource: cleanText(raw.progression?.lastXpSource) || null
      },
      ratings: {
        pokerIQ: nullableNumber(ratings.pokerIQ),
        decisionQuality: nullableNumber(ratings.decisionQuality),
        elo: nullableNumber(ratings.elo),
        rank: cleanText(ratings.rank) || 'Unranked'
      },
      activity: {
        ...base.activity,
        ...Object.fromEntries(Object.entries(activity).filter(([key, item]) =>
          Object.hasOwn(base.activity, key)
          && (item === null || typeof item === 'string' || Number.isFinite(Number(item)))
        ))
      },
      achievements: Array.isArray(raw.achievements)
        ? raw.achievements.filter(item => item && typeof item === 'object').map(clone)
        : [],
      settings: {
        profileVisibility: raw.settings?.profileVisibility === 'private'
          ? 'private'
          : 'private'
      }
    };
  }

  function createProfileStore({
    storage,
    now = () => new Date().toISOString(),
    createId
  } = {}) {
    let activeStorage = storage;
    if (activeStorage === undefined) {
      try {
        activeStorage = root.localStorage || null;
      } catch (_) {
        activeStorage = null;
      }
    }
    const listeners = new Set();
    const options = { now, createId };
    let status = { persisted: Boolean(activeStorage), error: null };
    let profile;

    function persist() {
      if (!activeStorage || typeof activeStorage.setItem !== 'function') {
        status = { persisted: false, error: null };
        return false;
      }
      try {
        activeStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
        status = { persisted: true, error: null };
        return true;
      } catch (error) {
        status = {
          persisted: false,
          error: String(error?.message || error || 'Storage error')
        };
        return false;
      }
    }

    function load() {
      let parsed = null;
      try {
        const stored = activeStorage && typeof activeStorage.getItem === 'function'
          ? activeStorage.getItem(PROFILE_STORAGE_KEY)
          : null;
        parsed = stored ? JSON.parse(stored) : null;
      } catch (error) {
        status = { persisted: false, error: String(error?.message || error) };
      }
      try {
        profile = migrateProfile(parsed, options);
      } catch (_) {
        profile = defaultProfile(options);
      }
      persist();
      return clone(profile);
    }

    function notify() {
      const snapshot = clone(profile);
      listeners.forEach(listener => listener(snapshot));
    }

    function commit(next) {
      profile = migrateProfile(next, options);
      persist();
      notify();
      return clone(profile);
    }

    load();

    return Object.freeze({
      getProfile() {
        return clone(profile);
      },
      updateProfile(patch = {}) {
        if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
          throw new Error('Изменения профиля должны быть объектом');
        }
        const displayName = Object.hasOwn(patch, 'displayName')
          ? validateDisplayName(patch.displayName)
          : profile.displayName;
        const bio = Object.hasOwn(patch, 'bio') ? validateBio(patch.bio) : profile.bio;
        const preferredGame = Object.hasOwn(patch, 'preferredGame')
          ? validatePreferredGame(patch.preferredGame)
          : profile.preferredGame;
        const avatar = Object.hasOwn(patch, 'avatar')
          ? normalizeAvatar(patch.avatar, displayName)
          : profile.avatar.type === 'initials'
            ? normalizeAvatar(profile.avatar, displayName)
            : clone(profile.avatar);
        return commit({
          ...profile,
          displayName,
          bio,
          preferredGame,
          avatar,
          updatedAt: now()
        });
      },
      resetProfile() {
        return commit(defaultProfile(options));
      },
      getProgression() {
        return clone(profile.progression);
      },
      addXp(amount, source = 'manual') {
        const numeric = Number(amount);
        if (!Number.isFinite(numeric) || numeric < 0) {
          throw new Error('XP должен быть неотрицательным числом');
        }
        const totalXp = profile.progression.totalXp + Math.floor(numeric);
        const next = commit({
          ...profile,
          progression: {
            ...calculateLevelFromXp(totalXp),
            lastXpSource: cleanText(source) || 'manual'
          },
          updatedAt: now()
        });
        return clone(next.progression);
      },
      subscribe(listener) {
        if (typeof listener !== 'function') throw new Error('Listener должен быть функцией');
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getStatus() {
        return { ...status };
      }
    });
  }

  const singleton = createProfileStore();
  const api = Object.freeze({
    PROFILE_SCHEMA_VERSION,
    PROFILE_STORAGE_KEY,
    MAX_DISPLAY_NAME_LENGTH,
    MAX_BIO_LENGTH,
    MAX_PREFERRED_GAME_LENGTH,
    AVATAR_PRESETS,
    xpRequiredForLevel,
    calculateLevelFromXp,
    defaultProfile,
    migrateProfile,
    createProfileStore,
    getProfile: singleton.getProfile,
    updateProfile: singleton.updateProfile,
    resetProfile: singleton.resetProfile,
    getProgression: singleton.getProgression,
    addXp: singleton.addXp,
    subscribe: singleton.subscribe,
    getStatus: singleton.getStatus
  });

  root.ProfileStore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
