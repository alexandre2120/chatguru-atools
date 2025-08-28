-- Migration to add server column to workspaces table
-- This allows the cron job to know which server to use for API calls

ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS server text;

-- Add comment explaining the field
COMMENT ON COLUMN workspaces.server IS 'ChatGuru server (e.g., s10, s20) for API calls. Temporarily stored for cron job access.';