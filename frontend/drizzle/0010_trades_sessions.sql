-- Migration 0010: Create trades and sessions tables with TimescaleDB hypertable
-- TimescaleDB hypertable for time-series optimization

-- Enable TimescaleDB extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create sessions table (already defined in Drizzle, this is for reference)
-- The actual DDL is managed by Drizzle ORM migrations
-- This migration adds TimescaleDB hypertable configuration

-- Convert trades table to TimescaleDB hypertable (after Drizzle creates it)
-- This will be executed as part of the migration after the table exists
SELECT create_hypertable('trades', 'created_at', if_not_exists => TRUE);

-- Data quality validation trigger
-- Validates P&L bounds and timestamp constraints
CREATE OR REPLACE FUNCTION validate_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate P&L is within reasonable bounds
  IF NEW.pnl < -100000 OR NEW.pnl > 100000 THEN
    RAISE WARNING 'Trade P&L % exceeds reasonable bounds (-100000 to 100000)', NEW.pnl;
  END IF;

  -- Validate timestamp is not in the future (allow 5 minute tolerance)
  IF NEW.created_at > NOW() + INTERVAL '5 minutes' THEN
    RAISE WARNING 'Trade timestamp is in the future: %', NEW.created_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to trades table
DROP TRIGGER IF EXISTS trg_validate_trade_pnl ON trades;
CREATE TRIGGER trg_validate_trade_pnl
  BEFORE INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION validate_trade_pnl();

-- Create index for session lookups (backup if not created by Drizzle)
CREATE INDEX IF NOT EXISTS idx_trades_session_sequence ON trades (session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_trades_session_created ON trades (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades (created_at);

-- Session indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_started ON sessions (user_id, started_at);
