CREATE TABLE orders (
  id UUID PRIMARY KEY,
  product_code TEXT NOT NULL
    CHECK (product_code ~ '^[A-Za-z0-9_-]{1,64}$'),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  idempotency_key TEXT UNIQUE
    CHECK (idempotency_key ~ '^[A-Za-z0-9_-]{1,128}$'),
  created_at TIMESTAMPTZ NOT NULL
);
