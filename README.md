# API Reliability Lab

A fault-injection lab for write APIs. It asks one question: **when a client gets no response, did the operation fail?** Not necessarily. A request can be saved and its response lost, and a blind retry then creates a duplicate.

The lab models this with an order API (Node.js, Express, TypeScript, PostgreSQL). A client that retries without an idempotency key can create duplicate orders; with the same key, the server replays the original result.

> **Status: in development.** The API, database and tests run locally. Saved scenarios do not execute yet, and there is no web interface or public deployment. The roadmap below lists what is planned; none of it is a current capability.

## Why this exists

Timeouts, retries and lost responses are the everyday failure modes of distributed systems, and they are easy to get wrong. The goal is to reproduce them on demand, measure what they cost, and show which mechanisms (idempotency keys, bounded retries with backoff and jitter, deadlines) actually contain the damage.

## What works today

| Area | Available behavior |
| --- | --- |
| Health | `GET /api/health` |
| Scenarios | Create, list, and retrieve saved scenarios (including a validated execution configuration) in PostgreSQL |
| Orders | Create and retrieve PostgreSQL orders |
| Idempotency | Reuse `Idempotency-Key` to replay the same order, including after a server restart |
| Verification | Unit/API tests, PostgreSQL integration tests, and a local order demo |

For `POST /api/orders`, requests without a key create separate orders (`201`). A new key creates an order (`201`); the same key and identical input returns that order (`200`) with `Idempotency-Replayed: true`. Reusing a key with different input returns `409 IDEMPOTENCY_CONFLICT`. PostgreSQL's unique constraint handles concurrent requests sharing a key.

The guarantee applies to this order creation operation while the key is stored. It does not make unrelated side effects, such as a payment or an email, idempotent. A lost response after saving an order is reproduced in integration tests through a controlled hook; it is not an API feature exposed to visitors.

## Run locally

Requirements: Node.js 24, npm, Docker with Compose. Commands below assume the repository root unless preceded by `cd server`.

```bash
docker compose up -d --wait db
cd server
npm ci
cp .env.example .env
cp .env.example .env.test
```

Edit `server/.env.test` so `DATABASE_URL` ends in `/reliability_lab_test` rather than `/reliability_lab`. Create that separate test database once from the repository root (or from `server/` using `../compose.yaml`):

```bash
cd ..
docker compose exec db createdb -U lab reliability_lab_test
cd server
npm run db:migrate
npm run db:migrate:test
npm run dev
```

The API listens on `http://127.0.0.1:3001` (override with `HOST` and `PORT`). If the test database already exists, skip its creation. Keep development and test connection strings separate: integration tests write to the test database.

In another terminal, try an order and then repeat the exact request:

```bash
curl -i -X POST http://127.0.0.1:3001/api/orders \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: readme-order-1' \
  -d '{"productCode":"BOOK-01","quantity":2}'
```

The first response is `201`; the second is `200` and reports `Idempotency-Replayed: true`. Choose a new key if you already used this one in a previous run. Alternatively, from `server/` run `npm run demo:orders` while the API is running. The demo writes orders to the development database.

## API reference

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/scenarios` | Save a validated scenario |
| `GET` | `/api/scenarios` | List scenarios |
| `GET` | `/api/scenarios/:id` | Retrieve one scenario |
| `POST` | `/api/orders` | Create or replay an order |
| `GET` | `/api/orders/:id` | Retrieve one order |

Successful API responses wrap their payload in `data`; errors use `error` with a `code` and `message`. See the request and response cases in `server/test/` for executable examples.

## Checks

From `server/`, after the test database is migrated:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npm run test:db
npm run build
```

`npm run test:orders` runs only the order integration tests. Database integration tests start their own application instances; `npm run dev` is not required. To run compiled output, stop the dev server and use `npm start` after building.

## Roadmap

1. Run saved scenarios: a retry executor with per-attempt timeouts, an overall deadline, exponential backoff with jitter, and cancellation.
2. A network-level fault proxy that drops, delays or fails responses after the API has committed, and run history with an attempt timeline.
3. Stronger idempotency (stored responses, request fingerprints, expiry, in-flight handling) and a transactional outbox with a deduplicating consumer.
4. Metrics, logs and traces, plus reproducible load benchmarks that compare naive and keyed clients.
5. A web interface and a public deployment so visitors can run the experiments.

These are planned features, not current API capabilities.

## License

[MIT](LICENSE)
