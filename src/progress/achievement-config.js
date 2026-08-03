'use strict';

(function attachAchievementConfig(root) {
  const RARITIES = Object.freeze(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']);
  const CATEGORIES = Object.freeze([
    'training',
    'decisions',
    'mastery',
    'progress',
    'consistency',
    'exams'
  ]);
  const RANK_ORDER = Object.freeze([
    'BEGINNER',
    'LEARNING',
    'INTERMEDIATE',
    'ADVANCED',
    'EXPERT',
    'MASTER',
    'GRANDMASTER',
    'ELITE',
    'LEGEND',
    'POKERPILOT'
  ]);
  const DEFAULT_RANK_ID = 'INTERMEDIATE';

  const definitions = [
    {
      id: 'FIRST_STEP',
      title: 'Первый шаг',
      description: 'Завершите первый тренировочный сценарий.',
      iconKey: 'spark',
      category: 'training',
      rarity: 'COMMON',
      hidden: false,
      condition: { metric: 'trainingScenarios', comparator: 'gte', target: 1 }
    },
    {
      id: 'QUICK_LEARNER',
      title: 'Быстро учусь',
      description: 'Завершите 10 тренировочных сценариев.',
      iconKey: 'bolt',
      category: 'training',
      rarity: 'COMMON',
      hidden: false,
      condition: { metric: 'trainingScenarios', comparator: 'gte', target: 10 }
    },
    {
      id: 'DECISION_MAKER',
      title: 'Решительный игрок',
      description: 'Примите 25 решений в тренажёре.',
      iconKey: 'decision',
      category: 'decisions',
      rarity: 'RARE',
      hidden: false,
      condition: { metric: 'trainerDecisions', comparator: 'gte', target: 25 }
    },
    {
      id: 'SHARP_MIND',
      title: 'Острый ум',
      description: 'Достигните Poker IQ 60 или выше.',
      iconKey: 'mind',
      category: 'mastery',
      rarity: 'EPIC',
      hidden: false,
      condition: { metric: 'pokerIq', comparator: 'gte', target: 60 }
    },
    {
      id: 'POKER_STUDENT',
      title: 'Ученик покера',
      description: 'Достигните Level 5.',
      iconKey: 'book',
      category: 'progress',
      rarity: 'RARE',
      hidden: false,
      condition: { metric: 'level', comparator: 'gte', target: 5 }
    },
    {
      id: 'ON_A_ROLL',
      title: 'На волне',
      description: 'Поддерживайте серию занятий 3 дня.',
      iconKey: 'flame',
      category: 'consistency',
      rarity: 'RARE',
      hidden: false,
      condition: { metric: 'streak', comparator: 'gte', target: 3 }
    },
    {
      id: 'DEDICATED',
      title: 'Предан игре',
      description: 'Поддерживайте серию занятий 7 дней.',
      iconKey: 'calendar',
      category: 'consistency',
      rarity: 'EPIC',
      hidden: false,
      condition: { metric: 'streak', comparator: 'gte', target: 7 }
    },
    {
      id: 'EXAM_READY',
      title: 'Готов к экзамену',
      description: 'Завершите первый экзамен.',
      iconKey: 'exam',
      category: 'exams',
      rarity: 'RARE',
      hidden: false,
      condition: { metric: 'exams', comparator: 'gte', target: 1 }
    },
    {
      id: 'HIGH_ACHIEVER',
      title: 'Новый уровень игры',
      description: 'Поднимитесь выше начального ранга.',
      iconKey: 'rank',
      category: 'mastery',
      rarity: 'EPIC',
      hidden: true,
      condition: { metric: 'rank', comparator: 'rankAbove', target: DEFAULT_RANK_ID }
    },
    {
      id: 'CENTURY_CLUB',
      title: 'Клуб 100',
      description: 'Заработайте 100 XP.',
      iconKey: 'chips',
      category: 'progress',
      rarity: 'LEGENDARY',
      hidden: false,
      condition: { metric: 'lifetimeXp', comparator: 'gte', target: 100 }
    }
  ];

  const ACHIEVEMENTS = Object.freeze(definitions.map(definition => Object.freeze({
    ...definition,
    condition: Object.freeze({ ...definition.condition })
  })));
  const ACHIEVEMENT_IDS = Object.freeze(ACHIEVEMENTS.map(item => item.id));
  const BY_ID = Object.freeze(Object.fromEntries(ACHIEVEMENTS.map(item => [item.id, item])));

  function getAchievementCatalog() {
    return ACHIEVEMENTS.map(item => ({
      ...item,
      condition: { ...item.condition }
    }));
  }

  const api = Object.freeze({
    RARITIES,
    CATEGORIES,
    RANK_ORDER,
    DEFAULT_RANK_ID,
    ACHIEVEMENTS,
    ACHIEVEMENT_IDS,
    BY_ID,
    getAchievementCatalog
  });

  root.PokerPilotAchievementConfig = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
