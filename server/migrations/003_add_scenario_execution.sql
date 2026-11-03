ALTER TABLE scenarios
  ADD COLUMN execution JSONB NOT NULL DEFAULT '{
    "order": {
      "productCode": "BOOK-01",
      "quantity": 2
    },
    "idempotencyMode": "keyed",
    "fault": {
      "kind": "none"
    },
    "deadlineMs": 30000,
    "retry": {
      "baseDelayMs": 200,
      "maxDelayMs": 1000
    },
    "expectedOrderCount": 1
  }'::jsonb,

  ADD CONSTRAINT scenarios_execution_is_object
    CHECK (jsonb_typeof(execution) = 'object');