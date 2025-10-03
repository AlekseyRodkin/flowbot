-- Create viral_triggers table for tracking viral triggers sent to users
CREATE TABLE IF NOT EXISTS viral_triggers (
  id BIGSERIAL PRIMARY KEY,
  user_telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- 'day7_invite', 'day14_reminder', etc
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_viral_triggers_user_id ON viral_triggers(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_viral_triggers_type ON viral_triggers(trigger_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_viral_triggers_user_type ON viral_triggers(user_telegram_id, trigger_type);

-- Add comment
COMMENT ON TABLE viral_triggers IS 'Tracks which viral triggers have been sent to users';
