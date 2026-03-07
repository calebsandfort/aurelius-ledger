# Database Migrations

This document covers database migration strategy and TimescaleDB configuration.

## Migration Strategy

The project uses Drizzle ORM's migration system. Migrations are defined in `/frontend/src/lib/db/schema/` and applied via Drizzle Kit.

## Running Migrations

```bash
cd frontend
pnpm drizzle-kit migrate
```

## Generating Migrations

```bash
pnpm drizzle-kit generate
```

## Core Migrations

### Users Table

Created by Better Auth. See: `/frontend/src/db/schema/auth.ts`

### Sessions Table

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  total_pnl NUMERIC(12, 2) NOT NULL DEFAULT '0',
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  breakeven_count INTEGER NOT NULL DEFAULT 0,
  net_discipline_score INTEGER NOT NULL DEFAULT 0,
  net_agency_score INTEGER NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
);

CREATE INDEX idx_sessions_user_started ON sessions(user_id, started_at);
```

### Trades Table

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  raw_input TEXT NOT NULL,
  direction VARCHAR(10) NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  pnl NUMERIC(10, 2) NOT NULL DEFAULT '0',
  setup_description VARCHAR(2000),
  discipline_score INTEGER NOT NULL DEFAULT 0,
  agency_score INTEGER NOT NULL DEFAULT 0,
  discipline_confidence VARCHAR(10) NOT NULL DEFAULT 'low',
  agency_confidence VARCHAR(10) NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
);

CREATE INDEX idx_trades_session_sequence ON trades(session_id, sequence_number);
CREATE INDEX idx_trades_session_created ON trades(session_id, created_at);
CREATE INDEX idx_trades_created_at ON trades(created_at);
```

## TimescaleDB Configuration

TimescaleDB is enabled for time-series optimization. The trades table can be converted to a hypertable:

```sql
SELECT create_hypertable('trades', 'created_at');
```

## Continuous Aggregates

For dashboard queries, create a continuous aggregate for hourly session stats:

```sql
CREATE MATERIALIZED VIEW session_hourly_stats
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', created_at) AS bucket,
  session_id,
  COUNT(*) AS trade_count,
  SUM(pnl) AS total_pnl,
  AVG(discipline_score) AS avg_discipline,
  AVG(agency_score) AS avg_agency
FROM trades
GROUP BY bucket, session_id;

-- Refresh policy
SELECT add_continuous_aggregate_policy('session_hourly_stats',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '5 minutes');
```

## Retention Policy

Auto-delete trades older than 1 year:

```sql
SELECT add_retention_policy('trades', INTERVAL '1 year');
```

## Docker Compose Setup

The database runs in Docker. See `docker-compose.yml`:

```yaml
services:
  db:
    image: timescale/timescaledb:latest-pg16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: aurelius
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
```

## Related Documentation

- [Database Schema](./schema.md)
- [Trade API Endpoints](./api/trades.md)
