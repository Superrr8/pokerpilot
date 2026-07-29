'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = path.join(__dirname, '..', 'src', 'profile', 'profile-store.js');

function loadApi() {
  if (!fs.existsSync(modulePath)) return {};
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function memoryStorage(initial = {}, { failWrites = false } = {}) {
  const values = new Map(Object.entries(initial));
  const operations = [];
  return {
    getItem(key) {
      operations.push(['getItem', key]);
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      operations.push(['setItem', key, String(value)]);
      if (failWrites) throw new Error('QuotaExceededError');
      values.set(key, String(value));
    },
    removeItem(key) {
      operations.push(['removeItem', key]);
      values.delete(key);
    },
    snapshot: () => Object.fromEntries(values),
    operations
  };
}

function createStore({ initial, failWrites = false } = {}) {
  const api = loadApi();
  assert.equal(typeof api.createProfileStore, 'function', 'createProfileStore отсутствует');
  const storage = memoryStorage(initial, { failWrites });
  const store = api.createProfileStore({
    storage,
    now: () => '2026-07-29T12:00:00.000Z',
    createId: () => 'profile-test-id'
  });
  return { api, store, storage };
}

test('Default profile создаётся с безопасными фактическими значениями', () => {
  const { store } = createStore();
  const profile = store.getProfile();
  assert.equal(profile.displayName, 'Player');
  assert.deepEqual(profile.avatar, { type: 'initials', value: 'PL' });
  assert.equal(profile.preferredGame, '$1/$3 Cash');
  assert.equal(profile.progression.totalXp, 0);
  assert.equal(profile.progression.level, 1);
  assert.deepEqual(profile.ratings, {
    pokerIQ: null,
    decisionQuality: null,
    elo: null,
    rank: 'Unranked'
  });
  assert.equal(profile.settings.profileVisibility, 'private');
});

test('schemaVersion и единый storage key имеют текущие значения', () => {
  const { api, store, storage } = createStore();
  assert.equal(api.PROFILE_SCHEMA_VERSION, 1);
  assert.equal(store.getProfile().schemaVersion, 1);
  assert.equal(api.PROFILE_STORAGE_KEY, 'pokerpilot_profile');
  assert.deepEqual(
    [...new Set(storage.operations.map(([, key]) => key))],
    ['pokerpilot_profile']
  );
});

test('повреждённый JSON восстанавливается без падения', () => {
  const { store } = createStore({
    initial: { pokerpilot_profile: '{broken' }
  });
  assert.doesNotThrow(() => store.getProfile());
  assert.equal(store.getProfile().displayName, 'Player');
  assert.equal(store.getProfile().schemaVersion, 1);
});

test('старый профиль мигрирует в schemaVersion 1 без потери допустимых полей', () => {
  const old = {
    schemaVersion: 0,
    name: '  Daria  ',
    bio: 'Cash player',
    game: '$2/$5 Cash',
    avatarPreset: 'spade-green',
    xp: 500,
    createdAt: '2025-01-01T00:00:00.000Z'
  };
  const { store } = createStore({
    initial: { pokerpilot_profile: JSON.stringify(old) }
  });
  const profile = store.getProfile();
  assert.equal(profile.schemaVersion, 1);
  assert.equal(profile.displayName, 'Daria');
  assert.equal(profile.preferredGame, '$2/$5 Cash');
  assert.equal(profile.avatar.value, 'spade-green');
  assert.equal(profile.progression.totalXp, 500);
  assert.equal(profile.progression.level, 2);
  assert.equal(profile.createdAt, old.createdAt);
});

test('повторная миграция идемпотентна', () => {
  const api = loadApi();
  const options = {
    now: () => '2026-07-29T12:00:00.000Z',
    createId: () => 'profile-test-id'
  };
  const once = api.migrateProfile({
    schemaVersion: 0,
    name: 'Player One',
    xp: 1250
  }, options);
  const twice = api.migrateProfile(once, options);
  assert.deepEqual(twice, once);
});

test('частично повреждённый профиль получает безопасные defaults по полям', () => {
  const { store } = createStore({
    initial: {
      pokerpilot_profile: JSON.stringify({
        schemaVersion: 1,
        displayName: 'X'.repeat(100),
        bio: 'Y'.repeat(500),
        preferredGame: null,
        avatar: { type: 'preset', value: 'missing' },
        progression: { totalXp: -400 },
        ratings: { pokerIQ: 'bad' }
      })
    }
  });
  const profile = store.getProfile();
  assert.equal(profile.displayName, 'Player');
  assert.equal(profile.bio, '');
  assert.equal(profile.preferredGame, '$1/$3 Cash');
  assert.deepEqual(profile.avatar, { type: 'initials', value: 'PL' });
  assert.equal(profile.progression.totalXp, 0);
  assert.equal(profile.ratings.pokerIQ, null);
});

test('getProfile возвращает копию и не позволяет мутировать состояние store снаружи', () => {
  const { store } = createStore();
  const snapshot = store.getProfile();
  snapshot.displayName = 'Mutated';
  snapshot.progression.totalXp = 999999;
  assert.equal(store.getProfile().displayName, 'Player');
  assert.equal(store.getProgression().totalXp, 0);
});

test('updateProfile trim-ит имя и сохраняет допустимые данные', () => {
  const { store } = createStore();
  const updated = store.updateProfile({
    displayName: '  Влад  ',
    bio: '  Играю спокойно  ',
    preferredGame: '  $1/$3 Cash  '
  });
  assert.equal(updated.displayName, 'Влад');
  assert.equal(updated.bio, 'Играю спокойно');
  assert.equal(updated.preferredGame, '$1/$3 Cash');
  assert.equal(store.getProfile().displayName, 'Влад');
});

test('пустое имя отклоняется без изменения профиля', () => {
  const { store } = createStore();
  assert.throws(
    () => store.updateProfile({ displayName: '   ' }),
    /имя/i
  );
  assert.equal(store.getProfile().displayName, 'Player');
});

test('имя длиннее 24 символов отклоняется', () => {
  const { store } = createStore();
  assert.throws(
    () => store.updateProfile({ displayName: 'A'.repeat(25) }),
    /24/
  );
});

test('bio длиннее 120 символов отклоняется', () => {
  const { store } = createStore();
  assert.throws(
    () => store.updateProfile({ bio: 'B'.repeat(121) }),
    /120/
  );
});

test('неизвестный avatar preset нормализуется в инициалы', () => {
  const { store } = createStore();
  const updated = store.updateProfile({
    displayName: 'Vlad Poker',
    avatar: { type: 'preset', value: 'unknown-preset' }
  });
  assert.deepEqual(updated.avatar, { type: 'initials', value: 'VP' });
});

test('XP не может стать отрицательным', () => {
  const { store } = createStore();
  assert.throws(() => store.addXp(-1, 'test'), /XP/i);
  assert.equal(store.getProgression().totalXp, 0);
});

test('XP curve корректна на границах первых уровней', () => {
  const api = loadApi();
  assert.equal(typeof api.calculateLevelFromXp, 'function');
  assert.deepEqual(api.calculateLevelFromXp(0), {
    totalXp: 0,
    level: 1,
    xpIntoLevel: 0,
    xpToNextLevel: 500,
    levelStartXp: 0,
    nextLevelXp: 500
  });
  assert.equal(api.calculateLevelFromXp(499).level, 1);
  assert.equal(api.calculateLevelFromXp(500).level, 2);
  assert.equal(api.calculateLevelFromXp(1249).level, 2);
  assert.equal(api.calculateLevelFromXp(1250).level, 3);
});

test('addXp не создаёт NaN и сохраняет источник операции', () => {
  const { store } = createStore();
  assert.throws(() => store.addXp('not-a-number', 'test'), /XP/i);
  const progression = store.addXp(500, 'manual-test');
  assert.equal(progression.totalXp, 500);
  assert.equal(progression.level, 2);
  assert.equal(Number.isNaN(progression.totalXp), false);
  assert.equal(store.getProfile().progression.lastXpSource, 'manual-test');
});

test('одно обновление вызывает одно уведомление подписчика', () => {
  const { store } = createStore();
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.updateProfile({ bio: 'One update' });
  assert.equal(calls, 1);
  unsubscribe();
  store.updateProfile({ bio: 'Second update' });
  assert.equal(calls, 1);
});

test('ошибка quota не ломает in-memory профиль и сообщается вызывающему коду', () => {
  const { store } = createStore({ failWrites: true });
  const updated = store.updateProfile({ displayName: 'Offline Player' });
  assert.equal(updated.displayName, 'Offline Player');
  assert.equal(store.getProfile().displayName, 'Offline Player');
  assert.equal(store.getStatus().persisted, false);
  assert.match(store.getStatus().error, /QuotaExceededError/);
});

test('отсутствующий localStorage не ломает профиль', () => {
  const api = loadApi();
  const store = api.createProfileStore({
    storage: null,
    now: () => '2026-07-29T12:00:00.000Z',
    createId: () => 'memory-only'
  });
  assert.equal(store.getProfile().displayName, 'Player');
  assert.equal(store.updateProfile({ displayName: 'Memory' }).displayName, 'Memory');
  assert.equal(store.getStatus().persisted, false);
});
