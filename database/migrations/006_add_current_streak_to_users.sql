-- Migration: Add current_streak column to users table
-- Date: 2025-10-15
-- Description: Add current_streak to users table for easier access and consistency with code expectations

-- Add current_streak column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;

-- Sync existing data from streaks table to users table
UPDATE users
SET current_streak = COALESCE(s.current_streak, 0)
FROM streaks s
WHERE users.telegram_id = s.telegram_id;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_current_streak ON users(current_streak);

-- Note: This creates denormalization - current_streak will exist in both users and streaks tables
-- This is intentional for performance and code simplicity
