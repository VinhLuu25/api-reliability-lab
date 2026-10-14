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

Project foundation created. Application implementation has not started.