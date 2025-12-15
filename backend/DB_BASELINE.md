## Neon DB baseline

Схема БД была приведена вручную через Neon SQL Editor.

Таблица Rounds:

- id
- state (VARCHAR)
- result (JSONB)
- startedAt (timestamptz)
- finishedAt (timestamptz)
- createdAt
- updatedAt

Таблица Bets:

- id
- amount
- choice (VARCHAR)
- payout (NUMERIC)
- userId
- roundId
- createdAt
- updatedAt
