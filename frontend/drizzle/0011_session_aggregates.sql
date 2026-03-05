-- Migration 0011: Session aggregates trigger for atomic updates
-- Automatically updates session aggregates when a trade is inserted

-- Function to update session aggregates after trade insertion
CREATE OR REPLACE FUNCTION update_session_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  -- Increment trade count and update P&L
  UPDATE sessions
  SET
    trade_count = trade_count + 1,
    total_pnl = total_pnl + NEW.pnl,
    -- Update win/loss/breakeven counts based on outcome
    win_count = win_count + CASE WHEN NEW.outcome = 'win' THEN 1 ELSE 0 END,
    loss_count = loss_count + CASE WHEN NEW.outcome = 'loss' THEN 1 ELSE 0 END,
    breakeven_count = breakeven_count + CASE WHEN NEW.outcome = 'breakeven' THEN 1 ELSE 0 END,
    -- Update discipline and agency scores
    net_discipline_score = net_discipline_score + NEW.discipline_score,
    net_agency_score = net_agency_score + NEW.agency_score
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to trades table
DROP TRIGGER IF EXISTS trg_update_session_aggregates ON trades;
CREATE TRIGGER trg_update_session_aggregates
  AFTER INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION update_session_aggregates();

-- Function to automatically create session for new trading day
-- This is called before insert on trades
CREATE OR REPLACE FUNCTION get_or_create_session()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_session_id UUID;
  v_today DATE;
BEGIN
  -- Get user_id from the session (via foreign key to sessions table)
  -- The trade's session_id should already be set before this trigger
  -- This function is a placeholder for application-level logic

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a function to end a session (mark as completed)
CREATE OR REPLACE FUNCTION end_session(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET ended_at = NOW()
  WHERE id = p_session_id
    AND ended_at IS NULL;
END;
$$ LANGUAGE plpgsql;
