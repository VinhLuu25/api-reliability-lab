CREATE TABLE scenarios (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL
    CHECK (char_length(title) <= 120 AND char_length(btrim(title)) > 0),
  attempt_timeout_ms INTEGER NOT NULL
    CHECK (attempt_timeout_ms BETWEEN 100 AND 10000),
  max_attempts INTEGER NOT NULL
    CHECK (max_attempts BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL
);
