-- Create bot_sessions table for storing Telegraf sessions
CREATE TABLE IF NOT EXISTS bot_sessions (
  session_key TEXT PRIMARY KEY,
  session_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bot_sessions_updated_at ON bot_sessions(updated_at);

-- Auto-delete old sessions (older than 30 days)
CREATE OR REPLACE FUNCTION delete_old_sessions() RETURNS trigger AS $$
BEGIN
  DELETE FROM bot_sessions WHERE updated_at < NOW() - INTERVAL '30 days';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_delete_old_sessions
  AFTER INSERT ON bot_sessions
  EXECUTE FUNCTION delete_old_sessions();

-- Add comment
COMMENT ON TABLE bot_sessions IS 'Stores Telegraf bot session data with automatic cleanup of old sessions';
