# Decision Quality Engine

Decision Quality (DQ) — детерминированная учебная оценка того, насколько
решение пользователя согласуется с текущей рекомендацией PokerPilot.
DQ оценивает действие в момент решения и не использует выигрыш банка,
денежный результат, будущий runout или результат сессии.

Это не Poker IQ, не рейтинг игрока, не GTO-оценка и не результат солвера.

## Контракт

`DecisionQualityEngine.evaluate(input)` возвращает сериализуемый объект:

```js
{
  schemaVersion: 1,
  score: 0, // 0–100 или null для UNRATED
  grade: "A+",
  classification: "EXCELLENT",
  stars: 5,
  isRated: true,
  confidence: "high",
  components: {
    actionQuality: 98,
    sizingQuality: 100,
    evQuality: null,
    contextReliability: 100
  },
  reasons: ["Вы выбрали основное действие тренера."],
  modelVersion: "dq-1.0.0",
  evaluatedAt: "2026-01-01T00:00:00.000Z"
}
```

Публичный API:

- `evaluate(input)`
- `classify(score)`
- `getLabel(scoreOrClassification)`
- `getGrade(score)`
- `getStars(score)`
- `explain(result)`

## Формула v1

Доступные компоненты объединяются с весами:

- action quality — 70%;
- sizing quality — 20%;
- EV quality — 10%.

Если sizing или EV недоступны, их вес не считается нулём, а
перераспределяется между реально доступными компонентами.
`contextReliability` отражает надёжность, но не добавляет баллы.

Основное действие получает 94–98 до дополнительных компонентов.
Structured alternative получает 84–88. Явное расхождение получает
25/45/60 при high/medium/low confidence. `isMarginal` и low confidence
сжимают нижнюю границу до 50 и не позволяют выдавать необоснованный
`BLUNDER`.

Sizing применяется только к `BET`, `RAISE` и `ALL_IN`, когда суммы и
`amountUnit` сопоставимы:

- отклонение до 10% или $1 округления — 100;
- до 25% — 75;
- до 50% — 20;
- больше 50% — 0.

`FOLD` и `CHECK` не получают sizing-компонент. Null, несовместимые единицы
или нулевой ориентир дают `sizingQuality: null`.

EV используется только для сопоставимого числового `callEV`. В текущей
интеграции Study/Live он передаётся только из точного перебора; Monte Carlo
не влияет на DQ. Отсутствующий, `NaN` или бесконечный EV даёт
`evQuality: null`.

Если точный `callEV` материально противоречит выбранному `CALL` или `FOLD`,
итог ограничивается значением `79 / C / ACCEPTABLE`. Материальным считается
расхождение больше `max($1, 1% текущего банка)`; Monte Carlo к этому
ограничению не относится.

## Пороги

| Score | Grade | Classification | Stars |
|---|---|---|---|
| 95–100 | A+ | EXCELLENT | 5 |
| 90–94 | A | EXCELLENT | 4 |
| 85–89 | B | GOOD | 4 |
| 80–84 | B | GOOD | 3 |
| 70–79 | C | ACCEPTABLE | 3 |
| 50–69 | D | MISTAKE | 2 |
| 1–49 | F | BLUNDER | 1 |
| 0 | F | BLUNDER | 0 |
| null | — | UNRATED | null |

## История и миграция

DQ расширяет существующий `progress.history`; отдельная история решений не
создаётся. Новая запись содержит `decisionId`, `decisionQuality` и
компактный `trainerSnapshot` с действием, размером, альтернативами,
confidence и marginality.

Старые и неполные записи нормализуются в явный `UNRATED` и не входят в
средние. Аналитика дедуплицирует одинаковый `decisionId`, игнорирует
повреждённые записи и стабильно сортирует даты.

Подробная история ограничена последними 1200 записями. Ограничение
применяется при добавлении/нормализации и не меняет существующий ключ
`pokerpilot_v1_6_progress`.

## Статусы выборки

- 0 — `NONE`;
- 1–4 — `PROVISIONAL`;
- 5–19 — `FORMING`;
- 20 и больше — `ESTABLISHED`.

Profile показывает lifetime, recent 20, trend, количество rated decisions,
лучшую сессию и улицы. Coach использует DQ только как дополнительный
сигнал; существующая weak-area logic остаётся источником плана тренировки.

## Ограничения v1

- исторические записи без trainer snapshot остаются UNRATED;
- course lesson/exam attempts используют отдельную учебную схему и пока не
  преобразуются в decision records;
- Live и фиксированные тренировки оцениваются по доступному в момент
  решения учебному контракту, а не по solver database;
- EV нескольких альтернатив пока не хранится;
- XP за DQ выключен: безопасная идемпотентность между progress storage и
  ProfileStore требует отдельного этапа.
