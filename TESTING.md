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
