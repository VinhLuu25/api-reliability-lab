# API Reliability Lab

A developer tool for reproducing API failures and investigating timeouts, retries, and duplicate operations.

## Planned first release

- A controlled order service backed by PostgreSQL.
- Saved scenarios for response delays, connection interruptions, and temporary service failures.
- A runner with bounded retries, deadlines, and cancellation.
- Attempt timelines and assertions about the final database state.
- A command-line interface and automated tests.

## Status

The backend currently supports:

- Health checks.
- Scenario creation, listing, and retrieval with PostgreSQL persistence.
- Runtime validation of scenario and order input.
- Order creation and retrieval.
- Idempotent order creation using a client-provided `Idempotency-Key`.
- Automated tests for retries, concurrent requests, conflicting input, and connection loss after an order is saved.

Scenarios and orders survive backend restarts.

Scenario-driven fault execution, the retry runner, attempt timelines, and the CLI are not implemented yet. Connection loss is currently reproduced through a controlled integration-test hook.

## Order reliability

`POST /api/orders` accepts a product code and quantity.

| Request | Result |
|---|---|
| No idempotency key | Creates a new order (`201`) |
| New key | Creates a new order (`201`) |
| Same key and same input | Returns the original order (`200`) |
| Same key and different input | Returns `409 IDEMPOTENCY_CONFLICT` |

PostgreSQL enforces idempotency-key uniqueness. Concurrent requests sharing the same key and input create only one order.

The key is stored with the order, so retries remain safe after a backend restart. This guarantee applies to order creation while the key is retained; it does not cover separate operations such as payments or emails.

## Run the backend locally

Start Docker Desktop, then run from the project root:

```bash
docker compose up -d --wait db
```

Inside the backend directory:

```bash
cd server
npm ci
```

For a fresh checkout, create `server/.env` and `server/.env.test` using `server/.env.example` as a reference. Configure separate development and test databases that match your local PostgreSQL setup.

Apply migrations to both databases:

```bash
npm run db:migrate
npm run db:migrate:test
```

Start the development server:

```bash
npm run dev
```

The API listens at http://127.0.0.1:3001.

## Run the order demo

With the development server running, open another terminal inside `server/`:

```bash
npm run demo:orders
```

The demo checks duplicate creation without a key, replay with a matching key, conflicting input, and concurrent requests.

The demo creates records in the development database.

## Check and test

Run inside `server/`:

```bash
npm run typecheck
npm test
npm run test:db
npm run build
```

To run only the order integration tests:

```bash
npm run test:orders
```

Database tests require PostgreSQL and the test migrations. They start their own HTTP application instances, so the development server does not need to be running.

## Run the compiled backend

Inside `server/`:

```bash
npm run build
npm start
```

Stop the development server before starting the compiled server on the same port.