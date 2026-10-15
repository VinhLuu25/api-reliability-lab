# API Reliability Lab

A developer tool for reproducing API failures and investigating
timeouts, retries, and duplicate operations.

## Planned first release

- A controlled order service backed by PostgreSQL.
- Saved scenarios for response delays, connection interruptions,
  and temporary service failures.
- A runner with bounded retries, deadlines, and cancellation.
- Attempt timelines and assertions about the final database state.
- A command-line interface and automated tests.

## Status

The local backend supports health checks and scenario creation,
listing, and retrieval.

Scenario input is validated at runtime. Scenarios are currently
stored in memory and are lost when the backend restarts.

Fault execution and PostgreSQL persistence are not implemented yet.

## Run the backend locally

```bash
cd server
npm ci
npm run dev
```

The API listens at http://127.0.0.1:3001.

## Check and build

```bash
cd server
npm run typecheck
npm run build
npm start
```

Stop the development server before starting the compiled server
on the same port.