# PokerPilot tests

Тесты используют встроенный модуль `node:test` и без внешних зависимостей
загружают реальный `PokerCore` из `src/poker-core.js`.

Требуется Node.js 18 или новее.

Быстрые тесты из корня проекта:

```sh
node --test tests/poker-core.test.cjs tests/poker-core-api-contract.test.cjs tests/poker-core-extended.test.cjs tests/poker-math-stability.test.cjs tests/validation-security.test.cjs tests/browser-smoke.test.cjs tests/postflop-scenarios-contract.test.cjs tests/preflop-ranges-contract.test.cjs tests/progress-storage-contract.test.cjs
```

Тесты режима «Обучение»:

```sh
node --test tests/learning-course-data.test.cjs tests/learning-progress.test.cjs tests/learning-storage-integration.test.cjs tests/learning-unlock.test.cjs tests/learning-ui-contract.test.cjs
```

Тесты Модуля 3, visual refresh foundation и звука:

```sh
node --test tests/learning-positions-module.test.cjs tests/learning-stage72-progress.test.cjs tests/learning-stage72-browser-smoke.test.cjs tests/visual-refresh-contract.test.cjs tests/sound-manager.test.cjs
```

Контракты UI/UX Modernization (Этап 8.0):

```sh
node --test tests/dashboard-contract.test.cjs tests/ui-system-contract.test.cjs tests/poker-card-component.test.cjs tests/sound-v2-contract.test.cjs tests/stage80-browser-contract.test.cjs
```

Контракт информационной архитектуры и пяти основных разделов (Этап 8.1):

```sh
node --test tests/information-architecture.test.cjs
```

Live Session: модель сохранённой руки, UI-контракт, непрерывный flow, presentation queue, mobile UX и premium motion:

```sh
node --test tests/live-hand-model.test.cjs tests/live-session-ui-contract.test.cjs tests/live-flow-controller.test.cjs tests/live-presentation-queue.test.cjs tests/live-ux-controller.test.cjs tests/live-motion-system.test.cjs
```

Profile Foundation: версионируемый store, XP, адаптер существующей статистики и UI-контракты:

```sh
node --test tests/profile-store.test.cjs tests/profile-statistics-adapter.test.cjs tests/profile-ui-contract.test.cjs
```

Decision Quality Engine: формула, 24 контрольных решения, история,
аналитика и UI-контракты:

```sh
node --test tests/decision-quality-engine.test.cjs tests/decision-quality-records.test.cjs tests/decision-quality-analytics.test.cjs tests/decision-quality-ui-contract.test.cjs
```

Poker IQ: детерминированный engine, 20 контрольных профилей, устойчивость,
кэш и UI-контракты:

```sh
node --test tests/poker-iq-engine.test.cjs tests/poker-iq-stability.test.cjs tests/poker-iq-cache.test.cjs tests/poker-iq-ui-contract.test.cjs
```

Progress System: event contract, XP/Level, Decision Quality/Poker IQ adapters,
Skill Map, day streak, migration, persistence and Home snapshot:

```sh
node --test tests/progress-system.test.cjs
```

Read-only Progress Overview: view model, empty/partial snapshots, Poker IQ,
Decision Quality, skills, weekly focus, streak, recent history and mobile UI:

```sh
node --test tests/progress-overview.test.cjs
```

Progress UI integration: реальные Trainer/Exam события, XP, Level/Rank/Streak,
идемпотентность и обновление snapshot без перезагрузки:

```sh
node --test tests/progress-integration.test.cjs
```

Stage 9.5 Achievements and Progress Feedback: централизованный каталог,
детерминированная доменная проверка условий, миграция schema v2,
структурированные переходы XP/Level/Rank, последовательная очередь уведомлений
и read-only карточки достижений в Progress Overview:

```sh
node --test tests/achievement-config.test.cjs tests/achievement-system.test.cjs tests/progress-feedback.test.cjs tests/progress-system.test.cjs tests/progress-integration.test.cjs tests/progress-overview.test.cjs
```

Каталог содержит `FIRST_STEP`, `QUICK_LEARNER`, `DECISION_MAKER`,
`SHARP_MIND`, `POKER_STUDENT`, `ON_A_ROLL`, `DEDICATED`, `EXAM_READY`,
`HIGH_ACHIEVER` и `CENTURY_CLUB`. Разблокировки являются признанием и не
дают дополнительный XP. Сценарий тренировки по-прежнему даёт ровно 15 XP,
экзамен — 60 XP, а Live Session и Hand Lab XP не начисляют.

Дубликаты stable event ID не изменяют XP, счётчики или историю достижений и
не создают повторное уведомление. Старые сохранения без `counters` и
`achievements` мигрируют идемпотентно; повреждённые необязательные данные
нормализуются без потери остального прогресса. UI получает готовый
`transition` из `ProgressSystem` и не пересчитывает Level, Rank или условия
достижений.

Итог Stage 9.5: 1010 passed, 0 failed, 0 skipped, 0 TODO. Exhaustive evaluator
проверил все 2 598 960 рук. В браузере подтверждены последовательные
уведомления, обновление Progress Overview без reload, сохранение разблокировок
после reload без повторного воспроизведения, desktop layout и mobile 390x844
без horizontal overflow. PokerCore, evaluator, equity, outs, EV, Monte Carlo,
Trainer strategy и Live gameplay не менялись.

Stage 9.6 Achievement Center: read-only projection каталога и snapshot,
фильтры All/Unlocked/Locked, presentation progress, rarity metadata,
устойчивость к legacy/повреждённым данным и responsive UI:

```sh
node --test tests/achievement-config.test.cjs tests/achievement-presentation.test.cjs tests/achievement-center.test.cjs
```

Новые тесты фиксируют независимую копию каталога, неизменность условий,
числовой и rank progress, clamp/fallback, детерминированный порядок карточек,
unlock dates, unknown IDs, фильтры, lifecycle без дублирования listeners,
semantic progress и безопасный `textContent`. Achievement Center не вызывает
progress mutations и не читает storage напрямую.

Browser smoke Achievement Center:

1. Открыть Профиль → «Все достижения».
2. Проверить общий процент и фильтры «Все / Открытые / Не открытые».
3. Убедиться, что progress bars и даты соответствуют Progress snapshot.
4. Вернуться кнопкой «К прогрессу» и снова открыть Center.
5. Проверить desktop 1280 и iPhone 390×844 без horizontal overflow.
6. После reload убедиться, что состояние достижений сохранилось, а live
   celebration повторно не воспроизводится.

Редкость (`COMMON`, `RARE`, `EPIC`, `LEGENDARY`) является только presentation
metadata. Она не влияет на XP, Poker IQ, Rank, Level, streak или порядок
проверки условий. Достижения по-прежнему не дают bonus XP.

Итог Stage 9.6: 1028 passed, 0 failed, 0 skipped, 0 TODO. Отдельный
exhaustive evaluator проверил 2 598 960 рук за 7,82 с. Browser smoke
подтвердил 10 детерминированных карточек, фильтры 10/4/6,
сохранение 4/10 после reload, desktop 1280 и mobile 390×844 без
horizontal overflow и без ошибок консоли.

Stage 9.7 Progress Analytics Foundation: schema v3 history, local calendar
bucketing, read-only aggregation и Profile Analytics UI:

```sh
node --test tests/progress-date-utils.test.cjs tests/progress-history.test.cjs tests/progress-analytics.test.cjs tests/progress-analytics-view.test.cjs
```

Первичный RED: 37 tests, 2 passed, 35 failed. Провалы фиксировали отсутствие
date/analytics/UI-модулей, schema v2, сокращённую history без post-state,
отсутствие deduplication/sorting и read-only Analytics API. После минимальной
реализации: 37 passed, 0 failed.

Migration suite подтверждает v2 → v3, идемпотентность, сохранение totals и
achievements, отсутствие synthetic daily events, partial coverage и безопасную
нормализацию повреждённой history. Date suite использует injected clock/offset,
проверяет local midnight, DST, 7 и 30 календарных bucket.

Browser smoke Progress Analytics:

1. Проверить clean origin: честный empty state и скрытые пустые charts.
2. Проверить legacy origin: partial-history notice без реконструкции Poker IQ.
3. Переключить 7 дней / 30 дней / всё время.
4. Завершить реальный тренировочный сценарий и проверить ровно 15 XP,
   одну категорию scenario, decision event и recorded Poker IQ post-state.
5. Reload: history сохраняется, progress-feedback не повторяется.
6. Вернуться в Progress Overview и открыть Achievement Center.
7. Проверить desktop 1280 и iPhone 390×844, safe area, no horizontal overflow
   и zero console errors.

Итог Stage 9.7: 1065 passed, 0 failed, 0 skipped, 0 TODO. Browser smoke
подтвердил clean empty state, partial legacy coverage, реальные activity/XP/IQ
series после сценария, периоды 7/30/all, persistence после reload, соседний
Achievement Center, desktop 1280 и iPhone 390×844 без horizontal overflow и
без ошибок консоли. Отдельный exhaustive evaluator запускается командой ниже.

Отдельный exhaustive evaluator Stage 9.7: 1 passed, 0 failed; все 2 598 960
пятикарточных комбинаций проверены за 8,18 с.

Полный набор тестов проекта:

```sh
node --test --test-concurrency=1 tests/*.test.cjs
```

Полная проверка всех 2 598 960 пятикарточных комбинаций запускается отдельно:

```sh
node --test tests/poker-core-exhaustive.test.cjs
```

Контрольные раздачи текущего тренера запускаются отдельно:

```sh
node --test tests/trainer-control-hands.test.cjs
```

Контракт структурированного результата тренера:

```sh
node --test tests/trainer-result-contract.test.cjs
```

Контекстные сравнительные тесты тренера:

```sh
node --test tests/trainer-context.test.cjs
```

Расширенная стратегическая матрица тренера (301 сценарий):

```sh
node --test tests/trainer-strategy-matrix.test.cjs
```

Повторяющиеся карты считаются невозможными входными данными и должны
отклоняться `PokerCore` с понятной ошибкой.
