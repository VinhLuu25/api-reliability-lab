# API Reliability Lab

An API reliability learning project built with Node.js, Express, TypeScript, and PostgreSQL. It currently stores test scenarios and orders, and demonstrates how an idempotency key makes order creation safe to retry after an uncertain response.

> **Current scope:** The API and database are available locally. Saved scenarios do not run yet. There is no web interface or public deployment yet; those are planned for the finished project.

## What works today

| Area | Available behavior |
| --- | --- |
| Health | `GET /api/health` |
| Scenarios | Create, list, and retrieve saved scenarios in PostgreSQL; validate input |
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

The API listens on `http://127.0.0.1:3001`. If the test database already exists, skip its creation. Keep development and test connection strings separate: integration tests write to the test database.

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
npm run typecheck
npm test
npm run test:db
npm run build
```

`npm run test:orders` runs only the order integration tests. Database integration tests start their own application instances; `npm run dev` is not required. To run compiled output, stop the dev server and use `npm start` after building.

## Next milestones

1. Store a validated execution configuration with each scenario.
2. Execute controlled faults and add a bounded retry runner with deadlines and cancellation.
3. Persist run history and attempt timelines, then provide a usable CLI.
4. Build a web interface that runs experiments and displays results; deploy the API, database, and site so visitors can try it online.

These are planned features, not current API capabilities.