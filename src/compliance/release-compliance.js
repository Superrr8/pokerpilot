'use strict';

(function attachReleaseCompliance(root) {
  const TERMS_VERSION = '1.0';
  const PRIVACY_VERSION = '1.0';
  const SUPPORT_VERSION = '1.0';
  const RESPONSIBLE_PLAY_VERSION = '1.0';
  const EFFECTIVE_DATE = '2026-09-17';
  const SUPPORTED_LOCALES = Object.freeze(['en', 'ru']);
  const DOCUMENT_VERSIONS = Object.freeze({
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION,
    support: SUPPORT_VERSION,
    responsiblePlay: RESPONSIBLE_PLAY_VERSION
  });
  const DEFAULT_DESTINATIONS = Object.freeze({
    terms: Object.freeze({ url: null }),
    privacy: Object.freeze({ url: null }),
    support: Object.freeze({ url: null }),
    responsiblePlay: Object.freeze({ url: null })
  });
  const OWNED_STORAGE_KEYS = Object.freeze([
    'pokerpilot_v1_6_progress',
    'pokerpilot_v1_5_1_progress',
    'pokerpilot_v1_5_progress',
    'pokerpilot_v1_4_progress',
    'pokerpilot_profile',
    'pokerpilot_progress_system',
    'pokerpilot_daily_challenge_v1',
    'pokerpilot_poker_iq_cache',
    'pokerpilot.appearance.v1',
    'pokerelevate.locale.v1'
  ]);
  const OWNED_STORAGE_PREFIXES = Object.freeze(['pokerpilot_', 'pokerpilot.', 'pokerelevate.']);

  const DOCUMENT_COPY = Object.freeze({
    en: Object.freeze({
      terms: Object.freeze({
        title: 'Terms of Use',
        summary: 'The rules for using PokerElevate as an educational poker-training product.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Educational purpose',
            body: 'PokerElevate is an educational and training product for practicing poker decisions. It does not provide professional, legal, financial, or gambling advice.'
          }),
          Object.freeze({
            title: 'No real-money gambling',
            body: 'PokerElevate does not accept wagers, hold funds, award cash or redeemable prizes, or offer or facilitate real-money gambling. Simulated chips, stakes, pots, and results have no cash value.'
          }),
          Object.freeze({
            title: 'Risk and no guarantee',
            body: 'Poker combines skill, chance, and financial risk. Training, analysis, modeled equity, and recommendations do not guarantee winnings, profits, or future performance.'
          }),
          Object.freeze({
            title: 'Training metrics',
            body: 'Poker IQ, Decision Quality, skill scores, ranks, and similar labels are proprietary PokerElevate educational metrics. They are not standardized IQ tests, professional certifications, independently validated skill ratings, guaranteed GTO proof, or predictions of financial performance.'
          }),
          Object.freeze({
            title: 'Permitted use',
            body: 'Use PokerElevate for study, practice, and retrospective review. It is not intended to be used as prohibited real-time assistance during real-money play where applicable law, venue rules, or platform rules forbid such assistance.'
          }),
          Object.freeze({
            title: 'Your responsibility',
            body: 'You are responsible for your decisions, compliance with applicable laws and third-party rules, and determining whether poker activity is lawful and appropriate for you.'
          }),
          Object.freeze({
            title: 'Changes',
            body: 'When these Terms change, PokerElevate records the accepted document version and requires acceptance of the current version before continued use.'
          })
        ])
      }),
      privacy: Object.freeze({
        title: 'Privacy Policy',
        summary: 'How PokerElevate handles information in this local-first release.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Local-first design',
            body: 'PokerElevate does not require an account. Profile, training, assessment, progress, saved-hand, preference, and consent records are stored locally in this browser or installed application.'
          }),
          Object.freeze({
            title: 'Information stored',
            body: 'Local records may include your display name, avatar choice, optional bio and preferred game, decisions, training and assessment results, PokerElevate metrics, achievements, streaks, saved simulated hands, theme, language, sound settings, and accepted legal-document versions.'
          }),
          Object.freeze({
            title: 'Network and third parties',
            body: 'The application code does not include accounts, advertising, analytics, tracking, or an application data-upload service. When the web version is loaded from a hosting provider, that provider may process ordinary request information such as an IP address under its own policy.'
          }),
          Object.freeze({
            title: 'Retention',
            body: 'Local information remains on the device until it is replaced by normal use, deleted with the in-app Delete All Local Data control, or removed through browser or operating-system storage controls.'
          }),
          Object.freeze({
            title: 'Your controls',
            body: 'You can edit local profile fields and preferences. Delete All Local Data removes PokerElevate-owned local storage and returns the product to first-launch state after reload. It does not remove storage belonging to other sites or applications.'
          }),
          Object.freeze({
            title: 'Children',
            body: 'PokerElevate is not designed or marketed for children. Poker content includes simulated gambling themes and discussion of financial risk. A parent or guardian should supervise use where required.'
          }),
          Object.freeze({
            title: 'Policy changes',
            body: 'PokerElevate records the Privacy Policy version, acceptance time, language, and document identity. A new current version requires renewed acceptance.'
          })
        ])
      }),
      support: Object.freeze({
        title: 'Support & Contact',
        summary: 'Support destination information for this release.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Current contact path',
            body: 'A verified production support URL has not yet been configured for this release candidate. This local page remains available so a final HTTPS destination can be connected without changing the Profile interface.'
          }),
          Object.freeze({
            title: 'Privacy',
            body: 'This pre-release support page does not submit or transmit a message. Do not enter personal or sensitive information until a verified production support destination is displayed.'
          })
        ])
      }),
      responsiblePlay: Object.freeze({
        title: 'Educational Use & Responsible Play',
        summary: 'Important limits of poker training and recommendations.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Training, not gambling',
            body: 'PokerElevate is an educational and training product. It does not offer or facilitate real-money gambling. Simulated outcomes do not represent money won or lost.'
          }),
          Object.freeze({
            title: 'Know the risk',
            body: 'Poker includes skill, chance, and financial risk. No lesson, score, rank, analysis, or recommendation guarantees winnings or profit.'
          }),
          Object.freeze({
            title: 'Follow the rules',
            body: 'Do not use PokerElevate as prohibited real-time assistance. Follow applicable law and the rules of every venue or platform where you play.'
          })
        ])
      })
    }),
    ru: Object.freeze({
      terms: Object.freeze({
        title: 'Условия использования',
        summary: 'Правила использования PokerElevate как образовательного покерного тренажёра.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Образовательное назначение',
            body: 'PokerElevate — образовательный и тренировочный продукт для практики покерных решений. Он не предоставляет профессиональные, юридические, финансовые или азартно-игровые консультации.'
          }),
          Object.freeze({
            title: 'Без игры на реальные деньги',
            body: 'PokerElevate не принимает ставки, не хранит средства, не выдаёт деньги или призы, которые можно обменять на деньги, и не предлагает и не организует азартные игры на реальные деньги. Виртуальные фишки, ставки, банки и результаты не имеют денежной ценности.'
          }),
          Object.freeze({
            title: 'Риск и отсутствие гарантий',
            body: 'Покер сочетает мастерство, случайность и финансовый риск. Тренировки, анализ, расчётная эквити и рекомендации не гарантируют выигрышей, прибыли или будущих результатов.'
          }),
          Object.freeze({
            title: 'Учебные метрики',
            body: 'Poker IQ, Decision Quality, оценки навыков, ранги и похожие показатели — собственные образовательные метрики PokerElevate. Это не стандартизированные тесты IQ, не профессиональная сертификация, не независимо подтверждённый рейтинг навыков, не гарантированное доказательство GTO и не прогноз финансового результата.'
          }),
          Object.freeze({
            title: 'Разрешённое использование',
            body: 'Используйте PokerElevate для обучения, практики и последующего разбора. Продукт не предназначен для запрещённой помощи в реальном времени во время игры на деньги, если такая помощь запрещена законом, правилами заведения или платформы.'
          }),
          Object.freeze({
            title: 'Ваша ответственность',
            body: 'Вы отвечаете за свои решения, соблюдение применимых законов и правил третьих сторон, а также за определение законности и уместности покерной активности для вас.'
          }),
          Object.freeze({
            title: 'Изменения',
            body: 'При изменении этих Условий PokerElevate сохраняет принятую версию документа и требует принять актуальную версию до дальнейшего использования.'
          })
        ])
      }),
      privacy: Object.freeze({
        title: 'Политика конфиденциальности',
        summary: 'Как PokerElevate обрабатывает информацию в этой локальной версии.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Локальный подход',
            body: 'PokerElevate не требует аккаунта. Профиль, тренировки, оценка навыков, прогресс, сохранённые раздачи, настройки и согласия хранятся локально в этом браузере или установленном приложении.'
          }),
          Object.freeze({
            title: 'Какая информация хранится',
            body: 'Локальные записи могут включать отображаемое имя, выбранный аватар, необязательное описание и предпочитаемую игру, решения, результаты тренировок и оценки, метрики PokerElevate, достижения, серии, сохранённые учебные раздачи, тему, язык, настройки звука и принятые версии юридических документов.'
          }),
          Object.freeze({
            title: 'Сеть и третьи стороны',
            body: 'Код приложения не содержит аккаунтов, рекламы, аналитики, отслеживания или сервиса загрузки пользовательских данных. При загрузке веб-версии хостинг-провайдер может обрабатывать обычные данные запроса, например IP-адрес, в соответствии со своей политикой.'
          }),
          Object.freeze({
            title: 'Хранение',
            body: 'Локальная информация остаётся на устройстве, пока не будет заменена при обычном использовании, удалена через действие «Удалить все локальные данные» или удалена средствами браузера либо операционной системы.'
          }),
          Object.freeze({
            title: 'Ваши возможности',
            body: 'Вы можете изменять локальные поля профиля и настройки. Действие «Удалить все локальные данные» удаляет принадлежащее PokerElevate локальное хранилище и после перезагрузки возвращает продукт к состоянию первого запуска. Оно не удаляет данные других сайтов или приложений.'
          }),
          Object.freeze({
            title: 'Дети',
            body: 'PokerElevate не предназначен и не продвигается для детей. Покерный контент содержит темы симулированной азартной игры и обсуждение финансового риска. Где это требуется, использование должно проходить под контролем родителя или опекуна.'
          }),
          Object.freeze({
            title: 'Изменения политики',
            body: 'PokerElevate сохраняет версию Политики конфиденциальности, время принятия, язык и идентификатор документа. Новая актуальная версия требует повторного принятия.'
          })
        ])
      }),
      support: Object.freeze({
        title: 'Поддержка и контакты',
        summary: 'Информация о канале поддержки для этой версии.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Текущий канал связи',
            body: 'Проверенная финальная ссылка поддержки пока не настроена для этой версии-кандидата. Эта локальная страница остаётся доступной, чтобы позднее подключить финальный HTTPS-адрес без изменения интерфейса Профиля.'
          }),
          Object.freeze({
            title: 'Конфиденциальность',
            body: 'Эта страница поддержки не отправляет и не передаёт сообщения. Не вводите личную или чувствительную информацию, пока не будет показан проверенный финальный канал поддержки.'
          })
        ])
      }),
      responsiblePlay: Object.freeze({
        title: 'Обучение и ответственная игра',
        summary: 'Важные ограничения покерных тренировок и рекомендаций.',
        sections: Object.freeze([
          Object.freeze({
            title: 'Тренировка, а не азартная игра',
            body: 'PokerElevate — образовательный и тренировочный продукт. Он не предлагает и не организует азартные игры на реальные деньги. Учебные результаты не означают выигранные или проигранные деньги.'
          }),
          Object.freeze({
            title: 'Помните о риске',
            body: 'Покер сочетает мастерство, случайность и финансовый риск. Ни один урок, показатель, ранг, анализ или рекомендация не гарантирует выигрыш или прибыль.'
          }),
          Object.freeze({
            title: 'Соблюдайте правила',
            body: 'Не используйте PokerElevate как запрещённую помощь в реальном времени. Соблюдайте применимые законы и правила каждого заведения или платформы, где вы играете.'
          })
        ])
      })
    })
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeLocale(value) {
    return SUPPORTED_LOCALES.includes(String(value || '').toLowerCase())
      ? String(value).toLowerCase()
      : 'en';
  }

  function documentIdentity(type, locale = 'en', version = DOCUMENT_VERSIONS[type]) {
    if (!Object.hasOwn(DOCUMENT_VERSIONS, type)) throw new Error(`Unknown legal document: ${type}`);
    const normalizedVersion = String(version || DOCUMENT_VERSIONS[type]);
    return `pokerelevate:${type}:${normalizedVersion}:${normalizeLocale(locale)}`;
  }

  function plainText(document) {
    return [
      document.summary,
      ...document.sections.flatMap(section => [section.title, section.body])
    ].join('\n\n');
  }

  function validHttpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = new URL(value.trim());
      return parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch (_) {
      return null;
    }
  }

  function create({ destinations = {} } = {}) {
    const resolvedDestinations = Object.fromEntries(Object.keys(DOCUMENT_VERSIONS).map(type => {
      const configured = destinations[type];
      const candidate = typeof configured === 'string' ? configured : configured?.url;
      return [type, Object.freeze({ url: validHttpsUrl(candidate) })];
    }));

    function getDocument(type, locale = 'en') {
      if (!Object.hasOwn(DOCUMENT_VERSIONS, type)) throw new Error(`Unknown legal document: ${type}`);
      const normalizedLocale = normalizeLocale(locale);
      const copy = DOCUMENT_COPY[normalizedLocale][type];
      const document = {
        type,
        locale: normalizedLocale,
        version: DOCUMENT_VERSIONS[type],
        effectiveDate: EFFECTIVE_DATE,
        documentId: documentIdentity(type, normalizedLocale),
        title: copy.title,
        summary: copy.summary,
        sections: clone(copy.sections),
        destination: resolvedDestinations[type]
      };
      document.plainText = plainText(document);
      return Object.freeze(document);
    }

    function getDestination(type) {
      if (!Object.hasOwn(resolvedDestinations, type)) throw new Error(`Unknown legal destination: ${type}`);
      return { ...resolvedDestinations[type] };
    }

    return Object.freeze({ getDocument, getDestination });
  }

  function ownsStorageKey(value) {
    const key = typeof value === 'string' ? value : '';
    return OWNED_STORAGE_KEYS.includes(key)
      || OWNED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  function deleteAllLocalData(storage = root.localStorage) {
    if (!storage || typeof storage.removeItem !== 'function') {
      return { removedKeys: [], errors: ['Storage unavailable'] };
    }
    const candidates = new Set(OWNED_STORAGE_KEYS);
    if (Number.isFinite(Number(storage.length)) && typeof storage.key === 'function') {
      for (let index = 0; index < Number(storage.length); index += 1) {
        const key = storage.key(index);
        if (ownsStorageKey(key)) candidates.add(key);
      }
    }
    const removedKeys = [];
    const errors = [];
    candidates.forEach(key => {
      try {
        const existed = typeof storage.getItem !== 'function' || storage.getItem(key) !== null;
        storage.removeItem(key);
        if (existed) removedKeys.push(key);
      } catch (error) {
        errors.push(`${key}: ${String(error?.message || error)}`);
      }
    });
    return { removedKeys: removedKeys.sort(), errors };
  }

  const manager = create({ destinations: DEFAULT_DESTINATIONS });
  const api = Object.freeze({
    TERMS_VERSION,
    PRIVACY_VERSION,
    SUPPORT_VERSION,
    RESPONSIBLE_PLAY_VERSION,
    EFFECTIVE_DATE,
    DOCUMENT_VERSIONS,
    DEFAULT_DESTINATIONS,
    OWNED_STORAGE_KEYS,
    OWNED_STORAGE_PREFIXES,
    normalizeLocale,
    documentIdentity,
    ownsStorageKey,
    deleteAllLocalData,
    create,
    getDocument: manager.getDocument,
    getDestination: manager.getDestination
  });

  root.PokerElevateCompliance = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
