'use strict';

(function attachLocalization(root) {
  const SUPPORTED_LOCALES = Object.freeze(['en', 'ru']);
  const DEFAULT_LOCALE = 'en';
  const LOCALE_TAGS = Object.freeze({ en: 'en-US', ru: 'ru-RU' });
  const LOCALE_STORAGE_KEY = 'pokerelevate.locale.v1';
  const LOCALE_OPTIONS = Object.freeze([
    Object.freeze({ locale: 'en', flag: '🇺🇸', pickerLabel: 'USA', languageLabel: 'English' }),
    Object.freeze({ locale: 'ru', flag: '🇷🇺', pickerLabel: 'Russia', languageLabel: 'Russian' })
  ]);

  const PAIRS = Object.freeze({
    'nav.home': ['Home', 'Главная'],
    'nav.learning': ['Learn', 'Учиться'],
    'nav.training': ['Trainer', 'Тренер'],
    'nav.analysis': ['Review', 'Разбор'],
    'nav.profile': ['Profile', 'Профиль'],
    'action.continue': ['Continue', 'Продолжить'],
    'action.startLearning': ['Start learning', 'Начать обучение'],
    'action.startTraining': ['Start training', 'Начать тренировку'],
    'action.analyzeHand': ['Review hand', 'Разобрать раздачу'],
    'action.open': ['Open', 'Открыть'],
    'action.close': ['Close', 'Закрыть'],
    'action.cancel': ['Cancel', 'Отмена'],
    'action.save': ['Save', 'Сохранить'],
    'action.back': ['Back', 'Назад'],
    'action.home': ['Home', 'На главную'],
    'action.next': ['Next', 'Далее'],
    'action.confirm': ['Confirm', 'Подтвердить'],
    'action.edit': ['Edit', 'Изменить'],
    'action.reset': ['Reset stats', 'Сбросить статистику'],
    'live.saveHand': ['Save Hand', 'Сохранить раздачу'],
    'live.savedSuccess': ['Hand saved', 'Раздача сохранена'],
    'analysis.savedHands': ['Saved Hands', 'Сохранённые раздачи'],
    'profile.insufficientData': ['Not enough decisions to calculate', 'Недостаточно решений для оценки'],
    'profile.notCalculated': ['Not calculated', 'Не рассчитан'],
    'profile.notCalculatedFeminine': ['Not calculated', 'Не рассчитана'],
    'profile.unrated': ['Unrated', 'Без рейтинга'],
    'profile.unranked': ['Unranked', 'Без ранга'],
    'profile.saved': ['Profile saved', 'Профиль сохранён'],
    'profile.saveError': ['Could not save your profile on this device', 'Не удалось сохранить профиль на устройстве'],
    'profile.level': ['Level {level}', 'Level {level}'],
    'profile.levelProgress': ['Level {level} progress: {current} / {target} XP', 'Прогресс Level {level}: {current} / {target} XP'],
    'profile.totalXp': ['{xp} lifetime XP', '{xp} XP всего'],
    'profile.avatarLabel': ['{name} avatar', 'Аватар {name}'],
    'profile.edit': ['Edit profile', 'Редактировать профиль'],
    'profile.editAvatar': ['Edit avatar', 'Изменить аватар'],
    'profile.preferredGame': ['Preferred game', 'Предпочитаемая игра'],
    'profile.bio': ['Bio', 'Bio'],
    'decisionQuality.title': ['Decision Quality', 'Decision Quality'],
    'decisionQuality.excellent': ['Excellent decision', 'Отличное решение'],
    'decisionQuality.good': ['Good decision', 'Хорошее решение'],
    'decisionQuality.acceptable': ['Acceptable decision', 'Допустимое решение'],
    'decisionQuality.mistake': ['Mistake', 'Ошибка'],
    'decisionQuality.blunder': ['Major mistake', 'Серьёзная ошибка'],
    'decisionQuality.unrated': ['Not enough data', 'Недостаточно данных'],
    'decisionQuality.provisional': ['Provisional rating', 'Предварительная оценка'],
    'decisionQuality.forming': ['Rating in progress', 'Оценка формируется'],
    'decisionQuality.established': ['Rating established', 'Оценка сформирована'],
    'decisionQuality.minimumSample': ['Play at least one rated decision', 'Сыграйте минимум одно оцениваемое решение'],
    'settings.language': ['Language', 'Язык'],
    'settings.languageDescription': ['Choose the language used throughout PokerElevate.', 'Выберите язык интерфейса PokerElevate.'],
    'settings.chooseLanguage': ['Choose language', 'Выберите язык'],
    'settings.headerLanguage': ['Change language. Current language: {language}', 'Изменить язык. Текущий язык: {language}'],
    'settings.englishLanguage': ['English', 'английский'],
    'settings.russianLanguage': ['Russian', 'русский'],
    'settings.appearance': ['Appearance', 'Оформление'],
    'settings.interface': ['Interface', 'Интерфейс'],
    'settings.theme': ['Theme', 'Тема'],
    'settings.themeSelection': ['Theme selection', 'Выбор темы'],
    'settings.systemTheme': ['Device theme', 'Тема устройства'],
    'settings.currentTheme': ['{preference} · currently {resolved}', '{preference} · сейчас {resolved}'],
    'settings.soundOn': ['Sound on', 'Звук включён'],
    'settings.soundOff': ['Sound off', 'Звук выключен'],
    'settings.enableSound': ['Turn sound on', 'Включить звук'],
    'settings.disableSound': ['Turn sound off', 'Выключить звук'],
    'settings.volume': ['Volume', 'Громкость'],
    'settings.soundSettings': ['Sound settings', 'Настройки звука'],
    'dashboard.welcome': ['Welcome back, {name}', 'С возвращением, {name}'],
    'dashboard.nextStep': ['YOUR NEXT STEP', 'ТВОЙ СЛЕДУЮЩИЙ ШАГ'],
    'dashboard.weeklyFocus': ['WEEKLY FOCUS', 'ФОКУС НЕДЕЛИ'],
    'dashboard.recentActivity': ['RECENT ACTIVITY', 'НЕДАВНЯЯ АКТИВНОСТЬ'],
    'dashboard.quickActions': ['Quick actions', 'Быстрые действия'],
    'dashboard.playerProgress': ['Player progress', 'Прогресс игрока'],
    'dashboard.keyMetrics': ['Key metrics', 'Ключевые показатели'],
    'dashboard.level': ['Level', 'Уровень'],
    'dashboard.streak': ['Streak', 'Серия'],
    'dashboard.noStreak': ['No active streak', 'пока нет серии'],
    'dashboard.goodMorning': ['Good morning, {name}', 'Доброе утро, {name}'],
    'dashboard.goodAfternoon': ['Good afternoon, {name}', 'Добрый день, {name}'],
    'dashboard.goodEvening': ['Good evening, {name}', 'Добрый вечер, {name}'],
    'dashboard.welcomeBack': ['Welcome back, {name}', 'С возвращением, {name}'],
    'dashboard.liveHands': ['{title} • {count} {unit}', '{title} • {count} {unit}'],
    'dashboard.handOne': ['hand', 'раздача'],
    'dashboard.handFew': ['hands', 'раздачи'],
    'dashboard.handMany': ['hands', 'раздач'],
    'dashboard.recentDecisionHistory': ['Decision history is available in Review.', 'История решений доступна в разделе разбора.'],
    'dashboard.focusScore': ['Average score {score} across {count} decisions.{trend}', 'Средняя оценка {score} по {count} решениям.{trend}'],
    'dashboard.focusTrend': [' {trend}.', ' {trend}.'],
    'dashboard.reviewLastSession': ['Review the last session', 'Разобрать последнюю сессию'],
    'dashboard.reviewLastSessionDescription': ['Review the latest session decisions separately from the cash result.', 'Посмотрите решения последней сессии отдельно от денежного результата.'],
    'dashboard.aboutFourMinutes': ['about 4 minutes', 'около 4 минут'],
    'dashboard.goToReview': ['Go to Review', 'Перейти к разбору'],
    'dashboard.sessionAvailable': ['A completed session is available in history.', 'В истории есть завершённая сессия.'],
    'daily.title': ['Daily Hand', 'Раздача дня'],
    'daily.solve': ['Play Hand', 'Решить'],
    'daily.history': ['History', 'История'],
    'daily.oneDecision': ['One decision today', 'Одно решение на сегодня'],
    'daily.availableToday': ['Available today', 'Сегодня доступно'],
    'daily.completed': ['Completed', 'Завершено'],
    'daily.reward': ['Reward', 'Награда'],
    'daily.yourChoice': ['Your choice', 'Ваш выбор'],
    'daily.correctAction': ['Correct action', 'Верное действие'],
    'daily.review': ['View review', 'Посмотреть разбор'],
    'learning.title': ['Learning', 'Обучение'],
    'learning.course': ['Guided course', 'Последовательный курс'],
    'learning.lessons': ['Lessons', 'Уроки'],
    'learning.examples': ['Hand examples', 'Примеры раздач'],
    'learning.tasks': ['Mini challenges', 'Мини-задания'],
    'learning.exam': ['Exam', 'Экзамен'],
    'learning.startExam': ['Start exam', 'Начать экзамен'],
    'learning.repeatExam': ['Retake exam', 'Повторить экзамен'],
    'learning.correct': ['Correct.', 'Верно.'],
    'learning.reviewNeeded': ['Review this topic.', 'Нужно повторить.'],
    'training.title': ['Decision practice', 'Практика решений'],
    'training.studySpots': ['Training scenarios', 'Тренировочные ситуации'],
    'training.preflop': ['Preflop training', 'Префлоп-тренировка'],
    'training.live': ['Live Cash $1/$3', 'Live Cash $1/$3'],
    'analysis.handLab': ['Hand Lab', 'Hand Lab'],
    'analysis.run': ['Analyze hand', 'Проанализировать раздачу'],
    'analysis.result': ['RESULT', 'РЕЗУЛЬТАТ'],
    'analysis.recommendation': ['TRAINER RECOMMENDATION', 'РЕКОМЕНДАЦИЯ ТРЕНЕРА'],
    'analysis.confidence': ['Confidence', 'Уверенность'],
    'progress.title': ['Progress overview', 'Подробный прогресс'],
    'progress.achievements': ['Achievements', 'Достижения'],
    'progress.recent': ['Recent Progress', 'Недавний прогресс'],
    'progress.skills': ['Skills', 'Навыки'],
    'progress.analytics': ['Progress analytics', 'Аналитика прогресса'],
    'progress.todayInactive': ['No activity recorded today yet', 'Сегодня активность ещё не засчитана'],
    'progress.noRecent': ['No meaningful progress events yet.', 'Пока нет значимых событий прогресса.'],
    'progress.notifications': ['Progress notifications', 'Уведомления прогресса'],
    'progress.sampleNone': ['Not enough decisions', 'Недостаточно решений'],
    'progress.sampleProvisional': ['{count} decisions · provisional', '{count} решений · предварительно'],
    'progress.sampleForming': ['{count} decisions · sample forming', '{count} решений · выборка формируется'],
    'progress.sampleEstablished': ['{count} decisions · stable sample', '{count} решений · устойчивая выборка'],
    'progress.attemptOne': ['{count} attempt', '{count} попытка'],
    'progress.attemptFew': ['{count} attempts', '{count} попытки'],
    'progress.attemptMany': ['{count} attempts', '{count} попыток'],
    'progress.focusReserve': ['Most reliably measured growth opportunity: {score}.', 'Самый надёжно измеренный резерв роста: {score}.'],
    'progress.focusUnavailable': ['Weekly focus is not available yet', 'Фокус недели пока не определён'],
    'progress.focusInsufficient': ['Not enough reliable skill data yet. Keep training.', 'Недостаточно надёжных данных по навыкам. Продолжайте тренироваться.'],
    'progress.todayCounted': ['Counted today', 'Сегодня уже засчитано'],
    'progress.attemptsInsufficient': ['Not enough attempts to calculate', 'Недостаточно попыток для оценки'],
    'progress.unlockedOn': ['Unlocked {date}', 'Открыто {date}'],
    'progress.highConfidence': ['High confidence', 'Высокая уверенность'],
    'progress.mediumConfidence': ['Medium confidence', 'Средняя уверенность'],
    'progress.lowConfidence': ['Low confidence', 'Низкая уверенность'],
    'progress.limitedData': ['Limited data', 'Мало данных'],
    'progress.trendUp': ['Growing', 'Растёт'],
    'progress.trendDown': ['Declining', 'Снижается'],
    'progress.trendStable': ['Stable', 'Стабильно'],
    'profile.iqNone': ['At least 30 rated decisions are required. Start with your first decision.', 'Нужно минимум 30 оцениваемых решений. Начните с первого решения.'],
    'profile.iqProvisional': ['Provisional Poker IQ · {count} of 30 decisions', 'Предварительный Poker IQ · {count} из 30 решений'],
    'profile.iqForming': ['Poker IQ is forming · {count} of 30 decisions', 'Poker IQ формируется · {count} из 30 решений'],
    'profile.iqEstablished': ['Rating established from {count} decisions', 'Оценка сформирована по {count} решениям'],
    'profile.trendUp': ['↗ Growing{delta}', '↗ Растёт{delta}'],
    'profile.trendDown': ['↘ Declining{delta}', '↘ Снижается{delta}'],
    'profile.trendStable': ['→ Stable', '→ Стабилен'],
    'profile.trendUnavailable': ['— Not enough data', '— Недостаточно данных'],
    'profile.decisionCount': ['{count} decisions', '{count} решений'],
    'profile.ratingForming': ['Rating in progress', 'Оценка формируется'],
    'profile.bestStreak': ['Best: {count}', 'Лучшая: {count}'],
    'profile.achievementsUnlocked': ['Unlocked', 'Открыто'],
    'profile.iqToRank': ['{count} IQ to “{rank}”', '{count} IQ до ранга «{rank}»'],
    'profile.maximumRank': ['Maximum rank', 'Максимальный ранг'],
    'profile.rankProgress': ['{rank} rank progress: {percent}%', 'Прогресс ранга {rank}: {percent}%'],
    'profile.pokerIqSummary': ['Poker IQ {score}, rank {rank}. {status}.', 'Poker IQ {score}, ранг {rank}. {status}.'],
    'profile.pokerIqUnavailable': ['Poker IQ is not calculated. {status}.', 'Poker IQ не рассчитан. {status}.'],
    'profile.noData': ['No data', 'Нет данных'],
    'coach.overallAccuracy': ['Overall accuracy: {value}', 'Общая точность: {value}'],
    'coach.decisionStreak': ['{count} decisions, best streak {best}.', '{count} решений, лучшая серия {best}.'],
    'coach.topicTooTight': ['Too-tight folds', 'Слишком тайтовые фолды'],
    'coach.topicTooLoose': ['Loose entries', 'Слишком широкие входы'],
    'coach.topicPassive': ['Passive calls/checks', 'Пассивные коллы/чеки'],
    'coach.topicOverplay': ['Hand overplay', 'Переигрывание рук'],
    'coach.topicPotOdds': ['Pot odds', 'Пот-оддсы'],
    'coach.topicOuts': ['Counting outs', 'Подсчёт аутов'],
    'coach.topicSizing': ['Bet sizing', 'Размеры ставок'],
    'coach.topicPosition': ['Position', 'Позиция'],
    'coach.topicRangeReading': ['Range reading', 'Чтение диапазона'],
    'coach.planTooTight': ['Before folding, calculate required equity and list natural bluffs. Do not compare your hand only with the nuts.', 'Перед фолдом посчитай минимальное эквити и перечисли естественные блефы. Не сравнивай руку только с натсами.'],
    'coach.planTooLoose': ['First check position, domination risk, and how many players remain behind. Previously invested chips do not justify a poor call.', 'Сначала проверь позицию, доминацию и сколько игроков остаётся за спиной. Вложенные раньше деньги не оправдывают плохой колл.'],
    'coach.planPassive': ['Before checking, name at least three worse hands that will pay. If they exist, look for value and the right size.', 'Перед чеком назови минимум три худшие руки, которые готовы платить. Если они есть — ищи вэлью и подходящий размер.'],
    'coach.planOverplay': ['Ask which worse hands continue against a raise. If the answer is almost none, choose call or fold more often.', 'Спроси, какие худшие руки продолжат против рейза. Если ответ — почти никакие, чаще выбирай call или fold.'],
    'coach.planPotOdds': ['Formula: call price / final pot after your call. Then compare it with equity, not the chance of hitting one specific out.', 'Формула: цена колла / финальный банк после твоего колла. Затем сравни с эквити, а не с вероятностью одного конкретного аута.'],
    'coach.planOuts': ['Count specific cards, remove overlaps, and mark conditional outs separately; they can improve your hand without guaranteeing a win.', 'Считай конкретные карты, убирай пересечения и отдельно помечай условные ауты, которые могут улучшить, но не гарантируют победу.'],
    'coach.planSizing': ['Define the bet’s goal: value, protection, or bluff. Choose size from the ranges, board texture, and SPR.', 'Определи цель ставки: вэлью, защита или блеф. Размер выбирай по диапазону, текстуре доски и SPR.'],
    'coach.planPosition': ['In position, equity is easier to realize and pot size easier to control; out of position, use a tighter range.', 'В позиции можно лучше реализовать эквити и контролировать размер банка; без позиции диапазон должен быть строже.'],
    'coach.planRangeReading': ['Build the range from preflop and narrow it after each action. Player type changes bluff and thin-value frequencies.', 'Строй диапазон от префлопа и сужай его после каждого действия. Тип игрока меняет частоту блефов и тонкого вэлью.'],
    'coach.planDefault': ['Play at least 10 decisions so the Trainer can build a personal plan.', 'Сыграй не менее 10 решений, чтобы тренер построил персональный план.'],
    'coach.mainWeakness': ['Main weakness: {topic}', 'Главное слабое место: {topic}'],
    'coach.errorsRecorded': ['{count} errors recorded. {plan}', 'Зафиксировано {count} ошибок. {plan}'],
    'coach.notEnoughData': ['Not enough data yet', 'Данных пока мало'],
    'coach.dqUnavailable': ['Decision Quality: not enough data', 'Decision Quality: недостаточно данных'],
    'coach.dqScore': ['Decision Quality: {score}', 'Decision Quality: {score}'],
    'coach.dqTrendUp': ['Recent-decision trend +{delta}.', 'Тренд последних решений +{delta}.'],
    'coach.dqTrendDown': ['Recent-decision trend {delta}.', 'Тренд последних решений {delta}.'],
    'coach.dqTrendStable': ['Recent-decision trend is stable.', 'Тренд последних решений стабилен.'],
    'coach.trendUnavailable': ['Not enough data for a trend yet.', 'Для тренда пока мало данных.'],
    'coach.ratedDecisions': ['{count} rated decisions{forming}.', '{count} оценённых решений{forming}.'],
    'coach.sampleForming': [' — the sample is still forming', ' — выборка пока формируется'],
    'coach.weakestStreet': [' Weakest street: {street} — {score}.', ' Самая слабая улица: {street} — {score}.'],
    'coach.lowestCategory': [' Lowest category average, “{category}”: {score}.', ' Низшая средняя по категории «{category}» — {score}.'],
    'coach.dqSignalNote': [' This is an additional signal; the weak-topic plan is still based on actual mistakes.', ' Это дополнительный сигнал; план слабых тем по-прежнему строится по фактическим ошибкам.'],
    'coach.dqBuildSignal': ['Play decisions with an available Trainer recommendation to build this signal.', 'Сыграйте решения с доступной рекомендацией тренера, чтобы сформировать дополнительный сигнал.'],
    'coach.iqUnavailable': ['Poker IQ: not calculated', 'Poker IQ: не рассчитан'],
    'coach.iqStart': ['Play at least one rated decision. A stable rating requires at least 30 decisions.', 'Сыграйте хотя бы одно оцениваемое решение. Для сформированной оценки нужно минимум 30 решений.'],
    'coach.iqForming': ['Poker IQ is forming: {current} of the required 30 decisions are rated. Avoid strong conclusions from a small sample.', 'Poker IQ формируется: оценено {current} из необходимых 30 решений. Не делайте сильных выводов по малой выборке.'],
    'coach.iqTrendUp': ['The trend is up {delta} IQ.', 'Тренд растёт на {delta} IQ.'],
    'coach.iqTrendDown': ['The trend is down {delta} IQ.', 'Тренд снижается на {delta} IQ.'],
    'coach.iqTrendStable': ['The trend is stable.', 'Тренд стабилен.'],
    'coach.iqEstablished': ['Rating based on {count} decisions. {trend}{strongest}{weakest} Cash results are not included in Poker IQ.', 'Оценка основана на {count} решениях. {trend}{strongest}{weakest} Денежный результат раздач в Poker IQ не входит.'],
    'coach.iqStrongest': [' Strongest street: {street} — {score}.', ' Сильнейший срез: {street} — {score}.'],
    'coach.iqWeakest': [' Focus area: {street} — {score}.', ' Зона внимания: {street} — {score}.'],
    'coach.iqScoreRank': ['Poker IQ: {score} · {rank}', 'Poker IQ: {score} · {rank}'],
    'live.actionPost': ['POST {amount}', 'СТАВИТ {amount}'],
    'live.actionCall': ['CALL {amount}', 'КОЛЛ {amount}'],
    'live.actionBet': ['BET {amount}', 'СТАВКА {amount}'],
    'live.actionRaise': ['RAISE TO {amount}', 'РЕЙЗ ДО {amount}'],
    'live.actionAllIn': ['ALL-IN {amount}', 'ОЛЛ-ИН {amount}'],
    'live.actionCheck': ['CHECK', 'ЧЕК'],
    'live.actionFold': ['FOLD', 'ФОЛД'],
    'live.showdown': ['{player} shows {hand}.', '{player} показывает {hand}.'],
    'live.wins': ['{player} wins {amount}.', '{player} выигрывает {amount}.'],
    'live.splitPot': ['Pot {amount} is split between {count} players.', 'Банк {amount} разделён между {count} игроками.'],
    'live.yourTurnHand': ['Your turn: {position} • {hand}', 'Твой ход: {position} • {hand}'],
    'live.yourTurnStreet': ['Your turn on {street}', 'Твой ход на {street}'],
    'live.sessionPaused': ['Session paused', 'Сессия на паузе'],
    'live.nextHandSoon': ['Next hand soon', 'Следующая раздача скоро'],
    'achievement.all': ['All', 'Все'],
    'achievement.unlocked': ['Unlocked', 'Открытые'],
    'achievement.locked': ['Locked', 'Не открытые'],
    'achievement.collection': ['Player collection', 'Коллекция игрока'],
    'accessibility.primaryNavigation': ['Primary navigation', 'Основная навигация'],
    'accessibility.closeTrainer': ['Close Trainer', 'Закрыть Тренер'],
    'accessibility.closeSessionSettings': ['Close session settings', 'Закрыть настройки сессии'],
    'accessibility.heroCards': ['Hero cards', 'Карты Hero'],
    'accessibility.communityCards': ['Community cards', 'Общие карты'],
    'accessibility.availableActions': ['Available actions', 'Доступные действия'],
    'accessibility.openProfile': ['Open profile', 'Открыть профиль'],
    'fallback.englishOnly': ['English fallback', null]
  });

  const COURSE_COPY_PAIRS = Object.freeze([
    ['Texas Hold’em Foundations', 'Основы Texas Hold’em'],
    ['Hand rules, streets, positions, blinds, and table actions.', 'Правила раздачи, улицы, позиции, блайнды и действия за столом.'],
    ['game objective', 'цель игры'],
    ['hole and community cards', 'карманные и общие карты'],
    ['streets', 'улицы'],
    ['positions and dealer', 'позиции и дилер'],
    ['blinds', 'блайнды'],
    ['actions', 'действия'],
    ['card uniqueness', 'уникальность карт'],
    ['PokerElevate interface', 'интерфейс PokerElevate'],
    ['The objective and seven available cards', 'Цель игры и семь доступных карт'],
    ['In Texas Hold’em, you win the pot when every opponent folds or your best five-card hand is strongest at showdown.', 'В Texas Hold’em ты выигрываешь банк, если все соперники сбросили карты или твоя лучшая пятикарточная комбинация сильнее на вскрытии.'],
    ['Each player receives two private hole cards. Up to five community cards are dealt to the board and shared by every remaining player.', 'Каждый игрок получает две закрытые карманные карты. До пяти общих карт выкладываются на стол и доступны всем оставшимся игрокам.'],
    ['Your result uses the best five cards from the two hole cards and five community cards. The same physical card can never appear twice in one hand.', 'Для результата используются любые лучшие пять карт из двух карманных и пяти общих. Одна физическая карта не может появиться в раздаче дважды.'],
    ['First separate the hero’s two cards from the board, then find the best five without assuming both hole cards must be used.', 'Сначала отдели две карты героя от общей доски, затем ищи лучшую пятёрку без обязательного использования обеих карманных карт.'],
    ['Blinds and street order', 'Блайнды и порядок улиц'],
    ['Before cards are dealt, the small and big blinds post forced bets to create the starting pot.', 'До раздачи малый и большой блайнды вносят обязательные ставки и создают начальный банк.'],
    ['Preflop begins after two hole cards are dealt. Then come the flop—three cards, the turn—a fourth card, and the river—a fifth.', 'Префлоп начинается после раздачи двух карманных карт. Затем открываются flop — три карты, turn — четвёртая и river — пятая.'],
    ['After each betting round, the remaining players move to the next street. A showdown can follow the river.', 'После каждого круга ставок оставшиеся игроки переходят на следующую улицу. После ривера возможен showdown.'],
    ['Remember the rhythm: preflop → flop (3 cards) → turn (1) → river (1).', 'Запомни ритм: preflop → flop (3 карты) → turn (1) → river (1).'],
    ['Positions, the button, and actions', 'Позиции, кнопка и действия'],
    ['The dealer button moves clockwise. Positions are defined relative to the button; later position usually provides more information.', 'Кнопка дилера перемещается по часовой стрелке. Позиции определяются относительно кнопки; поздняя позиция обычно даёт больше информации.'],
    ['Fold ends your participation in the hand. Check passes action without betting when nothing is owed. Call matches the current bet.', 'Fold прекращает участие в раздаче. Check передаёт ход без ставки, когда платить не нужно. Call уравнивает текущую ставку.'],
    ['Bet creates a wager, raise increases an existing wager, and all-in commits the entire available stack.', 'Bet создаёт ставку, raise увеличивает уже сделанную ставку, all-in ставит весь доступный стек.'],
    ['Check and bet are available when no bet is facing you; call and raise are available once a bet has been made.', 'Check и bet возможны, когда перед тобой нет ставки; call и raise — когда ставка уже есть.'],
    ['How to read PokerElevate', 'Как читать PokerElevate'],
    ['Hand Lab accepts hole cards, board, positions, pot, bet, effective stack, and the number and type of opponents.', 'Hand Lab принимает карманные карты, доску, позиции, банк, ставку, effective stack, число и тип соперников.'],
    ['Training spots test your decision before revealing the answer, while Positions and Ranges trains preflop play.', 'Учебные ситуации проверяют решение до показа ответа, а «Позиции и диапазоны» тренируют префлоп.'],
    ['The math panel separates equity, pot odds, EV, and outs from the Trainer’s heuristic recommendation.', 'Математический блок отделяет equity, pot odds, EV и ауты от эвристической рекомендации тренера.'],
    ['Before calculating, verify the street, card uniqueness, and that the pot and bet values are in the correct fields.', 'Перед расчётом проверь улицу, уникальность карт и что «банк» и «ставка» введены в правильные поля.'],
    ['Hole and community cards', 'Карманные и общие карты'],
    ['Hero has A♠ K♠ and the board is Q♠ J♦ 4♣.', 'У героя A♠ K♠, на столе Q♠ J♦ 4♣.'],
    ['Hero still has two hole cards, while the three flop cards are shared. Two more community cards can arrive by the river.', 'У героя по-прежнему две карманные карты, а три карты флопа общие для всех. До ривера могут появиться ещё две общие карты.'],
    ['Check or call', 'Check или call'],
    ['Everyone checks to Hero on the flop.', 'На флопе все до героя сделали check.'],
    ['Hero has no bet to match, so check or bet is available. A call is not required here.', 'Герою не нужно уравнивать ставку: доступны check или bet. Call здесь физически не требуется.'],
    ['Button advantage', 'Преимущество кнопки'],
    ['Hero is on the BTN and the opponent is in the BB.', 'Герой на BTN, соперник в BB.'],
    ['After the flop, BTN usually acts after BB and sees the opponent’s action before deciding.', 'После флопа BTN обычно действует после BB и видит действие соперника до своего решения.'],
    ['How many private hole cards does each player receive in Texas Hold’em?', 'Сколько закрытых карманных карт получает игрок в Texas Hold’em?'],
    ['Two', 'Две'],
    ['Three', 'Три'],
    ['Five', 'Пять'],
    ['Each player receives exactly two private hole cards.', 'Каждый игрок получает ровно две закрытые карманные карты.'],
    ['Which street comes immediately after the flop?', 'Какая улица идёт сразу после flop?'],
    ['After the three-card flop, one turn card is dealt.', 'После трёх карт flop открывается одна карта turn.'],
    ['A bet has been made before Hero acts. Which action simply matches it?', 'Перед героем сделана ставка. Какое действие просто уравнивает её?'],
    ['Call matches the bet. Check is unavailable, and bet becomes raise once a wager already exists.', 'Call уравнивает ставку. Check недоступен, а bet заменяется raise, когда ставка уже есть.'],
    ['How can you win the pot?', 'Как можно выиграть банк?'],
    ['Only at showdown', 'Только на вскрытии'],
    ['Make everyone fold or win at showdown', 'Получить все fold или выиграть вскрытие'],
    ['Only by making a flush', 'Только собрав флеш'],
    ['You win the pot when everyone folds or by showing the strongest hand at showdown.', 'Банк выигрывается без вскрытия после всех fold или сильнейшей рукой на showdown.'],
    ['How many hole cards does Hero have?', 'Сколько карманных карт у героя?'],
    ['Each Hold’em player has two hole cards.', 'В Hold’em у каждого игрока две карманные карты.'],
    ['How many community cards can be on the board by the river?', 'Сколько общих карт может быть к риверу?'],
    ['The flop adds three cards, and the turn and river add one each.', 'Flop даёт три, turn и river — ещё по одной карте.'],
    ['Choose the correct street order.', 'Выбери правильный порядок улиц.'],
    ['The standard order is preflop, flop, turn, river.', 'Стандартный порядок: preflop, flop, turn, river.'],
    ['Why are blinds used?', 'Зачем нужны blinds?'],
    ['Create a forced starting pot', 'Создать обязательный начальный банк'],
    ['Reveal the cards', 'Открыть карты'],
    ['Choose the winner', 'Выбрать победителя'],
    ['The small blind and big blind are forced bets posted before the deal.', 'Small blind и big blind — обязательные ставки до раздачи.'],
    ['What does BTN mean?', 'Что обозначает BTN?'],
    ['The dealer-button position', 'Позицию кнопки дилера'],
    ['The big blind', 'Большой блайнд'],
    ['The turn street', 'Улицу turn'],
    ['BTN is the dealer-button position.', 'BTN — позиция dealer button.'],
    ['When is checking allowed?', 'Когда допустим check?'],
    ['When there is no bet to match', 'Когда не нужно уравнивать ставку'],
    ['Always', 'Всегда'],
    ['Only after an all-in', 'Только после all-in'],
    ['Check is available when Hero is not facing an unmatched bet.', 'Check доступен, когда перед героем нет непокрытой ставки.'],
    ['What does a raise do?', 'Что делает raise?'],
    ['Folds the cards', 'Сбрасывает карты'],
    ['Increases an existing bet', 'Увеличивает существующую ставку'],
    ['Gives a free card', 'Даёт бесплатную карту'],
    ['A raise increases a bet that has already been made.', 'Raise повышает уже сделанную ставку.'],
    ['Can A♠ be assigned to both Hero and the board?', 'Можно ли указать A♠ одновременно у героя и на доске?'],
    ['Yes', 'Да'],
    ['No', 'Нет'],
    ['There is only one A♠ in the deck, so a physical card cannot appear twice.', 'В колоде только одна A♠, поэтому повтор физической карты невозможен.'],
    ['Where can you manually review a known hand?', 'Где вручную разобрать известную раздачу?'],
    ['In Hand Lab', 'В Hand Lab'],
    ['Only in Live Poker', 'Только в Live Poker'],
    ['In the progress report', 'В отчёте прогресса'],
    ['Hand Lab is designed for manual hand entry and analysis.', 'Hand Lab предназначен для ручного ввода и анализа раздачи.'],
    ['Hand Rankings and Comparison', 'Комбинации и сравнение рук'],
    ['Nine categories, the best five cards, kickers, and ties.', 'Девять категорий, лучшая пятёрка, кикеры и ничьи.'],
    ['kickers', 'кикеры'],
    ['ties', 'ничьи'],
    ['hand comparison', 'сравнение рук'],
    ['From high card to three of a kind', 'От старшей карты до сета'],
    ['High card: no pair or stronger combination; comparison starts with the highest card.', 'High card: нет пары или более сильной комбинации; сравнение начинается со старшей карты.'],
    ['One pair contains two cards of the same rank. Two pair contains two different pairs. Three of a kind contains three cards of one rank.', 'One pair содержит две карты одного ранга. Two pair — две разные пары. Three of a kind — три карты одного ранга.'],
    ['Within the same category, compare the primary rank first, then the remaining kickers in order.', 'При одинаковой категории сначала сравнивается основной ранг, затем оставшиеся кикеры по порядку.'],
    ['Name the category first; only then compare ranks within it.', 'Сначала назови категорию, только потом сравнивай ранги внутри неё.'],
    ['Straight, flush, and full house', 'Стрит, флеш и фулл-хаус'],
    ['A straight is five consecutive ranks; an ace can be high in 10-J-Q-K-A or low in A-2-3-4-5.', 'Straight — пять последовательных рангов; туз может быть старшим в 10-J-Q-K-A или младшим в A-2-3-4-5.'],
    ['A flush is five cards of one suit, not necessarily consecutive. Flushes are compared by their highest cards.', 'Flush — пять карт одной масти, не обязательно подряд. Флеши сравниваются по старшим картам.'],
    ['A full house combines three of a kind and a pair; compare the rank of the trips first.', 'Full house объединяет three of a kind и pair; сначала сравнивается ранг тройки.'],
    ['No suit outranks another: ♠ does not beat ♥ just because of its symbol.', 'Масть сама по себе не старше другой масти: ♠ не побеждает ♥ только из-за символа.'],
    ['Four of a kind and straight flush', 'Каре и стрит-флеш'],
    ['Four of a kind is four cards of one rank; the fifth card is the kicker.', 'Four of a kind — четыре карты одного ранга; пятая карта служит кикером.'],
    ['A straight flush is five consecutive cards of one suit and the highest category in standard Hold’em.', 'Straight flush — пять последовательных карт одной масти и самая высокая категория в обычном Hold’em.'],
    ['Any higher category beats a lower one regardless of the individual high cards.', 'Любая более высокая категория побеждает более низкую независимо от отдельных старших карт.'],
    ['Do not confuse a flush with a straight flush: the latter requires both one suit and a sequence.', 'Не путай обычный флеш со стрит-флешем: для второго нужны и одна масть, и последовательность.'],
    ['Best five, kickers, and ties', 'Лучшая пятёрка, кикеры и ничьи'],
    ['Choose the best hand of exactly five from the seven available cards. You may use two, one, or none of your hole cards.', 'Из семи доступных карт выбирается лучшая комбинация ровно из пяти. Можно использовать две, одну или ни одной карманной карты.'],
    ['Kickers matter only after the category and primary combination ranks match.', 'Кикеры решают только после совпадения категории и основных рангов комбинации.'],
    ['If the best five cards are exactly equal in strength, the pot is split; the sixth and seventh cards do not break the tie.', 'Если лучшие пять карт полностью одинаковы по силе, банк делится: шестая и седьмая карты не разрывают ничью.'],
    ['Write the two best five-card hands side by side and compare their evaluation from left to right.', 'Запиши обе лучшие пятёрки рядом и сравнивай элементы оценки слева направо.'],
    ['The board plays', 'Играет доска'],
    ['The board is A♠ K♦ Q♣ J♥ 10♠; the hands are 2♣ 2♦ and 9♣ 9♦.', 'Доска A♠ K♦ Q♣ J♥ 10♠, руки 2♣ 2♦ и 9♣ 9♦.'],
    ['Both best five-card hands are the ace-high straight on the board. Neither pocket pair plays, so the result is a tie.', 'Обе лучшие пятёрки — общий стрит до туза. Карманные пары не входят в лучшую пятёрку, поэтому это ничья.'],
    ['The kicker decides', 'Кикер решает'],
    ['The board is K♣ 8♦ 4♠ 2♥ 2♣; the hands are A♠ K♦ and Q♠ K♥.', 'Доска K♣ 8♦ 4♠ 2♥ 2♣, руки A♠ K♦ и Q♠ K♥.'],
    ['Both players have two pair, kings and twos. Hero’s ace outranks the opponent’s queen as the kicker.', 'У обоих две пары: короли и двойки. Туз героя старше дамы соперника и выигрывает как кикер.'],
    ['Two possible full houses', 'Два возможных фулл-хауса'],
    ['The seven available cards are K♠ K♥ K♦ 9♣ 9♦ 9♠ 2♣.', 'Из семи карт доступны K♠ K♥ K♦ 9♣ 9♦ 9♠ 2♣.'],
    ['The best five are K-K-K-9-9. A full house with three kings beats the version with three nines.', 'Лучшая пятёрка — K-K-K-9-9. Фулл-хаус с тройкой королей старше варианта с тройкой девяток.'],
    ['Which is stronger: a flush or a full house?', 'Что старше: flush или full house?'],
    ['A full house ranks above a flush in the standard hand hierarchy.', 'Full house расположен выше flush в стандартном порядке категорий.'],
    ['A-2-3-4-5 is…', 'A-2-3-4-5 — это…'],
    ['A five-high straight', 'Straight до пятёрки'],
    ['An ace-high straight', 'Straight до туза'],
    ['An ace can be the low card in A-2-3-4-5; the high card of that straight is the five.', 'Туз может быть младшей картой стрита A-2-3-4-5; старшая карта такого стрита — пятёрка.'],
    ['The board already contains the best five cards for both players. What happens?', 'Общий борд уже содержит лучшую пятёрку для обоих. Что происходит?'],
    ['The higher hole card wins', 'Побеждает старшая карманная карта'],
    ['The pot is split', 'Банк делится'],
    ['The higher suit wins', 'Побеждает старшая масть'],
    ['The sixth and seventh cards are not used to break a tie between identical best five-card hands.', 'Шестая и седьмая карты не используются для разрыва полностью одинаковой лучшей пятёрки.'],
    ['Which is stronger: high card or one pair?', 'Что старше: high card или one pair?'],
    ['Any pair beats high card.', 'Любая пара старше high card.'],
    ['Which is stronger: two pair or three of a kind?', 'Что старше: two pair или three of a kind?'],
    ['Three of a kind beats two pair.', 'Тройка старше двух пар.'],
    ['Which is stronger: a straight or a flush?', 'Что старше: straight или flush?'],
    ['A flush beats a straight.', 'Flush старше straight.'],
    ['Which is stronger: a full house or four of a kind?', 'Что старше: full house или four of a kind?'],
    ['Four of a kind beats a full house.', 'Каре старше фулл-хауса.'],
    ['Which listed category is strongest?', 'Какая из перечисленных категорий старше?'],
    ['A straight flush beats four of a kind and a regular flush.', 'Straight flush старше каре и обычного флеша.'],
    ['How many cards make up the final hand?', 'Сколько карт входит в итоговую комбинацию?'],
    ['Seven', 'Семь'],
    ['Only the two hole cards', 'Только две карманные'],
    ['The best five cards are always evaluated from the seven available.', 'Всегда оценивается лучшая пятёрка из доступных семи карт.'],
    ['The players have the same pair. What is compared next?', 'У игроков одинаковая пара. Что сравнивается дальше?'],
    ['Suit', 'Масть'],
    ['Kickers from highest to lowest', 'Кикеры по старшинству'],
    ['Table position', 'Позиция за столом'],
    ['After the same pair, compare kickers from highest to lowest.', 'После одинаковой пары сравниваются кикеры от старшего к младшему.'],
    ['The best five cards are identical. Who wins?', 'Лучшие пять карт одинаковы. Кто выигрывает?'],
    ['The player on the BTN', 'Игрок на BTN'],
    ['The player holding an ace', 'Игрок с тузом в руке'],
    ['Identical best five-card hands produce a tie.', 'Полностью одинаковая лучшая пятёрка означает ничью.'],
    ['How are two flushes compared?', 'Как сравнивают два флеша?'],
    ['By comparing high cards in order', 'По старшим картам последовательно'],
    ['By suit', 'По масти'],
    ['By the number of hole cards used', 'По числу карманных карт'],
    ['Compare the highest card in each flush, then the next card, and so on.', 'Флеши сравниваются по старшей карте, затем по следующей и так далее.'],
    ['How are two full houses compared?', 'Как сравнивают два фулл-хауса?'],
    ['Compare the pair first', 'Сначала по паре'],
    ['Compare the trips first', 'Сначала по тройке'],
    ['The trips are the primary rank of a full house; compare the pair only when the trips match.', 'Главный ранг фулл-хауса — ранг тройки; пара сравнивается только при равных тройках.'],
    ['Poker Table Positions', 'Позиции за покерным столом'],
    ['Action order, table zones, IP/OOP, and position-based starting hands.', 'Порядок действий, зоны стола, IP/OOP и стартовые руки по позициям.'],
    ['early position', 'ранняя позиция'],
    ['middle position', 'средняя позиция'],
    ['late position', 'поздняя позиция'],
    ['position-based starting hands', 'стартовые руки по позициям'],
    ['6-max table', '6-max стол'],
    ['Choose a seat to see its role and starting-hand examples.', 'Выбери место, чтобы увидеть его роль и примеры стартовых рук.'],
    ['Early position', 'Ранняя позиция'],
    ['UTG acts first preflop with almost no information, so it opens the strongest and narrowest range.', 'UTG действует первым префлоп и почти без информации, поэтому открывает самый сильный и узкий диапазон.'],
    ['Often OOP against late positions.', 'Часто OOP против поздних позиций.'],
    ['Middle position', 'Средняя позиция'],
    ['HJ has more information than UTG, but CO, BTN, and the blinds remain behind, so its range is still disciplined.', 'HJ получает больше информации, чем UTG, но за ним остаются CO, BTN и блайнды, поэтому диапазон всё ещё дисциплинирован.'],
    ['Can be IP against the blinds and OOP against CO/BTN.', 'Может быть IP против блайндов и OOP против CO/BTN.'],
    ['Late position', 'Поздняя позиция'],
    ['CO sits directly right of BTN and can open wider, especially when BTN and the blinds play tightly.', 'CO находится справа от BTN и может открываться шире, особенно когда BTN и блайнды играют тайтово.'],
    ['Often IP against the blinds, but OOP against BTN.', 'Часто IP против блайндов, но OOP против BTN.'],
    ['BTN is the most advantageous position: it usually acts last after the flop and realizes equity from a wide range more effectively.', 'BTN — самая выгодная позиция: после флопа он обычно действует последним и лучше реализует equity широкого диапазона.'],
    ['Usually IP against every remaining opponent.', 'Обычно IP против всех оставшихся соперников.'],
    ['Blinds', 'Блайнды'],
    ['SB has already posted half a big blind, but acts first on nearly every postflop street, making wide passive calls dangerous.', 'SB уже вложил половину большого блайнда, но после флопа почти всегда действует первым, поэтому широкий пассивный call опасен.'],
    ['Almost always OOP.', 'Почти всегда OOP.'],
    ['BB closes preflop action and receives the best call price, but its defense depends on the opener’s position and raise size.', 'BB закрывает префлоп-торги и получает лучшую цену на call, но защита зависит от позиции открывающего и размера рейза.'],
    ['Usually OOP against the opener.', 'Обычно OOP против открывающего.'],
    ['Any pair', 'Любая пара'],
    ['Action order and table zones', 'Порядок действий и зоны стола'],
    ['Position is your seat relative to the dealer button. Preflop, UTG acts first, followed by HJ, CO, BTN, SB, and BB.', 'Позиция — место относительно кнопки дилера. Префлоп первым действует UTG, затем HJ, CO, BTN, SB и BB.'],
    ['UTG is early position, HJ is middle position, CO and BTN are late position, and SB and BB are the blinds.', 'UTG относится к ранней позиции, HJ — к средней, CO и BTN — к поздней, а SB и BB образуют блайнды.'],
    ['The later the decision, the more opponent actions are known and the wider the range can usually be.', 'Чем позже решение, тем больше действий соперников уже известно и тем шире обычно может быть диапазон.'],
    ['Before evaluating your cards, name your position and count how many players still act after you.', 'Перед оценкой карт сначала назови свою позицию и сколько игроков ещё будут действовать после тебя.'],
    ['Why CO and BTN play wider', 'Почему CO и BTN играют шире'],
    ['CO and BTN win the blinds uncontested more often and are less likely to face an unexpected raise from behind.', 'CO и BTN чаще забирают блайнды без борьбы и реже получают неожиданный рейз от игроков позади.'],
    ['BTN usually acts last after the flop, so it can choose value bets, bluffs, and pot control more precisely.', 'BTN после флопа обычно действует последним, поэтому может точнее выбирать value bet, bluff и контроль банка.'],
    ['The same marginal hand can be a fold from UTG and a profitable open from BTN.', 'Одна и та же пограничная рука может быть fold из UTG и прибыльным open с BTN.'],
    ['A wide late-position range comes from information and initiative—not permission to play any two cards.', 'Широкий диапазон поздней позиции — результат информации и инициативы, а не разрешение играть любые две карты.'],
    ['IP and OOP after the flop', 'IP и OOP после флопа'],
    ['IP (in position) means acting after the opponent postflop. OOP (out of position) means acting first.', 'IP (in position) означает действовать после соперника на постфлопе. OOP (out of position) — действовать раньше.'],
    ['IP controls pot size, realizes equity, and gathers information more effectively. OOP uses more cautious sizes and checks more often.', 'IP лучше контролирует размер банка, реализует equity и собирает информацию. OOP чаще выбирает осторожные размеры и checks.'],
    ['Position is relative: CO is IP against BB but OOP against BTN.', 'Позиция относительна: CO будет IP против BB, но OOP против BTN.'],
    ['Do not confuse a seat name with relative position: always compare Hero’s seat with the specific opponent.', 'Не путай название места и относительную позицию: всегда сравнивай место героя с конкретным соперником.'],
    ['Starting-hand examples by position', 'Примеры стартовых рук по позициям'],
    ['From UTG, prioritize strong pairs, large suited broadways, and AK because many players remain behind.', 'Из UTG приоритет получают сильные пары, большие suited broadway и AK: за героем ещё много игроков.'],
    ['HJ and CO add medium pairs, suited aces, and connected broadways. BTN can open wider still.', 'С HJ и CO добавляются средние пары, suited aces и связные broadway. BTN может открывать ещё шире.'],
    ['BB defends against a specific opening range: wider against BTN than against a strong UTG range.', 'BB защищает диапазон против конкретного открытия: против BTN шире, чем против сильного UTG.'],
    ['These examples are learning guides, not absolute GTO charts: stack, raise size, and opponent type change the decision.', 'Примеры — учебные ориентиры, а не абсолютные GTO-чарты: стек, размер рейза и тип соперника меняют решение.'],
    ['A5s from UTG and BTN', 'A5s из UTG и BTN'],
    ['Everyone folds to Hero, who holds A♠ 5♠.', 'До героя все сделали fold; у героя A♠ 5♠.'],
    ['From UTG the hand is marginal and often folded; from BTN it can open because of position, fold equity, and playability.', 'Из UTG рука погранична и часто выбрасывается, а с BTN может открываться благодаря позиции, fold equity и играбельности.'],
    ['BB defense depends on the opener', 'Защита BB зависит от открывающего'],
    ['Hero is in the BB with KQo and faces the same raise from UTG or BTN.', 'Герой в BB с KQo получает одинаковый рейз от UTG или BTN.'],
    ['Use caution against the narrow UTG range; KQo continues much more often against the wide BTN range.', 'Против узкого UTG диапазона нужна осторожность; против широкого BTN KQo значительно чаще продолжает.'],
    ['Position is relative', 'Позиция относительна'],
    ['CO and BTN see a flop against BB.', 'CO и BTN увидели флоп против BB.'],
    ['Both act after BB, but if CO and BTN remain together, BTN acts after CO and has the positional advantage.', 'Оба действуют после BB, но если CO и BTN остались вместе, BTN действует после CO и имеет позиционное преимущество.'],
    ['Which position usually acts last after the flop?', 'Какая позиция обычно действует последней после флопа?'],
    ['BTN usually acts last after the flop and receives the most information.', 'BTN обычно действует последним после флопа и получает максимум информации.'],
    ['Hero on CO plays against BB. Who is usually IP after the flop?', 'Герой на CO играет против BB. Кто обычно IP после флопа?'],
    ['Neither', 'Никто'],
    ['CO acts after BB postflop and is therefore IP.', 'CO находится после BB по постфлоп-порядку и поэтому играет IP.'],
    ['Where does the same marginal hand usually open wider?', 'Где одна и та же пограничная рука обычно открывается шире?'],
    ['BTN uses information, initiative, and postflop position, so its opening range is wider.', 'BTN использует информацию, инициативу и постфлоп-позицию, поэтому его open-диапазон шире.'],
    ['Who acts first preflop at a 6-max table?', 'Кто действует первым префлоп за 6-max столом?'],
    ['UTG makes the first voluntary preflop decision.', 'UTG первым принимает добровольное решение префлоп.'],
    ['Which position is considered middle position in this course?', 'Какая позиция относится к средней в этом курсе?'],
    ['HJ sits between early-position UTG and late-position CO/BTN.', 'HJ находится между ранним UTG и поздними CO/BTN.'],
    ['Which pair consists of late positions?', 'Какая пара относится к поздним позициям?'],
    ['CO and BTN', 'CO и BTN'],
    ['UTG and HJ', 'UTG и HJ'],
    ['SB and BB', 'SB и BB'],
    ['CO and BTN are late positions.', 'CO и BTN — поздние позиции.'],
    ['Which positions post the forced blinds?', 'Какие позиции вносят обязательные blinds?'],
    ['The small blind and big blind post forced bets.', 'Small blind и big blind вносят обязательные ставки.'],
    ['What does IP mean?', 'Что означает IP?'],
    ['Act after the opponent', 'Действовать после соперника'],
    ['Act before the opponent', 'Действовать до соперника'],
    ['Be all-in', 'Быть all-in'],
    ['In position means acting after the opponent postflop.', 'In position означает действовать после соперника на постфлопе.'],
    ['Hero is in SB against BTN. Hero is usually…', 'Герой в SB против BTN. Герой обычно…'],
    ['On the BTN', 'На BTN'],
    ['SB acts before BTN after the flop and is therefore OOP.', 'SB действует раньше BTN после флопа и поэтому находится OOP.'],
    ['CO plays against BB without BTN. Who is IP?', 'CO играет против BB без BTN. Кто IP?'],
    ['CO acts after BB and is IP.', 'CO действует после BB и находится IP.'],
    ['Whose opening range is usually wider?', 'Чей open-диапазон обычно шире?'],
    ['BTN acts late and usually opens wider than UTG.', 'BTN действует поздно и обычно открывает шире UTG.'],
    ['Against which opener does BB usually defend wider?', 'Против какого открытия BB обычно защищается шире?'],
    ['BTN opens wider, so BB can defend more hands.', 'BTN открывает шире, поэтому BB может защищать больше рук.'],
    ['What is the main practical advantage of late position?', 'Главное практическое преимущество поздней позиции?'],
    ['More information before deciding', 'Больше информации до решения'],
    ['An extra card', 'Дополнительная карта'],
    ['A higher suit', 'Старшая масть'],
    ['Late position sees opponents’ actions and acts last after the flop more often.', 'Поздняя позиция видит действия соперников и чаще действует последней после флопа.'],
    ['Starting Hands', 'Стартовые руки'],
    ['Ranges for entering the pot from different positions.', 'Диапазоны входа в банк из разных позиций.']
  ]);

  const COPY_PAIRS = Object.freeze([
    ['Decision training and hand review', 'Тренировка и разбор решений'],
    ['Poker IQ in progress', 'Poker IQ формируется'],
    ['Course progress', 'Прогресс курса'],
    ['Quick training', 'Быстрая тренировка'],
    ['Enter a hand', 'Ввести раздачу'],
    ['Equity', 'Equity'],
    ['Train topic', 'Тренировать тему'],
    ['Train', 'Тренировать'],
    ['{topic}: focused practice', '{topic}: точная практика'],
    ['A short practice session on a topic where mistakes have already occurred.', 'Короткая тренировка по теме, в которой уже были ошибки.'],
    ['{count} errors recorded for this topic.', 'Зафиксировано ошибок по теме: {count}.'],
    ['Return to a saved hand', 'Вернуться к сохранённой раздаче'],
    ['Review the recent hand in Hand Lab while the line is still fresh.', 'Разберите недавнюю раздачу в Hand Lab, пока линия ещё свежа.'],
    ['about 3 minutes', 'около 3 минут'],
    ['Open Review', 'Открыть разбор'],
    ['A saved hand is available for analysis.', 'Есть сохранённая раздача для анализа.'],
    ['Safe default action.', 'Безопасное действие по умолчанию.'],
    ['A saved hand is waiting for review', 'Сохранённая раздача ждёт разбора'],
    ['{count} saved hand in Hand Lab.', '{count} раздача сохранена в Hand Lab.'],
    ['{count} saved hands in Hand Lab.', '{count} раздач сохранено в Hand Lab.'],
    ['Open Hand Lab', 'Открыть Hand Lab'],
    ['Recent activity', 'Недавняя активность'],
    ['Open Daily Hand', 'Открыть раздачу дня'],
    ['Daily Hand history', 'История раздач дня'],
    ['Today’s poker spot', 'Сегодняшняя покерная ситуация'],
    ['How should you play it?', 'Как сыграть?'],
    ['YOUR DECISION', 'ТВОЁ РЕШЕНИЕ'],
    ['Choose an action', 'Выберите действие'],
    ['Confirm decision', 'Подтвердить решение'],
    ['Correct', 'Верно'],
    ['Daily Hand reward', 'Награда за раздачу дня'],
    ['Decision comparison', 'Сравнение решения'],
    ['Daily Hand stats', 'Статистика раздач дня'],
    ['Last seven days', 'Последние 7 дней'],
    ['Activity over the last seven days', 'Активность за последние семь дней'],
    ['No history yet', 'История пока пуста'],
    ['Complete today’s hand and your result will appear here.', 'Завершите сегодняшнюю раздачу — результат появится здесь.'],
    ['Completed hands', 'Завершённые раздачи'],
    ['Completed decisions and the rewards earned from them.', 'Завершённые решения и начисленные за них награды.'],
    ['Review unavailable', 'Разбор недоступен'],
    ['This entry is missing or damaged.', 'Эта запись не найдена или повреждена.'],
    ['Archived hand result', 'Результат архивной раздачи'],
    ['Situation', 'Ситуация'],
    ['Street', 'Улица'],
    ['Difficulty', 'Сложность'],
    ['Outcome', 'Результат'],
    ['Your action', 'Ваше действие'],
    ['Hand review', 'Разбор решения'],
    ['Positions and ranges', 'Позиции и диапазоны'],
    ['Starting hands, opens, and defense.', 'Стартовые руки, открытия и защита.'],
    ['Choose a format. Every recommendation and calculation uses the existing PokerCore and Trainer Engine.', 'Выбери формат. Все рекомендации и расчёты используют существующий PokerCore и Trainer Engine.'],
    ['18 validated postflop scenarios.', '18 проверенных постфлоп-сценариев.'],
    ['Ten decisions covering positions and ranges.', 'Десять решений по позициям и диапазонам.'],
    ['Educational 6-max and 9-max sessions.', 'Учебные 6-max и 9-max сессии.'],
    ['Exam / Training / Review and practice settings', 'Экзамен / Тренировка / Разбор и настройки практики'],
    ['Analysis', 'Разбор'],
    ['No math before your answer.', 'Никакой математики до ответа.'],
    ['The math is visible immediately, but the answer is not highlighted.', 'Математика видна сразу, ответ не подсвечивается.'],
    ['Hints open only when requested.', 'Подсказки открываются только по запросу.'],
    ['Practice spot', 'Учебный режим'],
    ['Your cards', 'Твои карты'],
    ['Board', 'Доска'],
    ['Your position', 'Твоя позиция'],
    ['Opponent', 'Соперник'],
    ['Bankroll', 'Банк'],
    ['Next situation', 'Следующая ситуация'],
    ['Show math', 'Показать математику'],
    ['What did I miss?', 'Что я упустил?'],
    ['Preflop', 'Префлоп'],
    ['Flop', 'Флоп'],
    ['Turn', 'Тёрн'],
    ['River', 'Ривер'],
    ['Poker math', 'Покерная математика'],
    ['Position and hands', 'Позиции и руки'],
    ['Start weak-spot training', 'Начать тренировку слабого места'],
    ['Focus session complete', 'Фокус-сессия завершена'],
    ['Correct decisions', 'Правильных решений'],
    ['Continue training', 'Продолжить тренировку'],
    ['Session setup', 'Настройка сессии'],
    ['Buy-in', 'Бай-ин'],
    ['Table', 'Стол'],
    ['Table character', 'Характер стола'],
    ['Mixed', 'Смешанный'],
    ['Passive', 'Пассивный'],
    ['Aggressive', 'Агрессивный'],
    ['Take a seat', 'Сесть за стол'],
    ['Table is preparing the hand', 'Стол готовит раздачу'],
    ['Action', 'К действию'],
    ['Next hand', 'Следующая рука'],
    ['End session', 'Закончить сессию'],
    ['Hand history', 'История раздачи'],
    ['Session', 'Сессия'],
    ['Live Cash controls', 'Управление Live Cash'],
    ['Exit Live Cash', 'Выйти из Live Cash'],
    ['More Live Cash settings', 'Дополнительные настройки Live Cash'],
    ['Decrease size', 'Уменьшить размер'],
    ['Increase size', 'Увеличить размер'],
    ['Bet size', 'Размер ставки'],
    ['Hero actions', 'Действия Hero'],
    ['Profile settings', 'Настройки профиля'],
    ['Player profile', 'Профиль игрока'],
    ['Player development', 'Развитие игрока'],
    ['Current level', 'Текущий уровень'],
    ['Current rank', 'Текущий ранг'],
    ['Achievements earned', 'Открыто'],
    ['Performance summary', 'Краткий срез'],
    ['Detailed progress', 'Подробный прогресс'],
    ['Overview', 'Краткая сводка игрока'],
    ['Current level progress', 'Прогресс текущего уровня'],
    ['Edit profile', 'Редактировать профиль'],
    ['Avatar', 'Аватар'],
    ['Name', 'Имя'],
    ['Theme follows your device', 'Следовать оформлению устройства'],
    ['Deep green', 'Глубокий зелёный'],
    ['Warm amber', 'Тёплый янтарный'],
    ['Cool indigo', 'Прохладный индиго'],
    ['Clean light theme', 'Светлый минимализм'],
    ['Neon energy', 'Неон и энергия'],
    ['Glass and depth', 'Стекло и глубина'],
    ['Graphite and champagne', 'Графит и шампанское'],
    ['Warm poker room', 'Тёплый клубный'],
    ['Soft light theme', 'Мягкий светлый'],
    ['One structure, nine PokerElevate personalities.', 'Одна структура — девять характеров PokerElevate.'],
    ['System / Auto', 'System / Auto'],
    ['Profile saved', 'Профиль сохранён'],
    ['Achievements', 'Достижения'],
    ['View all achievements', 'Все достижения'],
    ['Next goals', 'Следующие цели'],
    ['Earned', 'Открыто'],
    ['Locked', 'Заблокировано'],
    ['No achievement data yet.', 'Пока нет данных о достижениях.'],
    ['Recent Progress', 'Недавний прогресс'],
    ['Latest', 'Последнее'],
    ['Skills', 'Навыки'],
    ['Weekly focus', 'Фокус недели'],
    ['Weekly focus is not available yet', 'Фокус недели пока не определён'],
    ['Not enough reliable skill data yet. Keep training.', 'Недостаточно надёжных данных по навыкам. Продолжайте тренироваться.'],
    ['Poker IQ history', 'История Poker IQ'],
    ['XP history', 'История XP'],
    ['Activity', 'Активность'],
    ['Event types', 'Типы событий'],
    ['Accepted events', 'Accepted events'],
    ['Recorded values only', 'Recorded values only'],
    ['Real data only', 'Только реальные данные'],
    ['Real events only', 'Только реальные события'],
    ['Local calendar', 'Локальный календарь'],
    ['Period structure', 'Структура периода'],
    ['7 days', '7 дней'],
    ['30 days', '30 дней'],
    ['All time', 'Всё время'],
    ['No events in this period.', 'Нет событий за выбранный период.'],
    ['No events to break down.', 'Нет событий для распределения.'],
    ['No XP was earned in this period.', 'XP за выбранный период не начислялся.'],
    ['Poker IQ history will appear after new rated decisions.', 'История Poker IQ появится после новых оценённых решений.'],
    ['Poker IQ history is partial; older values are not reconstructed.', 'История Poker IQ частичная: старые значения не реконструируются.'],
    ['Collection', 'Коллекция'],
    ['Track unlocked goals and real progress without bonus rewards or hidden recalculations.', 'Отслеживайте открытые цели и реальный прогресс без дополнительных наград или скрытых пересчётов.'],
    ['All', 'Все'],
    ['Unlocked', 'Открытые'],
    ['Not unlocked', 'Не открытые'],
    ['Rating', 'Rating'],
    ['Decisions rated', 'Оценено решений'],
    ['Not enough decisions', 'Недостаточно решений'],
    ['No street data', 'Нет данных по улицам'],
    ['Last 20', 'Последние 20'],
    ['Last 7 days', 'Последние 7 дней'],
    ['Trend not available yet', 'Тренд пока недоступен'],
    ['No data', 'Нет данных'],
    ['No data yet', 'Данные появятся после первого действия.'],
    ['Saved Hands', 'Сохранённые раздачи'],
    ['No saved hands yet.', 'Сохранённых раздач пока нет.'],
    ['Hands from Live Cash $1/$3 can be opened in Hand Lab. The action history remains available for future Coach analysis.', 'Раздачи из Live Cash $1/$3 можно открыть в Hand Lab; история действий останется доступна для будущего анализа Coach.'],
    ['Manual hand analysis', 'Ручной анализ раздачи'],
    ['Enter only what you know. You do not need the opponent’s exact cards; the calculation uses an estimated or custom range.', 'Заполни только известные данные. Конкретные карты соперника не требуются: расчёт строится против предполагаемого или заданного диапазона.'],
    ['Effective stack', 'Эффективный стек'],
    ['Opponent type', 'Тип соперника'],
    ['Opponent range — optional', 'Диапазон соперника — необязательно'],
    ['Leave blank and PokerElevate will choose an educational Live model based on the opponent type and action.', 'Оставь пустым — PokerElevate подберёт учебную live-модель по типу соперника и его действию.'],
    ['What happened before the decision — optional', 'Что происходило до решения — необязательно'],
    ['Analyze hand', 'Проанализировать раздачу'],
    ['Edit inputs and recalculate', 'Изменить данные и пересчитать'],
    ['Why this action', 'Почему это действие'],
    ['Range and model limits', 'Диапазон и ограничения модели'],
    ['Alternative line', 'Альтернативная линия'],
    ['Why not the other actions?', 'Почему не другие действия?'],
    ['Outs, Equity, and math', 'Ауты, Equity и математика'],
    ['Player', 'Player'],
    ['Unranked', 'Без ранга'],
    ['Unrated', 'Без рейтинга'],
    ['Low', 'Низкий'],
    ['Medium', 'Средняя'],
    ['New', 'Новая'],
    ['Completed', 'Завершено'],
    ['Open', 'Открыть'],
    ['Today’s activity has not been counted yet', 'Сегодня активность ещё не засчитана'],
    ['‹ Back', '‹ Назад'],
    ['‹ Home', '‹ На главную'],
    ['‹ Back to progress', '‹ К прогрессу'],
    ['‹ Back to history', '‹ К истории'],
    ['‹ Back to learning', '‹ К обучению'],
    ['‹ Back to training', '‹ К тренировке'],
    ['Analytics', 'Аналитика'],
    ['Decision quality', 'Качество решений'],
    ['Not enough decisions to calculate Decision Quality.', 'Недостаточно решений для оценки Decision Quality.'],
    ['Not enough attempts to calculate', 'Недостаточно попыток для оценки'],
    ['Value', 'Вэлью'],
    ['Bluffing', 'Блефы'],
    ['Discipline', 'Дисциплина'],
    ['Postflop', 'Постфлоп'],
    ['Open Trainer', 'Открыть Trainer'],
    ['current', 'текущая'],
    ['best', 'лучшая'],
    ['Best: {count}', 'Лучшая: {count}'],
    ['{count} day', '{count} день'],
    ['{count} days', '{count} дня'],
    ['{count} days', '{count} дней'],
    ['{skill}: No data', '{skill}: Нет данных'],
    ['{count} attempt', '{count} попытка'],
    ['{count} attempts', '{count} попытки'],
    ['{count} attempts', '{count} попыток'],
    ['Personal focus', 'Персональный фокус'],
    ['Recent decisions', 'Последние решения'],
    ['History is empty.', 'История пока пуста.'],
    ['Overall accuracy: {value}', 'Общая точность: {value}'],
    ['{count} decisions, best streak {best}.', '{count} решений, лучшая серия {best}.'],
    ['Not enough data yet', 'Данных пока мало'],
    ['Play at least 10 decisions so the Trainer can build a personal plan.', 'Сыграй не менее 10 решений, чтобы тренер построил персональный план.'],
    ['Decision Quality: not enough data', 'Decision Quality: недостаточно данных'],
    ['Play decisions with an available Trainer recommendation to build this signal.', 'Сыграйте решения с доступной рекомендацией тренера, чтобы сформировать дополнительный сигнал.'],
    ['Poker IQ: not calculated', 'Poker IQ: не рассчитан'],
    ['Play at least one rated decision. A stable rating requires at least 30 decisions.', 'Сыграйте хотя бы одно оцениваемое решение. Для сформированной оценки нужно минимум 30 решений.'],
    ['Progress activity and XP are based only on accepted ProgressSystem events.', 'Активность и XP строятся только по принятым событиям ProgressSystem.'],
    ['Current progress state', 'Текущее состояние прогресса'],
    ['Streak / best', 'Серия / лучшая'],
    ['Analytics period', 'Период аналитики'],
    ['History is empty. Complete a training scenario to see real progress.', 'История пока пуста. Завершите тренировочный сценарий, чтобы увидеть реальную динамику.'],
    ['Selected-period summary', 'Сводка выбранного периода'],
    ['XP earned', 'XP получено'],
    ['Active days', 'Активных дней'],
    ['Scenarios', 'Сценариев'],
    ['Trainer decisions', 'Решений Trainer'],
    ['Exams', 'Экзаменов'],
    ['XP / active day', 'XP / активный день'],
    ['Accepted events by calendar day', 'Количество принятых событий по календарным дням'],
    ['XP actually earned by calendar day', 'Реально начисленный XP по календарным дням'],
    ['Recorded Poker IQ values', 'Записанные значения Poker IQ'],
    ['No accepted events yet.', 'Принятых событий пока нет.'],
    ['Overall achievement progress', 'Общий прогресс достижений'],
    ['{unlocked} of {total} unlocked', '{unlocked} из {total} открыто'],
    ['Achievements: {unlocked} of {total} unlocked, {percent}%', 'Достижения: {unlocked} из {total} открыто, {percent}%'],
    ['Achievement filter', 'Фильтр достижений'],
    ['Not unlocked', 'Не открыто'],
    ['Condition: {progress}', 'Условие: {progress}'],
    ['Condition:', 'Условие:'],
    ['Condition', 'Условие'],
    ['Hidden achievement', 'Скрытое достижение'],
    ['Keep developing your game to reveal the details.', 'Продолжайте развиваться, чтобы открыть детали.'],
    ['Condition is hidden for now.', 'Условие пока скрыто.'],
    ['Condition is not available yet.', 'Условие пока недоступно.'],
    ['Progress unavailable', 'прогресс недоступен'],
    ['Unlocked {date}', 'Открыто {date}'],
    ['Common', 'Обычное'],
    ['Rare', 'Редкое'],
    ['Epic', 'Эпическое'],
    ['Legendary', 'Легендарное'],
    ['First Step', 'Первый шаг'],
    ['Complete your first training scenario.', 'Завершите первый тренировочный сценарий.'],
    ['Quick Learner', 'Быстро учусь'],
    ['Complete 10 training scenarios.', 'Завершите 10 тренировочных сценариев.'],
    ['Decision Maker', 'Решительный игрок'],
    ['Make 25 decisions in the Trainer.', 'Примите 25 решений в тренажёре.'],
    ['Sharp Mind', 'Острый ум'],
    ['Reach a Poker IQ of 60 or higher.', 'Достигните Poker IQ 60 или выше.'],
    ['Poker Student', 'Ученик покера'],
    ['Reach Level 5.', 'Достигните Level 5.'],
    ['On a Roll', 'На волне'],
    ['Maintain a 3-day learning streak.', 'Поддерживайте серию занятий 3 дня.'],
    ['Dedicated', 'Предан игре'],
    ['Maintain a 7-day learning streak.', 'Поддерживайте серию занятий 7 дней.'],
    ['Exam Ready', 'Готов к экзамену'],
    ['Complete your first exam.', 'Завершите первый экзамен.'],
    ['Level Up', 'Новый уровень игры'],
    ['Move beyond the starting rank.', 'Поднимитесь выше начального ранга.'],
    ['Century Club', 'Клуб 100'],
    ['Earn 100 XP.', 'Заработайте 100 XP.'],
    ['{current} / {target} training scenarios', '{current} / {target} сценариев'],
    ['{current} / {target} training sessions', '{current} / {target} тренировок'],
    ['{current} / {target} decisions', '{current} / {target} решений'],
    ['{title}: {current} / {target} training sessions', '{title}: {current} / {target} тренировок'],
    ['{title}: {current} / {target} decisions', '{title}: {current} / {target} решений'],
    ['{current} / {target} Trainer decisions', '{current} / {target} решений Trainer'],
    ['{current} / {target} days', '{current} / {target} дня'],
    ['{current} / {target} exam', '{current} / {target} экзамен'],
    ['{date}: {count} events', '{date}: {count} событий'],
    ['English', 'English'],
    ['Русский', 'Русский'],
    ['United States', 'США'],
    ['Russia', 'Россия']
    ,['Good morning, {name}', 'Доброе утро, {name}']
    ,['Good afternoon, {name}', 'Добрый день, {name}']
    ,['Good evening, {name}', 'Добрый вечер, {name}']
    ,['Level {level} progress: {current} / {target} XP', 'Прогресс уровня {level}: {current} / {target} XP']
    ,['A short set of decisions to keep your game sharp.', 'Короткая серия решений для поддержания формы.']
    ,['5 hands · about 4 minutes', '5 раздач · около 4 минут']
    ,['Continue learning', 'Продолжить обучение']
    ,['An unfinished lesson is available.', 'Есть незавершённый учебный материал.']
    ,['{street} · {difficulty}', '{street} · {difficulty}']
    ,['{position} • {street}', '{position} • {street}']
    ,['Daily Hand cards', 'Карты раздачи дня']
    ,['Daily Hand progress', 'Прогресс раздачи дня']
    ,['Daily Hand streak: {count} days', 'Серия раздачи дня: {count} дней']
    ,['Completed: {count} · Accuracy: {percent}%', 'Решено: {count} · Точность: {percent}%']
    ,['Training', 'Тренировка']
    ,['Focus is taking shape', 'Фокус формируется']
    ,['Complete at least 10 rated decisions in a topic to unlock a personal focus.', 'Нужно минимум 10 оценённых решений по теме, чтобы выбрать персональный фокус.']
    ,['Keep your game sharp', 'Поддерживайте сильную форму']
    ,['Decision discipline', 'Дисциплина решений']
    ,['Value betting', 'Вэлью-беты']
    ,['Poker math', 'Покерная математика']
    ,['Decision dynamics are improving', 'Динамика улучшается']
    ,['Recent performance is declining', 'Недавняя динамика снижается']
    ,['Performance is stable', 'Динамика стабильна']
    ,['No reliable weak topics are currently detected. Keep your game sharp with regular training.', 'Надёжных слабых тем сейчас не обнаружено. Поддерживайте форму обычной тренировкой.']
    ,['At least {count} rated decisions in a topic are needed to select a personal focus.', 'Нужно минимум {count} оценённых решений по теме, чтобы выбрать персональный фокус.']
    ,['{current}/{target} lessons', '{current}/{target} уроков']
    ,['No completed modules yet', 'Пока нет завершённых модулей']
    ,['Your personal focus will appear after a few training sessions.', 'Персональный фокус появится после нескольких тренировок.']
    ,['Legacy navigation compatibility', 'Совместимость прежней навигации']
    ,['River: thin value', 'Ривер: тонкое вэлью']
    ,['Hand details', 'Параметры раздачи']
    ,['Hero position', 'Позиция Hero']
    ,['To call', 'К ответу']
    ,['No bet', 'Нет ставки']
    ,['Recommendation', 'Рекомендация']
    ,['Why', 'Почему']
    ,['Calling station checks for the third time. Effective stack $180.', 'Calling station чекает третий раз. Эффективный стек $180.']
    ,['Recommendations use an educational exploit model for Live $1/$3. This is not a GTO solver or a guarantee of winning.', 'Рекомендации используют учебную exploit-модель live $1/$3. Это не GTO-солвер и не гарантия выигрыша.']
    ,['River: bluff-catch', 'Ривер: блеф-кетч']
    ,['Aggressive player', 'Агрессивный игрок']
    ,['Pot before bet', 'Банк до ставки']
    ,['Bet', 'Ставка']
    ,['Current pot', 'Банк сейчас']
    ,['💡 Hint', '💡 Подсказка']
    ,['🧮 Math', '🧮 Математика']
    ,['What range does the opponent have?', 'Какой диапазон у соперника?']
    ,['After your turn check, an aggressive opponent bets $110 into a $217 pot.', 'После твоего чека на тёрне активный соперник ставит $110 в банк $217.']
    ,['AJ is too high in your range to fold against a player with meaningful bluffs.', 'AJ — слишком сильная верхняя часть твоего диапазона, чтобы выбрасывать против игрока с заметными блефами.']
    ,['Compare the call price with the opponent’s full betting range, not only the value hands.', 'Сравни цену колла не с силой отдельных вэлью-комбинаций, а со всем диапазоном ставки.']
    ,['You may overweigh sets and J9 while forgetting worse jacks and missed draws. You need only about 25% equity to call.', 'Ты можешь переоценить сеты и J9, забыв про худших валетов и промазавшие дро. Для колла требуется лишь около четверти банка.']
    ,['Value: sets and J9. Thinner value: KJ/QJ/JT. Bluffs: missed T8, 76, 65, and some overcards.', 'Вэлью: сеты и J9. Более слабое вэлью: KJ/QJ/JT. Блефы: промазавшие T8, 76, 65 и часть оверкарт.']
    ,['Folding is good only against a very passive opponent who almost never bluffs.', 'Фолд становится хорошим только против очень пассивного соперника, который почти не блефует.']
    ,['Calling keeps bluffs and worse Jx in the pot. This is a standard bluff-catch.', 'Колл сохраняет блефы и худшие Jx. Это стандартный bluff-catch.']
    ,['Raising isolates you against stronger value; worse hands usually fold.', 'Рейз изолирует тебя против более сильного вэлью: худшие руки часто выбросят.']
    ,['If the opponent were a passive calling station who suddenly bet large, folding would become much closer.', 'Если бы соперник был пассивным calling station и внезапно поставил крупно, фолд стал бы гораздо ближе.']
    ,['Flop: value and protection', 'Флоп: вэлью и защита']
    ,['A passive opponent checks to you. Effective stack $240.', 'Пассивный соперник чекает в тебя. Эффективный стек $240.']
    ,['An overpair can get three streets of value from Tx and pocket pairs.', 'Оверпара получает три улицы вэлью от Tx и карманных пар.']
    ,['Ask which worse hands are willing to pay.', 'Спроси: какие худшие руки готовы платить?']
    ,['Checking does not protect you from losing; it simply gives a free card and misses calls from worse hands.', 'Чек не защищает тебя от проигрыша — он просто бесплатно отдаёт карту и упускает коллы от худших рук.']
    ,['A passive caller has plenty of Tx, 99–44, and suited connectors. Strong hands are scarce: TT/77/33.', 'У пассивного коллера много Tx, 99–44 и suited connectors. Сильных рук мало: TT/77/33.']
    ,['Checking is acceptable as an occasional slowplay, but it usually loses value on a dry board.', 'Допустим как редкий слоуплей, но на сухой доске обычно теряет вэлью.']
    ,['A 55–70% pot bet gets called by many worse hands.', 'Ставка около 55–70% банка получает коллы от множества худших рук.']
    ,['Against an aggressive opponent, checking can sometimes induce a turn bet.', 'Против агрессивного соперника чек иногда полезен, чтобы спровоцировать ставку на тёрне.']
    ,['Turn: top pair versus a tight barrel', 'Тёрн: топ-пара против тайтового барреля']
    ,['A tight player fires a second barrel of $80 into $124.', 'Тайтовый игрок ставит $80 в банк $124 второй улицей.']
    ,['Against a tight range for a large second barrel, one pair is often behind.', 'Против узкого диапазона крупного второго барреля одна пара часто находится позади.']
    ,['Opponent type and second-barrel size matter more than how attractive AQ looks in isolation.', 'Тип соперника и размер второй ставки важнее абсолютной красоты AQ.']
    ,['You may count every flush draw as a bluff, but a tight player has few of them and many strong made hands.', 'Ты можешь считать все флеш-дро блефами, но у тайтового игрока их немного, а готовых сильных рук много.']
    ,['Sets, two pair, made straights, and strong combo draws. There are very few pure bluffs.', 'Сеты, две пары, готовые стриты и сильные комбодро. Чистых блефов почти нет.']
    ,['An exploitative fold saves money against an underbluffing range.', 'Эксплойтный фолд экономит деньги против недостаточно блефующего диапазона.']
    ,['Calling is acceptable with additional reads or against a more aggressive version of this player.', 'Колл допустим с дополнительными ридами или против более агрессивной версии игрока.']
    ,['Raising folds out bluffs and gets continued against almost exclusively by stronger hands.', 'Рейз выбивает блефы и получает продолжение почти только от рук сильнее.']
    ,['Against an AGGRO player using the same size, calling becomes much better.', 'Против AGGRO с тем же размером ставки колл станет значительно лучше.']
    ,['Flop: nut flush draw', 'Флоп: натсовое флеш-дро']
    ,['A regular bets $35 into $61 with $210 behind.', 'Регуляр ставит $35 в банк $61. За спиной $210.']
    ,['The nut flush draw with two overcards is a strong combo draw.', 'Натсовое флеш-дро с двумя оверкартами — сильное комбодро.']
    ,['Separate raw outs from clean outs: the nine spades are strong, while an ace or king may be conditional.', 'Разделяй сырые ауты и чистые: 9 пик сильные, A/K могут быть условными.']
    ,['An earlier screen incorrectly showed 36% pot odds. The correct calculation is $35 / ($61 + $35 + $35) ≈ 26.7%.', 'На экране раньше ошибочно показывалось 36% пот-оддсов. Правильно: $35 / ($61 + $35 + $35) ≈ 26.7%.']
    ,['The range contains top pairs, sets, pocket pairs, and draws. AKs has substantial equity and fold equity against it.', 'В диапазоне есть топ-пары, сеты, карманные пары и собственные дро. Против него у AKs много эквити и fold equity.']
    ,['Folding gives up a hand with a large share of the pot at a good price.', 'Фолд теряет руку с высокой долей банка и хорошей ценой.']
    ,['Calling is profitable and keeps weaker bluffs in. It is a good line.', 'Колл прибыльный и сохраняет слабые блефы. Это хорошая линия.']
    ,['Raising creates fold equity and can stack off against hands where you have many outs.', 'Рейз создаёт fold equity и может выставляться против рук, где у тебя много аутов.']
    ,['In position, calling is often simpler and lowers variance; against a player who overfolds, raising is even better.', 'На позиции колл часто проще и снижает дисперсию; против игрока, который слишком много фолдит, рейз ещё лучше.']
    ,['Flop: open-ended straight draw', 'Флоп: двусторонний стрит-дро']
    ,['The opponent bets half pot. You have an OESD.', 'Соперник ставит половину банка. У тебя OESD.']
    ,['Eight direct straight outs give you enough equity to continue.', 'Восемь прямых стрит-аутов дают достаточно шансов для продолжения.']
    ,['Count the fours and nines first: four of each.', 'Сначала посчитай 4 и 9: четыре четвёрки и четыре девятки.']
    ,['You improve on the next card 8/47 ≈ 17% of the time and by the river about 31.5% of the time if the outs are clean.', 'Вероятность закрыться на следующей карте — 8/47 ≈ 17%; к риверу — около 31.5%, если ауты чистые.']
    ,['The betting range includes Kx pairs, overpairs, and some overcards. A raise can fold out air, but calling realizes equity more cheaply.', 'Ставка содержит пары Kx, оверпары и часть оверкарт. Рейз может выбить воздух, но колл реализует эквити дешевле.']
    ,['The price is too good to fold an eight-out draw.', 'Цена слишком хорошая для фолда восьмиаутного дро.']
    ,['Calling gets the right direct price with potential implied odds.', 'Колл получает корректную прямую цену с потенциальными implied odds.']
    ,['A semibluff is reasonable, especially against a high c-bet frequency, but increases variance.', 'Полублеф допустим, особенно против высокой частоты c-bet, но увеличивает дисперсию.']
    ,['After a missed turn, continuing depends on the second barrel size and any new additional outs.', 'На тёрне без усиления продолжение зависит от размера второй ставки и новых дополнительных аутов.']
    ,['A calling station checks for the third time. Effective stack $180.', 'Calling station чекает третий раз. Эффективный стек $180.']
    ,['Against a player who calls too often, AJ gets value from worse Jx and pairs.', 'Против игрока, который слишком много коллирует, AJ добирает с худших Jx и пар.']
    ,['Thin value depends on who can call with worse.', 'Тонкое вэлью зависит от того, кто способен заколлировать хуже.']
    ,['Fear of rare two pair should not outweigh the value from many calls with KJ/QJ/JT/TT.', 'Страх редких двух пар не должен отменять прибыль от множества коллов с KJ/QJ/JT/TT.']
    ,['After three checks, the range is heavily weighted toward one-pair and weak showdown hands.', 'После трёх чеков диапазон сильно смещён к одной паре и слабым showdown-рукам.']
    ,['Checking guarantees showdown but misses value against a typical station.', 'Чек гарантирует шоудаун, но недобирает против типичного station.']
    ,['A small $60–80 bet gets called often enough by worse.', 'Небольшая ставка $60–80 получает достаточно коллов хуже.']
    ,['Against a tight regular who folds KJ/QJ, checking becomes better.', 'Против тайтового регуляра, который фолдит KJ/QJ, чек становится лучше.']
    ,['Turn: top pair and pot control', 'Тёрн: топ-пара и контроль банка']
    ,['An aggressive opponent checks after calling the flop. Effective stack $195.', 'Активный соперник чекает после колла флопа. За спиной $195.']
    ,['Both lines are reasonable: checking protects your range and induces river action; betting gets value and protection.', 'Обе линии разумны: чек защищает диапазон и провоцирует ривер, ставка добирает и защищает.']
    ,['Not every strong decision has only one correct answer.', 'Не каждое сильное решение имеет один-единственный правильный ответ.']
    ,['After checking, be prepared to bluff-catch more often on a safe river; otherwise the check loses its purpose.', 'После чека нужно быть готовым чаще ловить блеф на безопасном ривере; иначе чек теряет смысл.']
    ,['Worse Jx, pairs, T9/98, and QT/T8 draws remain in the opponent’s range.', 'У соперника остаются худшие Jx, пары, T9/98 и дро QT/T8.']
    ,['Controls the pot and preserves an aggressive player’s bluffs.', 'Контролирует банк и сохраняет блефы агрессивного игрока.']
    ,['Gets value and protection, but can face an uncomfortable raise.', 'Получает вэлью и защиту, но иногда сталкивается с неприятным рейзом.']
    ,['If you check and a blank river brings a half-pot bet, AJ should usually call more often.', 'Если выбрал чек и пришёл бланковый ривер с половинной ставкой, AJ обычно должен чаще коллировать.']
    ,['Flop: set on a wet board', 'Флоп: сет на мокрой доске']
    ,['Two opponents check. The board contains many straights and draws.', 'Два соперника чекают. Доска содержит много стритов и дро.']
    ,['A set is very strong, but the board is dynamic: bet larger for value and protection.', 'Сет очень силён, но доска динамичная: ставь крупнее на вэлью и защиту.']
    ,['On a wet board, your size should charge draws and get value from two pair.', 'На мокрой доске размер должен наказывать дро и собирать с двух пар.']
    ,['Slowplaying gives a free card to tens, jacks, sixes, and spade combinations.', 'Слоуплей даёт бесплатную карту десяткам T/J/6/пиковых комбинаций.']
    ,['Pair-plus-draw hands, two pair, made straights, and flush draws.', 'Пары+дро, две пары, готовые стриты и флеш-дро.']
    ,['Checking is too risky against multiple ranges.', 'Слишком опасно против нескольких диапазонов.']
    ,['A 70–90% pot bet gets many calls and reduces free equity realization.', 'Ставка 70–90% банка получает много коллов и уменьшает бесплатную реализацию эквити.']
    ,['If you face a large raise, do not fold automatically: a set can redraw to a full house.', 'Если получишь крупный рейз, не автоматически фолди: у сета есть redraw к фулл-хаусу.']
    ,['River: nut flush', 'Ривер: натсовый флеш']
    ,['A passive opponent bets $75 into $160.', 'Пассивный соперник ставит $75 в банк $160.']
    ,['With the nut flush, look for additional value instead of simply closing the action.', 'С натсовым флешем нужно искать дополнительное вэлью, а не просто закрывать действие.']
    ,['Which worse flushes and strong pairs can pay off a raise?', 'Какие худшие флеши и сильные пары способны оплатить рейз?']
    ,['The opponent’s passivity strengthens the betting range, but your hand blocks only the nuts, not every worse flush.', 'Пассивность соперника усиливает его ставку, но твоя рука блокирует только натс, а не все худшие флеши.']
    ,['Worse flushes, sets, and strong two pair.', 'Худшие флеши, сеты и сильные две пары.']
    ,['Safe and profitable, but often leaves value on the table.', 'Безопасно и прибыльно, но часто недобирает.']
    ,['Raising gets paid by worse flushes; choose a size they can call.', 'Рейз получает оплату от худших флешей; размер должен оставить им возможность колла.']
    ,['Against a very tight player, choose a smaller raise instead of moving all-in.', 'Против очень тайтового игрока можно выбрать меньший рейз вместо олл-ина.']
    ,['Flop: underpair versus a large bet', 'Флоп: андерпара против крупной ставки']
    ,['A tight preflop raiser bets $35 into $45.', 'Тайтовый префлоп-рейзер ставит $35 в банк $45.']
    ,['88 realizes equity poorly on a K-Q-high board against a strong large-bet range.', '88 плохо реализует эквити на K-Q-high против сильного диапазона крупной ставки.']
    ,['Showdown value is not the same as being able to withstand multiple streets of pressure.', 'Шоудаун-вэлью не равно способности выдержать несколько улиц давления.']
    ,['Even if you are ahead of AJ/JT, future bets and overcards make equity realization poor.', 'Даже если впереди AJ/JT, будущие ставки и оверкарты делают реализацию эквити плохой.']
    ,['Strong Kx/Qx, overpairs, and some strong draws.', 'Сильные Kx/Qx, оверпары и некоторые сильные дро.']
    ,['Preserves your stack in a poor range matchup.', 'Сохраняет стек в плохом диапазонном матче.']
    ,['Often leads to guessing on the turn without clean outs.', 'Часто приводит к угадыванию на тёрне без чистых аутов.']
    ,['Turns a hand with showdown value into an expensive bluff against a strong range.', 'Превращает руку с шоудаун-вэлью в дорогой блеф против сильного диапазона.']
    ,['Against a small 25–30% pot bet and a wide BTN range, one call would be reasonable.', 'Против маленькой ставки 25–30% банка и широкого BTN диапазона один колл был бы допустим.']
    ,['Turn: two pair versus a bet', 'Тёрн: две пары против ставки']
    ,['A calling station bets $55 with $230 behind.', 'Calling station ставит $55. За спиной $230.']
    ,['Two pair is ahead of many Qx hands and draws; build a large pot against a station.', 'Две пары впереди множества Qx и дро; против station нужно строить большой банк.']
    ,['Do not fear rare sets so much that you miss value from a wide range.', 'Не бойся редких сетов настолько, чтобы упускать вэлью с широкого диапазона.']
    ,['Calling leaves money on the table and lets draws see the river at a comfortable price.', 'Колл оставляет деньги на столе и позволяет дро увидеть ривер по удобной цене.']
    ,['Top pairs, draws, rare sets, and lower two pair.', 'Топ-пары, дро, редкие сеты и нижние две пары.']
    ,['Far too strong to fold.', 'Слишком сильная рука для фолда.']
    ,['Keeps bluffs in well, but misses value against Qx.', 'Хорошо сохраняет блефы, но недобирает против Qx.']
    ,['Extracts maximum value from worse made hands and draws.', 'Извлекает максимум с худших готовых рук и дро.']
    ,['Against a NIT who rarely bets Qx, calling becomes preferable to raising.', 'Против NIT, который почти не ставит Qx, колл становится предпочтительнее рейза.']
    ,['River: missed draw', 'Ривер: промазавшее дро']
    ,['The opponent checks the river after check-calling twice. You have ace high.', 'Соперник чекает ривер после двух чек-коллов. У тебя туз-хай.']
    ,['Ace high almost never wins at showdown, while a large bet attacks Qx and medium pairs.', 'Туз-хай почти не выигрывает шоудаун, а крупная ставка атакует Qx и средние пары.']
    ,['A good bluff has little showdown value and blocks strong continuing hands.', 'Хороший блеф имеет мало showdown value и блокирует сильные продолжения.']
    ,['A♥ blocks some nut flush draws that could have missed, but it also blocks strong Ax. It is not perfect, but it is a workable candidate.', 'A♥ блокирует часть натсовых флеш-дро, которые могли бы сами промазать, но также блокирует сильные Ax — это не идеальный, но рабочий кандидат.']
    ,['After two check-calls: Qx, Kx, medium pairs, and missed draws.', 'После чек-коллов: Qx, Kx, средние пары и промазавшие дро.']
    ,['Checking is reasonable against a player who rarely folds one pair.', 'Допустим против игрока, который редко фолдит одну пару.']
    ,['A large polarized bet can fold out a meaningful portion of Qx and pairs without blocking your own wins.', 'Крупный полярный бет может выбить значительную часть Qx/пар без блокировки твоего выигрыша.']
    ,['Do not bluff a calling station; check and give up.', 'Против calling station не блефуй: чек и сдавайся.']
    ,['Turn: combo draw versus an all-in', 'Тёрн: комбодро против олл-ина']
    ,['An aggressive opponent moves almost all-in for $145 into $150.', 'Агрессивный соперник идёт почти олл-ин $145 в банк $150.']
    ,['A flush draw plus an open-ended straight draw creates many overlapping but strong outs.', 'Флеш-дро плюс двусторонний стрит-дро создают много пересекающихся, но сильных аутов.']
    ,['Do not blindly add 9+8: some spades complete both the straight and the flush.', 'Не складывай 9+8 вслепую: часть пик одновременно закрывает и стрит, и флеш.']
    ,['Combine outs by specific card so the same card is never counted twice.', 'Ауты нужно объединять по конкретным картам, чтобы не считать одни и те же карты дважды.']
    ,['Strong made hands and strong draws. An aggressive player can also have semibluffs.', 'Сильные готовые руки и сильные дро. Против агрессивного игрока возможны и полублефы.']
    ,['Gives up too much of the pot at a good price.', 'Отказывается от слишком большой доли банка при хорошей цене.']
    ,['With correctly deduplicated outs, the combo draw usually has enough equity.', 'При корректном дедуплицированном подсчёте комбодро обычно имеет достаточно эквити.']
    ,['Discount any outs that give the opponent a higher flush.', 'Если часть аутов даёт сопернику более высокий флеш, их нужно дисконтировать.']
    ,['River: top pair versus an overbet', 'Ривер: топ-пара против овербета']
    ,['A tight player bets $180 into $120.', 'Тайтовый игрок ставит $180 в банк $120.']
    ,['An overbet from a tight player requires a very strong bluff-catching range.', 'Овербет от тайтового игрока требует очень сильного bluff-catching диапазона.']
    ,['Larger bets need fewer bluffs in theory, but a live NIT still tends to underbluff.', 'Чем больше ставка, тем меньше блефов нужно теоретически, но live NIT часто всё равно недоблефовывает.']
    ,['KQ looks strong in absolute terms but performs poorly against a polarized range of AK, sets, and two pair.', 'KQ выглядит сильно в абсолюте, но плохо стоит против полярного диапазона AK/сетов/двух пар.']
    ,['Strong value and very few natural missed draws.', 'Сильное вэлью и очень мало естественных промазавших дро.']
    ,['Correct exploit against a shortage of bluffs.', 'Эксплойтно правильно против недостатка блефов.']
    ,['Requires evidence that the opponent can overbet with air.', 'Требует доказательств, что соперник способен овербетить воздух.']
    ,['Against a WILD player with known overbet bluffs, KQ can become a call.', 'Против WILD с известными овербет-блефами KQ может стать коллом.']
    ,['Turn: nut flush draw and price', 'Тёрн: натсовое флеш-дро и цена']
    ,['A passive opponent bets $25 into $100. One card remains.', 'Пассивный соперник ставит $25 в банк $100. Осталась одна карта.']
    ,['The nut flush draw gets the direct price: the call needs about 16.7%, and one of nine spades arrives about 19.6% of the time.', 'Натсовое флеш-дро получает прямую цену: для колла нужно около 16.7%, а девять пик приходят примерно в 19.6% случаев.']
    ,['Do not use the “multiply by four” rule on the turn; only one card remains.', 'На тёрне не используй правило «умножить на четыре»: осталась только одна карта.']
    ,['The nine flush outs are strong. Aces can be additional conditional outs, but do not guarantee a win.', 'Девять флеш-аутов — сильные. Тузы могут быть дополнительными условными аутами, но не гарантируют победу.']
    ,['Strong Kx, sets, pocket pairs, and some draws. A passive player makes a semibluff raise less attractive.', 'Сильные Kx, сеты, карманные пары и часть дро. Пассивный тип делает рейз-полублеф менее привлекательным.']
    ,['Folding gives up a profitable direct price.', 'Фолд отдаёт прибыльную прямую цену.']
    ,['Calling realizes the nut draw cheaply and keeps weaker hands in the opponent’s range.', 'Колл дешёво реализует натсовое дро и сохраняет слабые руки соперника.']
    ,['A semibluff is possible, but a passive betting range is usually stronger and folds less often.', 'Полублеф возможен, но пассивный диапазон ставки обычно сильнее и реже фолдит.']
    ,['If the bet were $75 into the same pot, nine outs would no longer have the direct price without implied odds.', 'Если ставка была бы $75 в тот же банк, прямых пот-оддсов для девяти аутов уже не хватало бы без implied odds.']
    ,['Flop: gutshot and two overcards', 'Флоп: гатшот и две оверкарты']
    ,['A regular bets $20 into $60. Effective stack $260.', 'Регуляр ставит $20 в банк $60. Эффективный стек $260.']
    ,['Four tens complete the nut straight; aces and kings make conditional pairs. The small bet leaves enough equity to call.', 'Четыре десятки закрывают натсовый стрит; A и K дают условные пары. Маленькая ставка оставляет достаточно эквити для колла.']
    ,['Do not count all ten cards as clean outs: an ace or king can improve the opponent to two pair or already be dominated.', 'Не складывай все десять карт как чистые ауты: A и K иногда улучшают соперника до двух пар или уже доминированы.']
    ,['The clean foundation is four tens. Discount the six overcards and verify with equity against the range.', 'Чистая основа — четыре десятки. Шесть оверкарт нужно дисконтировать и проверять через эквити против диапазона.']
    ,['Qx, Jx, sets, medium pairs, and straight draws. Against the full range, AK has more equity than the four clean outs alone suggest.', 'Qx, Jx, сеты, средние пары и стрит-дро. Против всего диапазона AK имеет больше эквити, чем показывают только четыре чистых аута.']
    ,['Too tight against a one-third-pot bet.', 'Слишком тайтово против ставки треть банка.']
    ,['Calling keeps bluffs in and realizes equity in position.', 'Колл сохраняет блефы и реализует эквити в позиции.']
    ,['A semibluff is possible but not mandatory; part of the opponent’s range continues comfortably.', 'Полублеф возможен, но не обязателен: часть диапазона соперника хорошо продолжает.']
    ,['Against a large bet and a tight range, the conditional ace and king outs lose value.', 'Против крупной ставки и тайтового диапазона условные A/K становятся менее ценными.']
    ,['Turn: set on a four-straight board', 'Тёрн: сет на четырёхстритовой доске']
    ,['A calling station bets $70 into $120 on a turn that completes many straights.', 'Calling station ставит $70 в банк $120 на тёрне, который закрыл много стритов.']
    ,['A set still has substantial equity and a full-house redraw, but raising often isolates you against made straights.', 'Сет всё ещё имеет высокое эквити и redraw к фулл-хаусу, но рейз часто изолирует против готовых стритов.']
    ,['A board card that completes a straight for you is not automatically a clean out against the range.', 'Карта, которая делает тебе стрит на общей доске, не обязательно является чистым аутом против диапазона.']
    ,['The ten full-house/quads cards are stronger than a five or ten, which makes the board even more coordinated and may only chop or lose.', 'Десять карт к фулл-хаусу/каре сильнее, чем 5/T, которые создают ещё более координированную доску и могут лишь делить банк или проигрывать.']
    ,['Made straights, two pair, pair-plus-draw hands, sets, and flush draws. A station does not bet only the nuts.', 'Готовые стриты, две пары, пары+дро, сеты и флеш-дро. Station способен ставить не только натс.']
    ,['Too tight with a set, a redraw, and a healthy share of the pot.', 'Слишком тайтово с сетом, redraw и хорошей долей банка.']
    ,['Keeps bluffs and worse hands in without inflating the pot against straights.', 'Сохраняет блефы и худшие руки, не раздувая банк против стритов.']
    ,['Value from worse is possible, but a large raise is often continued against by the strongest part of the range.', 'Вэлью от худших возможно, но крупный рейз часто получает продолжение от очень сильной части диапазона.']
    ,['On a paired river, value-bet aggressively; on an unpaired five or ten, control the pot more often.', 'На спарившемся ривере можно агрессивно добирать; на 5/T без спаривания чаще контролируй банк.']
    ,['River: overpair versus an aggressive bet', 'Ривер: оверпара против агрессивной ставки']
    ,['An aggressive opponent bets $90 into $160 after your turn check.', 'Агрессивный соперник ставит $90 в банк $160 после твоего чека на тёрне.']
    ,['QQ beats every Jx hand and missed draw; against a wide aggressive range this is a confident bluff-catch.', 'QQ бьёт все Jx и промазавшие дро; против широкого агрессивного диапазона это уверенный bluff-catch.']
    ,['Count worse combinations that bet, not only sets and two pair.', 'Считай комбинации хуже, которые ставят, а не только сеты и две пары.']
    ,['After your check, the opponent is incentivized to bet Jx thinly and turn missed T9/96/65 into bluffs.', 'После твоего чека соперник получает стимул ставить Jx тонко и превращать промазавшие T9/96/65 в блеф.']
    ,['Stronger value: sets and two pair. Worse value: Jx. Bluffs: missed straight draws and overcards.', 'Вэлью сильнее: сеты и две пары. Вэлью хуже: Jx. Блефы: промазавшие стрит-дро и оверкарты.']
    ,['Folds a hand that is too strong against a player with a high bluff frequency.', 'Отдаёт слишком сильную руку против игрока с высокой частотой блефа.']
    ,['Keeps bluffs and worse value in.', 'Сохраняет блефы и худшее вэлью.']
    ,['Worse hands almost always fold, while better hands continue.', 'Худшие руки почти всегда выбросят, а лучшие продолжат.']
    ,['Against a NIT using the same line and size, folding would be much closer.', 'Против NIT с той же линией и размером фолд был бы значительно ближе.']
    ,['Available', 'Доступен']
    ,['In progress', 'В процессе']
    ,['Completed', 'Завершён']
    ,['Locked', 'Заблокирован']
    ,['Coming soon', 'Скоро']
    ,['Correct.', 'Верно.']
    ,['Review this topic.', 'Нужно повторить.']
    ,['Answers and ranges stay hidden: this diagram explains only the selected seat.', 'Ответы и диапазоны не раскрываются: схема объясняет только выбранное место.']
    ,['Turn sound off', 'Выключить звук']
    ,['Turn sound on', 'Включить звук']
    ,['🔊 Sound', '🔊 Звук']
    ,['🔇 Muted', '🔇 Без звука']
    ,['{current}/{target} lessons • best exam {percent}%', '{current}/{target} уроков • лучший экзамен {percent}%']
    ,['Sequential course', 'Последовательный курс']
    ,['Learning', 'Обучение']
    ,['Short lessons, practice, and an exam. The answer appears only after you choose.', 'Короткие уроки, практика и экзамен. Ответ появляется только после твоего выбора.']
    ,['Open lesson', 'Открыть урок']
    ,['Mini-task {count}', 'Мини-задание {count}']
    ,['Interactive diagram', 'Интерактивная схема']
    ,['‹ All modules', '‹ Все модули']
    ,['Module {count}', 'Модуль {count}']
    ,['Lessons', 'Уроки']
    ,['Exam', 'Экзамен']
    ,['Passing score', 'Порог']
    ,['Hand examples', 'Примеры раздач']
    ,['Mini-tasks', 'Мини-задания']
    ,['Retake exam', 'Повторить экзамен']
    ,['Start exam', 'Начать экзамен']
    ,['{label} • {count} questions', '{label} • {count} вопросов']
    ,['‹ Back to module', '‹ К модулю']
    ,['Trainer tip', 'Подсказка тренера']
    ,['Lesson complete — return', 'Урок завершён — вернуться']
    ,['I finished this lesson', 'Я изучил урок']
    ,['Mini-task', 'Мини-задание']
    ,['Continue', 'Продолжить']
    ,['‹ Exit exam', '‹ Выйти из экзамена']
    ,['Exam progress {percent}%', 'Прогресс экзамена {percent}%']
    ,['Finish exam', 'Завершить экзамен']
    ,['Next question', 'Следующий вопрос']
    ,['No mistakes — excellent work.', 'Ошибок нет — отличная работа.']
    ,['Module passed', 'Модуль пройден']
    ,['Review required', 'Нужно повторить']
    ,['Result: {percent}%', 'Результат: {percent}%']
    ,['The passing score is {percent}%.', 'Проходной результат — {percent}%.']
    ,['Mistakes by topic', 'Ошибки по темам']
    ,['Back to module', 'К модулю']
    ,['Best action.', 'Лучшее действие.']
    ,['You chose: {selected}. Preferred line: {recommended}.', 'Ты выбрал: {selected}. Предпочтительная линия: {recommended}.']
    ,['Coach review', 'Разбор Coach']
    ,['Strong decision', 'Сильное решение']
    ,['Marginal decision', 'Пограничное решение']
    ,['Mistake found', 'Есть ошибка']
    ,['Coach recommendation', 'Рекомендация Coach']
    ,['Excellent', 'Отлично']
    ,['Good', 'Хорошо']
    ,['Acceptable', 'Допустимо']
    ,['Mistake', 'Ошибка']
    ,['Serious mistake', 'Серьёзная ошибка']
    ,['Not enough data', 'Недостаточно данных']
    ,['Not enough data for a fair decision evaluation.', 'Недостаточно данных для честной оценки решения.']
    ,['Required for Call: {value}', 'Нужно для Call: {value}']
    ,['Required for Call', 'Нужно для Call']
    ,['Strong outs: {count}', 'Сильные outs: {count}']
    ,['Conditional outs: {count}', 'Условные outs: {count}']
    ,['Next-card hit: {value}', 'Попадание следующей картой: {value}']
    ,['Hit by river: {value}', 'Попадание к river: {value}']
    ,['EV Call versus Fold: {value}', 'EV Call относительно Fold: {value}']
    ,['EV Call versus Fold', 'EV Call относительно Fold']
    ,['Good decision: {action}', 'Хорошее решение: {action}']
    ,['Playable line: {action}', 'Рабочая линия: {action}']
    ,['Better play: {action}', 'Лучше сыграть: {action}']
    ,['Best action: {action}', 'Лучшее действие: {action}']
    ,['Raise to ${amount}', 'Raise до ${amount}']
    ,['Key factors', 'Ключевые факторы']
    ,['What would change the decision', 'Что изменило бы решение']
    ,['Remember', 'Запомнить']
    ,['Math', 'Математика']
    ,['Decision quality: {score}, {label}, grade {grade}', 'Качество решения: {score}, {label}, оценка {grade}']
    ,['Excellent decision', 'Отличное решение']
    ,['Good decision', 'Хорошее решение']
    ,['Acceptable decision', 'Допустимое решение']
    ,['You chose the Trainer’s primary action.', 'Вы выбрали основное действие тренера.']
    ,['You chose an acceptable alternative{detail}', 'Вы выбрали допустимую альтернативу{detail}']
    ,['The selected action differs from the Trainer’s main recommendation.', 'Выбранное действие расходится с основной рекомендацией тренера.']
    ,['The size is close to the recommendation.', 'Размер близок к рекомендованному.']
    ,['The size is acceptable but differs noticeably from the target.', 'Размер допустим, но заметно отличается от ориентира.']
    ,['The size differs substantially from the recommended target.', 'Размер существенно отличается от рекомендованного ориентира.']
    ,['The action agrees with the available numeric call EV.', 'Действие согласуется с доступным числовым EV колла.']
    ,['The action does not use the advantage shown by the available numeric call EV.', 'Действие не использует преимущество доступного числового EV колла.']
    ,['The exact EV estimate conflicts with the selected decision.', 'Точная EV-оценка противоречит выбранному решению.']
    ,['The decision is marginal: a small range or context change could alter the recommendation.', 'Решение пограничное: небольшое изменение диапазона или контекста может изменить рекомендацию.']
    ,['Model confidence is low, so the score is deliberately compressed.', 'Уверенность модели низкая, поэтому оценка намеренно сжата.']
    ,['Available equity exceeds the price to continue in the current model.', 'Доступная equity превышает цену продолжения в текущей модели.']
    ,['Available equity is insufficient for the current price to continue.', 'Доступной equity не хватает для заданной цены продолжения.']
    ,['{action}: available equity exceeds the price to continue in the current model.', '{action}: доступная equity превышает цену продолжения в текущей модели.']
    ,['{action}: available equity is insufficient for the current price to continue.', '{action}: доступной equity не хватает для заданной цены продолжения.']
    ,['Confidence is high here: the decision is far from the boundary in the current model.', 'Здесь уверенность высокая: решение находится далеко от границы текущей модели.']
    ,['Confidence is moderate: the line is preferred, but the spot is not completely clear-cut.', 'Уверенность средняя: линия предпочтительна, но ситуация не полностью однозначная.']
    ,['This is a marginal spot: a small range, bet-size, or context change could alter the recommendation.', 'Это пограничный spot: небольшое изменение диапазона, размера ставки или контекста может поменять рекомендацию.']
    ,['The current Call EV estimate is {value} relative to Fold in this model.', 'Готовая EV-оценка Call — {value} относительно Fold в этой модели.']
    ,['Call needs about {required}, while the current model gives about {equity}—there is a mathematical cushion.', 'Для Call нужно около {required}, а готовая модель даёт около {equity} — математический запас есть.']
    ,['Call needs about {required}, while the current model gives about {equity}—there is no mathematical cushion.', 'Для Call нужно около {required}, а готовая модель даёт около {equity} — математический запас отсутствует.']
    ,['The current made hand is {hand}; its quality determines whether to play for value or control the pot.', 'Текущая готовая рука — {hand}; её качество определяет, можно ли играть на value или нужен контроль банка.']
    ,['The final board is connected: made straights and two pair are possible, but no future draws remain.', 'Финальная доска связанная: готовые straight и две пары возможны, но будущих draw уже нет.']
    ,['A different bet size changes pot odds and can move the decision closer to the boundary.', 'Другой размер ставки меняет pot odds и может приблизить решение к границе.']
    ,['A different board texture changes the number of strong continuations and the value of protection.', 'Другая текстура доски меняет число сильных продолжений и ценность защиты.']
    ,['Connect made-hand strength with board texture, position, and the price to continue.', 'Связывай силу готовой руки с текстурой доски, позицией и ценой продолжения.']
    ,['top pair with a strong kicker', 'top pair с сильным kicker']
    ,['top pair with a weak kicker', 'top pair со слабым kicker']
    ,['overpair', 'оверпара']
    ,['underpair', 'нестаршая пара']
    ,['dynamic board', 'динамичная доска']
    ,['dry board', 'сухая доска']
    ,['What happened:', 'Что произошло:']
    ,['Decision Quality {score} out of 100, grade {grade}, {label}.', 'Decision Quality {score} из 100, оценка {grade}, {label}.']
    ,['You selected the Trainer’s primary action.', 'Вы выбрали основное действие тренера.']
    ,['hand', 'рука']
    ,['premium pair', 'премиальная пара']
    ,['medium pocket pair', 'средняя карманная пара']
    ,['small pocket pair', 'малая карманная пара']
    ,['suited broadway', 'одномастный broadway']
    ,['offsuit broadway', 'разномастный broadway']
    ,['suited ace', 'одномастный туз']
    ,['suited king', 'одномастный king']
    ,['weak offsuit king', 'слабый разномастный king']
    ,['weak offsuit ace', 'слабый разномастный туз']
    ,['suited connector', 'одномастный коннектор']
    ,['suited gapper', 'одномастный gapper']
    ,['weak offsuit hand', 'слабая разномастная рука']
    ,['early position {position}', 'ранняя позиция {position}']
    ,['middle position {position}', 'средняя позиция {position}']
    ,['late position {position}', 'поздняя позиция {position}']
    ,['blind {position}', 'блайнд {position}']
    ,['The pot is unopened: this decision uses the baseline first-in range.', 'Банк не открыт: решение относится к базовому диапазону первого входа.']
    ,['{count} limper(s) are already in the pot, so an isolation raise must account for multiway risk.', '{count} лимпер(а) уже вошли в банк, поэтому изоляция должна учитывать риск multiway-игры.']
    ,['A raise has already been made before Hero, so continuing requires a stronger range than in an unopened pot.', 'Перед Hero уже был рейз, поэтому нужен более сильный диапазон продолжения, чем в неоткрытом банке.']
    ,['Hero faces a 3-bet: continuing requires a substantially stronger hand and attention to effective stack.', 'Hero столкнулся с 3-bet: продолжение требует заметно более сильной руки и учёта effective stack.']
    ,['Hero faces a 3-bet', 'Hero столкнулся с 3-bet']
    ,['Hero is deciding against an existing bet.', 'Hero принимает решение против уже сделанной ставки.']
    ,['Hero is not facing a bet, so the choice is between Check and Bet.', 'Перед Hero нет ставки, поэтому выбор идёт между Check и Bet.']
    ,['{hand} is a premium pair: it is far ahead of most continuing hands and suits aggressive play.', '{hand} — премиальная пара: она далеко впереди большинства рук продолжения и подходит для агрессивного розыгрыша.']
    ,['{hand} is a premium pair: it is far ahead of most continuing hands and should continue.', '{hand} — премиальная пара: она далеко впереди большинства рук продолжения и подходит для продолжения.']
    ,['{hand} is a medium pocket pair with made showdown value, but its vulnerability depends on position and prior action.', '{hand} — средняя карманная пара с готовым showdown value, но её уязвимость зависит от позиции и предыдущего действия.']
    ,['{hand} is a small pocket pair: without the right context it struggles under pressure from overcards.', '{hand} — малая карманная пара: без подходящего контекста ей трудно выдерживать давление старших карт.']
    ,['{hand} is a suited ace: suited potential creates more strong draws and improves playability.', '{hand} — одномастный туз: suited-потенциал даёт больше сильных draw и улучшает playability.']
    ,['{hand} is a suited king: the suited version makes flush draws more often and realizes its potential better than offsuit.', '{hand} — одномастный king: suited-версия чаще получает flush draw и лучше реализует потенциал, чем offsuit.']
    ,['{hand} is a weak offsuit king: the kicker is weak and better Kx hands create domination risk.', '{hand} — слабый offsuit king: kicker слабый, а лучшие Kx часто создают риск доминации.']
    ,['{hand} is a weak offsuit ace: the ace looks attractive, but the weak kicker is often dominated.', '{hand} — слабый offsuit ace: туз выглядит привлекательно, но слабый kicker часто оказывается доминирован.']
    ,['{hand} is a suited connector: consecutive cards can make strong straight and flush draws.', '{hand} — одномастный коннектор: последовательные карты могут собирать сильные straight и flush draw.']
    ,['{hand} is a suited gapper: suited potential helps, but the gap reduces strong straight-draw frequency.', '{hand} — одномастный gapper: suited-потенциал помогает, но разрыв снижает частоту сильных straight draw.']
    ,['{hand} is suited broadway with good connectivity and suited potential.', '{hand} — одномастный broadway с хорошей связностью и suited-потенциалом.']
    ,['{hand} is offsuit broadway: the high cards are strong, but the lack of suited potential lowers playability.', '{hand} — разномастный broadway: высокие карты сильны, но отсутствие suited-потенциала снижает playability.']
    ,['{hand} is a weak offsuit combination without enough connectivity or suited potential.', '{hand} — слабая offsuit-комбинация без достаточной связности и suited-потенциала.']
    ,['Hand class {hand} is matched to the existing Trainer recommendation.', 'Класс руки {hand} сопоставлен с существующей рекомендацией Trainer.']
    ,['Hand strength is accounted for by the existing Trainer recommendation.', 'Сила руки учитывается существующей рекомендацией Trainer.']
    ,['{position}: many players remain after Hero, so the range must be tighter.', '{position}: после Hero остаётся много игроков, поэтому диапазон должен быть уже.']
    ,['{position}: fewer players remain than from UTG, but weak hands still encounter resistance often.', '{position}: игроков позади меньше, чем из UTG, но слабые руки всё ещё часто получают сопротивление.']
    ,['BTN is the latest position: fewer players remain and more postflop decisions are made in position.', 'BTN — самая поздняя позиция: меньше игроков позади и больше постфлоп-решений принимаются в позиции.']
    ,['{position}: the range is wider than early position, but players still remain after Hero.', '{position}: диапазон шире ранних позиций, но после Hero ещё остаются игроки.']
    ,['{position}: the preflop price may be better, but Hero often plays out of position postflop.', '{position}: префлоп-цена может быть лучше, но постфлоп Hero часто играет без позиции.']
    ,['combo draw', 'комбо-дро']
    ,['flush draw', 'флеш-дро']
    ,['straight draw', 'стрит-дро']
    ,['The board is paired: ordinary one-pair strength and draw cleanliness require more caution.', 'Доска спаренная: сила обычных one-pair рук и чистота draw требуют большей осторожности.']
    ,['The monotone board already supports made flushes and makes continuing ranges more polarized.', 'Монотонная доска уже поддерживает готовые flush и делает продолжение диапазонов более полярным.']
    ,['The board is two-tone and connected: both flush draws and many straight draws are possible.', 'Доска two-tone и связанная: здесь одновременно возможны flush draw и многочисленные straight draw.']
    ,['The board is two-tone: two cards of one suit create real flush draws, so the flop is not completely dry.', 'Доска two-tone: две карты одной масти создают реальные flush draw, поэтому flop не считается полностью сухим.']
    ,['The board is connected and dynamic: many straight/flush draws and strong continuations are possible.', 'Доска связанная и динамичная: возможны многочисленные straight/flush draw и сильные продолжения.']
    ,['The board is dry and calm: made hands need less protection.', 'Доска сухая и спокойная: готовые руки реже нуждаются в большой защите.']
    ,['A short effective stack turns the continuation into ALL-IN instead of an intermediate raise or Call.', 'Короткий effective stack превращает продолжение в ALL-IN вместо промежуточного рейза или Call.']
    ,['short effective stack', 'короткий effective stack']
    ,['The pot is multiway: marginal hands realize their potential less effectively.', 'В банке несколько соперников: marginal-руки хуже реализуют свой потенциал multiway.']
    ,['multiway: {count} opponents', 'multiway: {count} соперника']
    ,['The recommendation follows the current validated Trainer range for this context.', 'Рекомендация следует текущему проверенному диапазону Trainer для этого контекста.']
    ,['The suited {hand} version gains more flush draws and usually plays wider.', 'Suited-версия {hand} получает больше flush draw и обычно играет шире.']
    ,['BTN ranges are wider because fewer players remain behind.', 'С BTN диапазон шире, потому что игроков позади меньше.']
    ,['Against one limper, the decision can be more aggressive than against several.', 'Против одного лимпера решение может быть агрессивнее, чем против нескольких.']
    ,['A smaller opening size or later opener position can make continuing closer.', 'Меньший размер открытия или более поздняя позиция рейзера могут сделать продолжение ближе.']
    ,['With a deeper effective stack, Trainer can preserve room for a Call or a standard raise.', 'При более глубоком effective stack Trainer может оставить место для Call или обычного рейза.']
    ,['Weak offsuit Kx often win small pots but lose large ones to better Kx; suited versions can be played wider.', 'Слабые offsuit Kx часто выигрывают маленькие банки, но проигрывают крупные лучшим Kx; suited-версии можно играть шире.']
    ,['A suited ace is valuable for more than the ace: nut-flush potential improves playability.', 'Suited ace ценен не только тузом: nut-flush потенциал улучшает playability.']
    ,['Suited connectors are stronger in position and at the right price; alone they do not justify every Call.', 'Suited connectors сильнее в позиции и при подходящей цене; сами по себе они не оправдывают любой Call.']
    ,['With a premium pair, building the pot is usually more important than disguising strength at the cost of lost value.', 'С премиальной парой обычно важнее строить банк, чем маскировать силу ценой упущенного value.']
    ,['First identify position and the action before Hero, then match the hand to the continuing range.', 'Сначала определяй позицию и действие перед Hero, затем сопоставляй руку с диапазоном продолжения.']
    ,['{action} — baseline Trainer line for {hand} ({category}) from {position}.', '{action} — базовая линия Trainer для {hand} ({category}) из позиции {position}.']
    ,['{hand} is a premium pair. {action} preserves value and matches the current Trainer model.', '{hand} — премиальная пара. {action} сохраняет value и соответствует текущей модели Trainer.']
    ,['{hand} is a weak offsuit king: a weak kicker and domination risk make Fold a calm baseline decision.', '{hand} — слабый разномастный king: слабый kicker и риск доминации делают Fold спокойным базовым решением.']
    ,['Decision Quality {score} ({grade}) reflects how the action and sizing match the current Trainer recommendation.', 'Decision Quality {score} ({grade}) отражает совпадение действия и размера с готовой рекомендацией Trainer.']
    ,['Decision Quality {score} reflects how the action and sizing match the current Trainer recommendation.', 'Decision Quality {score} отражает совпадение действия и размера с готовой рекомендацией Trainer.']
    ,['Hero is in position (IP): more information helps control pot size.', 'Hero в позиции (IP): больше информации помогает контролировать размер банка.']
    ,['Hero is out of position (OOP): realizing hand potential and controlling the pot is harder.', 'Hero без позиции (OOP): сложнее реализовать потенциал руки и контролировать pot.']
    ,['The line follows the established Trainer recommendation and the actual hand context.', 'Линия следует готовой рекомендации Trainer и фактическому контексту раздачи.']
    ,['The current hand', 'текущая рука']
    ,['Heads-up, the same made hand or draw usually keeps more relative strength.', 'Heads-up такая же made hand или draw обычно сохраняет больше относительной силы.']
    ,['In position, a marginal line realizes its potential more easily.', 'В позиции marginal-линия реализует потенциал руки проще.']
    ,['A different validated opponent-range model can change the available equity.', 'Другая подтверждённая модель диапазона соперника может изменить доступную equity.']
    ,['heads-up', 'heads-up']
    ,['IP position', 'позиция IP']
    ,['OOP', 'без позиции OOP']
    ,['With a draw, compare available equity with pot odds; the number of outs alone does not guarantee a profitable continuation.', 'С draw сравнивай готовую equity и pot odds; число outs само по себе ещё не гарантирует прибыльное продолжение.']
    ,['In a multiway pot, one pair has less relative strength, so value and bluff-catches need a larger cushion.', 'В multiway pot относительная сила одной пары ниже, поэтому value и bluff-catch требуют большего запаса.']
    ,['Quick test', 'Быстрый тест']
    ,['Effective stack ${amount}', 'Эффективный стек ${amount}']
    ,['{opener} opens to ${amount}.', '{opener} открывает до ${amount}.']
    ,['What should you do?', 'Что делать?']
    ,['{opener} opens to ${amount}. What should you do?', '{opener} открывает до ${amount}. Что делать?']
    ,['Test result', 'Результат теста']
    ,['Accuracy by category', 'Точность по категориям']
    ,['Answer at least one hand.', 'Ответь хотя бы на одну руку.']
    ,['Everyone folds to you.', 'Все выбросили до тебя.']
    ,['Everyone folds to you. What should you do?', 'Все выбросили до тебя. Что делать?']
    ,['{hand} is inside the baseline live opening range from {position}.', '{hand} входит в базовый live-диапазон открытия из {position}.']
    ,['{hand} is outside the baseline {position} range.', '{hand} находится за пределами базового диапазона {position}.']
    ,['Position allows this combination to open profitably against a typical $1/$3 table.', 'Позиция позволяет открывать эту комбинацию прибыльно против типичного $1/$3 стола.']
    ,['Enough players remain behind, and the hand is often dominated or realizes equity poorly.', 'За спиной достаточно игроков, а рука часто доминирована или плохо реализует эквити.']
    ,['{count} limper before you.', '{count} лимпер до тебя.']
    ,['{count} limpers before you.', '{count} лимпера до тебя.']
    ,['{count} limper before you. What should you do?', '{count} лимпер до тебя. Что делать?']
    ,['{count} limpers before you. What should you do?', '{count} лимпера до тебя. Что делать?']
    ,['The hand can isolate weak ranges.', 'Рука подходит для изоляции слабых диапазонов.']
    ,['Multiway risk and domination make entering unprofitable.', 'Мультипот и риск доминации делают вход убыточным.']
    ,['Isolation size: about $12 plus $3 per limper, adjusted for the table.', 'Изоляционный размер: примерно $12 плюс $3 за каждого лимпера, с поправкой на стол.']
    ,['The hand is strong enough to 3-bet for value and initiative.', 'Рука достаточно сильна для 3-бета на вэлью/инициативу.']
    ,['The hand belongs in the continuing range but does not have to inflate the pot.', 'Рука входит в диапазон продолжения, но не обязана раздувать банк.']
    ,['This hand realizes equity too poorly against that opening range.', 'Против этого открытия рука недостаточно хорошо реализует эквити.']
    ,['The earlier the opening position, the stronger its range and the tighter your defense.', 'Чем раньше позиция открытия, тем сильнее его диапазон и уже твоя защита.']
    ,['You opened to $12 and faced a 3-bet to $42.', 'Ты открылся до $12 и получил 3-бет до $42.']
    ,['You opened to $12 and faced a 3-bet to $42. What should you do?', 'Ты открылся до $12 и получил 3-бет до $42. Что делать?']
    ,['A premium hand can 4-bet for value.', 'Премиальная рука может 4-бетить на вэлью.']
    ,['The hand keeps dominated combinations in and realizes equity in position.', 'Рука сохраняет доминируемые комбинации и реализует эквити в позиции.']
    ,['This hand is dominated too often against a 3-bet.', 'Против 3-бета эта рука слишком часто доминирована.']
    ,['Account for position, 3-bet size, and effective stack; do not defend only because you already invested $12.', 'Учитывай позицию, размер 3-бета и эффективный стек; не защищайся только потому, что уже вложил $12.']
    ,['Focus: {topic}', 'Фокус: {topic}']
    ,['Next hand', 'Следующая рука']
    ,['Learning range: {range}', 'Учебный диапазон: {range}']
    ,['Baseline line: {action}.', 'Базовая линия: {action}.']
    ,['View result', 'Посмотреть результат']
    ,['First-in opening', 'Открытие первым']
    ,['Against limpers', 'Против лимперов']
    ,['Against a raise', 'Против рейза']
    ,['Against a 3-bet', 'Против 3-бета']
    ,['Wild', 'Хаотичный']
    ,['New hand', 'Новая раздача']
    ,['⅓ pot', '⅓ банка']
    ,['½ pot', '½ банка']
    ,['¾ pot', '¾ банка']
    ,['Confirm ${amount}', 'Подтвердить ${amount}']
    ,['✦ Coach', '✦ Тренер']
    ,['Hidden card', 'Скрытая карта']
    ,['Dealing cards', 'Раздача карт']
    ,['Cards are moving into position', 'Карты занимают свои места']
    ,['Your decision', 'Твоё решение']
    ,['Choose a line · ${amount} to call', 'Выбери линию · к коллу ${amount}']
    ,['You can check', 'Можно чек']
    ,['Hero is observing the rest of the hand.', 'Hero наблюдает за продолжением раздачи.']
    ,['The table is preparing the next hand', 'Стол готовит следующую раздачу']
    ,['Hand result saved · next hand soon', 'Итог раздачи сохранён · следующая скоро']
    ,['Observing the table', 'Наблюдение за столом']
    ,['You folded · watch the opponents’ actions', 'Ты сфолдил · следи за действиями соперников']
    ,['Opponent’s turn', 'Ход соперника']
    ,['Waiting for the player to act', 'Ожидаем действие игрока']
    ,['Hand complete', 'Раздача завершена']
    ,['Session paused', 'Сессия на паузе']
    ,['Resume the session when you are ready', 'Продолжи сессию, когда будешь готов']
    ,['Choose a line · Check is available', 'Выбери линию · можно Check']
    ,['Medium', 'Средний']
    ,['Low', 'Низкий']
    ,['Showdown', 'Шоудаун']
    ,['flop', 'флоп']
    ,['turn', 'тёрн']
    ,['river', 'ривер']
    ,['Advanced', 'Продвинутая']
    ,['Intermediate', 'Средний уровень']
    ,['Beginner', 'Новичок']
    ,['Learning', 'Ученик']
    ,['Advanced', 'Продвинутый']
    ,['Expert', 'Эксперт']
    ,['Master', 'Мастер']
    ,['Grandmaster', 'Гроссмейстер']
    ,['Elite', 'Элита']
    ,['Legend', 'Легенда']
    ,['{count} decisions', '{count} решений']
    ,['{count} decisions · provisional', '{count} решений · предварительно']
    ,['{skill}: {score} / 100', '{skill}: {score} / 100']
    ,['{count} attempt · Limited data', '{count} attempt · Мало данных']
    ,['{count} attempts · Limited data', '{count} attempts · Мало данных']
    ,['{count} attempt · Limited data', '{count} попытка · Мало данных']
    ,['{count} attempts · Limited data', '{count} попытки · Мало данных']
    ,['{count} attempts · Limited data', '{count} попыток · Мало данных']
    ,['Counted today', 'Сегодня уже засчитано']
    ,['Decision rated', 'Решение оценено']
    ,['Scenario completed', 'Сценарий завершён']
    ,['Training scenarios', 'Тренировочные сценарии']
    ,['Training scenarios: {count}, {percent}%', 'Тренировочные сценарии: {count}, {percent}%']
    ,['Trainer decisions', 'Решения Trainer']
    ,['Trainer decisions: {count}, {percent}%', 'Решения Trainer: {count}, {percent}%']
    ,['Trainer decision rated', 'Решение Trainer оценено']
    ,['No XP', 'Без XP']
    ,['Training scenario completed', 'Сценарий тренировки завершён']
    ,['No achievements in this category yet.', 'В этой категории пока нет достижений.']
    ,['Foundation for future ratings', 'Основа будущих оценок']
    ,['Decision Quality {score} out of 100, {grade}.', 'Decision Quality {score} из 100, {grade}.']
    ,['Poker IQ {score}, rank {rank}. Provisional Poker IQ · {current} of {target} decisions.', 'Poker IQ {score}, ранг {rank}. Предварительный Poker IQ · {current} из {target} решений.']
    ,['— Not enough data', '— Недостаточно данных']
    ,['Provisional Poker IQ · {current} of {target} decisions', 'Предварительный Poker IQ · {current} из {target} решений']
    ,['{rank} rank progress: {percent}%', 'Прогресс ранга {rank}: {percent}%']
    ,['{count} IQ to “{rank}”', '{count} IQ до ранга «{rank}»']
    ,['Consistency', 'Стабильность']
    ,['Poker IQ by street', 'Poker IQ по улицам']
    ,['Provisional rating · {count} decisions', 'Предварительная оценка · {count} реш.']
    ,['Decisions', 'Решений']
    ,['Best session', 'Лучшая сессия']
    ,['Hands played', 'Сыграно раздач']
    ,['Sessions played', 'Сыграно сессий']
    ,['Decisions made', 'Принято решений']
    ,['Best exam', 'Лучший экзамен']
    ,['Day streak', 'Серия дней']
    ,['First Hand', 'Первая раздача']
    ,['10 Correct Decisions', '10 правильных решений']
    ,['3-Day Streak', 'Серия 3 дня']
    ,['100 Hands Played', '100 сыгранных раздач']
    ,['{count} rated decisions—the sample is still forming. Not enough data for a trend yet. Weakest street: {street} — {score}. This is an additional signal; the weak-topic plan is still based on actual mistakes.', '{count} оценённых решений — выборка пока формируется. Для тренда пока мало данных. Самая слабая улица: {street} — {score}. Это дополнительный сигнал; план слабых тем по-прежнему строится по фактическим ошибкам.']
    ,['Poker IQ: {score} · {rank}', 'Poker IQ: {score} · {rank}']
    ,['Poker IQ is forming: {current} of the required {target} decisions are rated. Avoid strong conclusions from a small sample.', 'Poker IQ формируется: оценено {current} из необходимых {target} решений. Не делайте сильных выводов по малой выборке.']
    ,['consecutive days', 'дней подряд']
    ,['Continue: {title}', 'Продолжить: {title}']
    ,['Return to the last open lesson without losing progress.', 'Вернитесь к последнему открытому материалу без потери прогресса.']
    ,['about 5 minutes', 'около 5 минут']
    ,['{title}: {current} / {target} scenarios', '{title}: {current} / {target} сценариев']
    ,['{title}: {current} / {target} Trainer decisions', '{title}: {current} / {target} решений Trainer']
    ,['{title}: Level {current} / {target}', '{title}: Level {current} / {target}']
    ,['{title}: {current} / {target} days', '{title}: {current} / {target} дня']
    ,['{title}: {current} / {target} exam', '{title}: {current} / {target} экзамен']
    ,['{title}: {current} / {target} XP', '{title}: {current} / {target} XP']
    ,['Everyone folded to you', 'Все выбросили до тебя']
    ,['Limpers before you', 'Перед тобой лимперы']
    ,['Against an early-position raise', 'Против рейза из ранней позиции']
    ,['Against a late-position raise', 'Против рейза из поздней позиции']
    ,['You opened and faced a 3-bet', 'Ты открылся и получил 3-бет']
    ,['BB defense against BTN', 'Защита BB против BTN']
    ,['Tight regular', 'Тайтовый регуляр']
    ,['Regular', 'Регуляр']
    ,['Passive limper', 'Пассивный лимпер']
    ,['Early (UTG–MP)', 'Ранняя (UTG–MP)']
    ,['Late (HJ–BTN)', 'Поздняя (HJ–BTN)']
    ,['For example: 99+,AQs+,AJo+,KQs', 'Например: 99+,AQs+,AJo+,KQs']
    ,['For example: HJ opened to $15, I 3-bet to $55, they called; flop checked through…', 'Например: HJ открыл $15, я 3-бет $55, он call; флоп чек-чек...']
    ,['What you may be missing', 'Что ты можешь упускать']
    ,['Why not the alternatives', 'Почему не другие варианты']
    ,['Pot before opponent bet', 'Банк до ставки соперника']
    ,['Bet / action price', 'Ставка / цена действия']
    ,['Opponents in the hand', 'Соперников в раздаче']
    ,['Confidence: {confidence}', 'Уверенность: {confidence}']
    ,['high', 'высокая']
    ,['medium', 'средняя']
    ,['low', 'низкая']
    ,['RAISE to ${amount}', 'RAISE до ${amount}']
    ,['{hand} • {position} • {explanation}', '{hand} • {position} • {explanation}']
    ,['{hand} is in the learning opening range from {position}. Raising takes the initiative and avoids inviting the entire table to see a cheap flop.', '{hand} входит в учебный диапазон открытия из позиции {position}. Рейз забирает инициативу и не приглашает весь стол дешёво посмотреть флоп.']
    ,['{hand} is outside the baseline opening range from {position}: too many players remain behind and the hand is often dominated.', '{hand} не входит в базовый диапазон открытия из позиции {position}: слишком много игроков остаётся за спиной и рука часто доминируется.']
    ,['Context: Hero is {position}; opponent type — {villain}; {format}; effective stack — {depth}.', 'Контекст: герой {position}; тип соперника — {villain}; {format}; effective stack — {depth}.']
    ,['in position', 'в позиции']
    ,['out of position', 'без позиции']
    ,['neutral regular', 'нейтральный regular']
    ,['deep', 'глубокий']
    ,['short', 'короткий']
    ,['Baseline Trainer line for {hand} ({category}) from {position}.', 'Базовая линия Trainer для {hand} ({category}) из позиции {position}.']
    ,['Unopened pot', 'Банк не открыт']
    ,['Position determines how many unknown ranges remain behind. The same hand can be a fold from UTG and a raise from BTN.', 'Позиция определяет, сколько неизвестных диапазонов остаётся за спиной. Одна и та же рука может быть fold из UTG и raise с BTN.']
    ,['A Call leaves more players in and gives up initiative; a fold discards a profitable part of the range.', 'Call оставляет больше игроков и отдаёт инициативу; fold выбрасывает прибыльную часть диапазона.']
    ,['The preflop decision uses baseline exploit ranges for live $1/$3. It does not replace a GTO solution for the exact rake, stacks, and table composition.', 'Префлоп-решение основано на базовых exploit-диапазонах live $1/$3. Оно не заменяет GTO-решение для точной структуры рейка, стеков и состава стола.']
    ,['DAILY HAND', 'РАЗДАЧА ДНЯ']
    ,['Best streak', 'Лучшая серия']
    ,['Accuracy', 'Точность']
    ,['Solved', 'Решено']
    ,['Correct:', 'Верно:']
    ,['Mistakes:', 'Ошибки:']
    ,['Earned:', 'Получено:']
    ,['Most recent:', 'Последний:']
    ,['Limpers before you', 'Лимперов перед тобой']
    ,['Raiser position', 'Позиция рейзера']
    ,['{current}/{target} decisions', '{current}/{target} решений']
    ,['Play more decisions to calculate a rating.', 'Сыграйте больше решений для оценки.']
    ,['Size', 'Размер']
    ,['Why, key factors, and math', 'Почему, ключевые факторы и математика']
    ,['🧮 Outs, Equity, and math', '🧮 Ауты, Equity и математика']
    ,['📝 Hand flow', '📝 Ход раздачи']
    ,['Stack', 'Стек']
    ,['Hands', 'Раздачи']
    ,['Tilt', 'Тильт']
    ,['Ⅱ Pause', 'Ⅱ Пауза']
    ,['Next hand', 'Следующая раздача']
    ,['Local data', 'Локальные данные']
    ,['Poker IQ is not calculated. At least 30 rated decisions are required.', 'Poker IQ не рассчитан. Нужно минимум 30 оцениваемых решений.']
    ,['Sound volume', 'Громкость звука']
    ,['Initials', 'Инициалы']
    ,['Ace of spades', 'Туз пик']
    ,['King of diamonds', 'Король бубен']
    ,['Queen of clubs', 'Дама треф']
    ,['Jack of hearts', 'Валет червей']
    ,['Incorrect', 'Неверно']
    ,['Reward pending', 'Награда ожидает начисления']
    ,['Completed without reward', 'Завершено без начисления']
    ,['Not completed', 'Не завершено']
    ,['Available today', 'Доступно сегодня']
    ,['Today', 'сег.']
    ,['{date}: {status}', '{date}: {status}']
    ,['Result: {result} over {count} hands.', 'Результат: {result} за {count} раздач.']
    ,['Could not read the range: {message}', 'Не удалось прочитать диапазон: {message}']
    ,['No combinations remain in the opponent range after removing known cards. Check the range.', 'После удаления известных карт в диапазоне соперника не осталось комбинаций. Проверь диапазон.']
    ,['Enter the opponent’s bet or raise size for this situation.', 'Для этой ситуации укажи размер ставки или рейза соперника.']
    ,['Profile name cannot be empty', 'Имя профиля не может быть пустым']
    ,['Profile name cannot be longer than {count} characters', 'Имя профиля не может быть длиннее {count} символов']
    ,['Bio cannot be longer than {count} characters', 'Bio не может быть длиннее {count} символов']
    ,['Choose a preferred game', 'Выберите предпочитаемую игру']
    ,['Game name cannot be longer than {count} characters', 'Название игры не может быть длиннее {count} символов']
    ,['Profile changes must be an object', 'Изменения профиля должны быть объектом']
    ,['XP must be a non-negative number', 'XP должен быть неотрицательным числом']
    ,['Listener must be a function', 'Listener должен быть функцией']
    ,['ProfileStore is unavailable', 'ProfileStore недоступен']
    ,['Unknown learning module: {module}', 'Неизвестный учебный модуль: {module}']
    ,['Module “{module}” is not implemented yet', 'Модуль «{module}» ещё не реализован']
    ,['Module “{module}” is locked', 'Модуль «{module}» заблокирован']
    ,['Learning module is locked', 'Учебный модуль заблокирован']
    ,['Unknown lesson: {lesson}', 'Неизвестный урок: {lesson}']
    ,['Unknown mini-task: {task}', 'Неизвестное мини-задание: {task}']
    ,['Unknown upcoming module: {module}', 'Неизвестный будущий модуль: {module}']
    ,['tight player', 'тайтовый игрок']
    ,['regular', 'регуляр']
    ,['passive player', 'пассивный игрок']
    ,['aggressive player', 'агрессивный игрок']
    ,['new player', 'новичок']
    ,['unpredictable player', 'непредсказуемый игрок']
    ,['Rank', 'Ранг']
    ,['Rating', 'Рейтинг']
    ,['Lifetime', 'За всё время']
    ,['Accepted events', 'Принятые события']
    ,['Daily XP gained', 'Ежедневно начисленный XP']
    ,['Recorded values only', 'Только записанные значения']
    ,['{title}: Poker IQ {current} / {target}', '{title}: Poker IQ {current} / {target}']
    ,['Decision Quality: not calculated.', 'Decision Quality: не рассчитана.']
    ,['Poker IQ is not calculated. At least 30 rated decisions are required. Start with your first decision.', 'Poker IQ не рассчитан. Нужно минимум 30 оцениваемых решений. Начните с первого решения.']
    ,['At least 30 rated decisions are required. Start with your first decision.', 'Нужно минимум 30 оцениваемых решений. Начните с первого решения.']
    ,['Poker IQ progress: not enough data', 'Прогресс Poker IQ: недостаточно данных']
    ,['Play at least one rated decision.', 'Сыграйте минимум одно оцениваемое решение.']
  ]);

  const englishMessages = Object.fromEntries(Object.entries(PAIRS).map(([key, value]) => [key, value[0]]));
  const russianMessages = Object.fromEntries(Object.entries(PAIRS).filter(([, value]) => value[1] !== null).map(([key, value]) => [key, value[1]]));
  const REQUIRED_KEYS = Object.freeze(Object.keys(PAIRS).filter(key => key !== 'fallback.englishOnly'));

  function normalizeLocale(value) {
    const language = String(value || '').trim().toLowerCase().replaceAll('_', '-');
    if (language === 'ru' || language.startsWith('ru-')) return 'ru';
    if (language === 'en' || language.startsWith('en-')) return 'en';
    return null;
  }

  function resolveDeviceLocale({ languages, language } = {}) {
    const candidates = Array.isArray(languages) ? languages : [];
    for (const candidate of candidates) {
      const resolved = normalizeLocale(candidate);
      if (resolved) return resolved;
    }
    return normalizeLocale(language) || DEFAULT_LOCALE;
  }

  function safeStorage(candidate) {
    if (candidate !== undefined) return candidate;
    try { return root.localStorage || null; } catch (_) { return null; }
  }

  function savedPreference(storage) {
    try {
      const value = storage?.getItem?.(LOCALE_STORAGE_KEY);
      return SUPPORTED_LOCALES.includes(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function interpolate(template, values = {}) {
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => (
      Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : ''
    ));
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function templateMatcher(template) {
    const names = [];
    let cursor = 0;
    let expression = '^';
    String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (token, name, offset) => {
      expression += escapeRegExp(template.slice(cursor, offset));
      expression += ['count', 'current', 'target', 'level', 'xp', 'percent', 'best'].includes(name)
        ? '(-?[0-9]+(?:[.,][0-9]+)?)'
        : '(.+?)';
      names.push(name);
      cursor = offset + token.length;
      return token;
    });
    expression += escapeRegExp(template.slice(cursor)) + '$';
    return {
      regex: new RegExp(expression, 'u'),
      names,
      literalLength: String(template).replace(/\{[a-zA-Z0-9_]+\}/g, '').length
    };
  }

  const exactCopyIndex = new Map();
  const templateCopyIndex = [];
  Object.entries(PAIRS).forEach(([key, pair]) => {
    pair.filter(value => typeof value === 'string').forEach(value => {
      if (value.includes('{')) templateCopyIndex.push({ key, ...templateMatcher(value) });
      else exactCopyIndex.set(value, key);
    });
  });
  const ALL_COPY_PAIRS = Object.freeze([...COURSE_COPY_PAIRS, ...COPY_PAIRS]);
  ALL_COPY_PAIRS.forEach(([en, ru], index) => {
    const key = `copy.${index}`;
    englishMessages[key] = en;
    russianMessages[key] = ru;
    for (const value of [en, ru]) {
      if (value.includes('{')) templateCopyIndex.push({ key, ...templateMatcher(value) });
      else exactCopyIndex.set(value, key);
    }
  });
  exactCopyIndex.set('Home', 'nav.home');
  templateCopyIndex.sort((left, right) => right.literalLength - left.literalLength);
  const messages = Object.freeze({
    en: Object.freeze(englishMessages),
    ru: Object.freeze(russianMessages)
  });

  function createLocalization({ storage, navigatorRef = root.navigator || {}, documentRef = root.document || null } = {}) {
    const activeStorage = safeStorage(storage);
    const listeners = new Set();
    const textRecords = new WeakMap();
    const attributeRecords = new WeakMap();
    let observer = null;
    let locale = savedPreference(activeStorage) || resolveDeviceLocale(navigatorRef);

    function t(key, values = {}, fallback = '') {
      if (typeof values === 'string') {
        fallback = values;
        values = {};
      }
      const template = messages[locale][key] ?? messages.en[key] ?? fallback;
      return typeof template === 'string' ? interpolate(template, values) : '';
    }

    function translateCopy(value) {
      const source = String(value ?? '');
      const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/u);
      const leading = match?.[1] || '';
      const core = match?.[2] || '';
      const trailing = match?.[3] || '';
      let key = exactCopyIndex.get(core);
      let values = {};
      if (!key) {
        for (const candidate of templateCopyIndex) {
          const result = candidate.regex.exec(core);
          if (!result) continue;
          key = candidate.key;
          values = Object.fromEntries(candidate.names.map((name, index) => [
            name,
            translateCopy(result[index + 1]).trim()
          ]));
          break;
        }
      }
      return key ? `${leading}${t(key, values, core)}${trailing}` : source;
    }

    function translateValue(value) {
      if (typeof value === 'string') return translateCopy(value);
      if (Array.isArray(value)) return value.map(translateValue);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateValue(item)]));
      }
      return value;
    }

    function applyDocumentLanguage() {
      const element = documentRef?.documentElement;
      if (!element) return;
      element.lang = LOCALE_TAGS[locale];
      element.dataset.locale = locale;
      element.setAttribute?.('lang', LOCALE_TAGS[locale]);
    }

    function localizeTextNode(node) {
      const current = String(node.nodeValue ?? '');
      const previous = textRecords.get(node);
      const source = previous && current === previous.output ? previous.source : current;
      const output = translateCopy(source);
      textRecords.set(node, { source, output });
      if (output !== current) node.nodeValue = output;
    }

    function localizeAttribute(element, name) {
      if (!element?.hasAttribute?.(name)) return;
      const current = element.getAttribute(name);
      let records = attributeRecords.get(element);
      if (!records) {
        records = new Map();
        attributeRecords.set(element, records);
      }
      const previous = records.get(name);
      const source = previous && current === previous.output ? previous.source : current;
      const output = translateCopy(source);
      records.set(name, { source, output });
      if (output !== current) element.setAttribute(name, output);
    }

    function localizeTree(node) {
      if (!node) return;
      if (node.nodeType === 3) {
        localizeTextNode(node);
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 9 && node.nodeType !== 11) return;
      if (node.nodeType === 1) {
        if (node.closest?.('[data-i18n-ignore]')) return;
        const tag = String(node.tagName || '').toUpperCase();
        if (tag === 'SCRIPT' || tag === 'STYLE') return;
        ['aria-label', 'title', 'placeholder'].forEach(name => localizeAttribute(node, name));
      }
      Array.from(node.childNodes || []).forEach(localizeTree);
    }

    function updateLanguageSelector() {
      documentRef?.querySelectorAll?.('[data-locale-choice]').forEach(button => {
        const selected = button.dataset.localeChoice === locale;
        button.classList?.toggle?.('is-selected', selected);
        button.setAttribute?.('aria-pressed', String(selected));
        button.setAttribute?.('aria-checked', String(selected));
      });
      const option = LOCALE_OPTIONS.find(item => item.locale === locale) || LOCALE_OPTIONS[0];
      const toggle = documentRef?.querySelector?.('#headerLocaleToggle');
      if (toggle) {
        toggle.textContent = option.flag;
        const language = t(
          option.locale === 'ru' ? 'settings.russianLanguage' : 'settings.englishLanguage',
          option.languageLabel
        );
        toggle.setAttribute?.('aria-label', t('settings.headerLanguage', { language }));
      }
    }

    function setHeaderPickerOpen(open, restoreFocus = false) {
      const picker = documentRef?.querySelector?.('#headerLocalePicker');
      const toggle = documentRef?.querySelector?.('#headerLocaleToggle');
      if (!picker || !toggle) return false;
      picker.hidden = !open;
      toggle.setAttribute?.('aria-expanded', String(open));
      if (!open && restoreFocus) toggle.focus?.();
      return open;
    }

    function mountHeaderLanguagePicker() {
      const container = documentRef?.querySelector?.('#headerLocaleControl');
      const toggle = documentRef?.querySelector?.('#headerLocaleToggle');
      const picker = documentRef?.querySelector?.('#headerLocalePicker');
      if (!container || !toggle || !picker || container.dataset.localeMounted === 'true') return;
      container.dataset.localeMounted = 'true';
      setHeaderPickerOpen(false);
      container.addEventListener?.('click', event => {
        const choice = event.target?.closest?.('[data-locale-choice]');
        if (choice && container.contains?.(choice)) {
          event.preventDefault?.();
          setLocale(choice.dataset.localeChoice);
          setHeaderPickerOpen(false, true);
          return;
        }
        const trigger = event.target?.closest?.('#headerLocaleToggle');
        if (trigger && container.contains?.(trigger)) {
          event.preventDefault?.();
          setHeaderPickerOpen(picker.hidden);
        }
      });
      documentRef?.addEventListener?.('click', event => {
        if (!picker.hidden && !container.contains?.(event.target)) setHeaderPickerOpen(false);
      });
      documentRef?.addEventListener?.('keydown', event => {
        if (event.key === 'Escape' && !picker.hidden) {
          event.preventDefault?.();
          setHeaderPickerOpen(false, true);
        }
      });
    }

    function translateDocument() {
      applyDocumentLanguage();
      localizeTree(documentRef);
      updateLanguageSelector();
      return locale;
    }

    function setLocale(value) {
      const next = normalizeLocale(value);
      if (!SUPPORTED_LOCALES.includes(next)) return locale;
      locale = next;
      try { activeStorage?.setItem?.(LOCALE_STORAGE_KEY, locale); } catch (_) {}
      translateDocument();
      listeners.forEach(listener => listener({ locale, localeTag: LOCALE_TAGS[locale] }));
      try {
        const EventConstructor = root.CustomEvent;
        if (EventConstructor && documentRef?.dispatchEvent) {
          documentRef.dispatchEvent(new EventConstructor('pokerelevate:localechange', { detail: { locale } }));
        }
      } catch (_) {}
      return locale;
    }

    function mount() {
      translateDocument();
      const container = documentRef?.querySelector?.('#profileLanguage');
      if (container && container.dataset.localeMounted !== 'true') {
        container.dataset.localeMounted = 'true';
        container.addEventListener?.('click', event => {
          const button = event.target?.closest?.('[data-locale-choice]');
          if (button && container.contains?.(button)) setLocale(button.dataset.localeChoice);
        });
      }
      mountHeaderLanguagePicker();
      if (!observer && typeof root.MutationObserver === 'function' && documentRef?.documentElement) {
        observer = new root.MutationObserver(records => {
          records.forEach(record => {
            if (record.type === 'characterData') localizeTextNode(record.target);
            if (record.type === 'attributes') localizeAttribute(record.target, record.attributeName);
            Array.from(record.addedNodes || []).forEach(localizeTree);
          });
        });
        observer.observe(documentRef.documentElement, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ['aria-label', 'title', 'placeholder']
        });
      }
      return locale;
    }

    applyDocumentLanguage();
    return Object.freeze({
      t,
      translateCopy,
      translateValue,
      translateDocument,
      localizeTree,
      setLocale,
      getLocale: () => locale,
      getLocaleTag: () => LOCALE_TAGS[locale],
      formatNumber(value, options) {
        return new Intl.NumberFormat(LOCALE_TAGS[locale], options).format(value);
      },
      formatPercent(value, options = {}) {
        return new Intl.NumberFormat(LOCALE_TAGS[locale], { style: 'percent', ...options }).format(value);
      },
      formatDate(value, options) {
        return new Intl.DateTimeFormat(LOCALE_TAGS[locale], options).format(value);
      },
      subscribe(listener) {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      mount,
      destroy() {
        observer?.disconnect?.();
        observer = null;
        listeners.clear();
      }
    });
  }

  const manager = createLocalization();
  const api = Object.freeze({
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_TAGS,
    LOCALE_STORAGE_KEY,
    LOCALE_OPTIONS,
    REQUIRED_KEYS,
    messages,
    normalizeLocale,
    resolveDeviceLocale,
    createLocalization,
    t: manager.t,
    translateCopy: manager.translateCopy,
    translateValue: manager.translateValue,
    translateDocument: manager.translateDocument,
    localizeTree: manager.localizeTree,
    setLocale: manager.setLocale,
    getLocale: manager.getLocale,
    getLocaleTag: manager.getLocaleTag,
    formatNumber: manager.formatNumber,
    formatPercent: manager.formatPercent,
    formatDate: manager.formatDate,
    subscribe: manager.subscribe,
    mount: manager.mount
  });

  root.PokerElevateI18n = api;
  root.PokerPilotI18n = api;
  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', manager.mount, { once: true });
    } else {
      manager.mount();
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
