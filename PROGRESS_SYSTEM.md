# PokerPilot Progress System

## Purpose

Stage 9.4A introduced the local, versioned progression foundation. Stage 9.5
adds deterministic achievements and non-blocking progress feedback on top of
that authority. It does not add an account system or new poker logic.

The new state is an event-driven source of truth for progression inputs. Values
that can be calculated safely are not stored as independent authorities.

## Terminology and ownership

| Concept | Meaning | Source of truth |
| --- | --- | --- |
| XP | Lifetime useful activity | `lifetimeXp` in Progress state |
| Level | Experience milestone | Derived only from lifetime XP |
| Decision Quality | Quality of one poker decision, 0–100 | Existing `DecisionQualityEngine` result in a normalized decision record |
| Poker IQ | Stable demonstrated decision quality | Existing `PokerIQ` engine over normalized rated decisions |
| Rank | Named Poker IQ interval | Derived only from Poker IQ configuration |
| Skill Map | Stable evidence grouped by poker topic | `skills` in Progress state |
| Streak | Consecutive local dates with meaningful completed activity | `streak` in Progress state |
| History | Compact progression change log | Bounded `history` in Progress state |
| Achievements | Recognition derived from accepted progress events | `achievements` and `counters` in Progress state |

XP and Poker IQ are deliberately separate. Repeating useful work may increase
experience, but activity alone cannot prove stronger decisions. Conversely,
Poker IQ may change after rated decisions without awarding XP.

Decision Quality describes one decision or a recent set of decisions. Poker IQ
uses a larger sample, recency, confidence, consistency and shrinkage, and is
therefore not a synonym for Decision Quality.

## Storage and authority

Current schema version: `2`.

Authoritative key:

```text
pokerpilot_progress_system
```

The following existing keys remain readable and are never deleted by Stage
9.4A:

- `pokerpilot_v1_6_progress`
- `pokerpilot_v1_5_1_progress`
- `pokerpilot_v1_5_progress`
- `pokerpilot_v1_4_progress`
- `pokerpilot_profile`
- `pokerpilot_poker_iq_cache`

During transition, legacy progress provides trainer history, course state,
saved hands and existing statistics. Profile storage continues to own identity
and settings. Its old `progression` and `ratings` fields are compatibility data,
not the new progression authority.

The Poker IQ key remains a disposable cache. It is never migrated as an
authoritative rating.

## State schema

```js
{
  schemaVersion: 2,
  playerId: "profile-or-local-id",
  lifetimeXp: 0,
  decisionRecords: [],
  counters: {
    trainingScenarios: 0,
    trainerDecisions: 0,
    exams: 0
  },
  achievements: {
    unlocked: {},
    history: []
  },
  streak: {
    current: 0,
    best: 0,
    lastQualifiedDate: null
  },
  skills: {
    preflop: skillState,
    value: skillState,
    bluffing: skillState,
    discipline: skillState,
    pokerMath: skillState,
    postflop: skillState
  },
  history: [],
  processedEventIds: [],
  metadata: {
    createdAt: "ISO timestamp",
    updatedAt: "ISO timestamp",
    migratedFrom: [],
    eventCount: 0
  }
}
```

`skillState`:

```js
{
  score: null,
  attempts: 0,
  confidence: "insufficient",
  updatedAt: null,
  recentTrend: "INSUFFICIENT_DATA"
}
```

`level`, `rank`, current Poker IQ, aggregate Decision Quality and XP progress
are snapshot fields. They are derived and are not stored as competing values.

## Progress events

Every event has this envelope:

```js
{
  id: "stable-id",
  type: "LESSON_COMPLETED",
  timestamp: "ISO timestamp",
  source: "learning",
  payload: {}
}
```

Allowlisted types:

- `LESSON_COMPLETED`
- `EXAM_COMPLETED`
- `TRAINING_SCENARIO_COMPLETED`
- `TRAINING_DECISION_RECORDED`
- `TRAINING_SESSION_COMPLETED`
- `HAND_REVIEW_COMPLETED`
- `DAILY_HAND_COMPLETED`
- `LIVE_SESSION_REVIEWED`
- `SKILL_CHECK_COMPLETED`

Event IDs are stored after successful processing. Replaying the same ID returns
`applied: false` and cannot award XP, change a skill, or advance a streak.
Unknown types and invalid required payloads are not processed.

`applyProgressEvent(state, event)` is pure and returns the previous compatible
fields plus an additive transition contract:

```js
{
  state,
  applied,
  rewards: { xp },
  changes,
  reason,
  duplicate,
  event: { id, type, source },
  transition: {
    xp: { gained, previous, current },
    level: { previous, current, leveledUp },
    rank: { previous, current, rankedUp },
    achievements: { newlyUnlocked: [] }
  }
}
```

UI handlers emit events instead of manipulating XP, skills, rank, achievements
or day streaks directly. Duplicate and rejected events carry a zero transition.

## XP configuration and level curve

Initial conservative rewards:

| Event | XP |
| --- | ---: |
| Lesson completed | 30 |
| Exam completed | 60 |
| Training scenario completed | 15 |
| Training decision recorded | 0 |
| Training session completed | 40 |
| Own hand reviewed | 35 |
| Daily hand completed | 25 |
| Live session reviewed | 45 |
| Skill check completed | 50 |

There are no random bonuses. Navigation and app opening never award XP.

XP needed for the next level is:

```text
250 × (current level + 1)
```

Therefore the first boundaries are 500 XP for Level 2, 1,250 lifetime XP for
Level 3, and 2,250 lifetime XP for Level 4. XP is normalized to a
non-negative integer and never decreases.

Achievements do not award XP in Stage 9.5. Live Session and Hand Lab still do
not emit XP-bearing progress events.

## Achievement catalog and evaluation

Stable IDs and exact conditions:

| ID | Condition |
| --- | --- |
| `FIRST_STEP` | 1 completed eligible training scenario |
| `QUICK_LEARNER` | 10 completed eligible training scenarios |
| `DECISION_MAKER` | 25 accepted valid trainer decisions |
| `SHARP_MIND` | Poker IQ at least 60 |
| `POKER_STUDENT` | Level at least 5 |
| `ON_A_ROLL` | Current streak at least 3 days |
| `DEDICATED` | Current streak at least 7 days |
| `EXAM_READY` | 1 completed eligible exam |
| `HIGH_ACHIEVER` | Rank strictly above the initial `INTERMEDIATE` rank |
| `CENTURY_CLUB` | At least 100 lifetime XP |

`achievement-config.js` owns metadata and declarative conditions.
`achievement-system.js` evaluates all catalog entries after each accepted
event, in catalog order. Existing unlocks are never emitted twice. One event
may unlock multiple achievements. Hidden locked achievements do not expose
their condition in the snapshot.

Schema v2 migration infers the three counters conservatively from retained
history and normalized decision records when older state has no counters. It
normalizes malformed optional achievement data and tolerates obsolete unknown
IDs without exposing them as catalog cards. Existing XP, decisions, skills,
streak and history remain intact. Re-running migration is idempotent.

## Progress feedback

`progress-feedback.js` consumes only a live, applied mutation result. It queues
compact XP feedback first, then all newly unlocked achievements, Level Up and
Rank Up notifications. Items display sequentially, never block pointer input,
use `aria-live`, clean up their DOM nodes and retain logical ordering under
`prefers-reduced-motion`. Snapshot subscriptions and page reloads cannot replay
historical unlocks; duplicate events do not reach the queue.

## Achievement Center

Stage 9.6 adds a separate read-only Achievement Center inside the Profile
destination. It receives an independent catalog copy from
`getAchievementCatalog()` and current state from `ProgressSystem.getSnapshot()`.
It never evaluates unlock eligibility, emits progress events, awards XP or
writes presentation state to localStorage.

The Center combines catalog metadata with authoritative `unlocked` flags from
the snapshot. Catalog order is stable: unlocked entries are shown first, then
locked entries, with original catalog order preserved inside each group.
Filters (`all`, `unlocked`, `locked`) are local UI state and are not persisted.

Rarity is presentation-only metadata with four values: `COMMON`, `RARE`,
`EPIC`, `LEGENDARY`. Changing rarity cannot change achievement conditions,
event processing, XP, Poker IQ, Level, Rank or streak.

Numeric presentation progress is derived from snapshot counters and existing
condition metadata, clamped to `0..target`, and never stored. Supported metrics
are training scenarios, trainer decisions, Poker IQ, Level, streak, exams and
lifetime XP. Rank progress uses the existing rank order. Non-finite, negative,
unknown or unsupported values fall back safely without `NaN` or `Infinity`.
Locked hidden achievements continue to conceal their condition.

Live progress feedback and the Achievement Center have separate roles:

- `progress-feedback.js` consumes a newly accepted mutation result once and
  shows transient XP/unlock/level/rank notifications;
- Achievement Center renders historical/current snapshot state and never
  replays unlock celebration.

Achievements remain recognition only and award no additional XP.

## Decision Quality boundary

The existing `DecisionQualityEngine` remains authoritative. The Progress
adapter calls it rather than copying its action, sizing, EV, confidence or
marginal formulas.

Its normalized output remains:

```js
{
  score: 0..100 | null,
  classification,
  grade,
  confidence,
  components,
  reasons,
  isRated
}
```

Missing EV is not invented. Marginal and low-confidence spots keep the existing
softer treatment. `UNRATED` decisions do not affect Poker IQ or Skill Map.

## Poker IQ and Rank boundaries

The existing calibrated `PokerIQ` engine remains authoritative. It consumes
deduplicated normalized decision records.

The adapter may report:

```js
{
  previous,
  current,
  delta,
  reason,
  confidence
}
```

XP is never an input. The existing prior, confidence, consistency, street
balance and trend logic are preserved.

Rank is derived using the existing contiguous Poker IQ thresholds:

- 1000–1199 Beginner
- 1200–1399 Learning
- 1400–1599 Intermediate
- 1600–1799 Advanced
- 1800–1999 Expert
- 2000–2199 Master
- 2200–2399 Grandmaster
- 2400–2599 Elite
- 2600–2799 Legend
- 2800–3000 PokerPilot

Stored rank labels are not authoritative. Future subdivisions can be added to
configuration without migrating stored progress.

## Skill Map foundation

Authoritative broad IDs:

- `preflop`
- `value`
- `bluffing`
- `discipline`
- `pokerMath`
- `postflop`

Display labels are not keys. A central allowlist maps existing topics such as
`position`, `range_reading`, `pot_odds`, `outs`, `sizing`, `too_tight`,
`too_loose`, `passive` and `overplay`.

Only rated Decision Quality evidence updates a skill. Scores use a stable
weighted running update. Confidence remains `insufficient` after one result,
becomes `low`, `medium`, then `high` only with more samples. Unknown topics are
ignored safely and cannot create arbitrary object keys. The schema leaves room
for future subskills.

## Streak rules

A day qualifies after at least one completed allowlisted event. A rated
training decision may qualify the day but awards no XP.

- App opening and navigation never count.
- Multiple events on one local date count once.
- The next calendar date increments the streak.
- A gap resets current streak to one.
- Best streak never decreases.
- Old or out-of-order dates cannot move the streak backwards.
- Invalid timestamps do not qualify.

The preferred event payload contains `localDate: YYYY-MM-DD`. Otherwise the
timestamp is converted with an explicit `timezoneOffsetMinutes` value; without
one, UTC is the deterministic fallback.

## History and retention

Progress history contains compact deltas and references the event ID. It does
not copy entire trainer scenarios or saved hands. Stage 9.7 raises the bounded
history retention from 400 to 2,000 accepted events. A normalized entry is
roughly a few hundred bytes, so the expected ceiling remains around 1 MB while
providing a materially longer local analytics window. Normalized rated
decisions follow the existing 1,200-record retention. Processed IDs are retained
in the existing 5,000-ID local deduplication ledger.

These limits prevent uncontrolled localStorage growth. A future server may use
an append-only event log and server-side idempotency beyond the local retention
window.

## Parsing, migration and integrity

- localStorage is untrusted input.
- JSON parse failures return safe defaults.
- Objects are rebuilt from allowlisted fields; prototype keys are not merged.
- Negative and non-finite numbers normalize safely.
- Unknown skills and events cannot create state keys.
- Legacy data is read, normalized and copied; old keys are not overwritten or
  removed.
- Migration is idempotent: once the new key exists, legacy inputs do not award
  or import again.
- Schema v1/v2 state receives safe counter, achievement and analytics defaults; evidence in
  retained history/decisions is used to avoid losing already completed work.
- Schema v2 to v3 migration preserves totals, achievements and real compact
  event history. It never expands aggregate totals into synthetic daily events.
- Legacy users with totals that predate detailed analytics receive an
  `analyticsCoverage.isPartial` marker and a truthful coverage notice.
- Import validates and normalizes before persistence.
- Storage errors leave a functional in-memory state and a status error.

## Public API

The classic-script module exposes:

```text
ProgressSystem.load()
ProgressSystem.getSnapshot()
ProgressSystem.getAnalyticsSnapshot(options)
ProgressSystem.recordEvent(event)
ProgressSystem.resetForTesting()
ProgressSystem.export()
ProgressSystem.import(value)
ProgressSystem.subscribe(listener)
```

Pure helpers and `ProgressSystem.create(options)` are exported for tests.
Snapshots and event results are cloned so consumers cannot mutate internal
state.

## Stage 9.7 analytics architecture

Progress Analytics has four deliberately separate layers:

1. The current authoritative state returned by `ProgressSystem.getSnapshot()`.
2. The bounded accepted-event history owned and persisted by ProgressSystem.
3. A pure analytics projection produced by `progress-analytics.js` and exposed
   through `ProgressSystem.getAnalyticsSnapshot(options)`.
4. Read-only presentation in `progress-analytics-view.js`.

Progress feedback remains a transient consumer of a newly applied event result.
Achievement Center remains a read-only catalog/snapshot projection. Neither is
replayed from Analytics history.

### History schema v3

New accepted events record only compact allowlisted data:

```text
eventId, type, timestamp, localDate, timezoneOffsetMinutes, source, xp, summary,
lifetimeXpAfter, levelAfter, rankAfter, pokerIqAfter, streakAfter, metadata
```

`metadata` allows only the small identifiers needed to label a learning event,
plus bounded score/passed values. Cards, notes, trainer payloads, saved hands and
full snapshots are never copied. Duplicate/replayed and rejected events do not
create entries. History normalization is deterministic, de-duplicates event IDs
and returns defensive copies.

Legacy v2 history continues to supply real activity and daily XP. Fields that
did not exist, especially `pokerIqAfter`, remain `null`; they are not inferred.
The exact Poker IQ series therefore starts only with newly recorded values.

### Calendar bucketing and periods

`progress-date-utils.js` converts timestamps with the event's explicit timezone
offset or uses the already stored `localDate`. Calendar ranges are generated by
UTC calendar-field arithmetic over `YYYY-MM-DD` keys, not by dividing elapsed
milliseconds by 86,400,000. This keeps midnight and DST behavior deterministic.

The read-only API accepts injected `now` and timezone offset values. Seven- and
thirty-day projections contain explicit zero-value calendar buckets. All-time
totals include every valid retained event up to the injected current day; its
chart uses active days and the UI compacts very long series to at most 60
truthfully aggregated visual buckets.

### Analytics contract

`getAnalyticsSnapshot({ period, now, timezoneOffsetMinutes, recentLimit })`
returns plain serializable copies containing current authoritative values,
coverage, period totals, daily activity, daily earned XP, recorded Poker IQ
points, a centralized event-category breakdown and bounded recent activity.
Aggregation is linear in retained history and never writes storage or applies a
progress event.

Empty, partial and corrupted history are valid states. Invalid timestamps are
excluded from dated aggregates, invalid numeric values clamp safely, and current
snapshot totals remain visible independently of historical coverage.

## Home and Progress Overview compatibility

Stage 9.3A Home keeps its existing visual structure and adapter. The new
snapshot is passed only through `buildHomeViewModel`. Missing or malformed new
data falls back to the existing Profile/Poker IQ/statistics inputs.

The read-only Progress Overview consumes `ProgressSystem.getSnapshot()` and
renders unlocked/locked achievement cards, measurable progress, rarity and
unlock dates. It never reads localStorage or evaluates conditions. Home markup,
route and recommendation priorities remain unchanged by Stage 9.5.

## Future server sync

Event envelopes already contain stable IDs, timestamps and sources. A future
server can acknowledge event IDs and resolve identity without changing score
formulas. Local timestamps are evidence, not trusted server time. Import/export
is versioned and validated, but Stage 9.4A does not implement accounts,
authentication, cloud merge, conflict resolution or remote deletion.

## Non-goals

- Leaderboards, social features and server-synced achievements
- Daily Hand backend
- Notifications, streak repair or fear-based messaging
- Achievement XP bonuses, sounds or haptics
- Poker IQ recalibration
- Changes to poker math, Trainer strategy, course content or Home design
