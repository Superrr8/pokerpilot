'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const uiPath = path.join(root, 'src', 'ui', 'progress-overview.js');
const cssPath = path.join(root, 'src', 'styles', 'progress-overview.css');

let ProgressOverview;
let loadError = null;
try {
  ProgressOverview = require(uiPath);
} catch (error) {
  loadError = error;
}

function api() {
  assert.ifError(loadError);
  assert.ok(ProgressOverview);
  return ProgressOverview;
}

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function skill(score = null, attempts = 0, confidence = 'insufficient', recentTrend = 'INSUFFICIENT_DATA') {
  return { score, attempts, confidence, recentTrend, updatedAt: null };
}

function snapshot(overrides = {}) {
  return {
    lifetimeXp: 0,
    level: {
      totalXp: 0,
      level: 1,
      xpIntoLevel: 0,
      xpToNextLevel: 500,
      levelStartXp: 0,
      nextLevelXp: 500
    },
    decisionQuality: {
      score: null,
      classification: 'UNRATED',
      isRated: false,
      recentAverage: null,
      ratedDecisions: 0
    },
    pokerIq: {
      score: null,
      isRated: false,
      sampleStatus: 'NONE',
      rank: { id: 'UNRANKED', label: 'Без ранга' },
      trend: { direction: 'INSUFFICIENT_DATA', delta: null },
      ratedDecisions: 0
    },
    rank: { id: 'UNRANKED', label: 'Без ранга' },
    streak: { current: 0, best: 0, lastQualifiedDate: null },
    skills: {
      preflop: skill(),
      value: skill(),
      bluffing: skill(),
      discipline: skill(),
      pokerMath: skill(),
      postflop: skill()
    },
    recentChanges: [],
    achievements: {
      unlockedCount: 0,
      totalCount: 10,
      items: []
    },
    ...overrides
  };
}

test('Progress Overview экспортирует чистую read-only модель и фиксированные broad skills', () => {
  const overview = api();
  assert.equal(typeof overview.createViewModel, 'function');
  assert.equal(typeof overview.render, 'function');
  assert.deepEqual(
    overview.SKILL_IDS,
    ['preflop', 'value', 'bluffing', 'discipline', 'pokerMath', 'postflop']
  );
});

test('новый игрок видит правдивые empty states без выдуманных трендов и рекомендаций', () => {
  const model = api().createViewModel({
    snapshot: snapshot(),
    displayName: 'Player',
    today: '2026-07-31'
  });
  assert.equal(model.playerName, 'Player');
  assert.equal(model.pokerIq.value, 'Не рассчитан');
  assert.equal(model.pokerIq.rank, 'Без ранга');
  assert.equal(model.pokerIq.change, null);
  assert.equal(model.decisionQuality.value, 'Не рассчитана');
  assert.match(model.decisionQuality.emptyMessage, /Недостаточно решений/);
  assert.equal(model.weeklyFocus.target, null);
  assert.match(model.weeklyFocus.emptyMessage, /Недостаточно надёжных данных/);
  assert.equal(model.recentEvents.length, 0);
  assert.match(model.recentEmptyMessage, /Пока нет/);
});

test('частичный или повреждённый snapshot нормализуется только для безопасного отображения', () => {
  const model = api().createViewModel({
    snapshot: {
      level: { level: -4, xpIntoLevel: 'bad', xpToNextLevel: 0 },
      pokerIq: { score: Infinity, rank: null, trend: { delta: NaN } },
      decisionQuality: null,
      skills: { preflop: { score: 250, attempts: -1 } },
      streak: { current: -3, best: 'bad' },
      recentChanges: 'broken'
    },
    displayName: '   ',
    today: 'bad-date'
  });
  assert.equal(model.playerName, 'Player');
  assert.equal(model.level.number, 1);
  assert.equal(model.level.xpIntoLevel, 0);
  assert.equal(model.level.xpToNextLevel, 1);
  assert.equal(model.pokerIq.value, 'Не рассчитан');
  assert.equal(model.skills.find(item => item.id === 'preflop').available, false);
  assert.deepEqual(model.streak, {
    current: 0,
    best: 0,
    todayQualified: false,
    todayLabel: 'Сегодня активность ещё не засчитана'
  });
});

test('Poker IQ, derived rank и реальное изменение берутся из snapshot', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      pokerIq: {
        score: 1842,
        isRated: true,
        sampleStatus: 'ESTABLISHED',
        rank: { id: 'EXPERT', label: 'Эксперт' },
        trend: { direction: 'UP', delta: 38 },
        ratedDecisions: 74
      },
      rank: { id: 'EXPERT', label: 'Эксперт' }
    }),
    displayName: 'Мария'
  });
  assert.equal(model.pokerIq.value, '1842');
  assert.equal(model.pokerIq.rank, 'Эксперт');
  assert.equal(model.pokerIq.change, '+38');
  assert.match(model.pokerIq.sampleLabel, /74/);
  assert.equal(model.playerName, 'Мария');
});

test('Level и XP progress сохраняют точные границы snapshot без пересчёта формул', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      level: {
        totalXp: 1749,
        level: 3,
        xpIntoLevel: 749,
        xpToNextLevel: 1000,
        levelStartXp: 1000,
        nextLevelXp: 2000
      }
    })
  });
  assert.deepEqual(model.level, {
    number: 3,
    totalXp: 1749,
    xpIntoLevel: 749,
    xpToNextLevel: 1000,
    label: '749 / 1000 XP'
  });
});

test('Decision Quality показывает текущий score, band и контекст выборки только при данных', () => {
  const absent = api().createViewModel({ snapshot: snapshot() });
  assert.equal(absent.decisionQuality.available, false);

  const present = api().createViewModel({
    snapshot: snapshot({
      decisionQuality: {
        score: 88,
        classification: 'GOOD',
        isRated: true,
        recentAverage: 84.5,
        ratedDecisions: 12
      }
    })
  });
  assert.equal(present.decisionQuality.available, true);
  assert.equal(present.decisionQuality.value, '88');
  assert.equal(present.decisionQuality.band, 'Хорошее решение');
  assert.match(present.decisionQuality.sampleLabel, /12/);
  assert.match(present.decisionQuality.sampleLabel, /формируется/);
});

test('skills preview показывает attempts, confidence и trend только когда они существуют', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      skills: {
        ...snapshot().skills,
        preflop: skill(82.4, 34, 'high', 'UP'),
        value: skill(71, 8, 'low', 'STABLE')
      }
    })
  });
  const preflop = model.skills.find(item => item.id === 'preflop');
  const value = model.skills.find(item => item.id === 'value');
  const bluffing = model.skills.find(item => item.id === 'bluffing');
  assert.equal(preflop.score, 82.4);
  assert.equal(preflop.attemptsLabel, '34 попытки');
  assert.equal(preflop.confidenceLabel, 'Высокая уверенность');
  assert.equal(preflop.trendLabel, 'Растёт');
  assert.equal(value.trendLabel, 'Стабильно');
  assert.equal(bluffing.scoreLabel, 'Нет данных');
  assert.equal(bluffing.trendLabel, null);
});

test('weekly focus выбирает только надёжный существующий skill или честный fallback', () => {
  const noTarget = api().createViewModel({
    snapshot: snapshot({
      skills: {
        ...snapshot().skills,
        value: skill(52, 8, 'low', 'DOWN')
      }
    })
  });
  assert.equal(noTarget.weeklyFocus.target, null);

  const target = api().createViewModel({
    snapshot: snapshot({
      skills: {
        ...snapshot().skills,
        preflop: skill(76, 31, 'high', 'STABLE'),
        discipline: skill(64, 14, 'medium', 'DOWN'),
        postflop: skill(70, 11, 'medium', 'STABLE')
      }
    })
  });
  assert.equal(target.weeklyFocus.target.id, 'discipline');
  assert.equal(target.weeklyFocus.target.score, 64);
  assert.equal(target.weeklyFocus.route, 'study');
});

test('streak использует current, best и факт квалификации сегодняшнего дня', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      streak: { current: 4, best: 9, lastQualifiedDate: '2026-07-31' }
    }),
    today: '2026-07-31'
  });
  assert.equal(model.streak.current, 4);
  assert.equal(model.streak.best, 9);
  assert.equal(model.streak.todayQualified, true);
  assert.equal(model.streak.todayLabel, 'Сегодня уже засчитано');
});

test('recent progress ограничен тремя существующими meaningful events', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      recentChanges: [
        { eventId: 'a', type: 'LESSON_COMPLETED', timestamp: '2026-07-31T10:00:00Z', xp: 30 },
        { eventId: 'b', type: 'TRAINING_SESSION_COMPLETED', timestamp: '2026-07-30T10:00:00Z', xp: 40 },
        { eventId: 'c', type: 'HAND_REVIEW_COMPLETED', timestamp: '2026-07-29T10:00:00Z', xp: 35 },
        { eventId: 'd', type: 'EXAM_COMPLETED', timestamp: '2026-07-28T10:00:00Z', xp: 60 },
        { eventId: 'ignored', type: 'UNKNOWN_EVENT', timestamp: '2026-07-27T10:00:00Z', xp: 999 }
      ]
    })
  });
  assert.equal(model.recentEvents.length, 3);
  assert.deepEqual(model.recentEvents.map(item => item.id), ['a', 'b', 'c']);
  assert.equal(model.recentEvents[0].xpLabel, '+30 XP');
});

test('Achievements показывает корректный count, locked/unlocked state и измеримый progress', () => {
  const model = api().createViewModel({
    snapshot: snapshot({
      achievements: {
        unlockedCount: 1,
        totalCount: 3,
        items: [
          {
            id: 'FIRST_STEP', title: 'Первый шаг', description: 'Завершите первую тренировку.',
            iconKey: 'spark', rarity: 'common', hidden: false, unlocked: true,
            unlockedAt: '2026-08-03T12:00:00.000Z', progress: { current: 1, target: 1, percent: 100, label: '1 / 1' }
          },
          {
            id: 'QUICK_LEARNER', title: 'Быстро учусь', description: 'Завершите 10 тренировок.',
            iconKey: 'bolt', rarity: 'uncommon', hidden: false, unlocked: false,
            unlockedAt: null, progress: { current: 4, target: 10, percent: 40, label: '4 / 10 тренировок' }
          },
          {
            id: 'HIGH_ACHIEVER', title: 'Новый ранг', description: 'Секрет.',
            iconKey: 'rank', rarity: 'rare', hidden: true, unlocked: false,
            unlockedAt: null, progress: null
          }
        ]
      }
    })
  });
  assert.equal(model.achievements.countLabel, '1 / 3');
  assert.equal(model.achievements.items[0].unlocked, true);
  assert.equal(model.achievements.items[0].dateLabel, '03.08.2026');
  assert.equal(model.achievements.items[1].progressLabel, '4 / 10 тренировок');
  assert.equal(model.achievements.items[2].title, 'Скрытое достижение');
  assert.equal(model.achievements.items[2].description.includes('Секрет'), false);
  assert.equal(model.achievements.items[2].progressLabel, null);
});

test('Achievements безопасен для пустого snapshot, unknown item и repeated render contract', () => {
  const overview = api();
  const empty = overview.createViewModel({ snapshot: snapshot() });
  assert.equal(empty.achievements.items.length, 0);
  assert.match(empty.achievements.emptyMessage, /Пока нет/);

  const unknown = overview.createViewModel({
    snapshot: snapshot({
      achievements: {
        unlockedCount: 0,
        totalCount: 10,
        items: [{ id: 'UNKNOWN_OLD', unlocked: true }]
      }
    })
  });
  assert.equal(unknown.achievements.items.length, 0);

  const source = read(uiPath);
  const html = read(htmlPath);
  assert.match(html, /id="progressAchievementsList"/);
  assert.match(html, /id="progressAchievementsCount"/);
  assert.match(source, /progressAchievementsList/);
  assert.match(source, /replaceChildren/);
});

test('Progress Overview подключён после ProgressSystem и читает snapshot без мутаций', () => {
  const html = read(htmlPath);
  const source = read(uiPath);
  const progressScript = '<script src="src/progress/progress-system.js"></script>';
  const overviewScript = '<script src="src/ui/progress-overview.js"></script>';
  assert.ok(fs.existsSync(uiPath), 'Нет src/ui/progress-overview.js');
  assert.ok(fs.existsSync(cssPath), 'Нет src/styles/progress-overview.css');
  assert.match(html, /src\/styles\/progress-overview\.css/);
  assert.ok(html.indexOf(progressScript) < html.indexOf(overviewScript));
  assert.ok(html.indexOf(overviewScript) < html.indexOf("const C = window.PokerCore;"));
  assert.match(html, /ProgressSystem\.getSnapshot\(\)/);
  assert.match(html, /id="progressOverview"/);
  assert.match(html, /id="progressFocusCta"[^>]*data-route="study"/);
  assert.match(source, /\.textContent\s*=/);
  assert.doesNotMatch(source, /recordEvent|addXp|localStorage|innerHTML\s*=/);
});

test('UI-контракт использует native progress, не содержит chart и сохраняет Profile route', () => {
  const html = read(htmlPath);
  const source = read(uiPath);
  assert.match(html, /id="progressXpBar"[^>]*<|<progress id="progressXpBar"/);
  assert.match(source, /createElement\(['"]progress['"]\)/);
  assert.doesNotMatch(`${html}\n${source}`, /radar|canvas|getContext\(/i);
  assert.match(html, /id="screen-profile"/);
  assert.match(html, /data-route="profile"/);
});

test('CSS остаётся mobile-first, использует tokens и защищает safe area/overflow', () => {
  const css = read(cssPath);
  assert.match(css, /var\(--surface-/);
  assert.match(css, /var\(--accent/);
  assert.match(css, /overflow-x:\s*(?:clip|hidden)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(min-width:\s*768px\)/);
  assert.doesNotMatch(css, /@keyframes|animation\s*:/);
});
